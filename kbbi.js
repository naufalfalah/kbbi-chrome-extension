/**
 * Shared KBBI fetch + parse logic.
 * kbbi.web.id stores definitions as JSON inside <div id="jsdata">.
 * Each entry has: { x, w, d, msg }
 *   x  – entry type (1 = primary, 5 = related/derived)
 *   w  – word lemma string
 *   d  – HTML string of definitions
 *   msg – optional "not found" message
 */

const KBBI_BASE = 'https://kbbi.web.id';

/**
 * Fetch and parse a word from kbbi.web.id.
 * @param {string} word
 * @returns {Promise<{found: boolean, entries: Array, suggestions: string[]}>}
 */
async function searchKBBI(word) {
  const url = `${KBBI_BASE}/${encodeURIComponent(word.trim().toLowerCase())}`;
  const res = await fetch(url);

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  return parseKBBI(html);
}

/**
 * Parse the KBBI page HTML.
 */
function parseKBBI(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // --- Primary path: parse from #jsdata JSON ---
  const jsdataEl = doc.querySelector('#jsdata');
  if (jsdataEl) {
    const raw = jsdataEl.textContent.trim();
    if (raw) {
      try {
        const jsonData = JSON.parse(raw);
        return parseFromJSON(jsonData, doc);
      } catch (_) {
        // fall through to HTML parser
      }
    }
  }

  // --- Fallback: parse HTML directly ---
  return parseFromHTML(doc);
}

// ─────────────────────────────────────────────
// JSON path
// ─────────────────────────────────────────────

function parseFromJSON(jsonData, doc) {
  // Normalize to array
  const items = Array.isArray(jsonData) ? jsonData : [jsonData];

  // Check for "not found" message in the first item
  const firstMsg = items[0]?.msg || '';
  const notFound =
    firstMsg.includes('tidak ditemukan') ||
    firstMsg.includes('Entri tidak ditemukan') ||
    (items.length === 1 && !items[0].d && !items[0].w);

  if (notFound) {
    const suggestions = extractSuggestions(doc);
    return { found: false, entries: [], suggestions };
  }

  const entries = [];

  items.forEach((item) => {
    if (!item.d) return;

    // Parse the HTML fragment stored in item.d
    const defDoc = new DOMParser().parseFromString(item.d, 'text/html');
    const entry = parseDefinitionHTML(defDoc.body, item.w || '');
    if (entry) entries.push(entry);
  });

  const suggestions = entries.length === 0 ? extractSuggestions(doc) : [];
  return { found: entries.length > 0, entries, suggestions };
}

/**
 * Parse the HTML fragment from item.d.
 *
 * kbbi.web.id HTML structure inside item.d:
 *   <b>ma·kan¹</b> <em>v</em>
 *   <b>1</b> definition text <em>example</em> ;
 *   <b>2</b> <span class="jk">ki</span> fig meaning <em>example</em>
 *   -- <b>makan angin</b> (v) compound def
 */
function parseDefinitionHTML(body, rawWord) {
  // Find the entry word from the first <b> tag (bold word heading)
  const firstB = body.querySelector('b');
  const entryWord = firstB ? firstB.textContent.trim() : rawWord.trim();

  const definitions = [];

  // Collect all top-level child nodes into a flat array
  const nodes = Array.from(body.childNodes);

  // Split content into numbered segments
  // A numbered definition starts with a <b> tag containing only digits
  const segments = [];
  let current = null;

  for (const node of nodes) {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'B') {
      const text = node.textContent.trim();
      if (/^\d+$/.test(text)) {
        // Start of a new numbered definition
        if (current) segments.push(current);
        current = { num: parseInt(text, 10), nodes: [] };
        continue;
      }
    }
    if (current) {
      current.nodes.push(node);
    }
  }
  if (current) segments.push(current);

  if (segments.length === 0) {
    // No numbered defs — try to grab the whole body text as one definition
    const bodyText = body.textContent.trim().replace(/\s+/g, ' ');
    if (bodyText && bodyText !== entryWord) {
      definitions.push({ type: 'definition', text: bodyText, examples: [], labels: [] });
    }
  } else {
    segments.forEach((seg) => {
      const def = extractDefFromNodes(seg.nodes);
      definitions.push(def);
    });
  }

  // Look for compound words (-- prefix pattern or <ul> elements)
  body.querySelectorAll('ul > li, ol > li').forEach((li) => {
    const text = li.textContent.trim().replace(/\s+/g, ' ');
    if (text) definitions.push({ type: 'compound', text, examples: [] });
  });

  if (!entryWord && definitions.length === 0) return null;
  return { word: entryWord, definitions };
}

function extractDefFromNodes(nodes) {
  const labels = [];
  const examples = [];
  const textParts = [];

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent.trim();
      if (t) textParts.push(t);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName;
      const cls = node.className || '';
      const text = node.textContent.trim();

      if (tag === 'EM' || tag === 'I') {
        // em tags can be grammar labels (short, often 1-3 chars) or examples
        if (text.length <= 4 && /^[a-zA-Z.]+$/.test(text)) {
          labels.push(text);
        } else if (text) {
          examples.push(text);
        }
      } else if (cls.includes('jk') || cls.includes('lbl') || tag === 'SPAN') {
        if (text) labels.push(text);
      } else if (text) {
        textParts.push(text);
      }
    }
  }

  const text = textParts
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*[;,]\s*/, '')
    .trim();

  return { type: 'definition', text, examples, labels };
}

// ─────────────────────────────────────────────
// HTML fallback path
// ─────────────────────────────────────────────

function parseFromHTML(doc) {
  const suggestions = extractSuggestions(doc);
  const entries = [];

  // Look for bold+sup pattern: <b>word<sup>n</sup></b>
  const boldEls = doc.querySelectorAll('b');
  boldEls.forEach((b) => {
    if (b.querySelector('sup') || /[·]/.test(b.textContent)) {
      const word = b.textContent.trim();
      // Collect sibling nodes for definitions
      const defs = [];
      let sib = b.nextSibling;
      const defNodes = [];
      while (sib && !(sib.nodeType === Node.ELEMENT_NODE && sib.tagName === 'B' && sib.querySelector('sup'))) {
        defNodes.push(sib);
        sib = sib.nextSibling;
      }
      const def = extractDefFromNodes(defNodes);
      if (def.text) defs.push(def);
      entries.push({ word, definitions: defs });
    }
  });

  // Try article/div-based structure
  if (entries.length === 0) {
    doc.querySelectorAll('article, #desc, #d1').forEach((container) => {
      const wordEl = container.querySelector('b, h2, h3');
      const word = wordEl?.textContent.trim() || '';
      const defs = [];
      container.querySelectorAll('li').forEach((li) => {
        const text = li.textContent.trim().replace(/\s+/g, ' ');
        if (text) defs.push({ type: 'definition', text, examples: [], labels: [] });
      });
      if (word || defs.length > 0) entries.push({ word, definitions: defs });
    });
  }

  return {
    found: entries.length > 0 && entries.some((e) => e.definitions.length > 0),
    entries,
    suggestions,
  };
}

// ─────────────────────────────────────────────
// Suggestion extraction
// ─────────────────────────────────────────────

function extractSuggestions(doc) {
  const suggestions = [];
  const seen = new Set();

  doc.querySelectorAll('.saran a, .mirip a, ul.list-group a, .suggestion a, a[href^="/"]').forEach((a) => {
    const text = a.textContent.trim();
    const href = a.getAttribute('href') || '';
    // Only include links that look like word entries (short path, no slashes after first)
    if (text && !seen.has(text) && /^\/[^/]+$/.test(href)) {
      seen.add(text);
      suggestions.push(text);
    }
  });

  return suggestions.slice(0, 10);
}
