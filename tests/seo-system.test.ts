import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateCanonicalUrl } from '../src/lib/seo-system/posts-service';
import { testRobotsRule } from '../src/lib/seo-system/workflow-service';
import { hasPermission, canEditPost } from '../src/lib/seo-system/rbac';

test('canonical validation rejects dangerous or malformed values (SEC-04)', () => {
  assert.equal(validateCanonicalUrl(''), null);
  assert.equal(validateCanonicalUrl(null), null);
  assert.equal(validateCanonicalUrl('https://migrationfactor.com/blog/a/'), 'https://migrationfactor.com/blog/a/');
  assert.throws(() => validateCanonicalUrl('javascript:alert(1)'), /https/);
  assert.throws(() => validateCanonicalUrl('/relative/path/'), /absolute/);
  assert.throws(() => validateCanonicalUrl('https://migrationfactor.com/a/#frag'), /fragment/);
});

test('robots.txt tester uses longest match and honours Allow overrides', () => {
  const robots = 'User-agent: *\nDisallow: /api/\nDisallow: /blog/private/\nAllow: /blog/private/ok/\n';
  assert.equal(testRobotsRule(robots, '/blog/skills-in-demand-visa-australia/').allowed, true);
  assert.equal(testRobotsRule(robots, '/api/v1/posts').allowed, false);
  assert.equal(testRobotsRule(robots, '/blog/private/x').allowed, false);
  const allowed = testRobotsRule(robots, '/blog/private/ok/page');
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.matchedRule, 'Allow: /blog/private/ok/');
  assert.equal(testRobotsRule('User-agent: *\nDisallow: /\n', '/anything').allowed, false);
});

test('permission matrix matches SRS 18.1 for the sensitive rows', () => {
  assert.equal(hasPermission(['author'], 'post.publish'), false);
  assert.equal(hasPermission(['author'], 'seo.edit_advanced'), false);
  assert.equal(hasPermission(['editor'], 'robots.edit'), false);
  assert.equal(hasPermission(['editor'], 'redirects.edit'), false);
  assert.equal(hasPermission(['admin'], 'gsc.connect'), false);
  assert.equal(hasPermission(['seo_manager'], 'robots.edit'), true);
  assert.equal(hasPermission(['super_admin'], 'gsc.connect'), true);
});

test('authors can only edit their own drafts and pending posts', () => {
  const author = { id: 'u1', email: 'a@x.com', name: 'A', roles: ['author'] as any, status: 'active' };
  assert.equal(canEditPost(author, { created_by: 'u1', status: 'draft' }), true);
  assert.equal(canEditPost(author, { created_by: 'u1', status: 'published' }), false);
  assert.equal(canEditPost(author, { created_by: 'u2', status: 'draft' }), false);
  const editor = { ...author, roles: ['editor'] as any };
  assert.equal(canEditPost(editor, { created_by: 'u2', status: 'published' }), true);
});

test('stored Google credentials round-trip through AES-256-GCM and reject tampering', async () => {
  process.env.SEO_ENCRYPTION_KEY = 'unit-test-key-0123456789abcdef';
  const { encryptSecret, decryptSecret } = await import('../src/lib/seo-system/secret-box');
  const sealed = encryptSecret('{"refreshToken":"1//abc"}');
  assert.ok(!sealed.includes('refreshToken'));
  assert.equal(decryptSecret(sealed), '{"refreshToken":"1//abc"}');
  assert.notEqual(encryptSecret('x'), encryptSecret('x'));
  const [iv, tag, data] = sealed.split('.');
  assert.throws(() => decryptSecret(`${iv}.${tag}.${Buffer.from('tampered').toString('base64')}`));
});

test('image bytes decide type and size, not the filename', async () => {
  const { readImageMeta } = await import('../src/lib/seo-system/image-meta');
  const png = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
  png.writeUInt32BE(1600, 16);
  png.writeUInt32BE(900, 20);
  assert.deepEqual(readImageMeta(png), { mime: 'image/png', width: 1600, height: 900 });
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x03, 0x84, 0x06, 0x40, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(readImageMeta(jpeg), { mime: 'image/jpeg', width: 1600, height: 900 });
  assert.equal(readImageMeta(Buffer.from('<?php echo 1; ?> not an image at all')), null);
});

test('title template is a fallback and settings validate with plain messages', async () => {
  const { applyTitleTemplate, normalizeSettings, DEFAULT_SETTINGS } = await import('../src/lib/seo-system/settings-defaults');
  assert.equal(applyTitleTemplate('%title% %sep% %sitename%', { title: 'Visa Guide', siteName: 'Migration Factor', separator: 'pipe' }), 'Visa Guide | Migration Factor');
  assert.equal(applyTitleTemplate('%sitename% %sep% %title%', { title: 'A', siteName: 'B', separator: 'emdash' }), 'B — A');
  assert.throws(() => normalizeSettings({ titleTemplate: 'no variable' }), /%title%/);
  assert.throws(() => normalizeSettings({ twitterSite: 'nohandle' }), /@/);
  assert.throws(() => normalizeSettings({ organization: { sameAs: ['javascript:alert(1)'] } }), /URL/);
  assert.equal(normalizeSettings({ autoTocMinH2: 4 }, DEFAULT_SETTINGS).autoTocMinH2, 4);
});

test('article renderer adds AVIF/WebP pictures and an automatic TOC', async () => {
  const { renderArticleBody } = await import('../src/lib/seo-system/article-render');
  const html = '<p>Intro</p><h2 id="a">A</h2><p>x</p><h2 id="b">B &amp; C</h2><img src="/uploads/x.jpg" alt="Alt" width="800" height="400" loading="lazy" />';
  const out = renderArticleBody(html, { autoTocMinH2: 2 });
  assert.match(out, /<nav class="table-of-contents"[\s\S]*href="#a"[\s\S]*B &amp; C/);
  assert.match(out, /<source type="image\/avif" srcset="\/_next\/image\?url=%2Fuploads%2Fx\.jpg&w=640&q=75 640w/);
  assert.match(out, /<source type="image\/webp"/);
  assert.match(out, /<img[^>]*src="\/uploads\/x\.jpg"[^>]*alt="Alt"/);
  assert.equal(renderArticleBody(html, { autoTocMinH2: 3 }).includes('table-of-contents'), false);
  assert.ok(!renderArticleBody('<img src="https://other.com/a.jpg" alt="x">').includes('<picture'));
});
