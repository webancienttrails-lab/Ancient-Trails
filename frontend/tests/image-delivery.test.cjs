const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sharp = require('sharp');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { getImgProps } = require('next/dist/shared/lib/get-img-props');
const defaultLoader = require('next/dist/shared/lib/image-loader').default;
const { imageConfigDefault } = require('next/dist/shared/lib/image-config');
const root = path.resolve(__dirname, '..');
function load(file, env = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module, exports: module.exports, URL, process: { env }, require });
  return module.exports;
}
const config = load('next.config.ts', { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://api.example' }).default;
const imgConf = { ...imageConfigDefault, ...config.images };
const propsFor = props => getImgProps(props, { defaultLoader, imgConf }).props;

test('uploaded photos use responsive optimized URLs and lazy loading by default', () => {
  const props = propsFor({ src: 'https://api.example/uploads/tours/photo.jpg', alt: 'Tour', fill: true, sizes: '(min-width: 1024px) 360px, 90vw' });
  assert.equal(props.loading, 'lazy');
  assert.match(props.src, /^\/_next\/image\?/);
  assert.match(props.srcSet, /640w/);
  assert.match(props.src, /q=75/);
  assert.equal(config.images.dangerouslyAllowLocalIP, false);
  assert.throws(() => propsFor({ src: 'https://unconfigured.example/photo.jpg', alt: '', width: 300, height: 200 }), /not configured/);
});

test('logos request display-sized versions rather than the uploaded original', () => {
  const props = propsFor({ src: 'https://api.example/uploads/site-logos/logo.png', alt: 'Logo', width: 218, height: 86 });
  const urls = [...props.srcSet.matchAll(/\/_next\/image\?[^ ,]+/g)].map(match => new URL(match[0], 'https://site.example'));
  assert.equal(urls.length, 2);
  assert.equal(urls[0].searchParams.get('w'), '218');
  assert.equal(urls[1].searchParams.get('w'), '436');
});

test('home art direction renders one eager image and a mobile source without duplicate preloads', () => {
  const { HomeHeroImage } = load('components/layout/home-hero-image.tsx');
  const html = renderToStaticMarkup(React.createElement(HomeHeroImage));
  assert.equal((html.match(/<img\b/g) || []).length, 1);
  assert.equal((html.match(/<source\b/g) || []).length, 1);
  assert.match(html, /media="\(max-width: 767px\)"/);
  assert.match(html, /loading="eager"/);
  assert.match(html, /fetchPriority="high"/i);
  assert.doesNotMatch(html, /rel="preload"/);
  assert.match(html, /srcSet=/i);
});

test('optimized illustrations, map and logo have bounded dimensions and substantially smaller payloads', async () => {
  const files = [
    ['illustration/Hampi illustration.webp', 660, 780, 100 * 1024],
    ['illustration/Khajuraho illustration.webp', 660, 780, 100 * 1024],
    ['home assets/Map-optimized.webp', 1070, 1070, 150 * 1024],
    ['Header Logo.webp', 218, 86, 10 * 1024],
  ];
  for (const [file, width, height, budget] of files) {
    const full = path.join(root, 'public', file), metadata = await sharp(full).metadata();
    assert.equal(metadata.format, 'webp');
    assert.ok(metadata.width <= width && metadata.height <= height, file);
    assert.ok(fs.statSync(full).size < budget, file);
  }
});
