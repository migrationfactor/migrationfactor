import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ServicePage from '../src/components/pages/ServicePage';
import { services, getService, getServiceSeo, type Service } from '../src/content/services';

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
