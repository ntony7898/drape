// Procedural fabric maps + design compositing (all generated in canvas, no image files).
export const FABRICS = {
  cotton: { name: 'Cotton', note: 'soft jersey · medium', stretch: 1, shear: .9, bend: .05, damp: .012, mass: 1, fric: .35, rough: .9, sheen: .5, sheenRough: .7, clear: 0, nrm: .55, rep: 46, weave: 'jersey' },
  denim: { name: 'Denim', note: 'stiff twill · heavy', stretch: 1, shear: 1, bend: .32, damp: .02, mass: 1.8, fric: .45, rough: .93, sheen: .15, sheenRough: .8, clear: 0, nrm: 1, rep: 34, weave: 'twill', speck: .10 },
  silk: { name: 'Silk', note: 'fluid satin · light', stretch: .96, shear: .75, bend: .004, damp: .004, mass: .5, fric: .12, rough: .3, sheen: 1, sheenRough: .25, clear: 0, nrm: .18, rep: 70, weave: 'satin' },
  wool: { name: 'Wool knit', note: 'stretchy loops · warm', stretch: .7, shear: .55, bend: .09, damp: .03, mass: 1.4, fric: .5, rough: 1, sheen: .8, sheenRough: .9, clear: 0, nrm: 1.2, rep: 22, weave: 'knit', speck: .06 },
  leather: { name: 'Leather / Vinyl', note: 'stiff grain · heavy', stretch: 1, shear: 1, bend: .55, damp: .03, mass: 2.2, fric: .4, rough: .45, sheen: 0, sheenRough: .5, clear: .45, nrm: .45, rep: 9, weave: 'grain' },
};
const TS = 256;
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, p) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const h = (i, j) => hash(((xi + i) % p + p) % p, ((yi + j) % p + p) % p); return (h(0, 0) * (1 - u) + h(1, 0) * u) * (1 - v) + (h(0, 1) * (1 - u) + h(1, 1) * u) * v; }
function height(weave, x, y) {
  const u = x / TS, v = y / TS, P2 = Math.PI * 2;
  switch (weave) {
    case 'jersey': { const cu = u * 32, cv = v * 24, f = cu - Math.floor(cu), g = cv - Math.floor(cv); const ax = Math.abs(f - .5) * 2; return .55 * Math.max(0, 1 - ((ax - .55) ** 2 * 6 + ((g + ax * .4) % 1 - .5) ** 2 * 5)) + .2 * vnoise(x / 4, y / 4, TS / 4); }
    case 'twill': { const d = Math.sin(P2 * (u * 24 + v * 24 * 1.0) ) * .5 + .5, th = Math.sin(P2 * v * 96) * .5 + .5; return .7 * d * (.7 + .3 * th) + .3 * vnoise(x / 3, y / 16, TS / 3); }
    case 'satin': return .25 * (Math.sin(P2 * v * 128) * .5 + .5) + .15 * vnoise(x / 32, y / 2, 8);
    case 'knit': { const cu = u * 12, cv = v * 16, f = cu - Math.floor(cu), g = cv - Math.floor(cv), ax = Math.abs(f - .5) * 2; const loop = Math.max(0, 1 - ((ax - .5) ** 2 * 7 + ((g + ax * .55) % 1 - .55) ** 2 * 9)); return .85 * loop + .15 * vnoise(x / 2, y / 2, TS / 2); }
    default: { let n = 0, a = .5, fq = 16; for (let o = 0; o < 4; o++) { n += a * vnoise(x / TS * fq, y / TS * fq, fq); a *= .5; fq *= 2; } return Math.pow(n, 1.6); }
  }
}
const mapCache = {};
export function weaveMaps(THREE, key) {
  if (mapCache[key]) return mapCache[key];
  const f = FABRICS[key], Hm = new Float32Array(TS * TS);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) Hm[y * TS + x] = height(f.weave, x, y);
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = TS; return c; };
  const nc = mk(), rc = mk(), nx = nc.getContext('2d'), rx = rc.getContext('2d'), nd = nx.createImageData(TS, TS), rd = rx.createImageData(TS, TS);
  const at = (x, y) => Hm[((y + TS) % TS) * TS + ((x + TS) % TS)];
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2.5, dy = (at(x, y + 1) - at(x, y - 1)) * 2.5, L = Math.hypot(dx, dy, 1), k = (y * TS + x) * 4;
    nd.data[k] = (-dx / L * .5 + .5) * 255; nd.data[k + 1] = (dy / L * .5 + .5) * 255; nd.data[k + 2] = (1 / L * .5 + .5) * 255; nd.data[k + 3] = 255;
    const r = Math.min(1, Math.max(0, .78 + (.5 - at(x, y)) * .35)); rd.data[k] = rd.data[k + 1] = rd.data[k + 2] = r * 255; rd.data[k + 3] = 255;
  }
  nx.putImageData(nd, 0, 0); rx.putImageData(rd, 0, 0);
  const tex = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(f.rep, f.rep); t.anisotropy = 8; return t; };
  return (mapCache[key] = { normal: tex(nc), rough: tex(rc), preview: nc });
}
export const PATTERNS = ['none', 'stripes', 'plaid', 'polka', 'houndstooth', 'camo', 'tiedye', 'gradient', 'blocks'];
export const PATTERN_NAMES = { none: 'Solid', stripes: 'Stripes', plaid: 'Plaid', polka: 'Polka', houndstooth: 'Houndstooth', camo: 'Camo', tiedye: 'Tie-dye', gradient: 'Gradient', blocks: 'Color block' };
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
// draw base+pattern into ctx (1024²). ppm = pixels per metre so motifs are physically sized
export function drawPattern(ctx, d, ppm) {
  const S = 1024, c1 = d.c1, c2 = d.c2, k = (d.pscale || 1) * ppm;
  ctx.save(); ctx.fillStyle = c1; ctx.fillRect(0, 0, S, S);
  const r = rng(1234);
  switch (d.pat) {
    case 'stripes': { const w = .05 * k; ctx.fillStyle = c2; for (let y = 0; y < S; y += w * 2) ctx.fillRect(0, y, S, w); break; }
    case 'plaid': { const w = .12 * k; ctx.globalAlpha = .55; ctx.fillStyle = c2; for (let x = 0; x < S; x += w) { ctx.fillRect(x, 0, w * .35, S); ctx.fillRect(0, x, S, w * .35); }
      ctx.globalAlpha = .35; ctx.fillStyle = d.trim; for (let x = w * .6; x < S; x += w) { ctx.fillRect(x, 0, w * .06, S); ctx.fillRect(0, x, S, w * .06); } break; }
    case 'polka': { const w = .06 * k; ctx.fillStyle = c2; for (let y = 0, row = 0; y < S + w; y += w, row++) for (let x = (row % 2) * w / 2; x < S + w; x += w) { ctx.beginPath(); ctx.arc(x, y, w * .22, 0, 7); ctx.fill(); } break; }
    case 'houndstooth': { const w = .035 * k, q = w / 4; ctx.fillStyle = c2;
      for (let y = -w; y < S + w; y += w) for (let x = -w; x < S + w; x += w) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2 * q, y); ctx.lineTo(x + 4 * q, y - 2 * q); ctx.lineTo(x + 4 * q, y); ctx.lineTo(x + 2 * q, y + 2 * q); ctx.lineTo(x + 2 * q, y + 4 * q); ctx.lineTo(x, y + 2 * q); ctx.lineTo(x - 2 * q, y + 4 * q); ctx.lineTo(x - 2 * q, y + 2 * q); ctx.closePath(); ctx.fill(); } break; }
    case 'camo': { const cols = [c2, d.trim, mix(c1, '#000000', .35)]; ctx.filter = 'blur(' + (.006 * k).toFixed(1) + 'px)';
      for (let i = 0; i < 260; i++) { ctx.fillStyle = cols[i % 3]; ctx.beginPath(); const x = r() * S, y = r() * S, rr = (.03 + r() * .06) * k; for (let a = 0; a < 6.28; a += .6) { const q = rr * (.6 + r() * .6); ctx.lineTo(x + Math.cos(a) * q * 1.4, y + Math.sin(a) * q); } ctx.fill(); } ctx.filter = 'none'; break; }
    case 'tiedye': { const im = ctx.getImageData(0, 0, S, S), A = hex(c1), B = hex(c2), C = hex(d.trim);
      for (let pass = 0; pass < 2; pass++) { const cx = pass ? 768 : 256, cy = 520; for (let y = 0; y < S; y++) for (let x = pass ? 512 : 0; x < (pass ? S : 512); x++) {
        const dx = x - cx, dy = y - cy, rr = Math.hypot(dx, dy) / (k * .35), an = Math.atan2(dy, dx), v = Math.sin(rr * 6 + an * 2 + Math.sin(an * 5) * .6) * .5 + .5, w2 = Math.sin(rr * 2.3 - an) * .5 + .5, o = (y * S + x) * 4;
        for (let ch = 0; ch < 3; ch++) im.data[o + ch] = A[ch] * (1 - v) * (1 - w2 * .5) + B[ch] * v * (1 - w2 * .5) + C[ch] * w2 * .5; } }
      ctx.putImageData(im, 0, 0); break; }
    case 'gradient': { const g = ctx.createLinearGradient(0, S, 0, 0); g.addColorStop(0, c2); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(0, 0, S, S); break; }
    case 'blocks': { ctx.fillStyle = c2; ctx.fillRect(0, S * .5, S, S * .25); ctx.fillStyle = d.trim; ctx.fillRect(0, S * .48, S, S * .025); ctx.fillRect(0, 0, S, S * .1); break; }
  }
  ctx.restore();
}
export function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
export function mix(a, b, t) { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
// garment construction details drawn in UV space (rib bands, placket, pocket, piping)
export function drawDetails(ctx, g, d) {
  const S = 1024, P = (a, b, s = 1) => { const q = g.uvAt(a, b, s); return [q[0] * S, (1 - q[1]) * S]; }, ppm = g.pxPerM;
  ctx.save(); ctx.lineCap = 'round';
  const rib = (pts, col) => { ctx.strokeStyle = col; ctx.globalAlpha = .5; ctx.lineWidth = .045 * ppm; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke(); ctx.globalAlpha = 1; };
  const t = g.type;
  if (t === 'hoodie') { // kangaroo pocket
    for (const s of [1]) { const a = P(-.15, 1.0), b = P(.15, 1.0), c = P(.11, .84), e = P(-.11, .84); ctx.fillStyle = mix(d.c1, '#000000', .12); ctx.strokeStyle = d.trim; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(...e); ctx.lineTo(...c); ctx.quadraticCurveTo(...P(.17, .9), ...b); ctx.lineTo(...a); ctx.quadraticCurveTo(...P(-.17, .9), ...e); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = d.trim; ctx.lineWidth = .008 * ppm; for (const x of [-.03, .03]) { ctx.beginPath(); ctx.moveTo(...P(x, 1.45)); ctx.lineTo(...P(x * 1.4, 1.27)); ctx.stroke(); }
  }
  if (t === 'camp' || t === 'jersey') { ctx.strokeStyle = mix(d.c1, '#000000', .25); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...P(.012, 1.45)); ctx.lineTo(...P(.012, .7)); ctx.stroke();
    for (let y = 1.38; y > .72; y -= .085) { const [x0, y0] = P(-.004, y); ctx.fillStyle = d.trim; ctx.beginPath(); ctx.arc(x0, y0, .007 * ppm, 0, 7); ctx.fill(); }
    if (t === 'jersey') { ctx.strokeStyle = d.trim; ctx.lineWidth = .012 * ppm; for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(...P(.07, 1.49, s)); ctx.lineTo(...P(.2, 1.39, s)); ctx.lineTo(...P(.4, 1.0, s)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(...P(-.07, 1.49, s)); ctx.lineTo(...P(-.2, 1.39, s)); ctx.lineTo(...P(-.4, 1.0, s)); ctx.stroke(); } }
    if (t === 'camp') { ctx.fillStyle = mix(d.c1, '#000000', .1); for (const sx of [1, -1]) { ctx.beginPath(); ctx.moveTo(...P(0, 1.42)); ctx.lineTo(...P(sx * .085, 1.505)); ctx.lineTo(...P(sx * .13, 1.43)); ctx.closePath(); ctx.fill(); } }
  }
  if (t === 'pants' || t === 'shorts' || t === 'wide' || t === 'wshorts') { ctx.fillStyle = mix(d.c1, '#000000', .14); for (const s of [1, -1]) { const a = P(-.4, 1.02, s), b = P(.4, .975, s); ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); }
    if (t === 'pants') { ctx.strokeStyle = d.trim; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(...P(-.015, 1.0)); ctx.lineTo(...P(-.04, .85)); ctx.moveTo(...P(.015, 1.0)); ctx.lineTo(...P(.04, .85)); ctx.stroke(); } }
  ctx.restore();
}
export function drawStitches(ctx, g, d) {
  ctx.save(); ctx.strokeStyle = d.trim; ctx.globalAlpha = .9; ctx.lineWidth = 1.6; ctx.setLineDash([4, 3]);
  const S = 1024;
  for (const st of g.stitches) {
    const off = (st.open ? .012 : .006) * st.sc * S;
    const x1 = st.a[0] * S + st.na[0] * off, y1 = (1 - st.a[1]) * S - st.na[1] * off, x2 = st.b[0] * S + st.nb[0] * off, y2 = (1 - st.b[1]) * S - st.nb[1] * off;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (st.open) { const o2 = off * 2.6; ctx.beginPath(); ctx.moveTo(st.a[0] * S + st.na[0] * o2, (1 - st.a[1]) * S - st.na[1] * o2); ctx.lineTo(st.b[0] * S + st.nb[0] * o2, (1 - st.b[1]) * S - st.nb[1] * o2); ctx.stroke(); }
  }
  ctx.restore();
}
export function speckle(ctx, amt) { if (!amt) return; const r = rng(99); ctx.save(); for (let i = 0; i < 60000; i++) { ctx.globalAlpha = amt * r(); ctx.fillStyle = r() > .5 ? '#ffffff' : '#000000'; ctx.fillRect(r() * 1024, r() * 1024, 1 + r() * 2, 1); } ctx.restore(); }
