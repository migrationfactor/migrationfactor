import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ServicePage from '../src/components/pages/ServicePage';
import { services, getService, getServiceSeo, type Service } from '../src/content/services';
import { getServicePage } from '../src/content/service-pages';
import studentVisa500 from '../src/content/visa-subclasses/student-visa-500';
import { studentVisa } from '../src/content/service-pages/student-visa';
import { visaSubclasses } from '../src/content/visa-subclasses/catalog';
import { getVisaArticle } from '../src/content/visa-subclasses';

test('Service catalogue supports unique routes and unknown routes are not guessed', () => {
  assert.equal(new Set(services.map(service => service.slug)).size, services.length);
  for (const service of services) assert.match(service.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(getService('not-a-real-service'), undefined);
  assert.equal(getService('student-visa')?.name, 'Student Visa');
});

test('Shared page renders long service copy, lists and safe text without changing its layout', () => {
  const service: Service = {
    ...services[0], intro: ['Extended introduction.', 'A second introduction paragraph.'],
    sections: [
      { id: 'documents', heading: 'Documents', paragraphs: ['First detail.', 'Second detail.'], items: ['Document A', 'Document B'] },
      { heading: 'More information', paragraphs: ['<script>alert("unsafe")</script>'] },
    ],
  };
  const html = renderToStaticMarkup(createElement(ServicePage, { service }));
  assert.match(html, /class="container detail-layout"/);
  assert.match(html, /class="service-sidebar"/);
  assert.match(html, /class="lead">Extended introduction\./);
  assert.match(html, /A second introduction paragraph\./);
  assert.match(html, /Document A/);
  assert.match(html, /id="documents"/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /Start with your circumstances/);
  assert.match(html, /service=Student%20Visa/);
});

test('Default service copy and optional SEO overrides remain independent of long body text', () => {
  const original = services[0];
  const html = renderToStaticMarkup(createElement(ServicePage, { service: original }));
  assert.match(html, /Start with your circumstances/);
  assert.match(html, /Understand your next steps/);
  assert.equal(getServiceSeo(original).title, 'Student Visa');
  const overridden = { ...original, intro: ['Long body text.'], seo: { title: 'Specific title', description: 'Specific description' } };
  assert.deepEqual(getServiceSeo(overridden), { title: 'Specific title', description: 'Specific description' });
});

test('Main Student Visa uses the supplied study guide and keeps subclass 500 content separate', () => {
  const service = getServicePage('student-visa')!;
  assert.equal(service.slug, 'student-visa');
  assert.deepEqual(service.intro, studentVisa.intro);
  assert.deepEqual(service.sections, studentVisa.sections);
  assert.notDeepEqual(service.sections, studentVisa500.sections);
  const html = renderToStaticMarkup(createElement(ServicePage, { service }));
  for (const section of studentVisa.sections) assert.ok(html.includes(`id="${section.id}"`), section.heading);
  assert.equal(service.sections?.length, 18);
  assert.match(html, /How to Choose a Course and Provider/);
  assert.match(html, /When Do Intakes Start/);
  assert.match(html, /Scholarships and Funding/);
  assert.match(html, /\/services\/student\/subclass-visa-500/);
  assert.match(html, /On this page/);
  assert.match(html, /class="service-sidebar"/);
  assert.match(html, /service=Student%20Visa/);
  assert.doesNotMatch(html, /class="pv-wrap"|\{\{consultation\}\}/);
  assert.equal(getServiceSeo(service).title, 'Study in Australia for International Students');
});

test('Supplied main-service documents render complete sections, FAQs and consultation links', () => {
  const expected = [
    ['partner-visa', 'Australia Partner Visa: Choosing the Right Pathway and Planning Your Application', 19, 12],
    ['business-migration', 'Australia Business Migration: What Is Available Now and How to Plan', 17, 11],
    ['humanitarian-protection', 'Australia Humanitarian and Protection Visas: Pathways, Requirements and What to Expect', 20, 12],
    ['parent-visa', 'Australia Parent Visa: Choosing the Right Pathway for Your Parents', 16, 12],
    ['skilled-visa', 'Australia Skilled Migration: Choosing a Pathway and Planning Your Journey', 17, 12],
    ['australian-citizenship', 'Australian Citizenship: Requirements, Eligibility and How to Apply', 20, 12],
    ['employer-sponsored-visa', 'Australia Employer Sponsored Visa: Requirements, Process and Pathways to Permanent Residence', 19, 12],
  ] as const;
  const titles = new Set<string>();
  for (const [slug, heading, count, faqCount] of expected) {
    const page = getServicePage(slug)!;
    assert.equal(page.heading, heading, slug);
    assert.equal(page.sections?.length, count, slug);
    const sections = page.sections!;
    assert.equal(new Set(sections.map(section => section.id)).size, count, `${slug}: unique contents anchors`);
    const faq = sections.find(section => section.heading === 'Frequently Asked Questions')!;
    assert.equal(faq.blocks?.filter(block => block.type === 'heading').length, faqCount, `${slug}: complete FAQ`);
    const html = renderToStaticMarkup(createElement(ServicePage, { service: page }));
    for (const section of sections) assert.ok(html.includes(`id="${section.id}"`), `${slug}: ${section.heading}`);
    assert.match(html, /On this page/);
    assert.match(html, /class="service-faqs"/);
    assert.ok(html.includes(`service=${encodeURIComponent(page.name)}`));
    assert.doesNotMatch(html, /INSERT VERIFIED|\{\{consultation\}\}|class="pv-wrap"|Start with your circumstances/);
    titles.add(getServiceSeo(page).title);
  }
  assert.equal(titles.size, expected.length);
});

test('Main service pages do not resolve subclass guides or copy their long content', () => {
  for (const summary of services) {
    assert.equal(getVisaArticle(summary.slug), undefined, summary.slug);
    const main = getServicePage(summary.slug)!;
    assert.equal(main.slug, summary.slug);
    assert.equal(main.name, summary.name);
    for (const visa of visaSubclasses) {
      const article = getVisaArticle(visa.slug)!;
      assert.notEqual(main.sections, article.sections, `${summary.slug}: copied subclass sections`);
      assert.ok(!(main.intro ?? [main.description]).includes(article.intro[0]), `${summary.slug}: copied subclass introduction`);
    }
    const html = renderToStaticMarkup(createElement(ServicePage, { service: main }));
    assert.doesNotMatch(html, /class="pv-wrap"/);
  }
  for (const visa of visaSubclasses) assert.ok(getVisaArticle(visa.slug), visa.slug);
  const parent = getServicePage('parent-visa')!;
  assert.equal(parent.name, 'Parent Visa');
  assert.doesNotMatch(renderToStaticMarkup(createElement(ServicePage, { service: parent })), /Balance of Family Test and What to Expect/);
  assert.ok(getVisaArticle('aged-parent-visa-804')?.sections.length);
});
