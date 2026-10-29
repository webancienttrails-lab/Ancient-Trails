/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const result = { exports: {} };
  vm.runInNewContext(compiled, { exports: result.exports, module: result });
  return result.exports;
}
const { handleTabKeyDown } = load('lib/tab-keyboard.ts');

function keyboard(key, index, modifiers = {}) {
  const calls = [];
  const tabs = [0, 1, 2].map(i => ({
    contains: target => target.index === i,
    focus: options => calls.push(['focus', i, options.preventScroll]),
    click: () => calls.push(['activate', i]),
  }));
  handleTabKeyDown({ key, target: { index }, ...modifiers,
    currentTarget: { querySelectorAll(selector) {
      assert.match(selector, /:not\(:disabled\)/);
      assert.match(selector, /aria-disabled/);
      return tabs;
    } }, preventDefault: () => calls.push(['preventDefault']),
  });
  return calls;
}

test('Left/Right wrap through enabled tabs and activate the focused panel', () => {
  for (const [key, current, next] of [['ArrowRight', 0, 1], ['ArrowRight', 2, 0], ['ArrowLeft', 0, 2]]) {
    assert.deepEqual(keyboard(key, current), [['preventDefault'], ['focus', next, true], ['activate', next]]);
  }
});

test('Home and End move to the first and last tabs', () => {
  assert.deepEqual(keyboard('Home', 2), [['preventDefault'], ['focus', 0, true], ['activate', 0]]);
  assert.deepEqual(keyboard('End', 0), [['preventDefault'], ['focus', 2, true], ['activate', 2]]);
});

test('Tab, vertical scrolling, modifiers and events outside tabs retain native behavior', () => {
  for (const key of ['Tab', 'ArrowUp', 'ArrowDown', 'Enter', ' ']) assert.deepEqual(keyboard(key, 0), []);
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) assert.deepEqual(keyboard('ArrowRight', 0, { [modifier]: true }), []);
  assert.deepEqual(keyboard('ArrowRight', -1), []);
});

const { formatTourTitle } = load('lib/tour-title.ts');
test('tour titles capitalise lowercase words while preserving names and acronyms', () => {
  assert.equal(formatTourTitle(' enigmatic khajuraho '), 'Enigmatic Khajuraho');
  assert.equal(formatTourTitle('tamil nadu & UNESCO heritage'), 'Tamil Nadu & UNESCO Heritage');
  assert.equal(formatTourTitle('McLeod Ganj'), 'McLeod Ganj');
});

test('each additional-details tab controls a labelled panel and only the selected panel is visible', () => {
  const file = 'app/tours/[tourId]/_components/single-tour-page.tsx';
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'TourAdditionalDetails');
  const compiled = ts.transpileModule(component.getText(source) + '\nexports.Component = TourAdditionalDetails;', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  for (const selected of ['flight', 'accommodation', 'reporting']) {
    const result = {};
    vm.runInNewContext(compiled, { exports: result, require,
      useState: () => [selected, () => {}], handleTabKeyDown,
      cn: (...values) => values.filter(value => typeof value === 'string').join(' '),
      Plane: () => null, Hotel: () => null, MapPin: () => null, ShieldCheck: () => null, Info: () => null,
      PolicyPanel: () => null, TourInfoList: () => React.createElement('p', null, 'Tour details'),
    });
    const html = renderToStaticMarkup(React.createElement(result.Component, { tour: {} }));
    assert.match(html, /role="tablist" aria-label="Additional tour details"/);
    const tabs = html.match(/<button[^>]*role="tab"[^>]*>/g);
    const panels = html.match(/<div[^>]*role="tabpanel"[^>]*>/g);
    assert.equal(tabs.length, 3);
    assert.equal(panels.length, 3);
    assert.equal(tabs.filter(tab => tab.includes('aria-selected="true"')).length, 1);
    assert.equal(tabs.filter(tab => tab.includes('tabindex="0"')).length, 1);
    for (const value of ['flight', 'accommodation', 'reporting']) {
      const tab = tabs.find(tag => tag.includes(`id="tour-additional-tab-${value}"`));
      const panel = panels.find(tag => tag.includes(`id="tour-additional-panel-${value}"`));
      assert.ok(tab.includes(`aria-controls="tour-additional-panel-${value}"`));
      assert.ok(panel.includes(`aria-labelledby="tour-additional-tab-${value}"`));
      assert.equal(panel.includes('hidden=""'), value !== selected);
      assert.equal(tab.includes('aria-selected="true"'), value === selected);
    }
  }
});
