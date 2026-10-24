// Dump visible boxes, text fonts, backgrounds, borders and pseudo-elements of a page as an indented tree.
// usage: node dump.mjs <url> <width> [scopeSelector=body] > out.txt
// Use it on the live page to read real computed values instead of guessing from page-builder CSS.
import { launch, prepare } from './lib.mjs';
const [url, width, scope = 'body'] = process.argv.slice(2);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: +width, height: 900 } });
await prepare(page, url);
const lines = await page.evaluate((scope) => {
  const out = [];
  const root = document.querySelector(scope);
  const sy = window.scrollY;
  const short = (s) => s.replace(/"/g, '').split(',')[0];
  const walk = (el, depth) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0 && el.children.length === 0) return;
    const ownText = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    const hasBg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none';
    const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some(s => cs['border' + s + 'Style'] !== 'none' && parseFloat(cs['border' + s + 'Width']) > 0);
    const isMedia = ['IMG', 'VIDEO', 'SVG', 'IFRAME', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'svg'].includes(el.tagName);
    const pseudo = ['::before', '::after'].map(p => { const ps = getComputedStyle(el, p); return ps.content && ps.content !== 'none' && ps.content !== 'normal' && !(ps.position === 'static' && (parseFloat(ps.height) === 0 || ps.height === 'auto') && ps.backgroundImage === 'none') ? `${p}{content:${ps.content.slice(0, 30)};w:${ps.width};h:${ps.height};pos:${ps.position};t:${ps.top};r:${ps.right};b:${ps.bottom};l:${ps.left};bg:${ps.backgroundImage.slice(0, 80)} ${ps.backgroundColor};bgsize:${ps.backgroundSize};op:${ps.opacity}}` : ''; }).join('');
    if (ownText || hasBg || hasBorder || isMedia || pseudo) {
      let s = `${'  '.repeat(Math.min(depth, 12))}${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.classList.length ? '.' + [...el.classList].slice(0, 3).join('.') : ''} [${Math.round(r.x)},${Math.round(r.y + sy)} ${Math.round(r.width)}x${Math.round(r.height)}]`;
      if (ownText) s += ` "${ownText.slice(0, 50)}" font:${short(cs.fontFamily)} ${cs.fontSize}/${cs.lineHeight} w${cs.fontWeight}${cs.fontStyle !== 'normal' ? ' ' + cs.fontStyle : ''} ls:${cs.letterSpacing} ${cs.textTransform !== 'none' ? cs.textTransform : ''} color:${cs.color} align:${cs.textAlign}`;
      if (hasBg) s += ` bg:${cs.backgroundColor}${cs.backgroundImage !== 'none' ? ' ' + cs.backgroundImage.slice(0, 120) + ' ' + cs.backgroundSize + ' ' + cs.backgroundPosition : ''}`;
      if (hasBorder) s += ` border:${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}|${cs.borderBottomWidth} ${cs.borderBottomStyle} radius:${cs.borderRadius}`;
      if (cs.opacity !== '1') s += ` op:${cs.opacity}`;
      const pad = cs.padding; if (pad !== '0px') s += ` pad:${pad}`;
      if (el.tagName === 'IMG') s += ` src:${el.currentSrc.split('/').pop()} fit:${cs.objectFit}`;
      if (pseudo) s += ' ' + pseudo;
      out.push(s);
    }
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(root, 0);
  return out;
}, scope);
console.log(lines.join('\n'));
await browser.close();
