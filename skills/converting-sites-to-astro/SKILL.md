---
name: converting-sites-to-astro
description: "Converts an existing website (WordPress, page builders such as SiteOrigin, Elementor or Divi, or any static site) into a standalone Astro + Tailwind site that matches the live site pixel for pixel, with reduced DOM. Use when asked to rebuild, migrate, clone or port a live site to Astro."
---

# Converting sites to Astro

Rebuild a live site as a standalone Astro + Tailwind project whose pages match the live pages pixel for pixel, with no files loaded from the old site and a much smaller DOM.

The target is measured, not eyeballed: every page gets a pixel diff and a text-position diff against live screenshots at 1440, 900 and 390px. A page is done when its diff is under about 0.5% and every remaining band is explained (an embed that changes per load, image resampling, a live-site bug you chose not to copy).

## Tools

The scripts live in `scripts/` next to this file. Copy them to a working tools directory once and install them:

```sh
cp -r <skill-dir>/scripts /tmp/site-tools && cd /tmp/site-tools && npm i
export LIVE=https://www.example.com WORK=/tmp/site LOCAL=http://localhost:4321
```

Every script reads `LIVE`, `LOCAL` and `WORK` from the environment and prints its usage at the top of the file.

| Script | Does |
|---|---|
| `crawl.mjs <origin>` | Finds every page from sitemaps and links; writes `$WORK/urls.txt`, `$WORK/raw/*.html` and the 404 page |
| `assets.mjs <origin>` | Downloads every image, video, font and stylesheet the pages use; writes each page's inline `<style>` (page-builder layout CSS) to `$WORK/css/pages/`; lists off-site URLs in `$WORK/external.txt` |
| `clean.py <origin>` | Strips raw HTML to readable structure in `$WORK/clean/` (`uv run --with beautifulsoup4 --with lxml python clean.py …`) |
| `shot.mjs <width> <path>…` | Captures live reference screenshots; warns when a capture looks stitched |
| `compare.mjs <path> <width> [band]` | Pixel diff local vs reference, per horizontal band; writes `.sbs.png` (live \| local) and `.diff.png` |
| `textpos.mjs <path> <width>` | Text position and font diff, live vs local |
| `dump.mjs <url> <width> [scope]` | Tree of visible boxes, fonts, backgrounds and pseudo-elements |
| `probe.mjs <url> <width> <selector>…` | Computed styles of specific elements, including `::before`/`::after` |
| `audit.sh <project> <origin>` | Post-build check that the site stands alone |

## Workflow

### 1. Crawl and mirror

Run `crawl.mjs`, `assets.mjs` and `clean.py`. Read `urls.txt` and confirm it holds every page a visitor can reach, including blog posts, portfolio or case-study detail pages and the 404. Read `external.txt` and sort each host into: self-host (free fonts, icon fonts, images on a CDN), keep external (licensed fonts like Adobe Typekit, video embeds), or drop (analytics, CMS scripts).

Capture references for every page at all three widths with `shot.mjs`. View any capture it flags as stitched, and recapture it; a broken reference inflates diffs by 5–15% and looks like your bug.

### 2. Build the shell and one page

Set up the project following [reference/astro-setup.md](reference/astro-setup.md): 1px spacing unit, the theme's own breakpoints, its container as a `wrap` utility, theme base styles in `@layer base`, the `img()` helper, `allowedHosts` for portals.

Build `BaseLayout`, `Header` (including the mobile menu) and `Footer`, then the home page. Get the home page to its target at all three widths before anything else: its sections become the shared components every other page reuses, so errors there multiply.

Read real values from the live page with `dump.mjs` and `probe.mjs` rather than reconstructing them from the page-builder CSS cascade.

### 3. Fan out the remaining pages

Hand groups of pages to subagents, each owning distinct files (a page directory, its components, its data file). Give each one: the tools directory and env vars, the shared components and what they do, the target numbers, and these rules:

- Reuse shared components; change one only additively (a new optional prop or slot) and re-run the home page compare afterwards.
- Use the one shared dev server on port 4321 and run browser checks one at a time. Each extra dev server costs about 450 MB and each Chrome a few hundred more; parallel ones get OOM-killed.
- Leave committing, building and dev-server restarts to the main agent.
- Report final diffs per page and width, every remaining difference with its cause, and every decision about copying or fixing a live-site bug.

Pages that repeat one layout (case studies, blog posts, team members) become one route plus a data file or content collection, with `getStaticPaths` generating the exact old URLs.

### 4. Review each result

Re-run `compare.mjs` on a sample of each subagent's pages yourself, and the home page at 1440 and 390 after any shared-component change. When a reported diff is high, view the reference before blaming the page.

### 5. Audit, commit, present

Run `npx astro build`, then `audit.sh`. It must show no CMS paths, no assets from the old origin, and every crawled URL built. Commit. Present a table of diffs per page and width, side-by-side screenshots from `$WORK/cmp/*/<name>.sbs.png`, a portal link, the external dependencies kept, and the live-site bugs copied or fixed.

## Reducing the DOM

Page builders nest row → cell → widget → widget-style → content, often 15–20 levels deep. Rebuild each section from what it looks like, not from its markup:

- One element per visual box. A builder row with one cell is a single `<section>`; a multi-column row is one grid or flex container.
- Background images, overlays, patterns and decorative shapes go on `::before`/`::after` of the box that owns them, not extra divs.
- Spacing that the builder spreads over margins on several wrappers collapses to padding on one element; read the final box positions with `probe.mjs`.
- Native elements replace widget scripts: `<dialog>` for modals, `<details>` for accordions, ARIA `tablist`/`tab`/`tabpanel` with a small script for tabs.
- Measure it: count elements and nesting depth inside `<main>` for one live page and its rebuild, and report both.

## Gotchas

- **Margins that escape their parent.** Builder widgets often contain child margins (negative ones too) that a flat rebuild lets collapse through. When a block sits off by exactly a margin's size, add `flow-root` to the parent.
- **Whitespace between inline tags.** Astro drops a line break between text and an inline tag, gluing words together ("moreabout us"). Keep a paragraph with inline links on one line.
- **Copy-or-fix decisions.** Live sites carry broken images, wrong links, copy-pasted SEO titles, hidden rows and text that overlaps on mobile. Decide each one explicitly, keep the pixel match by default, and list every one in the final report so the user can choose.
- **Embeds that differ per load** (Google Drive, YouTube, maps, review widgets) dominate the diff of the bands they sit in. Report the diff with those bands excluded. Replace third-party review widgets with local data and a component.
- **Responsive images.** Astro serves smaller WebP files than the old site, which causes 1–3% resampling noise in image bands. Accept it unless a height is off; then request the old site's widths.
- **Forms.** Rebuild every form's fields, labels and layout; wire submission only if asked.
