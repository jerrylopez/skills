// Print box and non-default computed styles for the first 3 matches of each selector.
// usage: node probe.mjs <url> <width> <selector>...
// Run it against the live URL and the local URL with equivalent selectors to find a mismatch.
import { launch, prepare } from './lib.mjs';

const [url, width, ...sels] = process.argv.slice(2);
const b = await launch();
const p = await b.newPage({ viewport: { width: +width, height: 900 } });
await prepare(p, url);
const props = ['display', 'position', 'fontFamily', 'fontSize', 'lineHeight', 'fontWeight', 'letterSpacing', 'color', 'backgroundColor', 'backgroundImage', 'borderTop', 'borderBottom', 'borderRadius', 'padding', 'margin', 'width', 'height', 'boxShadow', 'textTransform', 'gridTemplateColumns', 'gap', 'top', 'left', 'right', 'bottom', 'zIndex', 'opacity', 'transform', 'verticalAlign', 'textAlign', 'objectFit', 'maxWidth', 'minHeight', 'overflow', 'flexDirection', 'justifyContent', 'alignItems', 'columnCount'];
const skip = ['normal', 'none', 'auto', '0px', 'static', 'visible', 'rgba(0, 0, 0, 0)', '0px none rgb(0, 0, 0)'];
for (const s of sels) {
  const r = await p.evaluate(([s, props, skip]) => [...document.querySelectorAll(s)].slice(0, 3).map(e => {
    const out = {};
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(e, pseudo);
      if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue;
      const o = {};
      if (!pseudo) { const r = e.getBoundingClientRect(); o.box = [r.x, r.y + scrollY, r.width, r.height].map(v => Math.round(v * 10) / 10).join(','); }
      for (const k of props) { const v = cs[k]; if (v && !skip.includes(v)) o[k] = v; }
      out[pseudo || 'el'] = o;
    }
    return out;
  }), [s, props, skip]);
  console.log('##', s, JSON.stringify(r));
}
await b.close();
