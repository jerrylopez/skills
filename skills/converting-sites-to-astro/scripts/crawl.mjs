// Find every page on a site and save its HTML.
// usage: node crawl.mjs <origin> [max=500]
// Sources: robots.txt sitemaps, /sitemap.xml, /sitemap_index.xml, /wp-sitemap.xml, then a
// breadth-first walk of same-host <a href> links. Also saves the 404 page.
// Writes $WORK/urls.txt (one path per line) and $WORK/raw/<name>.html.
import fs from 'node:fs';
import { nameFor, WORK } from './lib.mjs';

const origin = (process.argv[2] || '').replace(/\/$/, '');
const max = +(process.argv[3] || 500);
if (!origin) { console.error('usage: node crawl.mjs <origin> [max]'); process.exit(1); }
const host = new URL(origin).host.replace(/^www\./, '');
fs.mkdirSync(`${WORK}/raw`, { recursive: true });

const get = async url => { try { const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 site-crawl' } }); return { status: r.status, type: r.headers.get('content-type') || '', text: await r.text(), url: r.url }; } catch { return { status: 0, type: '', text: '' }; } };
const SKIP = /\.(jpe?g|png|gif|webp|svg|pdf|zip|mp4|webm|mp3|css|js|xml|ico|woff2?)$|\/(wp-admin|wp-json|wp-login|feed|xmlrpc|cart|checkout|my-account)\b|\/(tag|author|category)\/|\/page\/\d+|[?#]/i;
const normalize = href => {
  try {
    const u = new URL(href, origin + '/');
    if (u.host.replace(/^www\./, '') !== host || !/^https?:$/.test(u.protocol)) return null;
    const p = u.pathname;
    return SKIP.test(p + u.search) ? null : p;
  } catch { return null; }
};

const queue = [], seen = new Set();
const add = p => { if (p && !seen.has(p)) { seen.add(p); queue.push(p); } };
add('/');

// Sitemaps (recursing into sitemap indexes).
const robots = await get(origin + '/robots.txt');
const maps = [...robots.text.matchAll(/^sitemap:\s*(\S+)/gim)].map(m => m[1]).concat(['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml'].map(s => origin + s));
const doneMaps = new Set();
while (maps.length) {
  const m = maps.shift(); if (doneMaps.has(m)) continue; doneMaps.add(m);
  const r = await get(m); if (r.status !== 200 || !/<(urlset|sitemapindex)/.test(r.text)) continue;
  for (const [, loc] of r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    const u = loc.replace(/&amp;/g, '&');
    if (/sitemap[^/]*\.xml$/i.test(u)) maps.push(u); else add(normalize(u));
  }
}
console.log(`sitemaps: ${doneMaps.size} checked, ${seen.size} urls`);

// Breadth-first link walk.
const ok = [];
while (queue.length && ok.length < max) {
  const p = queue.shift();
  const r = await get(origin + p);
  if (r.status !== 200 || !r.type.includes('html')) { console.log(`skip ${r.status} ${p}`); continue; }
  const finalPath = normalize(r.url);
  if (finalPath && finalPath !== p) { add(finalPath); continue; } // redirect: crawl the target instead
  ok.push(p);
  fs.writeFileSync(`${WORK}/raw/${nameFor(p)}.html`, r.text);
  for (const [, href] of r.text.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) add(normalize(href.replace(/&amp;/g, '&')));
}
ok.sort();
fs.writeFileSync(`${WORK}/urls.txt`, ok.join('\n') + '\n');

const nf = await get(origin + '/this-page-does-not-exist-xyz/');
fs.writeFileSync(`${WORK}/raw/404.html`, nf.text);
console.log(`${ok.length} pages -> ${WORK}/urls.txt; 404 page status ${nf.status} saved as raw/404.html`);
