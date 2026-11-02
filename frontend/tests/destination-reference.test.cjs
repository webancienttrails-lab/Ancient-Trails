const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createDestinationFixture } = require('./helpers/destination-preview-fixture.cjs');

const source = fs.readFileSync(path.join(__dirname, '../app/destinations/_components/destination-reference-page.tsx'), 'utf8');
const context = { exports: {}, require(name) {
  if (name === '@/components/contact/customise-tour-dialog') return { CustomiseTourDialog:({destinationName,variant})=>React.createElement('button',{'data-variant':variant},'Customise my '+destinationName+' Tour') };
  if (name === '@/components/ui/button') return { Button:({render,children,...props})=>React.cloneElement(render,props,children),ButtonArrow:()=>React.createElement('span') };
  if (name === 'next/link') return {__esModule:true,default:({children,prefetch,...props})=>React.createElement('a',props,children)};
  if (name === '@/lib/destination-map') {const helpers={exports:{},URL};vm.createContext(helpers);vm.runInContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/destination-map.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,helpers);return helpers.exports;}
  if (name === '@/lib/routes') { const routes={exports:{},require};vm.createContext(routes);vm.runInContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/routes.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,routes);return routes.exports; }
  if (name === 'next/image') return { __esModule: true, default: ({ src, alt, className }) => React.createElement('img', { src, alt, className }) };
  if (name === '@/lib/home-travel') return { getHomeMediaUrl: value => value || '' };
  if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  return require(name);
} };
vm.createContext(context);
vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, context);
function elements(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return [node, ...elements(node.props?.children)];
}
const custom = { heroTagline: 'Custom hero tagline', heroDescription: 'A custom destination description.', heroImage: '/uploads/custom-hero.webp',
  overviewTitle: 'A saved overview title', overviewDescription: 'A saved overview paragraph.', overviewQuote: 'A saved short quote.',
  attractions: [{ name: 'Saved attraction', image: '/uploads/custom-attraction.webp', description: 'Saved attraction description.' }],
  quickFacts: [{ icon: 'crown', value: 'Saved fact', label: 'Saved label', description: 'Saved fact description.' }],
  seasons: [{ icon: 'sun', name: 'Saved season', months: 'Saved months', description: 'Saved seasonal description.' }],
  thingsToKnow:['Carry water','Wear comfortable shoes'], bestTimeNote: 'Saved visit note', travelTip: 'Saved travel tip', timings: 'Saved timings', tickets: 'Saved ticket information',
  facilities: 'Saved facilities', closingQuote: 'Saved closing quote', byAir: 'Saved airport route', byRail: 'Saved railway route',
  byRoad: 'Saved road route', localTransport: 'Saved local transport', mapQuery: 'Saved location & region', mapHighlights: ['Saved map landmark'] };

test('destination reference sections render saved content rather than fixed Hampi copy', () => {
  const destination = { ...createDestinationFixture(() => custom), destinationId: 'CUSTOM', destinationName: 'Custom destination', keyLandmarks:['Saved landmark'], keyLandmarkImages:['/uploads/landmark.webp'], countryRegion: 'Custom country', state: 'Custom state', city: 'Custom city' };
  const html = renderToStaticMarkup(React.createElement(context.exports.DestinationReferencePage, { destination, images: [], onImageOpen() {} }));
  for (const text of ['Saved landmark','Carry water','Wear comfortable shoes','Saved closing quote','Saved airport route','Saved railway route','Saved road route']) assert.ok(html.includes(text),text);
  for (const text of ['Key Attractions','Best Time to Visit','Things to Know','How to Reach','By Train']) assert.ok(html.includes(text),text);
  for (const text of ['Saved timings','Saved ticket information','Saved facilities','Saved local transport','Saved travel tip','Saved seasonal description.','Saved map landmark','Location &amp; Map']) assert.ok(!html.includes(text),text);
  assert.ok(html.includes('/experiences?destination=CUSTOM'));
  assert.ok(html.includes('Customise my Custom destination Tour'));
  assert.ok(html.includes('data-variant="outline"'));
  assert.ok(!html.includes('aria-label="Plan your visit"'));
  assert.ok(html.indexOf('How to Reach')<html.indexOf('aria-label="Experiences in Custom destination"'));
  assert.doesNotMatch(html, /Where Stone Remembers|Vijayanagara Empire|1,600/);
  assert.match(html, /q=Saved%20location%20%26%20region/);
  assert.ok(html.includes(destination.bannerImage));
  for(const removed of ['Custom hero tagline','A saved overview title','Saved attraction','Saved attraction description.','Saved fact description.','Quick Facts']) assert.ok(!html.includes(removed), removed);
});

test('older destinations use their existing landmarks, images, facts and location', () => {
  const destination = createDestinationFixture(() => undefined);
  const data = context.exports.getDestinationReferenceData(destination);
  assert.equal(data.attractions[0].name, destination.keyLandmarks[0]);
  assert.equal(data.attractions[0].image, destination.keyLandmarkImages[0]);

  assert.equal(data.location, 'Hampi, Karnataka, India');

});

test('attraction images open the existing gallery and explore links retain the tour anchor', () => {
  const destination = createDestinationFixture(() => custom);
  const calls = [];
  const tree = context.exports.DestinationReferencePage({ destination, images: [], onImageOpen: (...args) => calls.push(args) });
  const nodes = elements(tree);
  const card=elements(context.exports.DestinationAttractionCard({attraction:custom.attractions[0],image:custom.attractions[0].image,onImageOpen:(...args)=>calls.push(args)}));
  card.find(node => node.props?.['aria-label'] === 'View Saved attraction').props.onClick();
  assert.deepEqual(calls, [['/uploads/custom-attraction.webp', 'Saved attraction']]);
  assert.ok(nodes.find(node => node.props?.render?.props?.href === '#destination-tours'));
  assert.ok(nodes.find(node => node.type === 'iframe').props.loading === 'lazy');
});

test('optional map images link to the same dynamic location instead of leaving a broken embed', () => {
  const destination = createDestinationFixture(() => ({ ...custom, mapImage: '/uploads/map.webp' }));
  const nodes = elements(context.exports.DestinationReferencePage({ destination, images: [], onImageOpen() {} }));
  assert.equal(nodes.some(node => node.type === 'iframe'), false);
  const map = nodes.find(node => node.props?.['aria-label'] === 'Open Hampi map');
  assert.ok(map.props.href.includes('query=Saved%20location%20%26%20region'));
  assert.equal(map.props.rel, 'noreferrer');
});

test('external image URLs remain usable without requiring new Next image host settings', () => {
  const destination = createDestinationFixture(() => ({ ...custom, attractions:[{name:'Example',image:'https://images.example.com/attraction.webp'}],mapImage:'https://images.example.com/map.webp' }));
  destination.bannerImage='https://images.example.com/hero.webp';
  const nodes=[...elements(context.exports.DestinationReferencePage({destination,images:[],onImageOpen(){}})),...elements(context.exports.DestinationAttractionCard({attraction:destination.pageContent.attractions[0],image:destination.pageContent.attractions[0].image,onImageOpen(){}}))];
  const images=nodes.filter(node=>node.props?.src?.startsWith('https://images.example.com/'));
  assert.equal(images.length,4);
  assert.ok(images.every(image=>image.props.unoptimized===true));
});

test('banner month formatting uses saved months and preserves multiple visit periods', () => {
  const format=context.exports.formatDestinationVisitMonths;
  assert.equal(format('November to May'),'Nov-May');
  assert.equal(format('October \u2013 February'),'Oct-Feb');
  assert.equal(format('March-May and October-November'),'Mar-May and Oct-Nov');
  assert.equal(format('Nov-Feb'),'Nov-Feb');
  assert.equal(format(''),'');
});

test('key landmarks remain authoritative when legacy page attractions are present', () => {
  const destination=createDestinationFixture(()=>custom);
  const result=context.exports.getDestinationReferenceData(destination);
  assert.equal(result.attractions.length,destination.keyLandmarks.length);
  assert.equal(result.attractions[0].name,destination.keyLandmarks[0]);
  assert.equal(result.attractions[0].image,destination.keyLandmarkImages[0]);
  destination.keyLandmarks=[];
  assert.equal(context.exports.getDestinationReferenceData(destination).attractions.length,0);
});

test('Google Maps links stored in the image field never render as broken images',()=>{
  const destination=createDestinationFixture(()=>({...custom,mapImage:'https://maps.app.goo.gl/PosZzJ5MqDGHejrN7',mapEmbedUrl:'https://maps.google.com/maps?q=15.3350132%2C76.460024&z=14&output=embed'}));
  const html=renderToStaticMarkup(React.createElement(context.exports.DestinationReferencePage,{destination,images:[],onImageOpen(){}}));
  assert.ok(html.includes('q=15.3350132%2C76.460024'));
  assert.ok(!html.includes('src="https://maps.app.goo.gl/'));
});
