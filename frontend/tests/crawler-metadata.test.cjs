const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { resolveRobots, resolveSitemap } = require('next/dist/build/webpack/loaders/metadata/resolve-route-data');

function load(relative, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relative), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, URL, AbortSignal,
    process: { env: {} }, require: name => dependencies[name] ?? require(name), ...globals });
  return module.exports;
}
const routes = load('lib/routes.ts');

test('robots serializes as plain-text rules with a sitemap and all private routes excluded', () => {
  const origin = load('lib/site-origin.ts');
  const robots = load('app/robots.ts', { '@/lib/site-origin': origin }).default();
  const text = resolveRobots(robots);
  assert.match(text, /User-Agent: \*\nAllow: \/\n/);
  assert.match(text, /Sitemap: https:\/\/ancienttrails\.tech\/sitemap\.xml/);
  for (const route of ['/me/account', '/booking-confirmed/id', '/booking-submitted/id', '/booking/recover/id', '/bank-transfer/id', '/login', '/api/auth']) {
    assert.ok(robots.rules.disallow.some(pattern => new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')).test(route)), route);
  }
});

test('public origin is configurable and ignores trailing paths or query parameters', () => {
  const origin = load('lib/site-origin.ts', {}, { process: { env: { SITE_URL: 'https://travel.example/path?preview=true' } } });
  assert.equal(origin.getSiteOrigin(), 'https://travel.example');
  const invalid = load('lib/site-origin.ts', {}, { process: { env: { SITE_URL: 'file:///tmp' } } });
  assert.throws(() => invalid.getSiteOrigin(), /HTTP or HTTPS/);
});

function sitemapFixture(failure) {
  const requests = [];
  const updatedAt = '2026-10-20T10:00:00.000Z';
  const dependencies = {
    '@/lib/api': { apiBaseUrl: 'https://api.example' },
    '@/lib/routes': routes,
    '@/lib/site-origin': { getSiteOrigin: () => 'https://travel.example' },
  };
  const fetch = async (url, options) => {
    requests.push({ url, options });
    if (failure && url.endsWith('/api/tours')) return { ok: false, status: 503 };
    let data;
    if (url.endsWith('/api/tours')) data = { tours: [{ tourId: 'T1', tourName: 'Hampi & Badami', updatedAt }, { tourId: 'T2', tourName: 'Hampi & Badami', updatedAt }] };
    else if (url.endsWith('/api/destinations')) data = { destinations: [{ destinationId: 'D1', destinationName: 'Tamil Nadu', updatedAt: 'invalid' }] };
    else if (url.endsWith('/api/experiences')) data = { experiences: [{ id: 'review-1', status: 'Published', updatedAt }, { id: 'private-review', status: 'Draft', updatedAt }] };
    else if (url.endsWith('page=1&limit=100')) data = { blogs: [{ slug: 'heritage-story', status: 'Published', updatedAt }, { slug: 'unpublished-story', status: 'Draft', updatedAt }], total: 101 };
    else if (url.endsWith('page=2&limit=100')) data = { blogs: [{ slug: 'older-story', status: 'Published', updatedAt }], total: 101 };
    else throw Error('Unexpected request ' + url);
    return { ok: true, json: async () => ({ success: true, data }) };
  };
  return { sitemap: load('app/sitemap.ts', dependencies, { fetch }).default, requests };
}

test('sitemap XML includes canonical public pages, every blog page and valid modification dates', async () => {
  const fixture = sitemapFixture();
  const entries = await fixture.sitemap();
  const urls = entries.map(entry => entry.url);
  for (const route of ['', '/tours', '/destinations', '/tour-calendar', '/about', '/contact', '/blog', '/tours/hampi-badami', '/destinations/tamil-nadu', '/experiences/review-1', '/blog/heritage-story', '/blog/older-story']) {
    assert.ok(urls.includes('https://travel.example' + route), route);
  }
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every(url => !/\/(me|booking|bank-transfer|login|api)(?:[/-]|$)|unpublished|private-review/.test(new URL(url).pathname)));
  const xml = resolveSitemap(entries);
  assert.match(xml, /^<\?xml/);
  assert.match(xml, /<loc>https:\/\/travel\.example\/blog\/older-story<\/loc>/);
  assert.match(xml, /<lastmod>2026-10-20T10:00:00.000Z<\/lastmod>/);
  assert.doesNotMatch(xml, /Invalid Date/);
  assert.equal(fixture.requests.length, 5);
  assert.ok(fixture.requests.every(request => request.options.next.revalidate === 3600));
});

test('API outages fail generation instead of publishing an incomplete sitemap', async () => {
  await assert.rejects(sitemapFixture(true).sitemap(), /returned 503/);
});
