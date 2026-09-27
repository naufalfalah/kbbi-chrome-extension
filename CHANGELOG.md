# Changelog

All notable changes to this extension are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); version
numbers match `manifest.json` and the Chrome Web Store listing.

Changes forced by a KBBI source site (markup, URL scheme, access policy)
are listed under **Source changes**, each with the date it was observed,
what changed on the site, and what was changed here in response.

## [Unreleased]

### Fixed
- Lookup error messages said "KBBI VI Daring" even while kbbi.web.id was
  the active source; they now name whichever source is active.

### Added
- `npm run package` (`scripts/pack.sh`) builds the Chrome Web Store zip
  from an allow-list of runtime files, so tests, docs, CI config and
  `node_modules/` can't end up in the store package.

### Documentation
- Privacy policy no longer lists the `tabs` permission, which the
  manifest never declared.
- README now covers the `parsers/` layout, dev-only files, `npm test`,
  and the packaging/release steps.

## [1.0.1] — 2026-08-29

### Source changes
- **kbbi.kemendikdasmen.go.id — observed 2026-08-26**
  - *On the site:* anonymous requests to `/entri/{word}` return a
    "Moda Terbatas" login-wall page instead of the dictionary entry.
  - *Impact:* every lookup showed "word not found", because the parser
    reads the login page as an ordinary not-found result. The failure was
    silent — no error was thrown.
  - *Fix:* added a parser for kbbi.web.id and made it the active source.
    The kemendikdasmen parser, fixtures and tests are kept, so switching
    back is a one-line change (`ACTIVE_SOURCE` in `kbbi.js`). See
    [ADR 0001](docs/adr/0001-multi-source-kbbi-data.md).

### Added
- kbbi.web.id as a second data source (`parsers/kbbiwebid.js`), with its
  host permission. `kbbi.js` is now a dispatcher over per-source parsers.
- Parser tests (`node:test` + `jsdom`) with saved HTML fixtures for both
  sources.
- CI: manifest validation, JS syntax check, parser tests, and PR title lint.

### Fixed
- The "view full entry" link always pointed to kbbi.kemendikdasmen.go.id,
  regardless of which source the definitions came from.

## [1.0.0] — 2026-08-26

Initial tagged release. The extension was first published on the Chrome
Web Store in April 2026.

### Added
- Toolbar popup lookup and right-click context-menu lookup (opens a
  full-page results tab).
- Homonym-aware result cards with grammar/register labels and usage
  examples.
- Definitions fetched from kbbi.kemendikdasmen.go.id (KBBI VI Daring).
  Before the first store release the extension used kbbi.web.id; it was
  moved to the official site on 2026-04-03.

[Unreleased]: https://github.com/naufalfalah/kbbi-chrome-extension/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/naufalfalah/kbbi-chrome-extension/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/naufalfalah/kbbi-chrome-extension/releases/tag/v1.0.0
