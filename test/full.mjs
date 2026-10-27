import { chromium } from '/tmp/t/node_modules/playwright/index.mjs';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:8123/', OUT = '/workspace/drape/screenshots/';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await ctx.newPage(); const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', e => errs.push('pageerror ' + e.message));
const W = ms => page.waitForTimeout(ms), ev = (f, a) => page.evaluate(f, a), shot = n => page.screenshot({ path: OUT + n + '.png' });
const R = { garments: {}, fabrics: {}, tiers: {} };
await page.goto(BASE + '?nohint=1&tier=1'); await page.waitForFunction(() => window.__drape); await W(1500);
const G = (process.env.G || 'tee,otee,hoodie,crew,camp,jersey,dress,pants,wide,shorts,wshorts,skirt').split(',');
const cols = { tee: '#2547ff', otee: '#ff5a4e', hoodie: '#1f4d3a', crew: '#7a6cff', camp: '#f2e6c9', jersey: '#c8102e', dress: '#111111', pants: '#24345c', wide: '#d9c9a8', shorts: '#3a3a3a', wshorts: '#ff9f1c', skirt: '#8e44ad' };
for (const g of G) { await ev(([g, c]) => __drape.set({ g, c1: c }), [g, cols[g]]); await W(6000); R.garments[g] = await ev(() => __drape.health()); await shot('garment-' + g); console.log(g, JSON.stringify(R.garments[g])); }
// fabrics: same tee, compare drape + behavior (minY / settle)
for (const [f, c] of [['cotton', '#d6452f'], ['denim', '#2f4f86'], ['silk', '#b3124a'], ['wool', '#7a5a3c'], ['leather', '#1c1c1e']]) { await ev(([f, c]) => __drape.set({ g: 'tee', f, c1: c, pat: 'none' }), [f, c]); await W(5500); R.fabrics[f] = await ev(() => __drape.health()); await page.screenshot({ path: `/tmp/fab-${f}.png`, clip: { x: 45, y: 90, width: 300, height: 560 } }); }
// grab
await ev(() => __drape.set({ g: 'tee', f: 'cotton', c1: '#2547ff' })); await W(4000);
R.grab = await ev(() => __drape.grabTest(195, 380, 300, 470)); await W(800); await shot('grab'); await ev(() => __drape.release());
// design tools
await ev(() => __drape.set({ pat: 'plaid', c2: '#111111' })); await ev(() => { __drape.paintAt(.3, .4, 1); __drape.paintAt(.32, .42, 1); });
await ev(() => __drape.addDecal({ t: 'text', val: 'DRAPE', font: 'Archivo Black', col: '#c6ff3d', s: .22 })); await ev(() => __drape.addDecal({ t: 'logo', val: 'img/TN-black-lime.svg', s: .14 }));
await W(1500); await page.click('.tabs button:nth-child(3)').catch(() => { }); await W(800); await shot('design-tools');
await page.keyboard.press('Escape'); await ev(() => document.querySelector('#sheet').classList.remove('open'));
// photo card
R.photo = await ev(() => __drape.photoCard(true)); await W(600); await shot('photo-card');
await ev(() => { const b = document.querySelector('#mbody img'); if (b) { const w = window.open; } }); await ev(() => document.querySelector('#mx').click());
// wardrobe
await ev(() => __drape.saveDesign()); await ev(() => __drape.wardrobe()); await W(800); await shot('wardrobe');
R.wardrobeCount = await ev(() => document.querySelectorAll('.witem').length);
await ev(() => __drape.set({ pat: 'none', c1: '#ffffff' })); await ev(() => document.querySelector('.witem button[data-a=load]').click()); await W(1500);
R.loadedPat = await ev(() => __drape.D.pat);
// runway + recording
await ev(() => __drape.setMode('runway')); await W(2500); await shot('runway');
await ev(() => { window.__lastExport = null; return __drape.recordVideo(3, 'runway').catch(e => String(e)); }); await W(4500);
R.runwayExport = await ev(() => window.__lastExport && { kind: window.__lastExport.kind, size: window.__lastExport.size });
await ev(() => __drape.setMode('studio')); await W(800);
// deep link
const url = await ev(() => __drape.shareURL()); R.shareLen = url.length;
const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push('p2 ' + e.message)); await p2.goto(url.replace(/^https?:\/\/[^/]+\/(drape\/)?/, BASE).replace('#', '?nohint=1#')); await p2.waitForFunction(() => window.__drape); await p2.waitForTimeout(3000);
R.deepLink = await p2.evaluate(() => ({ g: __drape.D.g, pat: __drape.D.pat, decals: __drape.D.decals.length })); await p2.screenshot({ path: OUT + 'deeplink.png' }); await p2.close();
// tiers timing
for (const t of [0, 1, 2]) { await ev(t => __drape.setTier(t), t); await W(2000); await ev(() => __drape.resetSimStats()); await W(5000); R.tiers[t] = await ev(() => __drape.stats()); }
fs.writeFileSync(OUT + 'results.json', JSON.stringify({ R, errs }, null, 1));
console.log(JSON.stringify({ ...R, garments: undefined }, null, 0)); console.log('ERRORS', errs);
await browser.close();
