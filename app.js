import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { APP } from './config.js';
import { posePrims, toWorld, NP, STRIDE, PARTS, depthAt } from './body.js';
import { GARMENTS, DEFAULT_FIT, buildGarment } from './garments.js';
import { FABRICS, weaveMaps, PATTERNS, PATTERN_NAMES, drawPattern, drawDetails, drawStitches, speckle, mix } from './texture.js';

const $ = s => document.querySelector(s), Q = new URLSearchParams(location.search);
document.getElementById('appName').textContent = APP.name; document.title = APP.name + ' — 3D cloth studio (test build)';
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches || localStorage.getItem('drape.rm') === '1';
if (RM()) document.body.classList.add('rm');
const toast = (m, ms = 2200) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), ms); };

// ---------- quality tiers ----------
const TIERS = [{ name: 'Low', cell: .026, sub: 8, shadow: 512 }, { name: 'Medium', cell: .019, sub: 10, shadow: 1024 }, { name: 'High', cell: .0145, sub: 12, shadow: 1024 }];
const mobile = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 900);
let qualPref = Q.get('tier') ?? localStorage.getItem('drape.q') ?? 'auto';
let tier = qualPref === 'auto' ? (mobile ? 1 : (navigator.hardwareConcurrency || 4) >= 8 ? 2 : 1) : +qualPref;

// ---------- renderer / scene ----------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 2 : 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .55;
const camera = new THREE.PerspectiveCamera(30, 1, .05, 60);
const HOME = { pos: new THREE.Vector3(0, 1.12, 4.3), tgt: new THREE.Vector3(0, 1.0, 0) };
camera.position.copy(HOME.pos);
const key = new THREE.DirectionalLight(0xfff1e0, 2.6); key.position.set(2.2, 4.2, 2.8); key.castShadow = true;
Object.assign(key.shadow.camera, { left: -1.3, right: 1.3, top: 2.1, bottom: -.3, near: .5, far: 12 }); key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.radius = 5;
const rim = new THREE.DirectionalLight(0xbfd4ff, 1.6); rim.position.set(-2.5, 2.6, -3);
const fill = new THREE.HemisphereLight(0xffffff, 0x302a28, .45);
scene.add(key, key.target, rim, fill);
// stage
const stage = new THREE.Group(); scene.add(stage);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: .55, metalness: 0 });
const floor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 96), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; stage.add(floor);
const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.63, 128), new THREE.MeshBasicMaterial({ color: 0xc6ff3d, transparent: true, opacity: .5 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .002; stage.add(ring);
const blobC = document.createElement('canvas'); blobC.width = blobC.height = 128; { const g = blobC.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
const blob = new THREE.Mesh(new THREE.PlaneGeometry(.9, .6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobC), transparent: true, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = .003; scene.add(blob);
// runway set
const runwaySet = new THREE.Group(); runwaySet.visible = false; scene.add(runwaySet);
{ const rw = new THREE.Mesh(new THREE.BoxGeometry(1.8, .06, 9), new THREE.MeshPhysicalMaterial({ color: 0x0d0d10, roughness: .18, clearcoat: 1, clearcoatRoughness: .1 })); rw.position.set(0, -.03, -1); rw.receiveShadow = true; runwaySet.add(rw);
  for (const x of [-.92, .92]) { const st = new THREE.Mesh(new THREE.BoxGeometry(.02, .02, 9), new THREE.MeshBasicMaterial({ color: 0xc6ff3d })); st.position.set(x, .005, -1); runwaySet.add(st); }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), new THREE.MeshStandardMaterial({ color: 0x111114, roughness: .9 })); back.position.set(0, 2.5, -5.4); runwaySet.add(back);
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(.5, .04, .04), new THREE.MeshBasicMaterial({ color: 0xffffff })); l.position.set(0, 3.4, -5 + i); runwaySet.add(l); } }
// photo scenes
const plinth = new THREE.Group(); plinth.visible = false; scene.add(plinth);
{ const pm = new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: .8 }); const arch = new THREE.Mesh(new THREE.TorusGeometry(1.6, .12, 24, 64, Math.PI), pm); arch.position.set(0, .9, -1.6); plinth.add(arch);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshStandardMaterial({ color: 0xd9cfc0, roughness: 1 })); wall.position.set(0, 2, -1.75); wall.receiveShadow = true; plinth.add(wall);
  for (const x of [-1.6, 1.6]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .9, 32), pm); c.position.set(x, .45, -1.6); plinth.add(c); } }

// ---------- mannequin ----------
const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xcfc8bd, roughness: .48, metalness: 0, sheen: .4, sheenColor: 0xffffff, sheenRoughness: .6, clearcoat: .15, clearcoatRoughness: .5 });
const bodyG = new THREE.Group(); scene.add(bodyG);
const body = { w: 1, h: 1 }, pose = { walk: 0, amt: 0 }, root = [0, 0, 0, 0];
let localPrims = posePrims(body, pose), worldPr = toWorld(localPrims, root);
function capsuleGeo(ra, rb, L) { const pts = []; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(1e-4, ra * Math.cos(a)), ra * Math.sin(a))); }
  for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(1e-4, rb * Math.cos(a)), L + rb * Math.sin(a))); } return new THREE.LatheGeometry(pts, 40); }
function buildBody() {
  bodyG.clear(); localPrims = posePrims(body, pose);
  for (let i = 0; i < NP; i++) { const k = i * STRIDE, L = Math.hypot(localPrims[k + 3] - localPrims[k], localPrims[k + 4] - localPrims[k + 1], localPrims[k + 5] - localPrims[k + 2]);
    const m = new THREE.Mesh(capsuleGeo(localPrims[k + 6] - .001, localPrims[k + 7] - .001, L), bodyMat); m.castShadow = m.receiveShadow = true; bodyG.add(m); }
  updateBody();
}
const _v = new THREE.Vector3(), _u = new THREE.Vector3(0, 1, 0);
function updateBody() {
  posePrims(body, pose, localPrims);
  bodyG.children.forEach((m, i) => { const k = i * STRIDE; m.position.set(localPrims[k], localPrims[k + 1], localPrims[k + 2]);
    _v.set(localPrims[k + 3] - localPrims[k], localPrims[k + 4] - localPrims[k + 1], localPrims[k + 5] - localPrims[k + 2]).normalize(); m.quaternion.setFromUnitVectors(_u, _v); m.scale.set(1, 1, localPrims[k + 8]); });
  bodyG.position.set(root[0], root[1], root[2]); bodyG.rotation.y = root[3]; toWorld(localPrims, root, worldPr);
  if (clothMesh) { clothMesh.position.set(root[0], root[1], root[2]); clothMesh.rotation.y = root[3]; } // cloth is simulated in the body's local frame
  blob.position.x = root[0]; blob.position.z = root[2];
}

// ---------- design state ----------
const DEF = () => ({ g: 'tee', f: 'cotton', c1: '#ece7de', c2: '#17171b', trim: '#c6ff3d', pat: 'none', pscale: 1, fit: { ...DEFAULT_FIT.tee }, body: { shape: 1, height: 1 }, decals: [], art: null, aop: 0, rough: 0, sheen: 1, light: 'studio', lightI: 1, bg: 'charcoal' });
let D = DEF();
const imgCache = {};
const loadImg = src => imgCache[src] || (imgCache[src] = new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }));
// texture canvases
const TEX = 1024, mk = () => { const c = document.createElement('canvas'); c.width = c.height = TEX; return c; };
const baseC = mk(), paintC = mk(), compC = mk(), paintX = paintC.getContext('2d'), compX = compC.getContext('2d');
const map = new THREE.CanvasTexture(compC); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
const clothMat = new THREE.MeshPhysicalMaterial({ map, side: THREE.DoubleSide, roughness: 1, sheen: .5 });
clothMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n if(!gl_FrontFacing) diffuseColor.rgb *= 0.62;'); };
const ZROOT = [0, 0, 0, 0];
let G = null, clothMesh = null, triP = null, pN = null, gen = 0;

// ---------- worker ----------
const worker = new Worker(new URL('./sim-worker.js', import.meta.url), { type: 'module' });
let busy = false, simMs = 0, simHist = [], lastPos = null, simT = 0, wind = 0, grab = null;
worker.onmessage = e => { const d = e.data; busy = false; if (d.gen !== gen) return; simMs = d.ms; simHist.push(d.ms); if (simHist.length > 120) simHist.shift(); lastPos = d.pos; };
worker.onerror = e => console.error('worker', e.message);
const fabParams = () => { const f = FABRICS[D.f]; return { stretch: f.stretch, shear: f.shear, bend: f.bend, damp: f.damp, mass: f.mass, fric: f.fric }; };

function rebuild(keepPaint = true) {
  body.w = .885 + D.body.shape * .115; body.h = D.body.height;
  const fresh = !G || G.type !== D.g; buildBody(); root[0] = root[2] = root[3] = 0; pose.amt = 0; updateBody();
  G = buildGarment(D.g, D.fit, TIERS[tier].cell, body, localPrims);
  if (fresh && !keepPaint) paintX.clearRect(0, 0, TEX, TEX);
  const n = G.rv2p.length, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(G.uv, 2)); geo.setIndex(new THREE.BufferAttribute(G.index, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 3);
  if (clothMesh) { scene.remove(clothMesh); clothMesh.geometry.dispose(); }
  clothMesh = new THREE.Mesh(geo, clothMat); clothMesh.castShadow = clothMesh.receiveShadow = true; clothMesh.frustumCulled = false; scene.add(clothMesh);
  triP = new Int32Array(G.index.length); for (let i = 0; i < G.index.length; i++) triP[i] = G.rv2p[G.index[i]]; pN = new Float32Array(G.n * 3);
  lastPos = G.pos.slice(); applyPositions(lastPos); gen++; simT = 0; busy = false;
  worker.postMessage({ type: 'init', gen, pos: G.pos.slice(), edges: G.edges, rest: G.rest, ekind: G.ekind, pins: G.pins, pinT: G.pinT, perm: G.perm, fabric: fabParams() });
  key.shadow.mapSize.set(TIERS[tier].shadow, TIERS[tier].shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
  applyMaterial(); compose(true);
}
function applyPositions(P) {
  const pa = clothMesh.geometry.attributes.position, na = clothMesh.geometry.attributes.normal, A = pa.array, N = na.array, r = G.rv2p;
  pN.fill(0);
  for (let t = 0; t < triP.length; t += 3) { const a = triP[t] * 3, b = triP[t + 1] * 3, c = triP[t + 2] * 3;
    const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    // back panels are wound opposite, so orient by render triangle; accumulate per particle with sign from front-facing convention
    for (const q of [a, b, c]) { pN[q] += nx; pN[q + 1] += ny; pN[q + 2] += nz; } }
  for (let i = 0; i < r.length; i++) { const p = r[i] * 3, k = i * 3; A[k] = P[p]; A[k + 1] = P[p + 1]; A[k + 2] = P[p + 2]; const L = Math.hypot(pN[p], pN[p + 1], pN[p + 2]) || 1; N[k] = pN[p] / L; N[k + 1] = pN[p + 1] / L; N[k + 2] = pN[p + 2] / L; }
  pa.needsUpdate = na.needsUpdate = true;
}
function applyMaterial() {
  const f = FABRICS[D.f], wm = weaveMaps(THREE, D.f);
  Object.assign(clothMat, { normalMap: wm.normal, roughnessMap: wm.rough, roughness: Math.min(1, Math.max(.05, f.rough + D.rough)), sheen: f.sheen * D.sheen, sheenRoughness: f.sheenRough, clearcoat: f.clear, clearcoatRoughness: .35 });
  clothMat.normalScale.set(f.nrm, f.nrm); clothMat.sheenColor.set(mix(D.c1, '#ffffff', .5)); clothMat.needsUpdate = true;
  worker.postMessage({ type: 'fabric', fabric: fabParams() });
}
// ---------- texture compose ----------
let baseKey = '';
async function compose(force) {
  if (!G) return;
  const bk = [D.g, D.c1, D.c2, D.trim, D.pat, D.pscale, D.f, tier, D.fit.len, D.fit.slv, D.fit.fit, body.w].join('|');
  if (force || bk !== baseKey) { const bx = baseC.getContext('2d'); drawPattern(bx, D, G.pxPerM); speckle(bx, FABRICS[D.f].speck); drawDetails(bx, G, D); baseKey = bk; }
  compX.clearRect(0, 0, TEX, TEX); compX.drawImage(baseC, 0, 0);
  if (D.art && D.aop) { const im = await loadImg(D.art); if (im) { const s = D.aop * G.pxPerM * .25, w = s, h = s * im.height / im.width; for (let y = 0; y < TEX; y += h) for (let x = 0; x < TEX; x += w) compX.drawImage(im, x, y, w, h); } }
  compX.drawImage(paintC, 0, 0);
  for (const dc of D.decals) await drawDecal(compX, dc);
  drawStitches(compX, G, D); map.needsUpdate = true;
}
const FONTS = { 'Archivo Black': 'A', 'Space Mono': 'M', 'DM Serif': 'DM', 'Pirata': 'PI', 'Monoton': 'MO', 'System': 'system-ui' };
async function drawDecal(x, dc) {
  const ppm = G.pxPerM, px = dc.u * TEX, py = (1 - dc.v) * TEX, s = dc.s * ppm;
  x.save(); x.translate(px, py); x.rotate((dc.r || 0) * Math.PI / 180);
  if (dc.t === 'text' || dc.t === 'emoji' || dc.t === 'shape') {
    const fam = dc.t === 'text' ? (FONTS[dc.font] || 'A') : 'system-ui';
    x.font = `${s * .5}px ${fam}, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = dc.col || '#111';
    const lines = String(dc.val).split('\n'); lines.forEach((l, i) => x.fillText(l, 0, (i - (lines.length - 1) / 2) * s * .55));
  } else { const im = await loadImg(dc.val); if (im) { const w = s, h = s * im.height / im.width; x.drawImage(im, -w / 2, -h / 2, w, h); } }
  x.restore();
}
// ---------- history ----------
const hist = [], redoS = [];
function snap() { return { d: JSON.stringify(D), p: paintX.getImageData(0, 0, TEX, TEX) }; }
function commit() { hist.push(snap()); if (hist.length > 25) hist.shift(); redoS.length = 0; updUR(); }
function updUR() { $('#undo').disabled = hist.length < 2; $('#redo').disabled = !redoS.length; }
function restore(s) { const old = D; D = JSON.parse(s.d); paintX.putImageData(s.p, 0, 0); const geom = old.g !== D.g || JSON.stringify(old.fit) !== JSON.stringify(D.fit) || JSON.stringify(old.body) !== JSON.stringify(D.body);
  if (geom) rebuild(true); else { applyMaterial(); compose(); } applyLight(); renderPane(); }
$('#undo').onclick = () => { if (hist.length < 2) return; redoS.push(hist.pop()); restore(hist[hist.length - 1]); updUR(); };
$('#redo').onclick = () => { if (!redoS.length) return; const s = redoS.pop(); hist.push(s); restore(s); updUR(); };

// ---------- lighting & backgrounds ----------
const LIGHTS = { studio: [0xfff1e0, 2.6, 0xbfd4ff, 1.6, .45, 1.0], sunset: [0xffa060, 3.0, 0x8a5cff, 2.0, .3, 1.05], neon: [0xff3fd0, 2.4, 0x2fe8ff, 3.0, .2, 1.1], daylight: [0xffffff, 3.2, 0xffffff, .8, .8, 1.0], noir: [0xffffff, 3.6, 0x223355, .3, .08, .95] };
const BGS = { charcoal: ['#1b1b20', '#07070a'], bone: ['#efe9df', '#cfc6b8'], lime: ['#d9ff7a', '#8fc21a'], blush: ['#ffd9d2', '#e6a4a0'], sunset: ['#ff9a62', '#5b2a86'], ocean: ['#5ee7ff', '#1d3b8f'], plinth: ['#e8dfd1', '#b9ae9c'], runway: ['#101014', '#000000'] };
function bgTex(a, b) { const c = document.createElement('canvas'); c.width = 16; c.height = 512; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 16, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function applyLight() {
  const L = LIGHTS[D.light] || LIGHTS.studio, I = D.lightI; key.color.set(L[0]); key.intensity = L[1] * I; rim.color.set(L[2]); rim.intensity = L[3] * I; fill.intensity = L[4] * I; scene.environmentIntensity = .55 * I; renderer.toneMappingExposure = L[5];
  const bg = mode === 'runway' ? 'runway' : D.bg, B = BGS[bg]; if (scene.background) scene.background.dispose?.(); scene.background = bgTex(B[0], B[1]);
  const light = ['bone', 'lime', 'blush', 'plinth'].includes(bg); floorMat.color.set(light ? mix(B[1], '#000000', .15) : '#1c1c20');
  plinth.visible = bg === 'plinth' && mode !== 'runway'; runwaySet.visible = mode === 'runway'; stage.visible = mode !== 'runway'; ring.visible = !light;
}

// ---------- interaction ----------
const controls = { enabled: true };
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hitP = new THREE.Vector3();
let tool = 'grab', paintSize = 14, paintCol = '#ff2e63', eraser = false, selDecal = -1, lastTap = 0, stroke = null, dragging = false;
function pick(e) { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); return clothMesh ? ray.intersectObject(clothMesh)[0] : null; }
canvas.addEventListener('pointerdown', e => {
  if (mode !== 'studio') return; const h = pick(e); const now = performance.now();
  if (!h && now - lastTap < 320) { resetView(); lastTap = 0; return; } lastTap = now;
  if (!h) return;
  e.stopImmediatePropagation(); canvas.setPointerCapture(e.pointerId); dragging = true;
  if (tool === 'paint') { stroke = { last: h.uv.clone() }; paintAt(h.uv, null); }
  else if (tool === 'place' && D.decals[selDecal]) { D.decals[selDecal].u = h.uv.x; D.decals[selDecal].v = h.uv.y; compose(); }
  else { const i = G.rv2p[h.face.a]; plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), h.point); grab = { i, x: h.point.x, y: h.point.y, z: h.point.z }; }
}, true);
canvas.addEventListener('pointermove', e => {
  if (!dragging) return; e.stopImmediatePropagation();
  if (tool === 'paint' && stroke) { const h = pick(e); if (h) { paintAt(h.uv, stroke.last); stroke.last = h.uv.clone(); } else stroke.last = null; }
  else if (tool === 'place' && D.decals[selDecal]) { const h = pick(e); if (h) { D.decals[selDecal].u = h.uv.x; D.decals[selDecal].v = h.uv.y; compose(); } }
  else if (grab) { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); if (ray.ray.intersectPlane(plane, hitP)) Object.assign(grab, { x: hitP.x, y: hitP.y, z: hitP.z }); }
}, true);
const up = e => { if (!dragging) return; dragging = false; e.stopImmediatePropagation(); if (tool !== 'grab') commit(); stroke = null; grab = null; };
canvas.addEventListener('pointerup', up, true); canvas.addEventListener('pointercancel', up, true);
function paintAt(uv, last) {
  const x = uv.x * TEX, y = (1 - uv.y) * TEX; paintX.save(); paintX.globalCompositeOperation = eraser ? 'destination-out' : 'source-over'; paintX.strokeStyle = paintX.fillStyle = paintCol; paintX.lineCap = 'round'; paintX.lineWidth = paintSize;
  if (last && Math.hypot(last.x - uv.x, last.y - uv.y) < .05) { paintX.beginPath(); paintX.moveTo(last.x * TEX, (1 - last.y) * TEX); paintX.lineTo(x, y); paintX.stroke(); } else { paintX.beginPath(); paintX.arc(x, y, paintSize / 2, 0, 7); paintX.fill(); }
  paintX.restore(); compose();
}
const orbit = new OrbitControls(camera, canvas); orbit.target.copy(HOME.tgt); orbit.enableDamping = !RM(); orbit.minDistance = 1.2; orbit.maxDistance = 8; orbit.maxPolarAngle = Math.PI * .56; orbit.enablePan = false;
orbit.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }; orbit.update();
function resetView() { camera.position.copy(HOME.pos); orbit.target.copy(HOME.tgt); orbit.update(); }

// ---------- buttons ----------
$('#windBtn').onclick = e => { wind = wind ? 0 : 1; e.currentTarget.setAttribute('aria-pressed', !!wind); toast(wind ? 'Wind on' : 'Wind off'); };
$('#shakeBtn').onclick = () => worker.postMessage({ type: 'shake', amt: .012 });
$('#dropBtn').onclick = () => rebuild(true);
$('#saveBtn').onclick = () => saveDesign();

// ---------- sheets / panes ----------
let tab = null;
$('#tabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; tab = tab === b.dataset.t ? null : b.dataset.t; document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === tab)); $('#sheet').classList.toggle('open', !!tab); renderPane(); };
const SW = [['Bone', '#ece7de'], ['Ink', '#17171b'], ['Lime', '#c6ff3d'], ['Coral', '#ff5a4e'], ['Cobalt', '#2547ff'], ['Indigo', '#24345c'], ['Forest', '#1f4d3a'], ['Plum', '#5b2347'], ['Gold', '#e3b23c'], ['Blush', '#f4b6c2'], ['Sky', '#8ecdf5'], ['Rust', '#a4471f'], ['Ash', '#9a9a9f'], ['Cream', '#f5edd6'], ['Orange', '#ff7a1a'], ['Mint', '#a6f0c6']];
const SWATCH_BOOK = [['Studio Black 01', '#101012'], ['Paper White 02', '#f7f5f0'], ['Heather Grey 03', '#a3a3a8'], ['Navy 04', '#1b2440'], ['Royal 05', '#2a4bd7'], ['Signal Red 06', '#d7262e'], ['Pumpkin 07', '#ff7518'], ['Sun 08', '#ffd23f'], ['Kelly 09', '#1e9b4b'], ['Olive 10', '#6b6b2f'], ['Sand 11', '#d8c3a5'], ['Mocha 12', '#6f4e37'], ['Lilac 13', '#c8a2c8'], ['Hot Pink 14', '#ff3fa4'], ['Teal 15', '#138d90'], ['Lime 16', '#c6ff3d']];
const ICON = { tee: 'M10 8l8-4h12l8 4 6 10-6 3v21H14V21l-6-3z', otee: 'M8 9l9-5h14l9 5 7 12-7 2v19H14V23l-7-2z', hoodie: 'M16 8q8-8 16 0l8 4 5 26-5 1-2-17v20H10V22l-2 17-5-1 5-26z', crew: 'M12 8l7-3q5 4 10 0l7 3 6 30-5 1-3-18v20H14V21l-3 18-5-1z', camp: 'M10 8l8-4 6 6 6-6 8 4 6 10-6 3v21H14V21l-6-3z', jersey: 'M10 8l8-4q6 6 12 0l8 4 6 10-6 3v21H14V21l-6-3zM24 10v32', dress: 'M18 4h12l1 10 9 28H8l9-28z', pants: 'M14 5h20l3 38h-8l-5-26-5 26h-8z', wide: 'M14 5h20l7 38h-12l-5-24-5 24H7z', shorts: 'M13 10h22l4 22h-11l-4-10-4 10H9z', wshorts: 'M13 10h22l7 22h-13l-5-9-5 9H6z', skirt: 'M16 10h16l8 28H8z' };
function sl(label, val, min, max, step, on, fmt = v => (+v).toFixed(2)) { const l = document.createElement('label'); l.className = 'sl'; l.innerHTML = `<span>${label}</span><input type=range min=${min} max=${max} step=${step} value=${val}><output>${fmt(val)}</output>`;
  const i = l.querySelector('input'), o = l.querySelector('output'); i.oninput = () => { o.textContent = fmt(i.value); on(+i.value, false); }; i.onchange = () => on(+i.value, true); return l; }
const h3 = (t, s = '') => `<h3>${t}${s ? `<small>${s}</small>` : ''}</h3>`;
let dsub = 'color';
function renderPane() {
  const P = $('#pane'); P.innerHTML = ''; if (!tab) return;
  if (tab === 'garment') {
    P.insertAdjacentHTML('beforeend', h3('Garment', 'real cloth sim · tap to switch'));
    const g = document.createElement('div'); g.className = 'grid';
    for (const [k, v] of Object.entries(GARMENTS)) { const b = document.createElement('button'); b.className = 'card' + (D.g === k ? ' on' : ''); b.innerHTML = `<svg viewBox="0 0 48 48"><path d="${ICON[k]}" fill="${D.g === k ? '#c6ff3d' : '#d8d4cc'}"/></svg>${v.name}`; b.dataset.g = k;
      b.onclick = () => { D.g = k; D.fit = { ...DEFAULT_FIT[k] }; paintX.clearRect(0, 0, TEX, TEX); rebuild(false); commit(); renderPane(); }; g.append(b); }
    P.append(g);
  }
  if (tab === 'fabric') {
    P.insertAdjacentHTML('beforeend', h3('Fabric', 'changes physics + surface'));
    const g = document.createElement('div'); g.className = 'grid';
    for (const [k, f] of Object.entries(FABRICS)) { const b = document.createElement('button'); b.className = 'card' + (D.f === k ? ' on' : ''); b.dataset.f = k; const c = weaveMaps(THREE, k).preview, cv = document.createElement('canvas'); cv.width = cv.height = 64; cv.getContext('2d').drawImage(c, 0, 0, 64, 64);
      b.append(cv); b.insertAdjacentHTML('beforeend', `${f.name}<small>${f.note}</small>`); b.onclick = () => { D.f = k; applyMaterial(); compose(); commit(); renderPane(); }; g.append(b); }
    P.append(g);
    P.insertAdjacentHTML('beforeend', h3('Surface'));
    P.append(sl('Roughness ±', D.rough, -.4, .4, .01, (v, c) => { D.rough = v; applyMaterial(); if (c) commit(); }), sl('Sheen', D.sheen, 0, 2, .05, (v, c) => { D.sheen = v; applyMaterial(); if (c) commit(); }));
  }
  if (tab === 'design') {
    const seg = document.createElement('div'); seg.className = 'seg'; for (const [k, n] of [['color', 'Color'], ['pattern', 'Pattern'], ['paint', 'Paint'], ['decal', 'Decals'], ['art', 'Mockup']]) { const b = document.createElement('button'); b.textContent = n; b.className = dsub === k ? 'on' : ''; b.onclick = () => { dsub = k; setTool(k === 'paint' ? 'paint' : 'grab'); renderPane(); }; seg.append(b); }
    P.append(seg);
    if (dsub === 'color') {
      for (const [slot, lab] of [['c1', 'Main color'], ['c2', 'Accent / pattern'], ['trim', 'Stitch & trim']]) {
        P.insertAdjacentHTML('beforeend', h3(lab)); const r = document.createElement('div'); r.className = 'scroll';
        const pk = document.createElement('input'); pk.type = 'color'; pk.value = D[slot]; pk.oninput = () => { D[slot] = pk.value; compose(); applyMaterial(); }; pk.onchange = commit; r.append(pk);
        for (const [n, c] of (slot === 'c1' ? SWATCH_BOOK : SW)) { const d = document.createElement('button'); d.className = 'dot' + (D[slot] === c ? ' on' : ''); d.style.background = c; d.title = n; d.onclick = () => { D[slot] = c; compose(); applyMaterial(); commit(); renderPane(); };
          if (slot === 'c1') { const w = document.createElement('div'); w.className = 'swn'; w.append(d); w.insertAdjacentHTML('beforeend', `<span>${n.split(' ').pop()}</span>`); r.append(w); } else r.append(d); }
        P.append(r);
      }
      P.insertAdjacentHTML('beforeend', '<p class="mut">Swatch book = Drape\'s own named studio colors (not Pantone® references).</p>');
    }
    if (dsub === 'pattern') {
      P.insertAdjacentHTML('beforeend', h3('Pattern', 'generated on device'));
      const g = document.createElement('div'); g.className = 'grid';
      for (const p of PATTERNS) { const b = document.createElement('button'); b.className = 'card' + (D.pat === p ? ' on' : ''); b.dataset.p = p; const cv = document.createElement('canvas'); cv.width = cv.height = 128; drawPattern(cv.getContext('2d'), { ...D, pat: p }, 900); b.append(cv); b.append(PATTERN_NAMES[p]);
        b.onclick = () => { D.pat = p; compose(); commit(); renderPane(); }; g.append(b); }
      P.append(g, sl('Scale', D.pscale, .4, 2.5, .05, (v, c) => { D.pscale = v; compose(); if (c) commit(); }));
    }
    if (dsub === 'paint') {
      P.insertAdjacentHTML('beforeend', h3('Brush', 'draw directly on the fabric'));
      const r = document.createElement('div'); r.className = 'row'; const pk = document.createElement('input'); pk.type = 'color'; pk.value = paintCol; pk.oninput = () => paintCol = pk.value; r.append(pk);
      for (const c of ['#ff2e63', '#c6ff3d', '#2547ff', '#ffffff', '#111111', '#ffd23f']) { const d = document.createElement('button'); d.className = 'dot'; d.style.background = c; d.onclick = () => { paintCol = c; pk.value = c; eraser = false; }; r.append(d); }
      const er = document.createElement('button'); er.className = 'pill' + (eraser ? ' on' : ''); er.textContent = 'Eraser'; er.onclick = () => { eraser = !eraser; er.classList.toggle('on', eraser); }; r.append(er);
      const cl = document.createElement('button'); cl.className = 'pill'; cl.textContent = 'Clear'; cl.onclick = () => { paintX.clearRect(0, 0, TEX, TEX); compose(); commit(); }; r.append(cl);
      P.append(r, sl('Size', paintSize, 3, 60, 1, v => paintSize = v, v => v + 'px'));
      P.insertAdjacentHTML('beforeend', '<p class="mut">Brush is on while this tab is open — drag on the garment to paint; drag the background to orbit.</p>');
    }
    if (dsub === 'decal' || dsub === 'art') {
      if (dsub === 'decal') {
        P.insertAdjacentHTML('beforeend', h3('Add decal'));
        const r = document.createElement('div'); r.className = 'row';
        const tx = document.createElement('input'); tx.type = 'text'; tx.value = 'DRAPE'; tx.style.flex = '1'; tx.maxLength = 24;
        const fs = document.createElement('select'); for (const f of Object.keys(FONTS)) fs.add(new Option(f, f));
        const add = document.createElement('button'); add.className = 'pill acc'; add.textContent = '+ Text'; add.onclick = () => addDecal({ t: 'text', val: tx.value || 'TEXT', font: fs.value, col: D.trim, s: .22 });
        r.append(tx, fs, add); P.append(r);
        const r2 = document.createElement('div'); r2.className = 'scroll'; r2.style.marginTop = '8px';
        for (const v of ['★', '●', '▲', '♥', '⚡', '🔥', '😎', '🌈', '💀', '🦋', '✨', '🎃']) { const b = document.createElement('button'); b.className = 'pill'; b.style.fontSize = '20px'; b.textContent = v; b.onclick = () => addDecal({ t: /[★●▲♥⚡]/.test(v) ? 'shape' : 'emoji', val: v, col: D.c2, s: .14 }); r2.append(b); }
        for (const v of ['black-lime', 'electric-blue', 'sunset', 'coral-navy', 'plum-gold']) { const b = document.createElement('button'); b.className = 'pill'; b.innerHTML = `<img src="img/TN-${v}.svg" width=30 height=30 style="border-radius:6px;vertical-align:middle">`; b.title = 'TN logo'; b.onclick = () => addDecal({ t: 'logo', val: `img/TN-${v}.svg`, s: .14 }); r2.append(b); }
        P.append(r2);
      } else {
        P.insertAdjacentHTML('beforeend', h3('Mockup artwork', 'PNG · JPG · SVG'));
        const r = document.createElement('div'); r.className = 'row'; const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/png,image/jpeg,image/svg+xml'; f.hidden = true;
        const b = document.createElement('button'); b.className = 'big'; b.textContent = 'Upload artwork'; b.onclick = () => f.click();
        f.onchange = () => { const file = f.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => { D.art = rd.result; addDecal({ t: 'image', val: rd.result, s: .24 }); }; rd.readAsDataURL(file); };
        r.append(b, f); P.append(r);
        const ao = document.createElement('div'); ao.className = 'seg'; ao.style.marginTop = '10px';
        for (const [k, n] of [[0, 'Placement print'], [1, 'All-over print']]) { const x = document.createElement('button'); x.textContent = n; x.className = (!!D.aop === !!k) ? 'on' : ''; x.onclick = () => { if (!D.art) return toast('Upload artwork first'); D.aop = k ? (D.aop || 1) : 0; compose(); commit(); renderPane(); }; ao.append(x); }
        P.append(ao); if (D.aop) P.append(sl('Tile size', D.aop, .3, 3, .05, (v, c) => { D.aop = v; compose(); if (c) commit(); }));
        P.insertAdjacentHTML('beforeend', '<p class="mut">Placement print sits on the chest print area; drag it with “Move on garment”. All-over print tiles the artwork across every panel. Uploaded images stay on this device (not in share links).</p>');
      }
      if (D.decals.length) {
        P.insertAdjacentHTML('beforeend', h3('Selected decal', 'pick · move · scale · rotate'));
        const r = document.createElement('div'); r.className = 'scroll';
        D.decals.forEach((dc, i) => { const b = document.createElement('button'); b.className = 'pill' + (i === selDecal ? ' on' : ''); b.textContent = dc.t === 'text' ? dc.val.slice(0, 8) : dc.t === 'logo' ? 'TN' : dc.t === 'image' ? 'Art' : dc.val; b.onclick = () => { selDecal = i; renderPane(); }; r.append(b); });
        P.append(r);
        const dc = D.decals[selDecal];
        if (dc) { const mv = document.createElement('button'); mv.className = 'pill' + (tool === 'place' ? ' on' : ''); mv.textContent = tool === 'place' ? '✓ Moving — drag on garment' : '✥ Move on garment'; mv.onclick = () => { setTool(tool === 'place' ? 'grab' : 'place'); renderPane(); };
          const del = document.createElement('button'); del.className = 'pill'; del.textContent = 'Delete'; del.onclick = () => { D.decals.splice(selDecal, 1); selDecal = D.decals.length - 1; compose(); commit(); renderPane(); };
          const col = document.createElement('input'); col.type = 'color'; col.value = dc.col || '#111111'; col.oninput = () => { dc.col = col.value; compose(); }; col.onchange = commit;
          const rr = document.createElement('div'); rr.className = 'row'; rr.style.marginTop = '8px'; rr.append(mv, del); if (dc.t !== 'logo' && dc.t !== 'image') rr.append(col); P.append(rr);
          P.append(sl('Scale', dc.s, .04, .6, .01, (v, c) => { dc.s = v; compose(); if (c) commit(); }, v => Math.round(v * 100) + 'cm'), sl('Rotate', dc.r || 0, -180, 180, 1, (v, c) => { dc.r = v; compose(); if (c) commit(); }, v => v + '°')); }
      }
    }
  }
  if (tab === 'fit') {
    const top = GARMENTS[D.g].kind === 'top' && D.g !== 'dress';
    P.insertAdjacentHTML('beforeend', h3('Fit', 'rebuilds the pattern, then re-drapes'));
    const seg = document.createElement('div'); seg.className = 'seg'; ['Slim', 'Regular', 'Oversized'].forEach((n, i) => { const b = document.createElement('button'); b.textContent = n; b.className = D.fit.fit === i ? 'on' : ''; b.onclick = () => { D.fit.fit = i; rebuild(true); commit(); renderPane(); }; seg.append(b); });
    P.append(seg, sl('Length', D.fit.len, 0, 1, .01, (v, c) => { D.fit.len = v; if (c) { rebuild(true); commit(); } }));
    if (top) P.append(sl('Sleeve', D.fit.slv, 0, 1, .01, (v, c) => { D.fit.slv = v; if (c) { rebuild(true); commit(); } }));
    P.insertAdjacentHTML('beforeend', h3('Avatar'));
    P.append(sl('Body', D.body.shape, 0, 2, .05, (v, c) => { D.body.shape = v; if (c) { rebuild(true); commit(); } }, v => v < .6 ? 'slim' : v > 1.4 ? 'broad' : 'reg'), sl('Height', D.body.height, .9, 1.1, .01, (v, c) => { D.body.height = v; if (c) { rebuild(true); commit(); } }, v => Math.round(v * 178) + 'cm'));
  }
  if (tab === 'stage') {
    P.insertAdjacentHTML('beforeend', h3('Play'));
    P.insertAdjacentHTML('beforeend', `<div class="bigrow"><button id="goRunway"><b>🎬</b>Runway</button><button id="goPhoto"><b>📸</b>Photo card</button><button id="goChal"><b>🏆</b>Daily</button></div>
      <div class="row" style="margin-top:8px"><button class="pill" id="goTurn">⟳ Turntable video</button><button class="pill" id="goHD">HD PNG (no card)</button></div>`);
    P.insertAdjacentHTML('beforeend', h3('Backdrop'));
    const r = document.createElement('div'); r.className = 'scroll'; for (const [k, v] of Object.entries(BGS)) { if (k === 'runway') continue; const b = document.createElement('button'); b.className = 'dot' + (D.bg === k ? ' on' : ''); b.style.background = `linear-gradient(${v[0]},${v[1]})`; b.title = k; b.onclick = () => { D.bg = k; applyLight(); commit(); renderPane(); }; r.append(b); } P.append(r);
    P.insertAdjacentHTML('beforeend', h3('Lighting'));
    const s = document.createElement('div'); s.className = 'seg'; for (const k of Object.keys(LIGHTS)) { const b = document.createElement('button'); b.textContent = k[0].toUpperCase() + k.slice(1); b.className = D.light === k ? 'on' : ''; b.onclick = () => { D.light = k; applyLight(); commit(); renderPane(); }; s.append(b); } P.append(s);
    P.append(sl('Intensity', D.lightI, .3, 1.8, .05, (v, c) => { D.lightI = v; applyLight(); if (c) commit(); }));
    $('#goRunway').onclick = () => setMode('runway'); $('#goPhoto').onclick = () => photoCard(); $('#goChal').onclick = () => challenge(); $('#goTurn').onclick = () => turntableVideo(); $('#goHD').onclick = () => photoCard(false);
  }
}
function setTool(t) { tool = t; const c = $('#modeChip'); c.hidden = t === 'grab'; c.textContent = t === 'paint' ? '✎ PAINT MODE' : '✥ DRAG TO PLACE DECAL'; }
function addDecal(dc) { const [u, v] = G.uvAt(0, G.kind === 'top' ? 1.25 : .9, 1); D.decals.push({ u, v, r: 0, ...dc }); selDecal = D.decals.length - 1; compose(); commit(); renderPane(); toast('Decal added — use “Move on garment” to drag it'); }

// ---------- recipe / share link ----------
const recipe = () => ({ v: 1, g: D.g, f: D.f, c: [D.c1, D.c2, D.trim], p: D.pat, ps: D.pscale, fit: D.fit, b: D.body, l: [D.light, D.lightI, D.bg], m: [D.rough, D.sheen], d: D.decals.filter(d => d.t !== 'image').map(d => [d.t, d.val, d.font || '', d.col || '', +d.u.toFixed(3), +d.v.toFixed(3), +d.s.toFixed(3), d.r || 0]) });
function fromRecipe(r) { const d = DEF(); if (!GARMENTS[r.g] || !FABRICS[r.f]) throw new Error('bad recipe'); Object.assign(d, { g: r.g, f: r.f, c1: r.c[0], c2: r.c[1], trim: r.c[2], pat: PATTERNS.includes(r.p) ? r.p : 'none', pscale: +r.ps || 1, fit: r.fit, body: r.b, light: r.l?.[0] || 'studio', lightI: r.l?.[1] || 1, bg: r.l?.[2] || 'charcoal', rough: r.m?.[0] || 0, sheen: r.m?.[1] ?? 1 });
  d.decals = (r.d || []).filter(x => x[0] !== 'image').map(x => ({ t: x[0], val: String(x[1]).slice(0, 60), font: x[2], col: x[3], u: x[4], v: x[5], s: x[6], r: x[7] })); return d; }
const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
const shareURL = () => location.origin + location.pathname + '#d=' + b64(JSON.stringify(recipe()));

// ---------- IndexedDB wardrobe ----------
const idb = new Promise((res, rej) => { const r = indexedDB.open('drape', 1); r.onupgradeneeded = () => r.result.createObjectStore('designs', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = async (m, f) => { const db = await idb; return new Promise((res, rej) => { const t = db.transaction('designs', m), s = t.objectStore('designs'), q = f(s); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); };
function thumb(w = 240, h = 320) { renderer.render(scene, camera); const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), s = canvas.width / canvas.height, tw = canvas.height * w / h; g.drawImage(canvas, (canvas.width - tw) / 2, 0, tw, canvas.height, 0, 0, w, h); return c.toDataURL('image/jpeg', .82); }
const dname = () => `${GARMENTS[D.g].name} · ${FABRICS[D.f].name}${D.pat !== 'none' ? ' · ' + PATTERN_NAMES[D.pat] : ''}`;
async function saveDesign() { const it = { id: Date.now() + '' + Math.floor(Math.random() * 1e3), name: dname(), at: Date.now(), d: JSON.stringify(D), paint: paintC.toDataURL(), thumb: thumb() }; await tx('readwrite', s => s.put(it)); toast('Saved to Wardrobe'); return it; }
async function wardrobe() {
  const items = (await tx('readonly', s => s.getAll())) || []; items.sort((a, b) => b.at - a.at);
  openModal(`<h2>Wardrobe</h2><p class="mut">${items.length} design${items.length === 1 ? '' : 's'} saved on this device</p><div class="row" style="margin:8px 0"><button class="pill acc" id="wSave">＋ Save current</button><button class="pill" id="wShare">Share link</button></div>
    <div class="wgrid">${items.map(i => `<div class="witem" data-id="${i.id}"><img src="${i.thumb}" alt=""><p>${i.name}</p><div class="wa"><button data-a="load" aria-label="Load">↥</button><button data-a="dup" aria-label="Duplicate">⧉</button><button data-a="del" aria-label="Delete">🗑</button></div></div>`).join('')}</div>`);
  $('#wSave').onclick = async () => { await saveDesign(); wardrobe(); }; $('#wShare').onclick = shareLink;
  $('#mbody').querySelectorAll('.witem button').forEach(b => b.onclick = async () => { const id = b.closest('.witem').dataset.id, it = items.find(x => x.id === id);
    if (b.dataset.a === 'del') { await tx('readwrite', s => s.delete(id)); wardrobe(); }
    if (b.dataset.a === 'dup') { await tx('readwrite', s => s.put({ ...it, id: Date.now() + 'd', at: Date.now(), name: it.name + ' (copy)' })); wardrobe(); }
    if (b.dataset.a === 'load') { D = JSON.parse(it.d); const im = await loadImg(it.paint); rebuild(true); paintX.clearRect(0, 0, TEX, TEX); if (im) paintX.drawImage(im, 0, 0); compose(); applyLight(); commit(); closeModal(); toast('Loaded ' + it.name); } });
}
$('#wardBtn').onclick = wardrobe;
async function shareLink() { const url = shareURL(); try { if (navigator.share) { await navigator.share({ title: APP.name + ' design', text: dname(), url }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { prompt('Copy this link', url); } }

// ---------- modal ----------
function openModal(html) { $('#mbody').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; $('#mbody').innerHTML = ''; }
$('#mx').onclick = closeModal; $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };

// ---------- export helpers ----------
async function shareFile(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return 'shared'; } } catch (e) { if (e.name === 'AbortError') return 'cancel'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return 'downloaded';
}
function renderAt(w, h) { const ps = renderer.getPixelRatio(), sz = renderer.getSize(new THREE.Vector2()), asp = camera.aspect; renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.render(scene, camera);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(canvas, 0, 0); renderer.setPixelRatio(ps); renderer.setSize(sz.x, sz.y, false); camera.aspect = asp; camera.updateProjectionMatrix(); return c; }
function hdSize() { const gl = renderer.getContext(), mx = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), gl.getParameter(gl.MAX_VIEWPORT_DIMS)[1]); return mx >= 3840 && !(mobile && (navigator.deviceMemory || 4) < 4) ? [2160, 3840] : [1080, 1920]; }
let lastCard = null;
async function photoCard(withCard = true) {
  const [W, H] = Q.get('hd') ? Q.get('hd').split('x').map(Number) : hdSize();
  const sv = camera.position.clone(), st = orbit.target.clone(); camera.position.set(0, 1.08, 4.6); orbit.target.set(0, .98, 0); camera.lookAt(orbit.target);
  const shot = renderAt(W, H); camera.position.copy(sv); orbit.target.copy(st); orbit.update();
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), u = W / 1080; g.drawImage(shot, 0, 0);
  if (withCard) {
    const gr = g.createLinearGradient(0, H * .72, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.78)'); g.fillStyle = gr; g.fillRect(0, H * .7, W, H * .3);
    g.fillStyle = '#c6ff3d'; g.font = `${34 * u}px M`; g.fillText('LOOK ' + new Date().toISOString().slice(0, 10).replace(/-/g, '.'), 64 * u, 110 * u);
    const logo = await loadImg('icons/icon.svg'); if (logo) g.drawImage(logo, W - 150 * u, 60 * u, 86 * u, 86 * u);
    g.fillStyle = '#fff'; g.font = `${96 * u}px A`; g.fillText(GARMENTS[D.g].name.toUpperCase(), 64 * u, H - 250 * u);
    g.font = `${38 * u}px G`; g.fillStyle = '#e8e4dc'; g.fillText(`${FABRICS[D.f].name} · ${PATTERN_NAMES[D.pat]} · ${['Slim', 'Regular', 'Oversized'][D.fit.fit]} fit`, 64 * u, H - 180 * u);
    [D.c1, D.c2, D.trim].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc((84 + i * 70) * u, H - 105 * u, 24 * u, 0, 7); g.fill(); g.strokeStyle = '#fff6'; g.lineWidth = 2 * u; g.stroke(); });
    g.fillStyle = '#fff9'; g.font = `${26 * u}px M`; g.textAlign = 'right'; g.fillText(`${APP.name} (${APP.status}) · test build`, W - 64 * u, H - 96 * u);
  }
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); lastCard = { blob, w: W, h: H };
  const url = URL.createObjectURL(blob);
  openModal(`<h2>${withCard ? 'Look card' : 'HD render'}</h2><p class="mut">${W}×${H} PNG · ${(blob.size / 1e6).toFixed(1)} MB</p><img class="prev" id="cardImg" src="${url}" alt="Look card"><div class="row"><button class="big" id="cShare">Share / Save</button></div>`);
  $('#cShare').onclick = () => shareFile(blob, `drape-look-${Date.now()}.png`, dname());
  return { w: W, h: H, size: blob.size };
}
// ---------- video recording (runway + turntable) ----------
let rec = null;
function pickMime() { if (!window.MediaRecorder) return null; for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1', 'video/mp4']) if (MediaRecorder.isTypeSupported(m)) return m; return null; }
async function recordVideo(sec, label) {
  const mime = pickMime(); let stream = null; try { stream = canvas.captureStream ? canvas.captureStream(30) : null; } catch { }
  const fallback = async () => { toast('Video recording not supported here — saving a photo instead'); const c = renderAt(1080, 1920); const blob = await new Promise(r => c.toBlob(r, 'image/png')); window.__lastExport = { kind: 'png', size: blob.size, fallback: true }; return shareFile(blob, 'drape-' + label + '.png', dname()); };
  if (!mime || !stream) return fallback();
  return new Promise(res => { const chunks = [], mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 }); rec = mr; mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    mr.onstop = async () => { rec = null; $('#recDot').hidden = true; const blob = new Blob(chunks, { type: mime.split(';')[0] }), ext = mime.includes('mp4') ? 'mp4' : 'webm'; if (blob.size < 2000) { res(await fallback()); return; } window.__lastExport = { kind: ext, size: blob.size };
      const url = URL.createObjectURL(blob); openModal(`<h2>${label} video</h2><p class="mut">${sec}s · ${ext.toUpperCase()} · ${(blob.size / 1e6).toFixed(1)} MB</p><video class="prev" src="${url}" controls playsinline loop autoplay muted></video><button class="big" id="vShare">Share / Save</button>`);
      $('#vShare').onclick = () => shareFile(blob, `drape-${label.toLowerCase()}-${Date.now()}.${ext}`, dname()); res(ext); };
    $('#recDot').hidden = false; mr.start(250); setTimeout(() => mr.state !== 'inactive' && mr.stop(), sec * 1000); });
}
function setRecordSize(on) { if (on) { renderer.setPixelRatio(1); renderer.setSize(720, 1280, false); camera.aspect = 9 / 16; } else { renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 2 : 1.75)); resize(); } camera.updateProjectionMatrix(); }
let turnT = -1;
async function turntableVideo() { $('#sheet').classList.remove('open'); tab = null; document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('on')); setRecordSize(true); turnT = 0; await recordVideo(6, 'Turntable'); turnT = -1; setRecordSize(false); resetView(); }

// ---------- modes: studio / runway ----------
let mode = 'studio', rw = { t: 0, z: -1.4, dir: 1, turn: 0, cut: 0 };
function setMode(m) {
  mode = m; const r = m === 'runway'; $('#runway').hidden = !r; $('#sheet').classList.remove('open'); tab = null; document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('on'));
  for (const s of ['.tabs', '.fab', '.top']) $(s).style.display = r ? 'none' : ''; setTool('grab');
  orbit.enabled = !r; setRecordSize(r);
  if (r) { rw = { t: 0, z: 0, dir: 1, turn: 0, cut: 0, phase: 0 }; } else { pose.amt = 0; root[0] = root[2] = root[3] = 0; updateBody(); rebuild(true); resetView(); }
  applyLight();
}
$('#rwExit').onclick = () => { if (rec) rec.stop(); setMode('studio'); };
$('#rwRec').onclick = () => { if (!rec) recordVideo(8, 'Runway'); };
$('#rwSnap').onclick = async () => { const c = renderAt(1080, 1920); const blob = await new Promise(r => c.toBlob(r, 'image/png')); shareFile(blob, 'drape-runway.png', dname()); };
const SHOTS = [[0, 1.15, 4.6, 0, 1.0], [0, 1.35, 2.3, 0, 1.15], [2.7, 1.0, .2, 0, .95], [0, .35, 3.2, 0, 1.0]];
function runwayUpdate(dt) {
  dt = Math.min(dt, 1 / 40); // keep animation in lockstep with the cloth step so the body never outruns the cloth
  rw.t += dt; const speed = .85, z0 = -2.2, z1 = .9;
  if (rw.turn > 0) { rw.turn -= dt; pose.amt += (.12 - pose.amt) * .12; const k = Math.min(1, 1 - rw.turn / 1.4), e = k * k * (3 - 2 * k); root[3] = rw.y0 + Math.PI * e; if (rw.turn <= 0) { rw.dir *= -1; root[3] = rw.dir > 0 ? 0 : Math.PI; } }
  else { pose.amt += (1 - pose.amt) * .08; root[2] += rw.dir * speed * dt * pose.amt; root[0] = 0; pose.walk += speed * dt / .62 * Math.PI * pose.amt; if ((rw.dir > 0 && root[2] > z1) || (rw.dir < 0 && root[2] < z0)) { rw.turn = 1.4; rw.y0 = root[3]; } }
  // walking direction: local +z is the body front; yaw PI faces -z
  updateBody();
  const ci = RM() ? 0 : Math.floor(rw.t / 2.4) % SHOTS.length, s = SHOTS[ci];
  camera.position.set(s[0], s[1], root[2] + s[2] + (ci === 0 ? .8 : 0)); camera.lookAt(0, s[4], root[2]);
}

// ---------- daily challenge ----------
const PROMPTS = [['Neon streetwear hoodie', 'hoodie', null], ['Halloween silk dress', 'dress', 'silk'], ['Monochrome denim joggers', 'pants', 'denim'], ['Picnic plaid skirt', 'skirt', 'cotton'], ['Tie-dye summer tee', 'tee', 'cotton'], ['Biker-core leather shorts', 'shorts', 'leather'],
  ['Cozy cabin knit crewneck', 'crew', 'wool'], ['Vacation camp shirt', 'camp', 'silk'], ['Ballpark jersey remix', 'jersey', null], ['Oversized gallery tee', 'otee', null], ['Wide-leg utility pants', 'wide', 'denim'], ['Retro gradient dress', 'dress', null], ['Houndstooth everything', null, null], ['Camo but make it pastel', null, null]];
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayIdx = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
const todayPrompt = () => PROMPTS[(dayIdx() * 7 + 3) % PROMPTS.length];
const hstr = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
function score(pr) { let s = 58 + hstr(JSON.stringify(recipe())) % 18; if (pr[1] && pr[1] === D.g) s += 12; if (pr[2] && pr[2] === D.f) s += 8; if (D.decals.length) s += 4; if (D.pat !== 'none') s += 3; if (/neon/i.test(pr[0]) && /c6ff3d|ff3fa4|2fe8ff/i.test(D.c1 + D.c2 + D.trim)) s += 5; return Math.min(99, s); }
const DEMO = ['Mara Quill', 'Juno Okafor', 'Teo Vasquez', 'Rin Halvorsen', 'Sol Adeyemi', 'Kit Moreau', 'Ines Park'];
const ent = () => JSON.parse(localStorage.getItem('drape.entries') || '[]');
function streak(es) { const days = new Set(es.map(e => e.day)); let s = 0, d = new Date(); if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); while (days.has(dayKey(d))) { s++; d.setDate(d.getDate() - 1); } return s; }
function challenge() {
  const pr = todayPrompt(), es = ent(), done = es.find(e => e.day === dayKey());
  const demo = DEMO.map((n, i) => ({ n: n, s: 62 + (hstr(n + dayKey()) % 36), demo: 1 }));
  const board = [...demo, ...es.filter(e => e.day === dayKey()).map(e => ({ n: 'You', s: e.score, th: e.thumb }))].sort((a, b) => b.s - a.s);
  openModal(`<h2>Daily challenge</h2><p class="mut">${dayKey()} · one entry per day · streak <b style="color:#c6ff3d">${streak(es)}🔥</b></p>
    <div style="background:linear-gradient(135deg,#c6ff3d,#2fe8ff);color:#111;border-radius:16px;padding:16px;margin:10px 0"><small style="font:700 10px M">TODAY'S PROMPT</small><div style="font:400 24px A">${pr[0]}</div><small>${pr[1] ? 'Bonus: ' + GARMENTS[pr[1]].name : ''}${pr[2] ? ' · ' + FABRICS[pr[2]].name : ''}</small></div>
    ${done ? `<p>✅ Entered today — score <b>${done.score}</b>. Come back tomorrow to keep the streak.</p>` : '<button class="big" id="cEnter" style="width:100%">Enter current design</button>'}
    <h3>Today's board <small>auto-score is a demo heuristic</small></h3><ul class="lb">${board.map((b, i) => `<li><b>${i + 1}</b>${b.th ? `<img src="${b.th}">` : ''}<span style="flex:1">${b.n} ${b.demo ? '<span class="demo">DEMO</span>' : ''}</span><span class="stat">${b.s}</span></li>`).join('')}</ul>
    <h3>Your past entries</h3><ul class="lb">${es.slice().reverse().map(e => `<li><img src="${e.thumb}"><span style="flex:1">${e.prompt}<br><span class="stat">${e.day}</span></span><span class="stat">${e.score}</span></li>`).join('') || '<li class="mut">No entries yet</li>'}</ul>
    <p class="mut">DEMO designers are fictional and generated on your device — there is no online leaderboard yet.</p>`);
  const b = $('#cEnter'); if (b) b.onclick = () => { const e = { day: dayKey(), prompt: pr[0], score: score(pr), thumb: thumb(120, 160), d: JSON.stringify(recipe()) }; localStorage.setItem('drape.entries', JSON.stringify([...es, e])); toast('Entered! Score ' + e.score); challenge(); };
}

// ---------- settings ----------
$('#setBtn').onclick = () => {
  openModal(`<h2>About & settings</h2><p><b>${APP.name}</b> <span class="chip">${APP.status}</span> · v${APP.version}</p>
  <p class="mut" style="font-size:13px;color:#ffb648">Test build. Simulation is an approximation, not production-grade patternmaking.</p>
  <h3>Simulation quality <small>now: ${TIERS[tier].name} · ${G.n} particles · ${simMs.toFixed(1)} ms/frame</small></h3><div class="seg" id="qseg">${['auto', 0, 1, 2].map(q => `<button data-q="${q}" class="${String(qualPref) === String(q) ? 'on' : ''}">${q === 'auto' ? 'Auto' : TIERS[q].name}</button>`).join('')}</div>
  <h3>Accessibility</h3><button class="pill ${RM() ? 'on' : ''}" id="rmT">Reduce motion ${RM() ? 'on' : 'off'}</button> <button class="pill" id="obT">Show tips again</button>
  <h3>Data</h3><p class="mut">Designs, entries and streaks live only on this device (IndexedDB / localStorage). Share links contain the design recipe only — uploaded images are never included.</p><button class="pill" id="rst">Reset on-device data</button>
  <p style="margin-top:16px"><a href="privacy.html" style="color:#c6ff3d">Privacy</a> · <a href="terms.html" style="color:#c6ff3d">Terms</a></p>
  <p class="mut">Mannequin, garments, fabrics and textures are generated procedurally. TN logo © Tony Nguyen. Built with three.js (MIT).</p>`);
  $('#qseg').onclick = e => { const q = e.target.dataset.q; if (q == null) return; qualPref = q; localStorage.setItem('drape.q', q); if (q !== 'auto') { tier = +q; rebuild(true); } $('#setBtn').onclick(); };
  $('#rmT').onclick = () => { localStorage.setItem('drape.rm', RM() ? '0' : '1'); document.body.classList.toggle('rm', RM()); $('#setBtn').onclick(); };
  $('#obT').onclick = () => { localStorage.removeItem('drape.onb'); closeModal(); showHint(); };
  $('#rst').onclick = async () => { if (!confirm('Delete all saved designs and entries on this device?')) return; localStorage.clear(); await tx('readwrite', s => s.clear()); toast('Cleared'); closeModal(); };
};
function showHint() { if (localStorage.getItem('drape.onb') || Q.has('nohint')) return; $('#hint').hidden = false; }
$('#hintOk').onclick = () => { $('#hint').hidden = true; localStorage.setItem('drape.onb', '1'); };

// ---------- main loop ----------
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < .7 ? 30 : 26; camera.updateProjectionMatrix(); }
addEventListener('resize', () => { if (mode === 'studio' && !rec) resize(); });
let last = performance.now(), frameEMA = 16, warm = 0, lastTierChange = 0;
function loop(now) {
  requestAnimationFrame(loop); const dt = Math.min(.05, (now - last) / 1000); last = now; frameEMA += ((dt * 1000) - frameEMA) * .05;
  if (mode === 'runway') runwayUpdate(dt);
  else if (turnT >= 0) { turnT += dt; const a = turnT / 6 * Math.PI * 2; camera.position.set(Math.sin(a) * 4.4, 1.15, Math.cos(a) * 4.4); camera.lookAt(0, 1.0, 0); }
  else orbit.update();
  if (lastPos && G) { applyPositions(lastPos); lastPos = null; }
  if (!busy && G && !window.__pause) { busy = true; simT += dt; worker.postMessage({ type: 'step', dt: Math.min(dt, 1 / 40) || 1 / 60, sub: TIERS[tier].sub, prims: localPrims, root: ZROOT, wind, grab, bob: 0, release: .9 }); }
  // adaptive quality (auto): drop a tier if we can't hold ~40fps
  if (qualPref === 'auto' && mode === 'studio' && !rec) { warm += dt; if (warm > 3 && now - lastTierChange > 4000 && tier > 0 && (frameEMA > 26 || simMs > 18)) { tier--; lastTierChange = now; warm = 0; rebuild(true); toast('Quality → ' + TIERS[tier].name + ' for smooth motion'); } }
  renderer.render(scene, camera);
}
// ---------- boot ----------
resize();
try { const m = location.hash.match(/#d=([\w-]+)/); if (m) { D = fromRecipe(JSON.parse(unb64(m[1]))); setTimeout(() => toast('Opened a shared design'), 600); } } catch (e) { console.warn('bad share link'); }
rebuild(false); applyLight(); commit(); requestAnimationFrame(loop); showHint();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
// test/automation hooks
window.__drape = {
  get D() { return D; }, set: async (patch) => { if (patch.g && !patch.fit) patch.fit = { ...DEFAULT_FIT[patch.g] }; const old = JSON.stringify([D.g, D.fit, D.body]); Object.assign(D, patch); if (old !== JSON.stringify([D.g, D.fit, D.body])) rebuild(false); else { applyMaterial(); await compose(); } applyLight(); },
  setTier: t => { qualPref = String(t); tier = t; rebuild(true); }, stats: () => ({ tier: TIERS[tier].name, n: G.n, edges: G.edges.length / 2, simMs, simAvg: simHist.reduce((a, b) => a + b, 0) / (simHist.length || 1), frameEMA }),
  resetSimStats: () => { simHist.length = 0; },
  health: () => { const P = clothMesh.geometry.attributes.position.array, r = G.rv2p; let pen = 0, maxPen = 0, nan = 0, maxStretch = 0; const c = Math.cos(root[3]), s = Math.sin(root[3]);
    for (let i = 0; i < G.n; i++) { const k = i * 3; } const Pp = new Float32Array(G.n * 3); for (let i = 0; i < r.length; i++) Pp.set(P.subarray(i * 3, i * 3 + 3), r[i] * 3);
    for (let i = 0; i < G.n; i++) { const x = Pp[i * 3], y = Pp[i * 3 + 1], z = Pp[i * 3 + 2]; if (!isFinite(x + y + z)) { nan++; continue; } const d = depthAt(localPrims, NP, 1, 0, x, y, z); if (d > .006) pen++; maxPen = Math.max(maxPen, d); }
    for (let e = 0; e < G.rest.length; e++) { if (G.ekind[e] !== 0) continue; const a = G.edges[e * 2] * 3, b = G.edges[e * 2 + 1] * 3; maxStretch = Math.max(maxStretch, Math.hypot(Pp[a] - Pp[b], Pp[a + 1] - Pp[b + 1], Pp[a + 2] - Pp[b + 2]) / G.rest[e]); }
    let miny = 9; for (let i = 1; i < Pp.length; i += 3) miny = Math.min(miny, Pp[i]); return { n: G.n, nan, penetrating: pen, penFrac: pen / G.n, maxPenMM: maxPen * 1000, maxStretch, minY: miny }; },
  grabTest: async (sx, sy, ex, ey) => { const o = { clientX: sx, clientY: sy, pointerId: 1, bubbles: true }; canvas.dispatchEvent(new PointerEvent('pointerdown', o)); for (let i = 1; i <= 10; i++) { canvas.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: sx + (ex - sx) * i / 10, clientY: sy + (ey - sy) * i / 10 })); await new Promise(r => setTimeout(r, 60)); } return grab ? { ...grab } : null; },
  release: () => canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true })),
  setTool, setMode, photoCard, recordVideo, saveDesign, shareURL, wardrobe, challenge, turntableVideo, paintAt: (u, v, l) => paintAt({ x: u, y: v }, l), addDecal, compose, get mode() { return mode; }, worldY: () => root,
};
