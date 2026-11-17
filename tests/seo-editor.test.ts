import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderBlocksToHtml, sanitizeInline, sanitizeRawHtml } from '../src/lib/seo-system/sanitizer';
import { normalizeSettings, DEFAULT_SETTINGS } from '../src/lib/seo-system/settings-defaults';
import { validateCustomJsonLd } from '../src/lib/seo-system/schema-service';

test('sanitizeInline keeps formatting and safe links only (SEC-01)', () => {
  const out = sanitizeInline('<b>x</b> <img src=x onerror=alert(1)> <a href="javascript:alert(1)">j</a> <a href="/p" target="_blank">ok</a> 1 < 2 <script>bad()</script>');
  assert.ok(out.includes('<b>x</b>'));
  assert.ok(!/onerror|<img|<script|javascript:/i.test(out));
  assert.ok(out.includes('<a href="/p" target="_blank" rel="noopener">ok</a>'));
  assert.ok(out.includes('1 &lt; 2'));
});

test('video, button and gallery blocks render; unsafe values are dropped', () => {
  const html = renderBlocksToHtml([
    { type: 'button', data: { text: 'Book now', url: '/contact' } },
    { type: 'button', data: { text: 'Bad', url: 'javascript:alert(1)' } },
    { type: 'video', data: { url: 'https://youtu.be/abc', title: 'Intro' } },
    { type: 'video', data: { url: 'https://evil.example/x', title: 'No' } },
    { type: 'gallery', data: { images: [{ url: '/a.webp', alt: 'A' }, { url: 'javascript:x', alt: 'B' }] } },
  ] as any).html;
  assert.ok(html.includes('href="/contact"'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('youtu.be/abc'));
  assert.ok(!html.includes('evil.example'));
  assert.equal((html.match(/<img /g) || []).length, 1);
});

test('migrated raw_html blocks survive rendering and h1 becomes h2', () => {
  const html = renderBlocksToHtml([{ type: 'raw_html', data: { html: '<h1>Title</h1><p onclick="x()">Body</p><script>1</script>' } }] as any).html;
  assert.ok(html.includes('<h2>Title</h2>'));
  assert.ok(!/onclick|<script/i.test(html));
  assert.ok(html.includes('Body'));
  assert.equal(sanitizeRawHtml(''), '');
});

test('settings validation covers the retention, thin-content and domain lists', () => {
  const ok = normalizeSettings({ trashRetentionDays: 14, minWords: 400, trustedDomains: ['Example.gov.au', '', ' abs.gov.au '], brandAliases: 'Migration Factor\nMigrationFactor' });
  assert.equal(ok.trashRetentionDays, 14);
  assert.deepEqual(ok.trustedDomains, ['example.gov.au', 'abs.gov.au']);
  assert.equal(ok.brandAliases.length, 2);
  assert.throws(() => normalizeSettings({ trashRetentionDays: 3 }), /7 to 365/);
  assert.throws(() => normalizeSettings({ minWords: 10 }), /50 to 5000/);
  assert.equal(normalizeSettings({}).trashRetentionDays, DEFAULT_SETTINGS.trashRetentionDays);
});

test('custom JSON-LD must be valid JSON with @context and @type', () => {
  assert.ok(validateCustomJsonLd('{not json').errors.length > 0);
  assert.ok(validateCustomJsonLd('{"name":"x"}').errors.length > 0);
  const good = validateCustomJsonLd('{"@context":"https://schema.org","@type":"Organization","name":"Migration Factor"}');
  assert.equal(good.errors.length, 0);
  assert.ok(good.value);
});
