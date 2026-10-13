import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function setup() {
  let pathname = '/';
  let active = true;
  let effect;
  let id = 0;
  const frames = new Map();
  const timers = new Map();
  const listeners = new Map();
  class Element {
    constructor(link) { this.link = link; }
    closest() { return this.link; }
  }
  const add = (name, handler) => listeners.set(name, handler);
  const remove = (name, handler) => { if (listeners.get(name) === handler) listeners.delete(name); };
  const location = { href: 'https://migrationfactor.com/', pathname: '/' };
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/components/shared/PageLoader.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, Element, URL,
    document: { addEventListener: add, removeEventListener: remove },
    window: { location, addEventListener: add, removeEventListener: remove },
    requestAnimationFrame: (callback) => { frames.set(++id, callback); return id; },
    cancelAnimationFrame: (key) => frames.delete(key),
    setTimeout: (callback, delay) => { timers.set(++id, { callback, delay }); return id; },
    clearTimeout: (key) => timers.delete(key),
    require: (name) => name === 'react' ? {
      useState: () => [active, (value) => { active = value; }],
      useEffect: (fn) => { effect = fn; },
    } : name === 'next/navigation' ? { usePathname: () => pathname } : { jsx: () => null, jsxs: () => null },
  });
  const mount = () => { exports.default(); return effect(); };
  const paint = () => { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); };
  const click = (href, options = {}) => listeners.get('click')({
    button: 0, target: new Element({ href, target: '', hasAttribute: () => false, ...options.link }), ...options,
  });
  return { mount, paint, click, frames, timers, listeners, location, active: () => active,
    route: (path) => { pathname = path; location.pathname = path; location.href = `https://migrationfactor.com${path}`; },
  };
}

test('initial loader clears after the page paints, without waiting for images or an artificial delay', () => {
  const app = setup(); const cleanup = app.mount();
  assert.equal(app.active(), true);
  app.paint(); assert.equal(app.active(), true);
  app.paint(); assert.equal(app.active(), false);
  assert.equal(app.timers.size, 0);
  cleanup();
});

test('internal navigation shows bars and route commit releases the overlay', () => {
  const app = setup(); let cleanup = app.mount(); app.paint(); app.paint();
  app.click('https://migrationfactor.com/about/'); assert.equal(app.active(), true);
  cleanup(); app.route('/about'); cleanup = app.mount(); app.paint(); app.paint();
  assert.equal(app.active(), false); assert.equal(app.timers.size, 0); cleanup();
});

test('hashes, current route, external URLs, new tabs, downloads and modified clicks stay untouched', () => {
  const app = setup(); const cleanup = app.mount(); app.paint(); app.paint();
  for (const [href, options] of [
    ['https://migrationfactor.com/#coaching', {}], ['https://migrationfactor.com/?q=test', {}],
    ['https://example.com/', {}], ['mailto:info@migrationfactor.com', {}],
    ['https://migrationfactor.com/about', { ctrlKey: true }],
    ['https://migrationfactor.com/about', { defaultPrevented: true }],
    ['https://migrationfactor.com/about', { button: 1 }],
    ['https://migrationfactor.com/about', { link: { target: '_blank' } }],
    ['https://migrationfactor.com/about', { link: { hasAttribute: () => true } }],
  ]) {
    app.click(href, options); assert.equal(app.active(), false, href);
  }
  assert.equal(app.timers.size, 0); cleanup();
});

test('cancelled or failed navigation never leaves visitors trapped behind the loader', () => {
  const app = setup(); const cleanup = app.mount(); app.paint(); app.paint();
  app.click('https://migrationfactor.com/about');
  const watchdog = [...app.timers.values()][0]; assert.equal(watchdog.delay, 5000);
  watchdog.callback(); assert.equal(app.active(), false); cleanup();
});

test('back/forward and browser restored pages clear correctly', () => {
  const app = setup(); let cleanup = app.mount(); app.paint(); app.paint();
  app.location.pathname = '/about'; app.listeners.get('popstate')(); assert.equal(app.active(), true);
  cleanup(); app.route('/about'); cleanup = app.mount(); app.paint(); app.paint();
  app.click('https://migrationfactor.com/contact'); assert.equal(app.active(), true);
  app.listeners.get('pageshow')(); app.paint(); app.paint(); assert.equal(app.active(), false); cleanup();
});

test('Strict Mode and route cleanup remove listeners, timers and pending frames', () => {
  const app = setup(); app.mount()(); const cleanup = app.mount();
  assert.equal(app.listeners.size, 3); app.click('https://migrationfactor.com/about'); cleanup();
  assert.equal(app.listeners.size, 0); assert.equal(app.frames.size, 0); assert.equal(app.timers.size, 0);
});
