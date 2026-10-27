import { chromium } from '/tmp/t/node_modules/playwright/index.mjs';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:8123/', OUT = '/workspace/drape/screenshots/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, acceptDownloads: true });
const page = await ctx.newPage(); const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', e => errs.push('pageerror ' + e.message));
const W = ms => page.waitForTimeout(ms), ev = (f, a) => page.evaluate(f, a);
const only = process.argv[2];
await page.goto(BASE + '?nohint=1&tier=' + (process.env.TIER || 1)); await page.waitForFunction(() => window.__drape); await W(1500);
const settle = async (sec) => { await W(sec * 1000); return ev(() => __drape.health()); };
const R = { garments: {} };
const garments = only ? [only] : ['tee', 'otee', 'hoodie', 'crew', 'camp', 'jersey', 'dress', 'pants', 'wide', 'shorts', 'wshorts', 'skirt'];
for (const g of garments) { await ev(g => __drape.set({ g, fit: undefined }) , g).catch(()=>{}); 
  await ev(g => { const D = __drape.D; return __drape.set({ g, fit: { tee: { len: .5, slv: .35, fit: 1 } }[g] || null }); }, g).catch(()=>{});
  const h = await settle(+(process.env.SETTLE || 6)); R.garments[g] = h; console.log(g, JSON.stringify(h)); await page.screenshot({ path: OUT + `garment-${g}.png` }); }
fs.writeFileSync(OUT + 'results.json', JSON.stringify({ R, errs }, null, 1));
console.log('ERRORS', errs);
await browser.close();
