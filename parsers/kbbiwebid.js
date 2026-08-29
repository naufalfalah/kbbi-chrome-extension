/**
 * Parser for kbbi.web.id (unofficial, community-run mirror based on KBBI III).
 *
 * Unlike kbbi.kemendikdasmen.go.id, each homonym lives on its own URL
 * (/makan, /makan-2, …) and all its content — numbered senses, idioms,
 * and derived word forms (imbuhan) — sits in a single flat container:
 *
 *   <div id="d1">
 *     <b>ma&#183;kan<sup>1</sup></b> <em>v</em> definisi pertama:
 *     <em>mereka -- tiga kali sehari</em>;
 *     <b>2</b> <em>v</em> definisi kedua: <em>ia sedang -- pisang</em>;
 *     ...
 *     <b>-- angin</b> <em>ki</em> definisi idiom;
 *     <br/><br/>
 *     <b>me&#183;ma&#183;kan</b> <em>v</em> definisi kata turunan;
 *   </div>
 *
 *   Not found: <div id="d1">…<span class="notfound">…</span></div>
 *
 * There is no other markup (no font colors, no separate <li> per sense) to
 * hang parsing off of, so entries are told apart purely by whether a <b>
 * tag's content is a bare number (a new numbered sense of the headword) or
 * text (a new idiom / derived-word block). "--" stands in for the headword
 * in examples on the live site; we drop bare "--" tokens rather than try to
 * substitute the real word back in.
 */

const KBBI_WEBID_BASE = 'https://kbbi.web.id';

function buildKbbiWebIdUrl(word) {
  return `${KBBI_WEBID_BASE}/${encodeURIComponent(word)}`;
}

function isLabelText(text) {
  return /^[A-Za-z]{1,8}(\s[A-Za-z]{1,8}){0,2}$/.test(text) && !text.includes('--');
}

function cleanText(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[:;,.\s]+|[:;,\s]+$/g, '')
    .trim();
}

function flushDefinition(current, definitions) {
  if (!current) return;
  let text = cleanText(current.textParts.join(''));
  if (current.headwordText) {
    text = `${current.headwordText} ${text}`.trim();
  }
  const examples = current.examples.map(cleanText).filter(Boolean);
  if (text || current.labels.length) {
    definitions.push({ type: current.type, text, labels: current.labels, examples });
  }
}

function parseKbbiWebId(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const container = doc.querySelector('#d1');
  if (!container || container.querySelector('.notfound')) {
    return { found: false, entries: [], suggestions: [] };
  }

  const firstBold = container.querySelector('b');
  if (!firstBold) return { found: false, entries: [], suggestions: [] };

  const word = firstBold.textContent.trim().replace(/·/g, '.').replace(/\s+/g, ' ');

  const definitions = [];
  let current = null;
  let seenHeadword = false;

  Array.from(container.childNodes).forEach((node) => {
    if (node.nodeType === 1 && node.tagName === 'B') {
      const raw = node.textContent.trim();

      if (!seenHeadword) {
        seenHeadword = true;
        current = { type: 'definition', labels: [], examples: [], textParts: [], awaitingLabel: true, headwordText: null };
        return;
      }

      if (/^\d+$/.test(raw)) {
        if (current && current.type === 'compound') {
          // Nested sub-sense of the current idiom/derived word — keep inline.
          current.textParts.push(` ${raw}`);
          current.awaitingLabel = false;
        } else {
          flushDefinition(current, definitions);
          current = { type: 'definition', labels: [], examples: [], textParts: [], awaitingLabel: true, headwordText: null };
        }
        return;
      }

      // Non-numeric bold = a new idiom or derived-word headword.
      flushDefinition(current, definitions);
      current = {
        type: 'compound',
        labels: [],
        examples: [],
        textParts: [],
        awaitingLabel: true,
        headwordText: raw.replace(/·/g, '.'),
      };
      return;
    }

    if (!current) return;

    if (node.nodeType === 1 && node.tagName === 'EM') {
      const text = node.textContent.trim();
      if (!text) return;
      if (current.awaitingLabel && isLabelText(text)) {
        text.split(/\s+/).forEach((label) => current.labels.push(label));
      } else {
        current.examples.push(text);
      }
      current.awaitingLabel = false;
      return;
    }

    if (node.nodeType === 1 && node.tagName === 'BR') return;

    const text = node.textContent;
    if (text.trim() && text.trim() !== '--') current.awaitingLabel = false;
    if (text.trim() !== '--') current.textParts.push(text);
  });

  flushDefinition(current, definitions);

  const found = definitions.length > 0;
  return {
    found,
    entries: found ? [{ word, definitions }] : [],
    suggestions: [],
  };
}

const kbbiWebIdSource = {
  buildUrl: buildKbbiWebIdUrl,
  parse: parseKbbiWebId,
  label: 'kbbi.web.id',
};

if (typeof globalThis !== 'undefined') {
  globalThis.KBBIParsers = globalThis.KBBIParsers || {};
  globalThis.KBBIParsers.kbbiwebid = kbbiWebIdSource;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = kbbiWebIdSource;
}
