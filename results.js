const input = document.getElementById('searchInput');
const btn = document.getElementById('searchBtn');
const results = document.getElementById('results');
const queryLabel = document.getElementById('queryLabel');

function onSuggestionClick(word) {
  input.value = word;
  doSearch(word);
}

async function doSearch(word) {
  word = word.trim();
  if (!word) return;

  // Update URL without reload
  const url = new URL(window.location.href);
  url.searchParams.set('word', word);
  window.history.replaceState(null, '', url.toString());

  document.title = `${word} — KBBI`;
  queryLabel.style.display = 'block';
  queryLabel.innerHTML = `Hasil pencarian untuk: <strong>"${escHtml(word)}"</strong>`;

  btn.disabled = true;
  input.value = word;
  renderLoading(results);

  try {
    const data = await searchKBBI(word);
    renderResults(data, results, word);
  } catch (err) {
    renderError(results, `Gagal menghubungi KBBI: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

btn.addEventListener('click', () => doSearch(input.value));
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch(input.value);
});

// On load: read ?word= from URL
document.addEventListener('DOMContentLoaded', () => {
  input.focus();
  const params = new URLSearchParams(window.location.search);
  const word = params.get('word');
  if (word) {
    doSearch(word);
  }
});

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
