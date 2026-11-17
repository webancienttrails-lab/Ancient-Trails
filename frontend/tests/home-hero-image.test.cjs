const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { getImageProps } = require("next/image");
const { renderToStaticMarkup } = require("react-dom/server");
const React = require("react");

function renderHero(unoptimized) {
  const file = path.join(__dirname, "../components/layout/home-hero-image.tsx");
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  const requireLocal = name => name === "next/image"
    ? { getImageProps: props => getImageProps({ ...props, unoptimized }) }
    : require(name);
  vm.runInThisContext("(function(require,module,exports){" + compiled + "\n})")(requireLocal, module, module.exports);
  return renderToStaticMarkup(React.createElement(module.exports.HomeHeroImage));
}

test("static production keeps a valid portrait source when image optimization is disabled", () => {
  const html = renderHero(true);
  const source = html.match(/<source[^>]+>/)[0];
  assert.match(source, /media="\(max-width: 767px\)"/);
  assert.match(source, /srcSet="\/home%20assets\/Mobile_banner.webp"/);
  assert.match(html, /<img[^>]+src="\/home assets\/Briddeshwara temple_banner.webp"/);
});

test("optimized builds retain the responsive portrait image candidates", () => {
  const source = renderHero(false).match(/<source[^>]+>/)[0];
  assert.match(source, /Mobile_banner.webp/);
  assert.match(source, /640w/);
  assert.match(source, /sizes="100vw"/);
});
