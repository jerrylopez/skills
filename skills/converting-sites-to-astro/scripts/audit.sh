#!/usr/bin/env bash
# Check a built Astro site stands alone.
# usage: audit.sh <project-dir> <origin>   (run after `npx astro build`)
# Reports: CMS paths left in dist, every reference to the old origin (should be canonical/og:url only),
# external hosts still loaded, and crawled URLs with no built page.
set -u
dir=${1:?project dir}; origin=${2:?origin}; work=${WORK:-/tmp/site}
host=$(echo "$origin" | sed -E 's#^https?://(www\.)?##; s#/.*##')
cd "$dir/dist" || { echo "no dist/: run npx astro build"; exit 1; }

echo "== CMS paths (expect none)"
rg -l 'wp-content|wp-includes|wp-json|admin-ajax|/sites/default/files|squarespace-cdn|wixstatic' . || echo "none"

echo "== References to $host (expect canonical/og:url and intentional links only)"
rg -o "<[a-z]+[^>]*${host//./\\.}[^>]*>" --no-filename . | sed -E 's/(href|content|src)="[^"]*"/\1=…/' | sort | uniq -c | sort -rn | head -20
rg -o "(src|srcset|url\()[^>]*${host//./\\.}" --no-filename . | head -5 | sed 's/^/ASSET FROM OLD SITE: /'

echo "== External hosts"
rg -o 'https?://[a-z0-9.-]+' --no-filename -g '*.html' -g '*.css' -g '*.js' . | sort | uniq -c | sort -rn

echo "== Crawled URLs without a built page"
missing=0
while read -r p; do [ -z "$p" ] && continue; [ -f ".${p%/}/index.html" ] || [ -f ".${p}" ] || [ -f ".${p%/}.html" ] || { echo "MISSING $p"; missing=1; }; done < "$work/urls.txt"
[ -f 404.html ] || { echo "MISSING 404.html"; missing=1; }
[ $missing = 0 ] && echo "all $(wc -l < "$work/urls.txt") pages + 404 present"
