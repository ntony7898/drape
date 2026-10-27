// Procedural mannequin: tapered capsules used for BOTH rendering and cloth collision (no mismatch).
// Prim layout (stride 9): ax ay az bx by bz ra rb sz   (sz = depth squash, applied in root frame)
export const STRIDE = 9;
const BASE = [
  ['hip', [0, .90, 0], [0, 1.06, 0], .165, .135, .72],
  ['waist', [0, 1.06, 0], [0, 1.27, 0], .135, .163, .70],
  ['chest', [0, 1.27, 0], [0, 1.40, 0], .163, .133, .62],
  ['neck', [0, 1.40, 0], [0, 1.56, 0], .058, .052, 1],
  ['head', [0, 1.62, .01], [0, 1.71, 0], .088, .092, 1],
  ['shL', [.15, 1.39, 0], [.19, 1.40, 0], .06, .058, 1],
  ['uaL', [.19, 1.40, 0], [.30, 1.16, 0], .052, .042, 1],
  ['faL', [.30, 1.16, 0], [.40, .94, 0], .041, .032, 1],
  ['hdL', [.40, .94, 0], [.44, .84, .01], .034, .028, 1],
  ['thL', [.093, .88, 0], [.10, .49, 0], .084, .055, 1],
  ['snL', [.10, .49, 0], [.105, .09, -.01], .053, .037, 1],
  ['ftL', [.105, .05, -.03], [.11, .04, .12], .042, .034, 1],
];
export const PARTS = [];
for (const p of BASE) { PARTS.push(p); if (p[0].endsWith('L')) PARTS.push([p[0].slice(0, -1) + 'R', [-p[1][0], p[1][1], p[1][2]], [-p[2][0], p[2][1], p[2][2]], p[3], p[4], p[5]]); }
export const NP = PARTS.length;
const rotX = (v, o, a) => { const y = v[1] - o[1], z = v[2] - o[2], c = Math.cos(a), s = Math.sin(a); return [v[0], o[1] + y * c + z * s, o[2] - y * s + z * c]; };
// pose: {w,h, walk(phase), amt(0..1)} -> Float32Array root-local prims
export function posePrims(b, pose = {}, out = new Float32Array(NP * STRIDE)) {
  const w = b.w, h = b.h, ph = pose.walk || 0, amt = pose.amt || 0, bob = amt * .015 * Math.cos(2 * ph);
  PARTS.forEach((p, i) => {
    let a = p[1], c = p[2]; const side = p[0].endsWith('L') ? 1 : -1, ph2 = ph + (side > 0 ? 0 : Math.PI);
    if (/^(th|sn|ft)/.test(p[0])) {
      const hipJ = [a[0], .88, 0], th = amt * .26 * Math.sin(ph2), kn = amt * (.06 + .6 * Math.max(0, Math.cos(ph2)));
      const knee = rotX([side * .10, .49, 0], hipJ, th);
      const T = v => { let q = rotX(v, hipJ, th); if (p[0] !== 'th' + p[0].slice(2)) { q = rotX([q[0], q[1], q[2]], knee, -kn); } return q; };
      if (p[0].startsWith('th')) { a = rotX(a, hipJ, th); c = rotX(c, hipJ, th); } else { a = T(a); c = T(c); }
    } else if (/^(ua|fa|hd)/.test(p[0])) {
      const sh = [side * .19, 1.40, 0], an = -amt * .16 * Math.sin(ph2), el = amt * .25 + .05;
      const elb = rotX([side * .30, 1.16, 0], sh, an);
      const T = v => p[0].startsWith('ua') ? rotX(v, sh, an) : rotX(rotX(v, sh, an), elb, el);
      a = T(a); c = T(c);
    }
    const k = i * STRIDE, ws = /^(head)/.test(p[0]) ? 1 : w, hs = p[0] === 'head' || p[0] === 'neck' ? Math.min(w, 1.05) : w;
    out[k] = a[0] * ws; out[k + 1] = a[1] * h + bob; out[k + 2] = a[2] * w; out[k + 3] = c[0] * ws; out[k + 4] = c[1] * h + bob; out[k + 5] = c[2] * w;
    out[k + 6] = p[3] * hs; out[k + 7] = p[4] * hs; out[k + 8] = p[5];
  });
  return out;
}
// root = [x,y,z,yaw]; world = R(yaw)*local + t
export function toWorld(local, root, out = new Float32Array(local.length)) {
  const c = Math.cos(root[3]), s = Math.sin(root[3]);
  for (let k = 0; k < local.length; k += STRIDE) for (const o of [0, 3]) {
    const x = local[k + o], z = local[k + o + 2];
    out[k + o] = x * c + z * s + root[0]; out[k + o + 1] = local[k + o + 1] + root[1]; out[k + o + 2] = -x * s + z * c + root[2];
    out[k + 6] = local[k + 6]; out[k + 7] = local[k + 7]; out[k + 8] = local[k + 8];
  }
  return out;
}
// push point P[ix..ix+2] out of all prims; returns 1 on contact
export function collideAt(pr, np, c, s, P, ix, th) {
  let px = P[ix], py = P[ix + 1], pz = P[ix + 2], hit = 0;
  for (let k = 0; k < np * STRIDE; k += STRIDE) {
    const ax = pr[k], ay = pr[k + 1], az = pr[k + 2], bx = pr[k + 3] - ax, by = pr[k + 4] - ay, bz = pr[k + 5] - az;
    const rmax = (pr[k + 6] > pr[k + 7] ? pr[k + 6] : pr[k + 7]) + th;
    const bb = bx * bx + by * by + bz * bz; let t = ((px - ax) * bx + (py - ay) * by + (pz - az) * bz) / bb; t = t < 0 ? 0 : t > 1 ? 1 : t;
    let dx = px - ax - bx * t, dy = py - ay - by * t, dz = pz - az - bz * t;
    if (dx * dx + dy * dy + dz * dz > rmax * rmax) continue;
    const r = pr[k + 6] + (pr[k + 7] - pr[k + 6]) * t + th, sz = pr[k + 8];
    if (sz === 1) { const L = Math.sqrt(dx * dx + dy * dy + dz * dz); if (L < r && L > 1e-7) { const f = r / L; px = ax + bx * t + dx * f; py = ay + by * t + dy * f; pz = az + bz * t + dz * f; hit = 1; } }
    else {
      let lx = dx * c - dz * s, lz = (dx * s + dz * c) / sz; const L = Math.sqrt(lx * lx + dy * dy + lz * lz);
      if (L < r && L > 1e-7) { const f = r / L; lx *= f; dy *= f; lz *= f * sz; dx = lx * c + lz * s; dz = -lx * s + lz * c; px = ax + bx * t + dx; py = ay + by * t + dy; pz = az + bz * t + dz; hit = 1; }
    }
  }
  P[ix] = px; P[ix + 1] = py; P[ix + 2] = pz; return hit;
}
// signed-ish depth of a point inside the body (for tests): max penetration over prims
export function depthAt(pr, np, c, s, x, y, z) { const P = new Float32Array([x, y, z]); collideAt(pr, np, c, s, P, 0, 0); return Math.hypot(P[0] - x, P[1] - y, P[2] - z); }
