const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

// kbbi.js/parsers expect a browser-global DOMParser; jsdom provides one.
global.DOMParser = new JSDOM('').window.DOMParser;

const { parse: parseKemendikdasmen } = require('../parsers/kemendikdasmen.js');

function fixture(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', 'kemendikdasmen', name), 'utf8');
}

test('parses a multi-homonym entry into the searchKBBI shape', () => {
  const result = parseKemendikdasmen(fixture('makan.html'));

  assert.equal(result.found, true);
  assert.deepEqual(result.suggestions, []);
  assert.equal(result.entries.length, 2);

  const [makan1, makan2] = result.entries;
  assert.equal(makan1.word, 'ma.kan1');
  assert.equal(makan2.word, 'ma.kan2');
});

test('extracts grammar/usage labels and examples from the first definition', () => {
  const { entries } = parseKemendikdasmen(fixture('makan.html'));
  const [def1, def2] = entries[0].definitions;

  assert.equal(def1.type, 'definition');
  assert.match(def1.text, /memasukkan makanan pokok/);
  assert.deepEqual(def1.labels, ['v']);
  assert.deepEqual(def1.examples, ['ia sedang makan nasi goreng']);

  // second sense: "ki" (kiasan) label + grey example + brown gloss appended
  assert.deepEqual(def2.labels, ['v', 'ki']);
  assert.deepEqual(def2.examples, [
    'toko itu makan banyak untung',
    '(menguntungkan)',
  ]);
});

test('includes derived/compound entries from the <ul class="adjusted-par"> list', () => {
  const { entries } = parseKemendikdasmen(fixture('makan.html'));
  const compound = entries[0].definitions.find((d) =>
    d.text.includes('makan angin')
  );

  assert.ok(compound, 'expected "makan angin" compound definition to be parsed');
  assert.deepEqual(compound.labels, ['ki']);
});

test('parses the second homonym independently of the first', () => {
  const { entries } = parseKemendikdasmen(fixture('makan.html'));
  const [def] = entries[1].definitions;

  assert.deepEqual(def.labels, ['n', 'Ark']);
  assert.match(def.text, /tempat pemujaan/);
});

test('returns found:false with empty entries when the site reports "tidak ditemukan"', () => {
  const result = parseKemendikdasmen(fixture('notfound.html'));

  assert.deepEqual(result, { found: false, entries: [], suggestions: [] });
});

test('returns found:false when the page has no matching h2 entries at all', () => {
  // Regression guard for kbbi.kemendikdasmen.go.id serving a "Moda Terbatas"
  // login-wall page instead of results (observed 2026-08-26) — the parser
  // should degrade to found:false rather than throwing.
  const html = '<html><body><h1>Moda Terbatas</h1><p>Silakan masuk.</p></body></html>';
  const result = parseKemendikdasmen(html);

  assert.deepEqual(result, { found: false, entries: [], suggestions: [] });
});
