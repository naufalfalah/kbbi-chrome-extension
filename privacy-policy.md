# Privacy Policy — KBBI Chrome Extension

[Bahasa Indonesia](#indonesia) | [English](#english)

---

## Bahasa Indonesia <a name="indonesia"></a>

Kebijakan Privasi — KBBI Chrome Extension
Terakhir diperbarui: Agustus 2026

1. Data yang Dikumpulkan
KBBI Chrome Extension tidak mengumpulkan, menyimpan, atau mengirimkan data pribadi pengguna kepada pengembang maupun pihak ketiga mana pun.

2. Penggunaan Jaringan
Satu-satunya koneksi jaringan yang dibuat oleh ekstensi ini adalah permintaan HTTP GET ke salah satu sumber data KBBI berikut (dipilih oleh pengembang di dalam kode, bukan oleh pengguna):
  https://kbbi.kemendikdasmen.go.id/entri/{kata}
  https://kbbi.web.id/{kata}
Permintaan ini dilakukan semata-mata untuk mengambil definisi kata yang Anda cari secara aktif. Tidak ada data pengguna yang dikirimkan dalam permintaan tersebut selain kata yang Anda masukkan.

3. Penyimpanan Lokal
Ekstensi ini tidak menggunakan chrome.storage, localStorage, IndexedDB, atau mekanisme penyimpanan apa pun. Tidak ada riwayat pencarian yang disimpan.

4. Izin (Permissions)
• contextMenus — untuk mendaftarkan menu klik kanan "Cari di KBBI".
• tabs — untuk membuka tab hasil dari menu klik kanan.
• host_permissions (kbbi.kemendikdasmen.go.id dan kbbi.web.id) — untuk melewati batasan CORS saat mengambil definisi dari sumber data yang sedang aktif.
Tidak ada izin yang digunakan untuk melacak aktivitas penelusuran Anda di luar fungsi pencarian kamus.

5. Perubahan Kebijakan
Jika ada perubahan pada kebijakan ini, pembaruan akan dipublikasikan di halaman GitHub repositori ekstensi ini.

6. Kontak
Pertanyaan dapat diajukan melalui: https://github.com/naufalfalah/kbbi-chrome-extension/issues

---

## English <a name="english"></a>

Privacy Policy — KBBI Chrome Extension
Last updated: August 2026

1. Data Collected
KBBI Chrome Extension does not collect, store, or transmit any personal data to the developer or any third party.

2. Network Usage
The only network connection made by this extension is an HTTP GET request to one of the following KBBI data sources (selected by the developer in code, not by the user):
  https://kbbi.kemendikdasmen.go.id/entri/{word}
  https://kbbi.web.id/{word}
This request is made solely to retrieve the definition of the word you actively search for. No user data is transmitted in this request beyond the word you typed.

3. Local Storage
This extension does not use chrome.storage, localStorage, IndexedDB, or any other storage mechanism. No search history is saved.

4. Permissions
• contextMenus — to register the right-click "Search in KBBI" menu item.
• tabs — to open a results tab from the context menu.
• host_permissions (kbbi.kemendikdasmen.go.id and kbbi.web.id) — to bypass CORS restrictions when fetching definitions from whichever source is currently active.
No permissions are used to track your browsing activity beyond the dictionary search function.

5. Policy Changes
If this policy changes, updates will be published on the GitHub repository page for this extension.

6. Contact
Questions can be submitted at: https://github.com/naufalfalah/kbbi-chrome-extension/issues