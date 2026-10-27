// Garments as 2D pattern pieces (front/back pairs) wrapped around the body; seam nodes are shared
// particles, so front+back are "sewn" into one closed cloth mesh.
import { collideAt, NP } from './body.js';
export const GARMENTS = {
  tee: { name: 'Essential tee', kind: 'top' }, otee: { name: 'Oversized tee', kind: 'top' }, hoodie: { name: 'Hoodie', kind: 'top' },
  crew: { name: 'Crewneck', kind: 'top' }, camp: { name: 'Camp shirt', kind: 'top' }, jersey: { name: 'Baseball jersey', kind: 'top' },
  dress: { name: 'Dress', kind: 'top' }, pants: { name: 'Joggers', kind: 'bottom' }, wide: { name: 'Wide-leg pants', kind: 'bottom' },
  shorts: { name: 'Shorts', kind: 'bottom' }, wshorts: { name: 'Wide shorts', kind: 'bottom' }, skirt: { name: 'Skirt', kind: 'bottom' },
};
export const DEFAULT_FIT = { tee: { len: .5, slv: .35, fit: 1 }, hoodie: { len: .5, slv: .7, fit: 2 }, otee: { len: .6, slv: .45, fit: 1 }, crew: { len: .45, slv: .75, fit: 1 }, camp: { len: .55, slv: .3, fit: 1 }, jersey: { len: .6, slv: .4, fit: 1 }, wide: { len: .9, slv: 0, fit: 1 }, wshorts: { len: .45, slv: 0, fit: 1 }, pants: { len: .85, slv: 0, fit: 1 }, shorts: { len: .5, slv: 0, fit: 1 }, skirt: { len: .5, slv: 0, fit: 1 }, dress: { len: .45, slv: 0, fit: 1 } };
const lerp = (a, b, t) => a + (b - a) * t, cl = (x, a, b) => x < a ? a : x > b ? b : x, H = Math.PI / 2;
const ell = (W, s, th, k = .7, cap = 9) => { let rx = W / (1 + k) * 1.273, rz = rx * k; if (rx > cap) { rx = cap; rz = W * 1.273 - rx; } return [rx * Math.sin(th), s * rz * Math.cos(th)]; };

function topSpec(type, o, cell) {
  const dress = type === 'dress', hood = type === 'hoodie', sweat = hood || type === 'crew', ov = type === 'otee', F = o.fit;
  const W0 = [.245, .27, .315][F] + (sweat ? .015 : 0) + (ov ? .055 : 0) + (type === 'camp' || type === 'jersey' ? .02 : 0);
  const flare = dress ? [.22, .45, .8][F] : 0;
  const Wb = b => W0 + (dress ? Math.max(0, 1.0 - b) * flare : 0);
  const hem = dress ? lerp(.80, .16, o.len) : 1.46 - (sweat ? lerp(.66, .92, o.len) : ov ? lerp(.68, .94, o.len) : lerp(.6, .88, o.len));
  const S = dress ? 0 : sweat ? lerp(.25, .64, o.slv) : lerp(.17, .6, o.slv), sw = [.085, .097, .118][F] + (ov ? .025 : 0);
  const top = a => 1.505 - .26 * Math.max(0, Math.abs(a) - .06);
  const nrx = dress ? .1 : .085, nry = dress ? .09 : .066, ncy = dress ? 1.505 : 1.515;
  const neckD = (a, b) => Math.sqrt((a / nrx) ** 2 + ((b - ncy) / nry) ** 2);
  const sl = (a, b) => { const qx = Math.abs(a) - .14, qy = b - 1.425; return [qx * .462 - qy * .887, qx * .887 + qy * .462]; };
  const swt = t => sw * (1 - .12 * t / Math.max(S, .1));
  const inSleeve = (a, b) => { if (S <= 0 || Math.abs(a) < .1) return false; const [t, n] = sl(a, b); return t >= 0 && t <= S + .05 && Math.abs(n) < swt(t) && b < top(a) + .005; };
  const inTorso = (a, b) => Math.abs(a) < Wb(b) && b > hem && b < top(a) && !(dress && Math.abs(a) > .15 && b > 1.23);
  const mask = (a, b) => (inTorso(a, b) || inSleeve(a, b)) && neckD(a, b) > 1;
  const hole = (a, b) => neckD(a, b) <= 1;
  const open = (a, b) => b < hem + cell * 1.01 ||
    (S > 0 && inSleeve(a, b) && !inTorso(a, b) && sl(a, b)[0] > S + .05 - cell * 1.2) || (dress && Math.abs(a) > .125 && b > 1.2 && b < top(a) - cell * .9);
  const wrap = (a, b, s) => {
    if (inSleeve(a, b) && (Math.abs(a) > Math.min(Wb(b) - .02, .19) || !inTorso(a, b))) {
      const [t, n] = sl(a, b), w = swt(t), R = 2 * w / Math.PI, th = cl(n / w, -1, 1) * H, sg = Math.sign(a);
      const bx = .14 + .462 * t + .887 * R * Math.sin(th), by = 1.425 - .887 * t + .462 * R * Math.sin(th);
      return [sg * bx, by, s * R * Math.cos(th)];
    }
    const W = Wb(b), [x, z] = ell(W, s, cl(a / W, -1, 1) * H, .7, b > 1.05 ? .18 : 9); return [x, b, z];
  };
  const pins = (a, b) => b > top(a) - cell * 1.01 && Math.abs(a) < .19 && Math.abs(a) > .05 ? 3 : 0;
  const ext = Math.max(W0 + flare * (1 - hem), S > 0 ? .14 + .462 * (S + .05) + sw : 0) + cell;
  const pairs = [{ axis: 'xy', mask, open, hole, wrap, pins, bounds: [-ext, ext, hem - cell * .5, 1.56], rect: hood ? [.01, .01, .49, .72] : [.01, .01, .49, .99] }];
  if (hood) {
    const hm = (z, y) => ((z + .015) / .15) ** 2 + ((y - 1.655) / .215) ** 2 < 1 && y > 1.47 && z < .105;
    pairs.push({
      axis: 'zy', flip: true, hood: true, mask: hm, rect: [.01, .76, .49, .99], bounds: [-.17, .11, 1.46, 1.88],
      open: (z, y) => z > .105 - cell * 1.1 || y < 1.47 + cell * 1.1,
      wrap: (z, y, s) => [s * (.03 + .115 * Math.sqrt(Math.max(0, 1 - ((z + .015) / .16) ** 2 - ((y - 1.655) / .23) ** 2))), y, z],
      pins: () => 0,
    });
  }
  return { pairs, perm: false };
}
function bottomSpec(type, o, cell) {
  const F = o.fit, waist = 1.02;
  if (type === 'skirt') {
    const hem = lerp(.76, .22, o.len), f = [.07, .3, .62][F], Wt = .255, Wb = b => Wt + (waist - b) * f;
    const mask = (a, b) => b >= hem && b <= waist && Math.abs(a) < Wb(b);
    return { perm: true, pairs: [{ axis: 'xy', mask, bounds: [-(Wb(hem) + cell), Wb(hem) + cell, hem - cell * .5, waist + cell * .5], rect: [.01, .01, .49, .99],
      open: (a, b) => b > waist - cell * 1.01 || b < hem + cell * 1.01, wrap: (a, b, s) => { const W = Wb(b), [x, z] = ell(W, s, cl(a / W, -1, 1) * H, .75); return [x, b, z]; },
      pins: (a, b) => b > waist - cell * 1.01 ? 2 : 0 }] };
  }
  const shorts = type === 'shorts' || type === 'wshorts', wideL = type === 'wide' || type === 'wshorts', crotch = .735, hem = shorts ? lerp(.64, .42, o.len) : lerp(.32, .05, o.len);
  const lw0 = [.138, .152, .18][F] + (shorts ? .01 : 0) + (wideL ? .035 : 0), lwA = [.072, .083, .105][F] + (wideL ? .08 : 0);
  const lw = b => shorts ? lw0 - (crotch - b) * .05 : lerp(lwA, lw0, cl((b - .08) / (crotch - .08), 0, 1)), Wh = 2 * lw0 + .005;
  const xc = b => lw(b) + .005;
  const axisX = b => b > .49 ? lerp(.10, .093, (b - .49) / .39) : lerp(.105, .10, (b - .09) / .4);
  const inLeg = (a, b) => b >= hem && b < crotch + cell * .5 && Math.abs(Math.abs(a) - xc(b)) < lw(b);
  const mask = (a, b) => (b >= crotch && b <= waist && Math.abs(a) < Wh) || inLeg(a, b);
  const wrap = (a, b, s) => {
    if (b < crotch) { const w = lw(b), R = 2 * w / Math.PI * 1.05, th = cl((Math.abs(a) - xc(b)) / w, -1, 1) * H; return [Math.sign(a) * (axisX(b) + R * Math.sin(th)), b, s * R * .95 * Math.cos(th)]; }
    const [x, z] = ell(Wh, s, cl(a / Wh, -1, 1) * H, .72); return [x, b, z];
  };
  return { perm: true, pairs: [{ axis: 'xy', mask, wrap, bounds: [-(Wh + cell), Wh + cell, hem - cell * .5, waist + cell * .5], rect: [.01, .01, .49, .99],
    open: (a, b) => b > waist - cell * 1.01 || b < hem + cell * 1.01, pins: (a, b) => b > waist - cell * 1.01 ? 2 : 0 }] };
}

export function buildGarment(type, o, cell, body, prims) {
  const spec = GARMENTS[type].kind === 'top' ? topSpec(type, o, cell) : bottomSpec(type, o, cell);
  const w = body.w, h = body.h, pos = [], rv2p = [], uv = [], idx = [], edges = new Map(), pinList = [], stitches = [], neckP = [], hoodBottom = []; let map0 = null; const pab = [];
  for (const pr of spec.pairs) {
    const [a0, a1, b0, b1] = pr.bounds, nx = Math.ceil((a1 - a0) / cell) + 1, ny = Math.ceil((b1 - b0) / cell) + 1;
    const A = i => a0 + i * cell, B = j => b0 + j * cell, inside = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && pr.mask(A(i), B(j));
    const [u0, v0, u1, v1] = pr.rect, sc = Math.min((u1 - u0) / (a1 - a0), (v1 - v0) / (b1 - b0));
    const shared = new Int32Array(nx * ny).fill(-1); if (!map0) map0 = { a0, a1, b0, u0, v0, sc };
    const P3 = (a, b, s) => { const q = pr.wrap(a, b, s); return pr.axis === 'xy' ? [q[0] * w, q[1] * h, q[2] * w] : [q[0] * w, q[1] * h, q[2] * w]; };
    for (const s of [1, -1]) {
      const rid = new Int32Array(nx * ny).fill(-1), pid = new Int32Array(nx * ny).fill(-1), bnd = new Uint8Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        if (!inside(i, j)) continue; const a = A(i), b = B(j), k = j * nx + i;
        const boundary = !inside(i + 1, j) || !inside(i - 1, j) || !inside(i, j + 1) || !inside(i, j - 1);
        const op = pr.open(a, b) || (pr.hole && [[cell, 0], [-cell, 0], [0, cell], [0, -cell]].some(([da, db]) => !pr.mask(a + da, b + db) && pr.hole(a + da, b + db))), sewn = boundary && !op; bnd[k] = boundary ? (sewn ? 2 : 1) : 0;
        let p;
        if (sewn && shared[k] >= 0) p = shared[k];
        else {
          p = pos.length / 3; let q = P3(a, b, s);
          if (sewn) { const q2 = P3(a, b, -s); q = [(q[0] + q2[0]) / 2, (q[1] + q2[1]) / 2, (q[2] + q2[2]) / 2]; shared[k] = p; }
          pos.push(...q); pab.push(a, b, s);
          const pn = pr.pins(a, b); if (pn) pinList.push([p, pn]);
          if (pr.hole && op && b > 1.38) neckP.push(p);
          if (pr.hood && b < 1.47 + cell * 1.1) hoodBottom.push(p);
        }
        pid[k] = p; rid[k] = rv2p.length; rv2p.push(p);
        const uu = s > 0 ? u0 + (a - a0) * sc : u0 + .5 + (a1 - a) * sc; uv.push(uu, v0 + (b - b0) * sc);
      }
      // edges
      const sa = pr.axis === 'xy' ? w : w;
      const add = (k1, k2, da, db, kind) => { const p1 = pid[k1], p2 = pid[k2]; if (p1 < 0 || p2 < 0 || p1 === p2) return; const key = p1 < p2 ? p1 * 1e6 + p2 : p2 * 1e6 + p1; if (!edges.has(key)) edges.set(key, [p1, p2, Math.hypot(da * sa, db * h), kind]); };
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i; if (pid[k] < 0) continue;
        if (i + 1 < nx) add(k, k + 1, cell, 0, 0); if (j + 1 < ny) add(k, k + nx, 0, cell, 0);
        if (i + 1 < nx && j + 1 < ny) add(k, k + nx + 1, cell, cell, 1); if (i > 0 && j + 1 < ny) add(k, k + nx - 1, cell, cell, 1);
        if (i + 2 < nx) add(k, k + 2, 2 * cell, 0, 2); if (j + 2 < ny) add(k, k + 2 * nx, 0, 2 * cell, 2);
      }
      // triangles (CCW in a,b); flip for back side (and hood mirrored)
      const flip = (s < 0) !== !!pr.flip;
      const tri = (x, y, z) => flip ? idx.push(x, z, y) : idx.push(x, y, z);
      for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
        const c00 = rid[j * nx + i], c10 = rid[j * nx + i + 1], c01 = rid[(j + 1) * nx + i], c11 = rid[(j + 1) * nx + i + 1];
        const n = (c00 >= 0) + (c10 >= 0) + (c01 >= 0) + (c11 >= 0);
        if (n === 4) { tri(c00, c10, c11); tri(c00, c11, c01); }
        else if (n === 3) { if (c00 < 0) tri(c10, c11, c01); else if (c10 < 0) tri(c00, c11, c01); else if (c01 < 0) tri(c00, c10, c11); else tri(c00, c10, c01); }
      }
      // stitch lines along boundaries, offset inward in uv
      const inw = k => { const i = k % nx, j = (k / nx) | 0; let dx = 0, dy = 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inside(i + di, j + dj)) { dx += di; dy += dj; } const L = Math.hypot(dx, dy) || 1; return [dx / L * (s > 0 ? 1 : -1), dy / L]; };
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i; if (!bnd[k]) continue;
        for (const k2 of [k + 1, k + nx]) { if ((k2 === k + 1 && i + 1 >= nx) || k2 >= nx * ny || !bnd[k2]) continue;
          const r1 = rid[k], r2 = rid[k2], n1 = inw(k), n2 = inw(k2);
          stitches.push({ a: [uv[r1 * 2], uv[r1 * 2 + 1]], b: [uv[r2 * 2], uv[r2 * 2 + 1]], na: n1, nb: n2, open: bnd[k] === 1 && bnd[k2] === 1, sc }); }
      }
    }
  }
  // hood attach (zero-length links) to the nearest neckline particles
  for (const hp of hoodBottom) { let best = -1, bd = .09; for (const np of neckP) { const d = Math.hypot(pos[hp * 3] - pos[np * 3], pos[hp * 3 + 1] - pos[np * 3 + 1], pos[hp * 3 + 2] - pos[np * 3 + 2]); if (d < bd) { bd = d; best = np; } } if (best >= 0) edges.set('h' + hp, [hp, best, 0, 3]); }
  const P = new Float32Array(pos), n = P.length / 3;
  for (let it = 0; it < 3; it++) for (let i = 0; i < n; i++) collideAt(prims, NP, 1, 0, P, i * 3, .012);
  // permanent waist pins hug the body (elastic waistband)
  const pins = new Int32Array(pinList.length), pinT = new Float32Array(pinList.length * 3), perm = new Uint8Array(pinList.length);
  pinList.forEach(([p, kind], k) => {
    let x = P[p * 3], y = P[p * 3 + 1], z = P[p * 3 + 2];
    if (kind === 2) { const q = new Float32Array(3); let lx = x, lz = z; for (let t = 1; t > .3; t -= .02) { q[0] = x * t; q[1] = y; q[2] = z * t; if (collideAt(prims, NP, 1, 0, q, 0, .008)) { break; } lx = q[0]; lz = q[2]; } x = lx; z = lz; P[p * 3] = x; P[p * 3 + 2] = z; }
    pins[k] = p; pinT.set([x, y, z], k * 3); perm[k] = kind >= 2 ? 1 : 0;
  });
  const E = new Int32Array(edges.size * 2), R = new Float32Array(edges.size), K = new Uint8Array(edges.size); let e = 0;
  // rest state = the arranged (wrapped + collision-projected) shape, blended slightly toward the flat pattern length.
  // Using the arranged shape as rest keeps the first drape stable (no tangles from initial tension).
  for (const v of edges.values()) { E[e * 2] = v[0]; E[e * 2 + 1] = v[1]; const a = v[0] * 3, b = v[1] * 3, d3 = Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]);
    R[e] = v[3] === 3 ? 0 : d3; K[e] = v[3]; e++; }
  return { type, n, pos: P, edges: E, rest: R, ekind: K, pins, pinT, perm, rv2p: new Int32Array(rv2p), uv: new Float32Array(uv), index: new Uint32Array(idx), stitches, pab, hood: spec.pairs.length > 1, kind: GARMENTS[type].kind, pxPerM: map0.sc * 1024 / w,
    uvAt: (a, b, s = 1) => [s > 0 ? map0.u0 + (a - map0.a0) * map0.sc : map0.u0 + .5 + (map0.a1 - a) * map0.sc, map0.v0 + (b - map0.b0) * map0.sc] };
}
