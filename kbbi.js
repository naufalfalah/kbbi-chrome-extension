/**
 * KBBI fetch + parse logic for kbbi.kemendikdasmen.go.id (KBBI VI Daring).
 *
 * HTML structure of /entri/{word}:
 *
 *   <h2 style="margin-bottom:3px">ma.kan<sup>1</sup></h2>
 *   <ol>
 *     <li>
 *       <font color="red"><i>
 *         <span title="Verba: kata kerja">v</span>
 *         <span title="kiasan"><font color="green">ki</font></span>
 *       </i></font>
 *       definition text:
 *       <font color="grey"><i>usage example</i></font>
 *     </li>
 *   </ol>
 *   <ul class="adjusted-par">...</ul>  <!-- derived/related words -->
 *
 *   Not found: <h4 style="color:red">Entri tidak ditemukan.</h4>
 */

const KBBI_BASE = 'https://kbbi.kemendikdasmen.go.id';

/**
 * Fetch and parse a word from kbbi.kemendikdasmen.go.id.
 * @param {string} word
 * @returns {Promise<{found: boolean, entries: Array, suggestions: string[]}>}
 */
async function searchKBBI(word) {
  const encoded = encodeURIComponent(word.trim());
  const url = `${KBBI_BASE}/entri/${encoded}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return parseKBBI(html);
}

function parseKBBI(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // "Not found" signal: red h4 with "Entri tidak ditemukan"
  const redH4 = doc.querySelector('h4[style*="color:red"], h4[style*="color: red"]');
  if (redH4 && redH4.textContent.includes('tidak ditemukan')) {
    return { found: false, entries: [], suggestions: [] };
  }

  // Word entries are marked by <h2> tags that have a <sup> child
  // (the homonym number, e.g. ma.kan¹ ma.kan²)
  // or by h2 with inline margin-bottom style.
  const allH2 = Array.from(doc.querySelectorAll('h2'));
  const entryH2s = allH2.filter(
    (h2) =>
      h2.querySelector('sup') ||
      (h2.getAttribute('style') || '').includes('margin-bottom')
  );

  if (entryH2s.length === 0) {
    return { found: false, entries: [], suggestions: [] };
  }

  const entries = [];

  entryH2s.forEach((h2) => {
    const word = h2.textContent.trim().replace(/\s+/g, ' ');

    // Walk forward siblings until the next entry h2 to collect definition lists
    const definitions = [];
    let sibling = h2.nextElementSibling;

    while (
      sibling &&
      sibling.tagName !== 'HR' &&
      sibling.tagName !== 'H4' &&
      !(
        sibling.tagName === 'H2' &&
        (sibling.querySelector('sup') ||
          (sibling.getAttribute('style') || '').includes('margin-bottom'))
      )
    ) {
      if (sibling.tagName === 'OL' || sibling.tagName === 'UL') {
        sibling.querySelectorAll('li').forEach((li) => {
          const def = parseLi(li);
          if (def) definitions.push(def);
        });
      }
      sibling = sibling.nextElementSibling;
    }

    entries.push({ word, definitions });
  });

  const found = entries.length > 0 && entries.some((e) => e.definitions.length > 0);
  return { found, entries, suggestions: [] };
}

/**
 * Parse a single <li> element into a structured definition object.
 *
 * <li>
 *   <font color="red"><i>
 *     <span title="Verba: ...">v</span>
 *     <span title="kiasan"><font color="green">ki</font></span>
 *   </i></font>
 *   definition text:
 *   <font color="grey"><i>example</i></font>
 *   <font color="brown"><i>gloss/clarification</i></font>
 * </li>
 */
function parseLi(li) {
  const labels = [];
  const examples = [];

  // Grammar labels: spans inside red font>i
  li.querySelectorAll('font[color="red"] i span').forEach((span) => {
    // Skip spans that only wrap green font (handled separately)
    if (!span.querySelector('font')) {
      const text = span.textContent.trim();
      if (text) labels.push(text);
    }
  });

  // Usage-type labels: green font (ki, pb, Ark, Tas, …)
  li.querySelectorAll('font[color="green"]').forEach((el) => {
    const text = el.textContent.trim();
    if (text) labels.push(text);
  });

  // Usage examples: grey font italic (skip bare semicolons / whitespace)
  li.querySelectorAll('font[color="grey"] i').forEach((el) => {
    const text = el.textContent.trim();
    if (text && text !== ';' && text !== ',') examples.push(text);
  });

  // Brown font = parenthetical gloss after an example (treat as example)
  li.querySelectorAll('font[color="brown"] i').forEach((el) => {
    const text = el.textContent.trim();
    if (text) examples.push(`(${text})`);
  });

  // Definition text = everything left after removing font elements
  const clone = li.cloneNode(true);
  clone.querySelectorAll('font').forEach((el) => el.remove());
  const text = clone.textContent
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/:\s*$/, '')
    .trim();

  if (!text && labels.length === 0) return null;
  return { type: 'definition', text, labels, examples };
}
