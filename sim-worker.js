// Position-based (Verlet) cloth solver in a Web Worker. Fixed substeps; Float32Arrays transferred each frame.
import { collideAt, STRIDE } from './body.js';
let P, PP, W, E, R, K, pins, pinT, perm, n = 0, m = 0, t = 0, gen = 0;
let F = { stretch: 1, shear: .9, bend: .06, damp: .012, mass: 1, fric: .35 };
const KS = new Float32Array(4);
self.onmessage = (e) => {
  const d = e.data;
  if (d.type === 'init') {
    ({ pos: P, edges: E, rest: R, ekind: K, pins, pinT, perm, gen } = d); n = P.length / 3; m = R.length; PP = P.slice(); W = new Float32Array(n).fill(1); t = 0;
    if (d.fabric) F = d.fabric;
  } else if (d.type === 'fabric') F = d.fabric;
  else if (d.type === 'shake') { for (let i = 0; i < n; i++) { const k = i * 3, a = d.amt; PP[k] -= (Math.sin(i * 12.9898) * .5) * a; PP[k + 1] -= (.4 + Math.sin(i * 78.233) * .3) * a; PP[k + 2] -= (Math.cos(i * 4.1414) * .5) * a; } }
  else if (d.type === 'step' && n) { const t0 = performance.now(); step(d); const out = P.slice(); self.postMessage({ type: 'pos', pos: out, ms: performance.now() - t0, gen, n, m }, [out.buffer]); }
};
function step(d) {
  const S = d.sub, h = d.dt / S, h2 = h * h, pr = d.prims, np = pr.length / STRIDE, root = d.root, c = Math.cos(root[3]), s = Math.sin(root[3]);
  const damp = 1 - F.damp, gy = -9.8 * h2, rel = d.release ?? 0.9, th = .007, fr = F.fric;
  KS[0] = F.stretch; KS[1] = F.shear; KS[2] = F.bend; KS[3] = 1;
  const wind = d.wind || 0, wx = Math.sin(t * .23) * .4 + .3, wz = 1;
  const g = d.grab;
  // damp relative to the body's motion so a walking figure doesn't drag its clothes like syrup
  let rx = 0, rz = 0; if (self.lastRoot && Math.hypot(root[0] - self.lastRoot[0], root[2] - self.lastRoot[2]) < .3) { rx = (root[0] - self.lastRoot[0]) / S; rz = (root[2] - self.lastRoot[2]) / S; } self.lastRoot = [root[0], root[1], root[2]];
  for (let sub = 0; sub < S; sub++) {
    t += h;
    // integrate
    for (let i = 0, k = 0; i < n; i++, k += 3) {
      let vx = rx + (P[k] - PP[k] - rx) * damp, vy = (P[k + 1] - PP[k + 1]) * damp, vz = rz + (P[k + 2] - PP[k + 2] - rz) * damp;
      const v2 = vx * vx + vy * vy + vz * vz; if (v2 > 1e-3) { const f = .0316 / Math.sqrt(v2); vx *= f; vy *= f; vz *= f; }
      PP[k] = P[k]; PP[k + 1] = P[k + 1]; PP[k + 2] = P[k + 2];
      let ax = 0, az = 0;
      if (wind) { const gust = wind * (.55 + .45 * Math.sin(t * 1.9 + P[k + 1] * 4 + P[k] * 3)) * (.75 + .25 * Math.sin(t * 5.3 + i * .37)); ax = wx * gust * h2 / F.mass; az = wz * gust * h2 / F.mass; }
      P[k] += vx + ax; P[k + 1] += vy + gy; P[k + 2] += vz + az; W[i] = 1;
    }
    // pins (root-local targets), released after `rel` seconds unless permanent
    for (let q = 0; q < pins.length; q++) {
      if (!perm[q] && t > rel) continue;
      const i = pins[q], k = i * 3, lx = pinT[q * 3], lz = pinT[q * 3 + 2];
      P[k] = lx * c + lz * s + root[0]; P[k + 1] = pinT[q * 3 + 1] + root[1] + (d.bob || 0); P[k + 2] = -lx * s + lz * c + root[2]; W[i] = 0;
    }
    if (g && g.i >= 0 && g.i < n) { const k = g.i * 3; P[k] += (g.x - P[k]) * .6; P[k + 1] += (g.y - P[k + 1]) * .6; P[k + 2] += (g.z - P[k + 2]) * .6; W[g.i] = 0; }
    // distance constraints (stretch / shear / bend / seam-attach)
    for (let e = 0; e < m; e++) {
      const i = E[e * 2], j = E[e * 2 + 1], wi = W[i], wj = W[j], ws = wi + wj; if (ws === 0) continue;
      const a = i * 3, b = j * 3, dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz); if (L < 1e-9) continue;
      let r = R[e]; const kind = K[e];
      if (kind === 2 && L < r) r = L + (r - L) * .5; // bend resists folding more softly than stretching
      const f = (L - r) / (L * ws) * KS[kind];
      P[a] += dx * f * wi; P[a + 1] += dy * f * wi; P[a + 2] += dz * f * wi; P[b] -= dx * f * wj; P[b + 1] -= dy * f * wj; P[b + 2] -= dz * f * wj;
    }
    // body + floor collision with friction
    for (let i = 0, k = 0; i < n; i++, k += 3) {
      if (W[i] === 0) continue;
      if (collideAt(pr, np, c, s, P, k, th)) { PP[k] += (P[k] - PP[k] - rx) * fr; PP[k + 1] += (P[k + 1] - PP[k + 1]) * fr; PP[k + 2] += (P[k + 2] - PP[k + 2] - rz) * fr; }
      if (P[k + 1] < .004) { P[k + 1] = .004; PP[k] += (P[k] - PP[k]) * .8; PP[k + 2] += (P[k + 2] - PP[k + 2]) * .8; }
    }
  }
}
