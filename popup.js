const input = document.getElementById('searchInput');
const btn = document.getElementById('searchBtn');
const results = document.getElementById('results');

// Called by render.js when user clicks a suggestion chip
function onSuggestionClick(word) {
  input.value = word;
  doSearch(word);
}

async function doSearch(word) {
  word = word.trim();
  if (!word) return;

  btn.disabled = true;
  renderLoading(results);

  try {
    const data = await searchKBBI(word);
    renderResults(data, results, word);
  } catch (err) {
    renderError(results, `Gagal menghubungi KBBI VI Daring: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

btn.addEventListener('click', () => doSearch(input.value));
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch(input.value);
});

input.focus();
