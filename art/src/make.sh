#!/bin/bash
# Re-renders the profile art: serves the repo, records each loop in headless Chrome, encodes WebP.
# Needs Node 22+, Chrome (or Chromium, Edge, Brave), Python 3 with Pillow. Run from the repo root.
set -e
frames=$(mktemp -d)
python3 -m http.server 5099 --bind 127.0.0.1 >/dev/null 2>&1 & server=$!
trap 'kill $server' EXIT
sleep 1
PREROLL=9 ALPHA=1 TOUR='[["top",0,0,9.0]]' node art/src/record.mjs "http://127.0.0.1:5099/art/src/banner.html" "$frames/banner" 1800 720 1 light 30
for p in superuser mnesio murmuration ferro; do
  PREROLL=8 ALPHA=1 TOUR='[["top",0,0,8.0]]' node art/src/record.mjs "http://127.0.0.1:5099/art/src/card.html?p=$p" "$frames/$p" 1600 560 1 light 30
done
python3 art/src/encode.py "$frames" art
