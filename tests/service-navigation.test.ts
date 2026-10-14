import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceNavigation } from '../src/content/service-navigation';
import { visaSubclasses } from '../src/content/visa-subclasses/catalog';
import { visaPath } from '../src/lib/visa-path';

test('Service submenus link every existing subclass once under its own service', () => {
  const children = serviceNavigation.flatMap(service => service.children);
  assert.equal(children.length, visaSubclasses.length);
  assert.equal(new Set(children.map(child => child.href)).size, children.length);
  for (const visa of visaSubclasses) {
    const parent = serviceNavigation.find(service => service.slug === visa.parentSlug);
    assert.ok(parent?.children.some(child => child.href === visaPath(visa.slug) && child.label === visa.name), visa.slug);
  }
  assert.deepEqual(serviceNavigation.find(service => service.slug === 'student-visa')?.children.map(child => child.href), ['/services/student/subclass-visa-500']);
  assert.equal(serviceNavigation.find(service => service.slug === 'australian-citizenship')?.children.length, 0);
  assert.ok(serviceNavigation.find(service => service.slug === 'parent-visa')?.children.some(child => child.href === '/services/aged-parent/subclass-visa-804'));
  assert.ok(children.every(child => !serviceNavigation.some(service => service.href.replace(/\/$/, '') === child.href)));
});
