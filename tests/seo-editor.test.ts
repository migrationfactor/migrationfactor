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

import { buildChecklist } from '../src/lib/seo-system/rankmath-checks';

test('checklist uses the familiar wording for failing and passing states', () => {
  const body = '<p>Skills assessment explained. ' + 'word '.repeat(700) + '</p><h2>Skills assessment steps</h2><img src="a.webp" alt="Skills assessment" /><a href="https://www.homeaffairs.gov.au/x">Home Affairs</a><a href="/other">Other</a>';
  const good = buildChecklist({ focusKeyword: 'Skills Assessment', seoTitle: 'Skills Assessment Australia: 5 Steps', metaDescription: 'Skills assessment explained', url: 'https://migrationfactor.com/skills-assessment-australia/', bodyHtml: body, keywordUsedBefore: 0 });
  assert.equal(good.basic[0].message, "Hurray! You're using Focus Keyword in the SEO Title.");
  assert.ok(good.basic.every((c) => c.status === 'passed'));
  assert.equal(good.titleReadability[3].status, 'passed');
  assert.equal(good.additional[7].message, "You haven't used this Focus Keyword before.");

  const bad = buildChecklist({ focusKeyword: '', seoTitle: 'Visa guide', metaDescription: '', url: 'https://migrationfactor.com/' + 'x'.repeat(80), bodyHtml: '<p>short</p>', keywordUsedBefore: 0 });
  assert.equal(bad.basic[0].message, 'Add Focus Keyword to the SEO title.');
  assert.equal(bad.basic[1].message, 'Add Focus Keyword to your SEO Meta Description.');
  assert.equal(bad.basic[2].message, 'Use Focus Keyword in the URL.');
  assert.equal(bad.additional[7].message, 'Set a Focus Keyword for this content.');
  assert.equal(bad.titleReadability[3].message, "Your SEO title doesn't contain a number.");
  assert.equal(bad.contentReadability[2].message, 'You are not using rich media like images or videos.');
});

import { scoreSeo, gradeFor } from '../src/lib/seo-system/seo-score';

test('the 100-mark sheet adds up to 100 and grades correctly', () => {
  const para = '<p>' + 'skills assessment word '.repeat(10) + 'filler '.repeat(60) + '</p>';
  const body = '<p>Skills assessment explained.</p>' + para.repeat(8) + '<h2>Skills assessment steps</h2><h2>Next</h2><ul><li>a</li></ul><div class="toc">Table of Contents</div><img src="a.webp" alt="Skills assessment" /><a href="https://www.homeaffairs.gov.au/x">Home Affairs</a><a href="/other">Other</a>';
  const best = scoreSeo({ focusKeyword: 'Skills Assessment', seoTitle: 'Skills Assessment Australia: Complete Guide in 5 Steps', metaDescription: 'Skills assessment explained', url: 'https://migrationfactor.com/skills-assessment-australia/', bodyHtml: body, keywordUsedBefore: 0, robotsIndex: true, canonicalUrl: '', articleSchema: true, brokenLinks: 0 });
  assert.deepEqual(best.categories.map((c) => c.max), [30, 30, 15, 15, 10]);
  assert.equal(best.categories.reduce((a, c) => a + c.max, 0), 100);
  assert.ok(best.total >= 90, 'a well optimised post scores 90+, got ' + best.total);
  const empty = scoreSeo({ focusKeyword: '', seoTitle: '', metaDescription: '', url: 'https://migrationfactor.com/' + 'x'.repeat(90), bodyHtml: '', keywordUsedBefore: 0, robotsIndex: false });
  assert.ok(empty.total < 60);
  assert.equal(empty.grade, 'Poor');
  assert.deepEqual([95, 85, 75, 65, 40].map(gradeFor), ['Excellent', 'Very Good', 'Good', 'Needs Improvement', 'Poor']);
});
