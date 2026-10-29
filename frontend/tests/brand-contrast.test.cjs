/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function luminance(hex) {
  const rgb = hex.replace('#', '').match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
const css = fs.readFileSync(path.join(__dirname, '../app/globals.css'), 'utf8');
const token = name => css.match(new RegExp(`--${name}: (#[a-f0-9]{6});`, 'i'))[1];

test('requested primary button colors are exact and their AA limitation is reported', t => {
  assert.equal(token('brand-primary').toLowerCase(), '#d47220');
  assert.equal(css.match(/--color-button-outline: (#[a-f0-9]{6});/i)[1].toLowerCase(), '#d66a1a');
  const source = fs.readFileSync(path.join(__dirname, '../components/ui/button.tsx'), 'utf8');
  assert.match(source, /default:\s*"border-button-outline bg-button-outline text-white /);
  const ratio = contrast('#ffffff', '#d66a1a');
  assert.ok(ratio < 4.5 && ratio >= 3);
  t.diagnostic(`WCAG AA failure for normal text: white on #D66A1A = ${ratio.toFixed(3)}:1 (requires 4.5:1). Large text passes 3:1. Exact requested colors retained.`);
});

test('outlined and text-only buttons use their dedicated token and report contrast', t => {
  assert.match(css, /--color-button-outline: #d66a1a;/i);
  const source = fs.readFileSync(path.join(__dirname, '../components/ui/button.tsx'), 'utf8');
  assert.match(source, /outline:\s*"border-button-outline bg-white text-button-outline /);
  assert.match(source, /link: "text-button-outline /);
  for (const bg of ['#ffffff', '#f7f2ee', '#fff1e5', '#fbf0e8', '#ead8c5']) {
    const ratio = contrast('#d66a1a', bg);
    t.diagnostic(`#D66A1A on ${bg}: ${ratio.toFixed(3)}:1; normal text ${ratio >= 4.5 ? 'passes' : 'FAILS'} AA; large text / border ${ratio >= 3 ? 'passes' : 'FAILS'} 3:1.`);
  }
});

test('brand text uses the requested color and control boundaries remain readable', t => {
  assert.equal(token('brand-primary-text').toLowerCase(), '#d66a1a');
  for (const bg of ['#ffffff', '#f7f2ee', '#fff1e5', '#fff8f0', '#fbf0e8', '#fcf0e1', '#ead8c5']) {
    const ratio = contrast(token('brand-primary-text'), bg);
    assert.ok(contrast(token('input'), bg) >= 3, `input border on ${bg}`);
    t.diagnostic(`${token('brand-primary-text')} on ${bg}: ${ratio.toFixed(3)}:1; normal text ${ratio >= 4.5 ? 'passes' : 'FAILS'} AA. Requested brand color retained.`);
  }
});

test('light orange text passes on dark surfaces', () => {
  for (const bg of ['#161616', '#1f1f1f', '#2a2a2a', '#323232']) {
    assert.ok(contrast('#ffc18b', bg) >= 4.5);
  }
});

module.exports = { contrast };
