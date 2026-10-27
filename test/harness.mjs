// Node harness: runs the real worker solver headless for fast tuning.
import { posePrims, toWorld, NP } from '../body.js';
import { buildGarment, DEFAULT_FIT } from '../garments.js';
import { FABRICS } from '../texture.js';
let out = null; globalThis.self = { postMessage: (m) => { out = m; } };
await import('../sim-worker.js');
const send = d => self.onmessage({ data: d });
export function run(g, { cell = .019, sub = 10, secs = 4, fab = 'cotton', fit } = {}) {
  const body = { w: 1, h: 1 }, lp = posePrims(body), root = [0, 0, 0, 0], wp = toWorld(lp, root);
  const G = buildGarment(g, fit || DEFAULT_FIT[g], cell, body, lp); const f = FABRICS[fab];
  send({ type: 'init', gen: 1, pos: G.pos.slice(), edges: G.edges, rest: G.rest, ekind: G.ekind, pins: G.pins, pinT: G.pinT, perm: G.perm, fabric: f });
  let ms = 0; const N = secs * 60;
  for (let i = 0; i < N; i++) { send({ type: 'step', dt: 1 / 60, sub, prims: wp, root, wind: 0, grab: null }); ms += out.ms; }
  const P = out.pos; const st = []; for (let e = 0; e < G.rest.length; e++) { if (G.ekind[e]) continue; const a = G.edges[e * 2] * 3, b = G.edges[e * 2 + 1] * 3; st.push(Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]) / G.rest[e]); }
  st.sort((a, b) => a - b); let miny = 9, maxy = 0; for (let i = 1; i < P.length; i += 3) { miny = Math.min(miny, P[i]); maxy = Math.max(maxy, P[i]); }
  return { G, P, ms: ms / N, strain: { p5: st[st.length * .05 | 0], med: st[st.length / 2 | 0], p95: st[st.length * .95 | 0], max: st[st.length - 1] }, miny, maxy };
}
if (process.argv[2]) { const r = run(process.argv[2], { secs: +(process.argv[3] || 4) }); console.log(process.argv[2], r.G.n, r.ms.toFixed(2) + 'ms', JSON.stringify(r.strain), r.miny.toFixed(3), r.maxy.toFixed(3));
  const r0 = run(process.argv[2], { secs: 0.0001 }); console.log('initial strain', JSON.stringify(r0.strain), r0.miny.toFixed(3)); }
