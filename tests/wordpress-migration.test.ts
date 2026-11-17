import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHead, decodeEntities } from '../scripts/wordpress-migration/extract-rankmath';
import { parseRobots, pathOf, transformPost, type WpPost } from '../scripts/wordpress-migration/transform-post';

const html = `<html><head><title>A &amp; B - Site</title>
<meta name="description" content="Desc &#8211; here"/>
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large"/>
<link rel="canonical" href="https://example.com/post/" />
<meta property="og:title" content="OG T" /><meta property="og:image" content="https://example.com/a.webp" /><meta name="twitter:card" content="summary_large_image" />
<script type="application/ld+json" class="rank-math-schema">{"@graph":[{"@type":"BlogPosting","keywords":"main kw,second"}]}</script>
</head><body></body></html>`;

test('parseHead extracts Rank Math head fields and decodes entities', () => {
  const h = parseHead(html);
  assert.equal(h.title, 'A & B - Site');
  assert.equal(h.description, 'Desc – here');
  assert.equal(h.canonical, 'https://example.com/post/');
  assert.deepEqual(h.og['og:title'], ['OG T']);
  assert.deepEqual(h.twitter['twitter:card'], ['summary_large_image']);
  assert.equal(h.jsonld.length, 1);
});

test('parseRobots maps directives and defaults to indexable', () => {
  const r = parseRobots('noindex, nofollow, max-snippet:50');
  assert.equal(r.index, false);
  assert.equal(r.follow, false);
  assert.equal(r.advanced.max_snippet, 50);
  assert.equal(parseRobots(null).index, true);
});

test('pathOf keeps the WordPress trailing slash', () => {
  assert.equal(pathOf('https://example.com/a-post'), '/a-post/');
  assert.equal(pathOf('https://example.com/a-post/'), '/a-post/');
});

test('transformPost keeps content HTML untouched and uses UTC dates', () => {
  const body = '<h2 id="x">Hi &amp; bye</h2>\n<p>Text <a href="/y/">link</a></p>';
  const post = {
    id: 1, date: '2026-01-02T03:04:05', date_gmt: '2026-01-02T03:04:05', modified: '2026-01-03T03:04:05', modified_gmt: '2026-01-03T03:04:05', slug: 'a-post', status: 'publish',
    link: 'https://example.com/a-post/', title: { rendered: 'Tom &amp; Jerry' }, content: { rendered: body }, excerpt: { rendered: '<p>Ex</p>' },
    author: 2, featured_media: 0, categories: [3], tags: [],
  } as WpPost;
  const t = transformPost(post, { media: [] }, null);
  assert.equal(t.bodyHtml, body);
  assert.equal(t.title, 'Tom & Jerry');
  assert.equal(t.legacyPath, '/a-post/');
  assert.equal(t.publishedAt, '2026-01-02T03:04:05.000Z');
  assert.ok(t.warnings.includes('no Rank Math data captured'));
});

test('decodeEntities handles numeric and named entities', () => {
  assert.equal(decodeEntities('&#8217;&amp;&hellip;'), '’&…');
});
