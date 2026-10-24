// Download every asset the crawled pages use, plus their CSS.
// usage: node assets.mjs <origin>       (run after crawl.mjs)
// Reads $WORK/raw/*.html. Collects src, srcset, data-src*, poster, <source>, <link rel=stylesheet>,
// icons, inline style url(), and url() inside every stylesheet (recursively, including @import).
// Writes:
//   $WORK/assets/<url path>      same-host files, original paths kept (e.g. wp-content/uploads/2025/07/x.png)
//   $WORK/css/<url path>         stylesheets
//   $WORK/css/pages/<name>.css   each page's inline <style> blocks (page-builder layout CSS lives here)
//   $WORK/external.txt           off-site asset URLs (fonts, CDNs, embeds) to decide on by hand
import fs from 'node:fs';
import path from 'node:path';
import { WORK } from './lib.mjs';

const origin = (process.argv[2] || '').replace(/\/$/, '');
if (!origin) { console.error('usage: node assets.mjs <origin>'); process.exit(1); }
const host = new URL(origin).host.replace(/^www\./, '');
const sameHost = u => u.host.replace(/^www\./, '') === host;
const decode = s => s.replace(/&amp;/g, '&').replace(/&#0?38;/g, '&').replace(/\\\//g, '/');

const assets = new Set(), sheets = new Set(), external = new Set();
const take = (raw, base) => {
  if (!raw || /^(data:|#|javascript:|mailto:|tel:)/.test(raw.trim())) return null;
  try { return new URL(decode(raw.trim()), base); } catch { return null; }
};
const addAsset = (raw, base) => {
  const u = take(raw, base); if (!u) return;
  u.hash = '';
  if (sameHost(u)) assets.add(u.href); else external.add(u.href);
};

fs.mkdirSync(`${WORK}/css/pages`, { recursive: true });
for (const f of fs.readdirSync(`${WORK}/raw`)) {
  const html = fs.readFileSync(`${WORK}/raw/${f}`, 'utf8');
  const base = origin + '/';
  for (const [, v] of html.matchAll(/\b(?:src|data-src|data-lazy-src|poster|data-bg|data-background)=["']([^"']+)["']/gi)) addAsset(v, base);
  for (const [, v] of html.matchAll(/\b(?:srcset|data-srcset|data-lazy-srcset)=["']([^"']+)["']/gi)) v.split(',').forEach(c => addAsset(c.trim().split(/\s+/)[0], base));
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (/rel=["'][^"']*stylesheet/i.test(tag)) { const u = take(href, base); if (u) (sameHost(u) ? sheets.add(u.href) : external.add(u.href)); }
    else if (/rel=["'][^"']*(icon|apple-touch)/i.test(tag)) addAsset(href, base);
  }
  for (const [, v] of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) addAsset(v, base);
  const inline = [...html.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)].map(([, attrs, css]) => `/* <style${attrs}> */\n${css}`).join('\n\n');
  fs.writeFileSync(`${WORK}/css/pages/${f.replace(/\.html$/, '.css')}`, inline);
}

const save = async (href, root) => {
  const u = new URL(href);
  let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index';
  const file = path.join(WORK, root, p);
  if (fs.existsSync(file)) return file;
  const r = await fetch(href).catch(() => null);
  if (!r || !r.ok) { console.log(`fail ${r?.status ?? 'net'} ${href}`); return null; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
};

// Stylesheets first: they reference more assets (fonts, backgrounds) and may @import others.
const doneSheets = new Set();
while (sheets.size > doneSheets.size) {
  for (const href of [...sheets]) {
    if (doneSheets.has(href)) continue; doneSheets.add(href);
    const file = await save(href, 'css'); if (!file) continue;
    const css = fs.readFileSync(file, 'utf8');
    for (const [, v] of css.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/gi)) { const u = take(v, href); if (u) (sameHost(u) ? sheets.add(u.href) : external.add(u.href)); }
    for (const [, v] of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) addAsset(v, href);
  }
}
let n = 0;
for (const href of assets) if (await save(href, 'assets')) n++;
fs.writeFileSync(`${WORK}/external.txt`, [...external].sort().join('\n') + '\n');
console.log(`${doneSheets.size} stylesheets -> ${WORK}/css, ${n}/${assets.size} assets -> ${WORK}/assets, ${external.size} external URLs -> ${WORK}/external.txt`);
