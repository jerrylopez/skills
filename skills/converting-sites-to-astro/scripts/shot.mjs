// Capture live reference screenshots.
// usage: LIVE=https://www.example.com node shot.mjs <width> <path>...
// Writes $WORK/ref/<width>/<name>.png and warns when a capture looks stitched
// (the top band of the page repeats further down, a known headless-capture glitch).
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { launch, capture, nameFor, LIVE, WORK } from './lib.mjs';

const [width, ...paths] = process.argv.slice(2);
if (!LIVE || !width || !paths.length) { console.error('usage: LIVE=<origin> node shot.mjs <width> <path>...'); process.exit(1); }
const out = `${WORK}/ref/${width}`;
fs.mkdirSync(out, { recursive: true });
const browser = await launch();
const page = await browser.newPage();
for (const p of paths) {
  const file = `${out}/${nameFor(p)}.png`;
  const h = await capture(page, LIVE + p, +width, file);
  console.log(`${nameFor(p)} @${width}: h=${h}${looksStitched(file) ? '  WARNING: top band repeats lower down; view it and recapture' : ''}`);
}
await browser.close();

function looksStitched(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H, data } = png;
  const rowKey = y => data.subarray(y * W * 4, (y + 1) * W * 4).toString('base64');
  // Pick a distinctive row near the top (one with more than one colour).
  let y0 = -1;
  for (let y = 10; y < Math.min(120, H); y++) { const r = data.subarray(y * W * 4, (y + 1) * W * 4); if (r.some((v, i) => v !== r[i % 4])) { y0 = y; break; } }
  if (y0 < 0) return false;
  const k0 = rowKey(y0), k1 = rowKey(y0 + 1), k2 = rowKey(y0 + 2);
  for (let y = 900; y < H - 3; y++) if (rowKey(y) === k0 && rowKey(y + 1) === k1 && rowKey(y + 2) === k2) return true;
  return false;
}
