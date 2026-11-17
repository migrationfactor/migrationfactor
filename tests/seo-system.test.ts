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
