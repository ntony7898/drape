# Drape — plan & honest notes (v1 test build)

"Drape" is a **working title** (one constant in `config.js`). No trademark search has been done.

## What v1 is
A mobile-first static PWA for playing with 3D garments: a procedural mannequin, a real-time position-based cloth solver in a Web Worker, 12 parametric garments, 5 fabric presets, surface design (colours, patterns, paint, decals, artwork mockups), runway/turntable video, HD look cards, a daily challenge, and a local wardrobe. It's a toy and a sketch tool. **It is not a patternmaking tool.**

## Gap analysis vs. professional 3D garment tools (e.g. CLO-class software)
| Area | Pro tools | Drape v1 |
|---|---|---|
| Patterns | Real 2D pattern pieces drawn by a designer, auto-sewing along seam lines, notches, darts, pleats | Hard-coded parametric front/back panels on a grid. Sewing = shared particles. You can't edit panels |
| Grading | Multi-size grading rules, size sets | Only fit sliders (length, sleeve, slim/regular/oversized) that rebuild the garment |
| Avatars | Measured, posable, scannable avatars, size charts, pose libraries | Capsule mannequin with shape and height sliders; one walk cycle |
| Physics | Calibrated fabric physics (measured stretch/bend/shear per warp/weft, weight, thickness), self-collision, layering, pressure/fit maps | PBD distance constraints (stretch/shear/bend) with hand-tuned presets. **No self-collision, no layering.** Rest shape = the arranged 3D shape, not the flat pattern, so fit is approximate |
| Rendering | Scanned/physically measured fabrics (U3M/AxF), ray-traced renders | Procedural weave normal/roughness tiles and PBR in WebGL |
| Output | Tech packs, DXF/AAMA patterns, BOM, production handoff | PNG, WebM/MP4 (where supported), share link |

## v2 roadmap (suggested order)
1. **2D pattern editor**: draw/edit panels with bezier edges and seam pairing, then auto-arrange around the avatar and sew (rest = flat pattern lengths, plus sewing springs that close the seams).
2. **Self-collision** (spatial hash) and two-layer outfits (tee under hoodie).
3. **WASM/WebGPU cloth** (compute shaders, XPBD with compliance), aiming for 10–20k particles on recent phones.
4. More garments: jackets, collars and cuffs as separate panels, pleated skirt, dresses with darts.
5. **Avatars**: measurement-driven body, pose library, optional phone body scan (photogrammetry/LiDAR) into a fitted avatar.
6. **GLB/USDZ export** (baked cloth plus texture) for AR Quick Look / Unreal / Blender.
7. **Backend**: accounts, cloud wardrobe, public share pages, a real daily-challenge leaderboard with moderation.

## iOS wrap (Capacitor)
- `npm i @capacitor/core @capacitor/ios`, `npx cap init Drape com.tn.drape --web-dir .` (or copy to `www/`), `npx cap add ios`.
- WKWebView supports WebGL2 and module workers on iOS 15+. **Untested on Safari/iOS so far.** MediaRecorder on iOS records MP4 (H.264) only; the app already falls back to PNG.
- Use `@capacitor/share` and `@capacitor/filesystem` for saving videos and PNGs to Photos; add `NSPhotoLibraryAddUsageDescription`.
- The service worker isn't used inside Capacitor (assets are local anyway).
- Needs icons/splash at the App Store sizes, privacy nutrition label (no data collected in v1), and TestFlight.

## Mockup mode (from the 3DMockups-inspired steering)
Done: upload of PNG/JPG/SVG artwork, auto-wrap onto the garment UV, placement print with drag/scale/rotate, all-over print with tile size, one-tap colour change, swatch book (Drape's own named colours, **not Pantone**), HD PNG up to 2160×3840 (best effort, depending on GPU limits) with background presets including simple 3D scenes (plinth, runway), 6s turntable video, and material/roughness/lighting controls.
Not done: true UV-island-aware wrapping (artwork crossing a seam can break or stretch), print-area guides in real-world cm, colourways batch export, transparent-background export. No selling, print-on-demand or payments (out of scope by request).

## Trademark & IP notes
- Don't use "CLO", "CLO 3D", "Marvelous Designer", "3DMockups", or their logos/assets/UI in the product or marketing. Comparisons in docs should stay factual and nominative.
- "Drape" is a common English word and is likely crowded in apparel/software classes (9, 25, 42). Run a USPTO/EUIPO knockout search plus a lawyer clearance before investing in the name.
- Fabric names (Denim, Silk, etc.) are generic. Avoid brand fabric names (e.g. Lycra®, Gore-Tex®, Tencel™).
- Colour swatches are Drape's own names and hex values. **Pantone® names and numbers are licensed**, so don't use them.
- Fonts bundled: OFL (see `fonts/OFL.txt`). The TN logo is Tony's own mark. Three.js is MIT licensed.
- User-uploaded artwork stays on the device. If a backend is added, terms need a user-content licence and DMCA process.
