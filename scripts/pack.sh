#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./manifest.json').version")
OUT="kbbi-extension-v${VERSION}.zip"

rm -f "$OUT"
zip -r "$OUT" \
  manifest.json background.js kbbi.js render.js shared.css \
  parsers popup.html popup.js results.html results.js icons \
  -x "*.DS_Store"

echo "Created $OUT"
