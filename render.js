/**
 * Shared rendering logic for KBBI results.
 * Used by both popup.js and results.js.
 */

function renderResults(data, container, word) {
  container.innerHTML = '';

  if (!data.found) {
    if (data.suggestions && data.suggestions.length > 0) {
      renderNotFoundWithSuggestions(data.suggestions, container);
    } else {
      container.innerHTML = `
        <div class="status error">
          Kata <strong>"${escHtml(word)}"</strong> tidak ditemukan di KBBI.
        </div>`;
    }
    return;
  }

  data.entries.forEach((entry) => {
    const card = document.createElement('div');
    card.className = 'entry';

    const header = document.createElement('div');
    header.className = 'entry-header';
    header.textContent = entry.word;
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'entry-body';

    if (entry.definitions.length === 0) {
      body.innerHTML = `<p class="def-text" style="color:var(--text-muted);font-style:italic">Tidak ada definisi tersedia.</p>`;
    } else {
      const ol = document.createElement('ul');
      ol.className = 'def-list';

      let defIndex = 0;
      entry.definitions.forEach((def) => {
        const li = document.createElement('li');

        if (def.type === 'compound') {
          li.className = 'compound-item';
          li.textContent = def.text;
        } else {
          defIndex++;
          li.className = 'def-item';

          const numEl = document.createElement('div');
          numEl.className = 'def-num';
          numEl.textContent = defIndex;

          const contentEl = document.createElement('div');
          contentEl.className = 'def-content';

          if (def.labels && def.labels.length > 0) {
            const labelsEl = document.createElement('div');
            labelsEl.className = 'def-labels';
            def.labels.forEach((lbl) => {
              const span = document.createElement('span');
              span.className = 'label';
              span.textContent = lbl;
              labelsEl.appendChild(span);
            });
            contentEl.appendChild(labelsEl);
          }

          const textEl = document.createElement('span');
          textEl.className = 'def-text';
          textEl.textContent = def.text;
          contentEl.appendChild(textEl);

          if (def.examples && def.examples.length > 0) {
            const examplesEl = document.createElement('div');
            examplesEl.className = 'def-examples';
            def.examples.forEach((ex) => {
              const span = document.createElement('span');
              span.className = 'def-example';
              span.textContent = ex;
              examplesEl.appendChild(span);
            });
            contentEl.appendChild(examplesEl);
          }

          li.appendChild(numEl);
          li.appendChild(contentEl);
        }

        ol.appendChild(li);
      });

      body.appendChild(ol);
    }

    card.appendChild(body);
    container.appendChild(card);
  });

  // Source link
  const link = document.createElement('a');
  link.className = 'kbbi-link';
  link.href = `https://kbbi.web.id/${encodeURIComponent(word)}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Lihat di kbbi.web.id ↗';
  container.appendChild(link);
}

function renderNotFoundWithSuggestions(suggestions, container) {
  const sugDiv = document.createElement('div');
  sugDiv.className = 'suggestions';
  sugDiv.innerHTML = `<h3>Mungkin maksud Anda:</h3>`;

  const listEl = document.createElement('div');
  listEl.className = 'sug-list';

  suggestions.forEach((sug) => {
    const btn = document.createElement('button');
    btn.className = 'sug-btn';
    btn.textContent = sug;
    btn.addEventListener('click', () => {
      if (typeof onSuggestionClick === 'function') {
        onSuggestionClick(sug);
      }
    });
    listEl.appendChild(btn);
  });

  sugDiv.appendChild(listEl);
  container.appendChild(sugDiv);
}

function renderLoading(container) {
  container.innerHTML = `
    <div class="status">
      <div class="spinner"></div>
      <div>Mencari definisi…</div>
    </div>`;
}

function renderError(container, message) {
  container.innerHTML = `
    <div class="status error">
      ${escHtml(message)}
    </div>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
