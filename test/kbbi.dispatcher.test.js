const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

global.DOMParser = new JSDOM('').window.DOMParser;

// Mirrors the <script src> load order in popup.html/results.html: parsers
// register themselves on globalThis.KBBIParsers as a side effect of being
// required, then kbbi.js's dispatcher reads that registry.
require('../parsers/kemendikdasmen.js');
require('../parsers/kbbiwebid.js');
const { searchKBBI, getActiveSource, ACTIVE_SOURCE } = require('../kbbi.js');

test('ACTIVE_SOURCE names a registered parser', () => {
  assert.ok(
    globalThis.KBBIParsers[ACTIVE_SOURCE],
    `expected globalThis.KBBIParsers.${ACTIVE_SOURCE} to be registered`
  );
});

test('getActiveSource returns the registered source with buildUrl/parse/label', () => {
  const source = getActiveSource();
  assert.equal(source, globalThis.KBBIParsers[ACTIVE_SOURCE]);
  assert.equal(typeof source.buildUrl, 'function');
  assert.equal(typeof source.parse, 'function');
  assert.equal(typeof source.label, 'string');
});

test('searchKBBI fetches the active source\'s URL and parses the response', async (t) => {
  const originalFetch = global.fetch;
  const calledUrls = [];
  global.fetch = async (url) => {
    calledUrls.push(url);
    return { ok: true, text: async () => '<html><body></body></html>' };
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const result = await searchKBBI('makan');

  const expectedUrl = globalThis.KBBIParsers[ACTIVE_SOURCE].buildUrl('makan');
  assert.deepEqual(calledUrls, [expectedUrl]);
  assert.equal(result.found, false); // empty HTML has no entries
});

test('searchKBBI throws on a non-OK HTTP response', async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 503 });
  t.after(() => {
    global.fetch = originalFetch;
  });

  await assert.rejects(() => searchKBBI('makan'), /HTTP 503/);
});
