const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, dependencies = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, URL,
    require: name => dependencies[name] ?? require(name) });
  return module.exports;
}
const origin = { getSiteOrigin: () => 'https://travel.example' };
const seo = load('lib/seo.ts', { './site-origin': origin });
const schemas = load('lib/structured-data.ts', {
  './site-origin': origin, './seo': seo, './routes': load('lib/routes.ts'),
  './tour-departures': load('lib/tour-departures.ts'),
  './home-travel': { getHomeMediaUrl: value => value.startsWith('/uploads/') ? 'https://api.example' + value : value },
});
const { JsonLd } = load('components/seo/json-ld.tsx');
const tour = { tourId: 'T1', tourName: 'Temple Trail', destinationId: 'D1', destinationIds: ['D1'], description: 'Explore ancient temples.', bannerImage: '/uploads/temple.jpg', galleryImages: [] };
const departure = { id: 'departure-1', departureId: 'DEP1', tourId: 'T1', departureDate: '2099-12-15', returnDate: '2099-12-20', bookingDeadline: '2099-12-01', status: 'scheduled', priceAdult: 42000, seatsAvailable: 12, totalSeats: 12, filledSeats: 0 };
const parseSchema = html => JSON.parse(html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1]);

test('JSON-LD cannot close its script or inject HTML, and still decodes to the original data', () => {
  const data = { '@context': 'https://schema.org', '@type': 'Thing', name: '</script><img src=x onerror=alert(1)>\u2028' };
  const html = renderToStaticMarkup(React.createElement(JsonLd, { data }));
  assert.equal((html.match(/<script/g) || []).length, 1);
  assert.equal((html.match(/<\/script>/g) || []).length, 1);
  assert.doesNotMatch(html, /<img/);
  assert.deepEqual(parseSchema(html), data);
});

test('tour graph contains the actual trip, canonical breadcrumbs, itinerary and live INR price', () => {
  const graph = schemas.tourStructuredData(tour, [departure], { days: [{ dayNumber: 1, placesVisited: ['Stone Temple'] }] }, [])['@graph'];
  const trip = graph.find(item => item['@type'] === 'TouristTrip');
  assert.equal(trip.name, tour.tourName);
  assert.equal(trip.url, 'https://travel.example/tours/temple-trail');
  assert.equal(trip.image, 'https://api.example/uploads/temple.jpg');
  assert.equal(trip.offers.price, 42000);
  assert.equal(trip.offers.priceCurrency, 'INR');
  assert.equal(trip.itinerary.itemListElement[0].item.name, 'Stone Temple');
  const crumbs = graph.find(item => item['@type'] === 'BreadcrumbList').itemListElement;
  assert.equal(crumbs[0].name, 'Home');
  assert.equal(crumbs[1].name, 'Tours');
  assert.equal(crumbs[2].item, trip.url);
});

test('past, sold-out, cancelled and coming-soon departures never generate an available offer', () => {
  for (const departures of [[], [{ ...departure, departureDate: '2000-01-01' }], [{ ...departure, status: 'coming_soon' }], [{ ...departure, status: 'cancelled' }], [{ ...departure, filledSeats: 12, seatsAvailable: 0 }]]) {
    const graph = schemas.tourStructuredData(tour, departures, null, [])['@graph'];
    assert.equal(graph[0].offers, undefined);
  }
});

test('FAQ schema uses nonempty published questions and answers without inventing defaults', () => {
  const data = schemas.faqStructuredData([{ items: [{ question: 'How do I book?', answer: 'Choose a tour and departure.' }, { question: 'How do I book?', answer: 'Choose a tour and departure.' }, { question: '', answer: '' }] }]);
  assert.equal(data['@type'], 'FAQPage');
  assert.equal(data.mainEntity.length, 1);
  assert.equal(data.mainEntity[0].acceptedAnswer.text, 'Choose a tour and departure.');
  assert.equal(schemas.faqStructuredData([]), null);
});

test('organization details come from site settings and absent contact details stay absent', () => {
  const data = schemas.organizationStructuredData({ logo: '/uploads/logo.png', socialLinks: { facebook: 'https://facebook.com/example', instagram: '' }, contact: { emailId: 'team@example.test', primaryCalling: '+91 1234567890', officeAddress: 'Published office address' } });
  assert.equal(data.logo, 'https://api.example/uploads/logo.png');
  assert.equal(data.sameAs.length, 1);
  assert.equal(data.email, 'team@example.test');
  const minimal = schemas.organizationStructuredData(null);
  assert.equal(minimal.email, undefined);
  assert.equal(minimal.telephone, undefined);
  assert.equal(schemas.websiteStructuredData().publisher['@id'], minimal['@id']);
});

test('Article schema uses the post canonical, author, real photo and publication dates', () => {
  const blog = { slug: 'temple-stories', title: 'Temple Stories', content: '<p>A temple story.</p>', heroImage: '/uploads/story.jpg', publishedAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-27T09:00:00Z', authorName: 'Trail Author' };
  const data = schemas.articleStructuredData(blog);
  assert.equal(data['@type'], 'Article');
  assert.equal(data.mainEntityOfPage['@id'], 'https://travel.example/blog/temple-stories');
  assert.equal(data.author.name, 'Trail Author');
  assert.equal(data.image[0], 'https://api.example/uploads/story.jpg');
  assert.equal(data.datePublished, '2026-10-01T08:00:00.000Z');
  assert.equal(data.dateModified, '2026-10-27T09:00:00.000Z');
  assert.equal(data.description, 'A temple story.');
  assert.equal(schemas.articleStructuredData({ ...blog, canonicalUrl: 'https://publisher.example/original' }).url, 'https://publisher.example/original');
});

test('recent-post discovery requests only live posts and never creates placeholder articles on failure', async () => {
  let fail = false;
  const published = { id: 'published', slug: 'published', title: 'Published Post', status: 'Published' };
  const source = load('lib/server-blog.ts', { 'server-only': {}, react: { cache: fn => fn },
    './blogs': { listPublishedBlogs: async options => {
      assert.equal(options.limit, 3); assert.equal(options.sort, 'Latest');
      if (fail) throw Error('API unavailable');
      return { data: { blogs: [published, { ...published, id: 'draft', status: 'Draft' }] } };
    } },
  });
  assert.equal((await source.getRecentPublishedBlogs()).length, 1);
  fail = true;
  assert.equal((await source.getRecentPublishedBlogs()).length, 0);
});
