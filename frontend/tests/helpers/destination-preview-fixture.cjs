const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

function createDestinationFixture(getPageContent) {
  const names = ['Virupaksha Temple', 'Vijaya Vittala Temple', 'Lotus Mahal', 'Hemakuta Hill', 'Tungabhadra River'];
  const files = ['Virupaksha-Temple-1786446568255-k1tyg7.webp', 'Vitthala-Temple-1786446568255-2liw5c.webp', 'Lotus-Mahal-1786446568254-nq922h.webp', 'Hemakut-1786446568253-iub7oc.webp', 'Hampi_5-1787731615853-lj80kv.webp'];
  const destination = {
    id: 'destination-preview-hampi', destinationId: 'HAMPI', destinationName: 'Hampi', destinationType: 'Domestic',
    countryRegion: 'India', state: 'Karnataka', city: 'Hampi', region: 'South India',
    primaryHeritageFocus: 'Vijayanagara architecture', bestTimeToVisit: 'October – February', unescoSite: true,
    keyLandmarks: names, keyLandmarkImages: files.map(file => '/uploads/destinations/' + file),
    recommendedDurationDays: 3, shortDescription: 'A landscape of majestic temples, royal ruins and boulder-strewn hills beside the Tungabhadra River.',
    fact: 'A journey through living history.', weather: 'Warm and sunny', elevation: '', temperature: '', season: 'October – February',
    dressCode: 'Wear comfortable, modest clothing at temples.', footwear: 'Comfortable walking shoes are recommended.',
    permits: '', idRequirement: '', restrictions: '',
    bannerImage: '/uploads/destinations/Hampi-banner-1786446560801-r0ra8t.webp', thumbnailImage: '',
    galleryImages: files.map(file => '/uploads/destinations/' + file), createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
  destination.pageContent = getPageContent(destination);
  return destination;
}

exports.createDestinationFixture = createDestinationFixture;
if (require.main === module) {
  const { getDestinationPageContent } = require('../../../backend/src/services/destination-page-content.ts');
  const destination = createDestinationFixture(getDestinationPageContent);
  const storage = path.resolve(__dirname, '../../../backend/storage');
  const server = http.createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/uploads/')) {
      const file = path.resolve(storage, decodeURIComponent(url.pathname.slice('/uploads/'.length)));
      if (!file.startsWith(storage + path.sep) || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
      response.setHeader('Content-Type', /\.png$/i.test(file) ? 'image/png' : 'image/webp');
      fs.createReadStream(file).pipe(response); return;
    }
    let data = {};
    if (url.pathname === '/api/destinations') data = { destinations: [destination] };
    else if (url.pathname === '/api/tours') data = { tours: [] };
    else if (url.pathname === '/api/tours/departures') data = { departures: [] };
    else if (url.pathname === '/api/tours/itineraries') data = { itineraries: [] };
    else if (url.pathname === '/api/experts') data = { experts: [] };
    else if (url.pathname === '/api/experiences') data = { experiences: [] };
    else if (url.pathname === '/api/blogs') data = { blogs: [], total: 0, pagination: { total: 0, page: 1, pages: 1 } };
    else if (url.pathname === '/api/notifications') data = { notifications: [], unreadCount: 0 };
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ success: true, data }));
  });
  server.listen(5127, '127.0.0.1', () => process.stdout.write('Destination preview fixture: http://127.0.0.1:5127\n'));
}
