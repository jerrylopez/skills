// Compare text positions and fonts, live vs local, matched by text content.
// usage: LIVE=<origin> node textpos.mjs <path> <width>
// "ok" = within 1px and same font; "!!" = moved or restyled; MISSING/EXTRA = text only on one side.
// Only the first text node of each element is recorded, so split text nodes can show as MISSING.
import { launch, prepare, LIVE, LOCAL } from './lib.mjs';

const [path, width] = process.argv.slice(2);
if (!LIVE) { console.error('Set LIVE=<origin>'); process.exit(1); }
const browser = await launch();
async function grab(url) {
  const page = await browser.newPage({ viewport: { width: +width, height: 900 } });
  await prepare(page, url);
  const r = await page.evaluate(() => {
    const out = [], seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode, t = n.textContent.replace(/\s+/g, ' ').trim();
      if (t.length < 3) continue;
      const el = n.parentElement; if (seen.has(el)) continue; seen.add(el);
      if (el.closest('script, style, noscript, option, select')) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const range = document.createRange(); range.selectNodeContents(n); const b = range.getBoundingClientRect();
      if (!b.width) continue;
      out.push({ t: t.slice(0, 40), x: Math.round(b.x), y: Math.round(b.y + scrollY), w: Math.round(b.width), h: Math.round(b.height), f: `${cs.fontFamily.split(',')[0]} ${cs.fontSize}/${cs.lineHeight} ${cs.fontWeight} ${cs.color}` });
    }
    return out;
  });
  await page.close();
  return r;
}
const live = await grab(LIVE + path), local = await grab(LOCAL + path);
await browser.close();
const used = new Set();
for (const a of live) {
  const i = local.findIndex((b, k) => !used.has(k) && b.t === a.t);
  if (i < 0) { console.log(`MISSING  y=${a.y} "${a.t}"`); continue; }
  used.add(i); const b = local[i], d = [b.x - a.x, b.y - a.y, b.w - a.w, b.h - a.h];
  const flag = d.some(v => Math.abs(v) > 1) || a.f !== b.f;
  console.log(`${flag ? '!!' : 'ok'} y=${a.y} d(x,y,w,h)=${d.join(',')} "${a.t}"${a.f !== b.f ? `  font live[${a.f}] local[${b.f}]` : ''}`);
}
local.forEach((b, k) => { if (!used.has(k)) console.log(`EXTRA y=${b.y} "${b.t}"`); });
