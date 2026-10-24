// Shared helpers. Configure with env vars:
//   LIVE   live site origin, e.g. https://www.example.com (required by textpos)
//   LOCAL  local dev origin (default http://localhost:4321)
//   WORK   working dir for refs/comparisons (default /tmp/site)
//   CHROME Chrome executable (default: newest agent-browser Chrome)
//   WAIT_FOR  optional CSS selector for a late widget to wait for before capture
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

export const LIVE = (process.env.LIVE || '').replace(/\/$/, '');
export const LOCAL = (process.env.LOCAL || 'http://localhost:4321').replace(/\/$/, '');
export const WORK = process.env.WORK || '/tmp/site';

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const dir = path.join(os.homedir(), '.agent-browser/browsers');
  const found = fs.existsSync(dir) ? fs.readdirSync(dir).filter(d => d.startsWith('chrome')).sort().reverse() : [];
  for (const d of found) { const p = path.join(dir, d, 'chrome'); if (fs.existsSync(p)) return p; }
  throw new Error('No Chrome found: set CHROME=/path/to/chrome');
}

export function launch() {
  return chromium.launch({ executablePath: findChrome(), args: ['--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'] });
}

/** File name for a URL path: "/" -> home, "/a/b/" -> a__b */
export function nameFor(p) {
  return p.replace(/^\/|\/$/g, '').replace(/\//g, '__') || 'home';
}

/** Load a page and normalize it for deterministic screenshots (live and local alike). */
export async function prepare(page, url) {
  for (let i = 0; ; i++) {
    try { return await prepareOnce(page, url); } catch (e) {
      if (i >= 3) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function prepareOnce(page, url) {
  try { await page.goto(url, { waitUntil: 'load', timeout: 60000 }); } catch (e) { console.error('goto', url, e.message); }
  // Scroll through the page so lazy images and scroll-triggered content load.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
  });
  if (process.env.WAIT_FOR) {
    await page.waitForFunction(s => { const w = document.querySelector(s); return !w || w.getBoundingClientRect().height > 50; }, process.env.WAIT_FOR, { timeout: 15000 }).catch(() => {});
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.addStyleTag({ content: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important} .grecaptcha-badge{display:none!important}' });
  await page.evaluate(async () => {
    for (const v of document.querySelectorAll('video')) { try { v.pause(); v.currentTime = 0; } catch {} }
    await document.fonts.ready;
  });
  await page.waitForTimeout(1200);
}

/** Full-height capture at a fixed width. Returns the page height. */
export async function capture(page, url, width, file) {
  await page.setViewportSize({ width, height: 900 });
  await prepare(page, url);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: h });
  await page.waitForTimeout(800);
  await page.screenshot({ path: file });
  return h;
}
