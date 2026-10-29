const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const noop = () => {};
const cache = new Map();
const mocks = {
  'server-only': {},
  'next/image': { __esModule: true, getImageProps: require('next/image').getImageProps, default: ({ src, alt }) => React.createElement('img', { src, alt }) },
  'next/link': { __esModule: true, default: ({ href, children, prefetch, ...props }) => React.createElement('a', { ...props, href, 'data-prefetch': prefetch === false ? 'off' : undefined }, children) },
  'next/navigation': { useRouter: () => ({ push: noop, replace: noop }), usePathname: () => '/', useSearchParams: () => new URLSearchParams(), notFound: () => { throw Error('NOT_FOUND'); } },
  '@/components/layout/header': { Header: () => null },
  '@/components/ui/toast': { ToastProvider: ({ children }) => children, useToast: () => ({ success: noop, error: noop }) },
};
function load(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const requireLocal = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
    const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
    const file = [base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')].find(fs.existsSync);
    if (!file) throw Error('Cannot load ' + base);
    return load(file);
  };
  vm.runInThisContext('(function(require,module,exports){' + compiled + '\n})', { filename })(requireLocal, module, module.exports);
  return module.exports;
}
const stamp = '2026-01-01T00:00:00.000Z';
const tour = { id: 'tour-record', tourId: 'TOUR-SSR', tourName: 'Server Heritage Trail', tourType: 'Heritage', tourFormat: 'Long Trails', destinationId: 'DEST-SSR', destinationIds: ['DEST-SSR'], durationDn: '5 Days/4 Nights', category: 'Heritage', isBestseller: false, difficulty: 'Easy', bestSeason: 'Winter', description: 'Explore the ancient stone temples.', inclusions: [], exclusions: [], expertId: 'EXPERT-SSR', notes: '', thumbnailImage: '/tour.jpg', bannerImage: '/tour.jpg', galleryImages: [], video: '', createdAt: stamp, updatedAt: stamp };
const destination = { id: 'destination-record', destinationId: 'DEST-SSR', destinationName: 'Server Heritage City', destinationType: 'Domestic', countryRegion: 'India', region: 'South India', state: 'Tamil Nadu', city: 'Thanjavur', primaryHeritageFocus: 'Temples', unescoSite: true, keyLandmarks: ['Stone Temple'], recommendedDurationDays: 5, shortDescription: 'An ancient city of temples.', dressCode: '', footwear: '', permits: '', idRequirement: '', restrictions: '', bannerImage: '/city.jpg', galleryImages: [], createdAt: stamp, updatedAt: stamp };
const departure = { id: 'departure-record', departureId: 'DEP-SSR', tourId: tour.tourId, destinationId: destination.destinationId, departureDate: '2099-02-12T00:00:00.000Z', returnDate: '2099-02-16T00:00:00.000Z', bookingDeadline: '2099-02-01T00:00:00.000Z', status: 'scheduled', priceAdult: 42000, priceExtraBed: 30000, priceChildWithoutExtraBed: 20000, singleOccupancy: 54000, seatsAvailable: 20, totalSeats: 20, filledSeats: 0, depositType: 'percentage', depositValue: 30, depositAppliesTo: 'per_person', balanceDueDaysBefore: 30, earlyBirdOffer: null, childPricingRules: [], createdAt: stamp, updatedAt: stamp };
const itinerary = { id: 'itinerary-record', tourId: tour.tourId, itinerarySummary: 'Walk through temple history.', days: [{ dayNumber: 1, title: 'Arrive at the Stone Temple', summary: 'Discover carved pillars and ancient murals.', placesVisited: ['Stone Temple'], hotels: 'Heritage Hotel', walkingDifficulty: 'Easy', meals: 'Breakfast' }], createdAt: stamp, updatedAt: stamp };
itinerary.days.push({ ...itinerary.days[0], dayNumber: 2, title: 'Explore the old palace', summary: 'Visit the royal courtyard and museum.' });
const catalogue = { tours: [tour], destinations: [destination], departures: [departure], experts: [] };
mocks['@/lib/server-travel'] = { getTravelCatalogue: async () => catalogue,
  findTourByRoute: load(path.join(root, 'lib/server-travel.ts')).findTourByRoute };
const actualTravel = load(path.join(root, 'lib/home-travel.ts'));
mocks['@/lib/home-travel'] = { ...actualTravel,
  listPublicTours: async () => ({ data: { tours: catalogue.tours } }),
  getHomeTrendingDestinations: async () => [],
  getHomeCustomisedTourDestinations: async () => [],
  getHomeExperienceCards: async () => [],
  getHomeUpcomingTours: async () => [],
  listPublicTourItineraries: async () => ({ data: { itineraries: [itinerary] } }),
  listPublicExperiences: async () => ({ data: { experiences: [] } }),
  listPublicMegaMenu: async () => ({ data: { megaMenu: null } }),
  getTourCalendarPageContent: async () => ({ data: { tourCalendar: { festivals: [] } } }),
};
const faqCategories = [{ id: 'booking', title: 'Booking', items: [{ id: 'how', question: 'How can I reserve a tour?', answer: 'Choose a live departure and complete the booking form.' }] }];
const recentPosts = [{ id: 'blog-1', slug: 'temple-stories', title: 'Temple Stories', heroImage: '/story.jpg', quote: 'Ancient temples and local history.', category: 'Heritage', publishedAt: stamp }];
mocks['@/lib/server-blog'] = { getRecentPublishedBlogs: async () => recentPosts };
mocks['@/lib/faq'] = { getPublicFaq: async () => ({ data: { faq: { categories: faqCategories } } }) };
mocks['@/lib/site-settings'] = { ...load(path.join(root, 'lib/site-settings.ts')),
  getPublicSiteSettings: async () => ({ data: { settings: { logo: '/brand.png', contact: { emailId: 'team@example.test' }, socialLinks: {} } } }) };
async function renderRoute(route, props) {
  const Page = load(path.join(root, 'app', route, 'page.tsx')).default;
  return renderToStaticMarkup(await Page(props));
}
function hasSingleHeading(html) { assert.equal((html.match(/<h1\b/g) || []).length, 1); }

test('every page main is a programmatically focusable skip destination', () => {
  let count = 0;
  function visitDirectory(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { visitDirectory(file); continue; }
      if (!file.endsWith('.tsx')) continue;
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node) {
        if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === 'main') {
          const attributes = node.attributes.properties;
          assert.equal(attributes.find(attribute => attribute.name?.getText(source) === 'id')?.initializer?.text, 'main-content', file);
          assert.equal(attributes.find(attribute => attribute.name?.getText(source) === 'tabIndex')?.initializer?.getText(source), '{-1}', file);
          count++;
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  visitDirectory(path.join(root, 'app'));
  visitDirectory(path.join(root, 'components'));
  assert.ok(count >= 30);
});

test('root places a single skip link and header portal before page content', async () => {
  mocks['next/font/google'] = { Montserrat: () => ({ variable: 'montserrat' }), Playfair_Display: () => ({ variable: 'playfair' }) };
  mocks['./globals.css'] = {};
  const RootLayout = load(path.join(root, 'app/layout.tsx')).default;
  const html = renderToStaticMarkup(await RootLayout({ children: React.createElement('main', { id: 'main-content', tabIndex: -1 }, 'Main content') }));
  assert.match(html, /<body[^>]*><a href="#main-content" class="skip-link">Skip to main content<\/a><div id="site-header-slot"><\/div>/);
  assert.equal((html.match(/class="skip-link"/g) || []).length, 1);
  assert.ok(html.indexOf('id="site-header-slot"') < html.indexOf('<main'));
  const header = fs.readFileSync(path.join(root, 'components/layout/header.tsx'), 'utf8');
  assert.match(header, /setHeaderPortalTarget\(document.getElementById\("site-header-slot"\)\)/);
  assert.match(header, /createPortal\(headerContent, headerPortalTarget\)/);
});

test('closed trip planner omits its backdrop and form controls from HTML', () => {
  const { PlanTripLauncher } = load(path.join(root, 'components/plan-trip-launcher.tsx'));
  const html = renderToStaticMarkup(React.createElement(PlanTripLauncher));
  assert.match(html, /Plan Your Trip/);
  assert.doesNotMatch(html, /aria-label="Close trip planner"/);
  assert.doesNotMatch(html, /id="plan-trip-panel"|<input|<select/);
});

test('hidden back-to-top control is inert and hidden from assistive technology', () => {
  const { BackToTopButton } = load(path.join(root, 'components/layout/back-to-top-button.tsx'));
  const html = renderToStaticMarkup(React.createElement(BackToTopButton));
  assert.match(html, /inert=""/);
  assert.match(html, /aria-hidden="true"/);
});
test('tour list HTML contains its heading, tour link and departure date before effects run', async () => {
  const html = await renderRoute('tours', {});
  hasSingleHeading(html);
  assert.match(html, /Server Heritage Trail/);
  assert.match(html, /href="\/tours\/server-heritage-trail"/);
  assert.match(html, /2099/);
});
test('tour detail HTML contains the actual name, price, dates and itinerary without a browser', async () => {
  const html = await renderRoute('tours/[tourId]', { params: Promise.resolve({ tourId: 'server-heritage-trail' }) });
  hasSingleHeading(html);
  assert.match(html, /Server Heritage Trail/);
  assert.match(html, /42,000/);
  assert.match(html, /2099/);
  assert.match(html, /Arrive at the Stone Temple/);
  assert.match(html, /Discover carved pillars and ancient murals/);
  assert.match(html, /Visit the royal courtyard and museum/);
  const schema = JSON.parse(html.match(/<script id="tour-jsonld"[^>]*>([\s\S]*?)<\/script>/)[1]);
  assert.equal(schema['@graph'][0].name, tour.tourName);
  assert.equal(schema['@graph'][0].offers.price, departure.priceAdult);
  assert.equal(schema['@graph'][1]['@type'], 'BreadcrumbList');
});
test('FAQ HTML contains matching visible answers and JSON-LD before browser effects run', async () => {
  const html = await renderRoute('faq', {});
  const schema = JSON.parse(html.match(/<script id="faq-jsonld"[^>]*>([\s\S]*?)<\/script>/)[1]);
  assert.equal(schema['@type'], 'FAQPage');
  assert.equal(schema.mainEntity[0].name, faqCategories[0].items[0].question);
  assert.equal(schema.mainEntity[0].acceptedAnswer.text, faqCategories[0].items[0].answer);
  const markup = html.replace(/<script[\s\S]*?<\/script>/g, '');
  assert.ok(markup.includes(faqCategories[0].items[0].question));
  assert.ok(markup.includes(faqCategories[0].items[0].answer));
});
test('home HTML contains the organization schema from published site settings', async () => {
  const html = await renderRoute('', {});
  const schema = JSON.parse(html.match(/<script id="organization-jsonld"[^>]*>([\s\S]*?)<\/script>/)[1]);
  assert.equal(schema['@type'], 'Organization');
  assert.equal(schema.email, 'team@example.test');
  assert.equal(new URL(schema.logo).pathname, '/brand.png');
  assert.match(html, /href="\/blog\/temple-stories"/);
});
test('footer HTML links directly to published posts without browser requests', () => {
  const { SiteFooter } = load(path.join(root, 'components/layout/footer.tsx'));
  const html = renderToStaticMarkup(React.createElement(SiteFooter, { recentPosts }));
  assert.match(html, /aria-label="Recent blog posts"/);
  assert.match(html, /href="\/blog\/temple-stories"/);
  assert.match(html, /Temple Stories/);
});
test('tour and destination metadata use real record names, descriptions, photos and canonical slugs', async () => {
  const tourRoute = load(path.join(root, 'app/tours/[tourId]/page.tsx'));
  const tourMetadata = await tourRoute.generateMetadata({ params: Promise.resolve({ tourId: tour.tourId }) });
  assert.match(tourMetadata.title.absolute, /Server Heritage Trail/);
  assert.match(tourMetadata.description, /42,000/);
  assert.equal(new URL(tourMetadata.alternates.canonical).pathname, '/tours/server-heritage-trail');
  assert.equal(new URL(tourMetadata.openGraph.images[0].url).pathname, '/tour.jpg');
  assert.equal(tourMetadata.twitter.images[0].url, tourMetadata.openGraph.images[0].url);
  const destinationRoute = load(path.join(root, 'app/destinations/[destinationId]/page.tsx'));
  const destinationMetadata = await destinationRoute.generateMetadata({ params: Promise.resolve({ destinationId: destination.destinationId }) });
  assert.match(destinationMetadata.title.absolute, /Server Heritage City/);
  assert.match(destinationMetadata.description, /ancient city of temples/);
  assert.equal(new URL(destinationMetadata.alternates.canonical).pathname, '/destinations/server-heritage-city');
  assert.equal(new URL(destinationMetadata.openGraph.images[0].url).pathname, '/city.jpg');
  assert.notEqual(tourMetadata.description, destinationMetadata.description);
});
test('destination list and detail HTML contain real names and navigation', async () => {
  const list = await renderRoute('destinations', {});
  hasSingleHeading(list);
  assert.match(list, /href="\/destinations\/server-heritage-city"/);
  const detail = await renderRoute('destinations/[destinationId]', { params: Promise.resolve({ destinationId: 'server-heritage-city' }) });
  hasSingleHeading(detail);
  assert.match(detail, /Server Heritage City/);
  assert.match(detail, /href="\/tours\/server-heritage-trail"/);
});
test('calendar HTML contains a heading and a linked scheduled tour', async () => {
  const html = await renderRoute('tour-calendar', {});
  hasSingleHeading(html);
  assert.match(html, /href="\/tours\/server-heritage-trail"/);
});
test('empty and orphaned calendar data never render synthetic or missing tours', () => {
  const { TourCalendarPage } = load(path.join(root, 'app/tour-calendar/tour-calendar-page.tsx'));
  for (const departures of [[], [departure]]) {
    const html = renderToStaticMarkup(React.createElement(TourCalendarPage, {
      initialData: { tours: [], destinations: [], experts: [], departures, calendar: null },
    }));
    assert.doesNotMatch(html, /Kerala Backwaters|Sacred South|Walking the Amalfi/);
    assert.doesNotMatch(html, /href="\/tours\/[^"?]+"/);
  }
});
test('destination region searches render matching cards before client filter effects', async () => {
  const html = await renderRoute('destinations', { searchParams: Promise.resolve({ search: 'South India' }) });
  assert.match(html, /href="\/destinations\/server-heritage-city"/);
});
test('tour searches apply to the initial server-rendered cards', async () => {
  const html = await renderRoute('tours', { searchParams: Promise.resolve({ search: 'no matching tour' }) });
  hasSingleHeading(html);
  assert.doesNotMatch(html, /href="\/tours\/server-heritage-trail"/);
});
test('legacy tour aliases and identifiers still resolve to the real tour record', () => {
  const { findTourByRoute } = mocks['@/lib/server-travel'];
  const legacy = { ...tour, tourId: 'HAMPI', tourName: 'A renamed Hampi trail' };
  assert.equal(findTourByRoute([legacy], 'flavours-of-badami-hampi'), legacy);
  assert.equal(findTourByRoute([tour], tour.tourId), tour);
});
test('home upcoming tours render actual links without client effects', () => {
  const { UpcomingToursSection } = load(path.join(root, 'app/(home)/_components/upcoming-tours-section.tsx'));
  const html = renderToStaticMarkup(React.createElement(UpcomingToursSection, { initialTours: [{ tourId: tour.tourId, title: tour.tourName, date: '12 Feb 2099', duration: tour.durationDn, image: '/tour.jpg', isBestseller: false }] }));
  assert.match(html, /href="\/tours\/server-heritage-trail"/);
});
test('unknown tour and destination routes return not-found instead of invented fallback details', async () => {
  await assert.rejects(renderRoute('tours/[tourId]', { params: Promise.resolve({ tourId: 'missing' }) }), /NOT_FOUND/);
  await assert.rejects(renderRoute('destinations/[destinationId]', { params: Promise.resolve({ destinationId: 'missing' }) }), /NOT_FOUND/);
  await assert.rejects(load(path.join(root, 'app/tours/[tourId]/page.tsx')).generateMetadata({ params: Promise.resolve({ tourId: 'missing' }) }), /NOT_FOUND/);
  await assert.rejects(load(path.join(root, 'app/destinations/[destinationId]/page.tsx')).generateMetadata({ params: Promise.resolve({ destinationId: 'missing' }) }), /NOT_FOUND/);
});
