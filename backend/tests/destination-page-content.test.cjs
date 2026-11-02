const test = require('node:test');
const assert = require('node:assert/strict');
const { Destination } = require('../src/models/destination.model.ts');
const { createDestination, updateDestination } = require('../src/controllers/destination.controller.ts');
const { destinationPageContentSchema, getDestinationPageContent } = require('../src/services/destination-page-content.ts');

const content = { thingsToKnow:['Carry water','Wear comfortable shoes'], heroTagline: 'A living heritage', overviewTitle: 'Stories of the city',
  attractions: [{ name: 'A temple', image: '/uploads/destinations/temple.webp', description: 'A saved attraction description.' }],
  quickFacts: [{ icon: 'landmark', value: 'A landmark', label: 'Heritage', description: 'A saved fact.' }],
  seasons: [{ icon: 'sun', name: 'Winter', months: 'Oct – Feb', description: 'A saved seasonal note.' }],
  travelTip: 'Bring walking shoes.', timings: 'Opening times vary.', tickets: 'Check admission locally.',
  byAir: 'Airport transfer', byRail: 'Station transfer', byRoad: 'Road route', localTransport: 'Local route',
  mapQuery: 'Test city, India', mapHighlights: ['A temple'], mapImage: '/uploads/destinations/map.webp' };
const payload = { destinationId: 'TEST-DESIGN', destinationName: 'Test city', destinationType: 'Domestic', countryRegion: 'India', keyLandmarks:['A temple'], keyLandmarkImages:['/uploads/destinations/temple.webp'], pageContent: content };

test('new page fields persist together with existing destination fields', async () => {
  const destination = new Destination(payload);
  await destination.validate();
  const restored = new Destination(destination.toObject());
  assert.deepEqual(restored.pageContent, content);
  assert.equal(restored.destinationName, 'Test city');
});

test('Hampi page content does not create duplicate attractions from key landmarks', () => {
  const names = ['Virupaksh Temple', 'Vitthal Temple', 'Lotus Mahal', 'Hemakut', 'Pushkarini'];
  const images = names.map((_, index) => `/uploads/destinations/image-${index}.webp`);
  const result = getDestinationPageContent({ destinationId: 'D1', destinationName: 'Hampi', keyLandmarks: names, keyLandmarkImages: images });
  assert.equal(result.attractions, undefined);
  assert.equal(result.quickFacts.length, 5);
  assert.equal(result.heroTagline, 'Where Stone Remembers an Empire');
  assert.deepEqual(getDestinationPageContent({ destinationId: 'D2', destinationName: 'Jaipur' }), {});
  assert.deepEqual(getDestinationPageContent({ destinationId: 'D3', destinationName: 'Beyond Hampi' }), {});
});

test('saved page edits override template content, including intentionally empty fields', () => {
  const result = getDestinationPageContent({ destinationId: 'HAMPI', destinationName: 'Hampi', pageContent: { ...content, overviewQuote: '', quickFacts: [] } });
  assert.equal(result.heroTagline, content.heroTagline);
  assert.equal(result.overviewQuote, '');
  assert.deepEqual(result.quickFacts, []);
  assert.equal(result.mapQuery, 'Test city, India');
});

test('page content validates image sources, field lengths and repeatable content limits', () => {
  assert.equal(destinationPageContentSchema.safeParse(content).success, true);
  assert.equal(destinationPageContentSchema.safeParse({thingsToKnow:Array(16).fill('Tip')}).success,false);
  assert.equal(destinationPageContentSchema.safeParse({thingsToKnow:['x'.repeat(241)]}).success,false);
  assert.equal(destinationPageContentSchema.safeParse({ heroImage: 'javascript:alert(1)' }).success, false);
  assert.equal(destinationPageContentSchema.safeParse({ mapImage: '//untrusted.example/map.png' }).success, false);
  assert.equal(destinationPageContentSchema.safeParse({ heroTagline: 'x'.repeat(181) }).success, false);
  assert.equal(destinationPageContentSchema.safeParse({ quickFacts: Array(6).fill(content.quickFacts[0]) }).success, false);
  assert.equal(destinationPageContentSchema.safeParse({ seasons: Array(4).fill(content.seasons[0]) }).success, false);
  assert.equal(destinationPageContentSchema.safeParse({ heroImage: 'https://images.example/hero.webp' }).success, true);
});

test('destination create and update APIs return edited page content to public consumers', async t => {
  t.mock.method(Destination, 'create', async values => new Destination(values));
  let updated;
  t.mock.method(Destination, 'findByIdAndUpdate', async (id, values) => { updated = values; return new Destination(values); });
  function response() { return { body: null, statusCode: 0, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } }; }
  const created = response();
  await createDestination({ body: payload }, created);
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.data.destination.pageContent.heroTagline, content.heroTagline);
  assert.equal(created.body.data.destination.keyLandmarks[0], payload.keyLandmarks[0]);
  assert.equal(created.body.data.destination.keyLandmarkImages[0], payload.keyLandmarkImages[0]);
  assert.equal(created.body.data.destination.pageContent.attractions,undefined);
  const edited = response();
  await updateDestination({ params: { id: 'fixture-id' }, body: { ...payload, pageContent: { ...content, heroTagline: 'Edited headline' } } }, edited);
  assert.equal(edited.statusCode, 200);
  assert.equal(updated.pageContent.heroTagline, 'Edited headline');
  assert.equal(edited.body.data.destination.pageContent.mapQuery, content.mapQuery);
});

test('public attractions always reflect edited key landmarks rather than legacy page content', () => {
  const result=getDestinationPageContent({destinationId:'D4',destinationName:'Custom',keyLandmarks:['New landmark'],keyLandmarkImages:['/uploads/new.webp'],pageContent:content});
  assert.equal(result.attractions,undefined);
  assert.equal(result.closingQuote,content.closingQuote);
  assert.equal(result.byAir,content.byAir);
});
