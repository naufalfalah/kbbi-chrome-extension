const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

global.DOMParser = new JSDOM('').window.DOMParser;

const { parse: parseKbbiWebId } = require('../parsers/kbbiwebid.js');

function fixture(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', 'kbbiwebid', name), 'utf8');
}

// Fixtures here are real captures from kbbi.web.id (2026-08-26), unlike the
// kemendikdasmen ones which had to be reconstructed by hand because that
// site was blocking anonymous fetches at the time — see TO-DO.md.

test('parses the single-entry <div id="d1"> into the searchKBBI shape', () => {
  const result = parseKbbiWebId(fixture('makan.html'));

  assert.equal(result.found, true);
  assert.deepEqual(result.suggestions, []);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].word, 'ma.kan1');
});

test('splits numbered senses into separate definitions with labels and examples', () => {
  const { entries } = parseKbbiWebId(fixture('makan.html'));
  const [def1, def2] = entries[0].definitions;

  assert.equal(def1.type, 'definition');
  assert.equal(def1.labels[0], 'v');
  assert.match(def1.text, /memasukkan makanan pokok/);
  assert.ok(def1.examples[0].includes('tiga kali sehari'));

  assert.equal(def2.type, 'definition');
  assert.match(def2.text, /memasukkan sesuatu ke dalam mulut, kemudian mengunyah/);
});

test('captures idioms and derived word forms as compound entries', () => {
  const { entries } = parseKbbiWebId(fixture('makan.html'));
  const compounds = entries[0].definitions.filter((d) => d.type === 'compound');

  assert.ok(compounds.length > 10, 'expected many idiom/derived-word compound entries');

  const angin = compounds.find((d) => d.text.startsWith('-- angin'));
  assert.ok(angin, 'expected "-- angin" idiom to be parsed');
  assert.deepEqual(angin.labels, ['ki']);

  const memakan = compounds.find((d) => d.text.startsWith('me.ma.kan '));
  assert.ok(memakan, 'expected derived word "memakan" to be parsed');
});

test('returns found:false when the page reports no results', () => {
  const result = parseKbbiWebId(fixture('notfound.html'));

  assert.deepEqual(result, { found: false, entries: [], suggestions: [] });
});
