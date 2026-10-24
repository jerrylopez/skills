// Pixel-diff the local page against its live reference.
// usage: node compare.mjs <path> <width> [band=100]
// Prints overall diff %, then every horizontal band over 1% so you know where to look.
// Writes $WORK/cmp/<width>/<name>.png (local), .diff.png and .sbs.png (live | local).
import fs from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { launch, capture, nameFor, LOCAL, WORK } from './lib.mjs';

const [path, width, bandArg = '100'] = process.argv.slice(2);
const band = +bandArg, name = nameFor(path), outDir = `${WORK}/cmp/${width}`;
const refFile = `${WORK}/ref/${width}/${name}.png`;
if (!fs.existsSync(refFile)) { console.error(`No reference ${refFile}: run shot.mjs ${width} ${path}`); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
const browser = await launch();
await capture(await browser.newPage(), LOCAL + path, +width, `${outDir}/${name}.png`);
await browser.close();

const a = PNG.sync.read(fs.readFileSync(refFile));
const b = PNG.sync.read(fs.readFileSync(`${outDir}/${name}.png`));
const H = Math.max(a.height, b.height), W = a.width;
const pad = img => { const o = new PNG({ width: W, height: H }); o.data.fill(255); PNG.bitblt(img, o, 0, 0, img.width, img.height, 0, 0); return o; };
const A = pad(a), B = pad(b), D = new PNG({ width: W, height: H });
const total = pixelmatch(A.data, B.data, D.data, W, H, { threshold: 0.15 });
console.log(`${name} @${width}: ref h=${a.height} local h=${b.height} diff=${(100 * total / (W * H)).toFixed(2)}%`);
for (let y = 0; y < H; y += band) {
  let n = 0; const yh = Math.min(band, H - y);
  for (let yy = y; yy < y + yh; yy++) for (let x = 0; x < W; x++) { const i = (yy * W + x) * 4; if (D.data[i] === 255 && D.data[i + 1] === 0) n++; }
  const pct = 100 * n / (W * yh);
  if (pct > 1) console.log(`  ${y}-${y + yh}: ${pct.toFixed(1)}%`);
}
fs.writeFileSync(`${outDir}/${name}.diff.png`, PNG.sync.write(D));
const S = new PNG({ width: W * 2 + 10, height: H }); S.data.fill(0);
PNG.bitblt(A, S, 0, 0, W, H, 0, 0); PNG.bitblt(B, S, 0, 0, W, H, W + 10, 0);
fs.writeFileSync(`${outDir}/${name}.sbs.png`, PNG.sync.write(S));
