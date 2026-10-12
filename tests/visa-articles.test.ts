import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { visaSubclasses } from '../src/content/visa-subclasses/catalog';
import { getVisaArticle } from '../src/content/visa-subclasses';
import VisaArticlePage from '../src/components/pages/VisaArticlePage';

test('Every unique supplied visa article has a route, its own copy and unique section anchors', () => {
  assert.equal(visaSubclasses.length, 12);
  assert.equal(new Set(visaSubclasses.map(visa => visa.slug)).size, 12);
  assert.equal(getVisaArticle('missing-subclass'), undefined);
  for (const summary of visaSubclasses) {
    const article = getVisaArticle(summary.slug)!;
    assert.ok(article.intro.length > 0);
    assert.ok(article.sections.length >= 18);
    const ids = article.sections.map(section => section.id);
    assert.equal(new Set(ids).size, ids.length, summary.slug);
    assert.ok(article.sections.some(section => section.heading === 'Frequently Asked Questions'));
    const html = renderToStaticMarkup(createElement(VisaArticlePage, { visa: article }));
    assert.doesNotMatch(html, /INSERT VERIFIED|migrationrepublic\.com|immigrationagentnearme\.com|font-family:Inter/);
    assert.match(html, /class="subclass-hero-row"/);
    assert.match(html, /class="subclass-faq"/);
    assert.match(html, /cta-section/);
    assert.ok(html.includes(article.officialUrl));
    assert.ok(html.includes(encodeURIComponent(article.name)));
  }
});

test('One shared visa design renders each document’s steps and FAQ answers without copying another visa', () => {
  const student = getVisaArticle('student-visa-500')!;
  const skilled = getVisaArticle('skilled-independent-visa-189')!;
  const studentHtml = renderToStaticMarkup(createElement(VisaArticlePage, { visa: student }));
  const skilledHtml = renderToStaticMarkup(createElement(VisaArticlePage, { visa: skilled }));
  assert.match(studentHtml, /Genuine Student/);
  assert.match(skilledHtml, /Expression of Interest/);
  assert.match(studentHtml, /class="subclass-steps"/);
  assert.match(skilledHtml, /class="subclass-steps"/);
  assert.doesNotMatch(studentHtml, /MARA-registered/);
  assert.doesNotMatch(studentHtml, /<script>alert/);
});
