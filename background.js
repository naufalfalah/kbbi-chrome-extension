chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'cari-kbbi',
    title: 'Cari "%s" di KBBI',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'cari-kbbi' && info.selectionText) {
    const word = info.selectionText.trim();
    chrome.tabs.create({
      url: chrome.runtime.getURL(`results.html?word=${encodeURIComponent(word)}`),
    });
  }
});
