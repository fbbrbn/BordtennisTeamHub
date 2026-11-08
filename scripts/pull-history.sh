#!/usr/bin/env bash
# Copies the past seasons from the `history` branch into public/history/ for the site:
# every past pool, by pool id (pool ids are unique across seasons), the per-player index and the
# head-to-head records.
# Used by .github/workflows/site.yml and by `npm run history:pull`.
set -euo pipefail

out="public/history"
rm -rf -- "$out"
mkdir -p "$out/pools" "$out/players" "$out/h2h"
if ! git fetch --depth 1 origin history 2>/dev/null; then
  echo "No history branch yet: building without past seasons."
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT
git archive FETCH_HEAD | tar -x -C "$tmp"
find "$tmp" -path '*/pools/*.json' -exec cp {} "$out/pools/" \;
if [ -d "$tmp/players" ]; then
  cp "$tmp"/players/*.json "$out/players/"
fi
if [ -d "$tmp/h2h" ]; then
  cp "$tmp"/h2h/*.json "$out/h2h/"
fi
echo "Past seasons: $(ls "$out/pools" | wc -l) pools, $(ls "$out/players" | wc -l) player files, $(ls "$out/h2h" | wc -l) head-to-head files."
