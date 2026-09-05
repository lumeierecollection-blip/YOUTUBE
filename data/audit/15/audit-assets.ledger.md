# audit-assets — Stage 15 ledger (Delete-list sweep)

**Stage:** 15 · **Lane:** audit-assets · **Date:** 2026-08-30 · **Model:** opencode/big-pickle
**Domain:** icons · licences · images · font vendoring
**Owns (edit):** `src/skills/remotion-render/public/**` · `THIRD_PARTY_LICENSES.md` · `fonts-loader.js` · `fonts-manifest.json` · `fetch-fonts.js` · `wait-for-fonts.js` · `vendor-icons.js` · `image-assets.js` · `broll.js` · `b-roll-manifest-ch-fixture.json` · `decode-png.js` · `compositions/icons-data.js` · `effects/PhotoTreatment.jsx` · `data/audit/**`. Everything else read/grep only.
**DEL rows (primary owner):** DEL-29 (assets) · DEL-26 (co-owner; audit-motion primary).
**Protocol rows 15 sweep note:** DEL-29 PASS (grep-clean, no edit) · DEL-26 AMEND (co-owned, deletion not applicable). Neither row required an owned-file edit, so the three-phase edit protocol (CROSSCHECK-PROTOCOL.md §2) was **not** entered — no change was made. This ledger is a pure sweep + classification + co-report.

---

## 1. Row verdicts

| ID | Pattern | Register state (NOT trusted; re-grepped) | Hits in scope | Verdict | Rationale |
|---|---|---|---|---|---|
| DEL-29 | `https://` in compositions | not relied on | 0 literals in `compositions/**` | **PASS** (literal pattern grep-clean) + co-report | No `https://` literal in any composition. All `https?://` in the package source are build-time fetchers / attribution TEXT records. The only render-scene `http` substring is an SVG namespace inside a `data:` URI. See §2. |
| DEL-26 | `three\|THREE\.` (co-owned; audit-motion primary) | not relied on | `THREE.` code = 2 lines, both in `effects/PhotoTreatment.jsx` (my file) | **AMEND** (aligns with audit-motion primary) | `THREE.`/`@remotion/three`/`@react-three/*` exist ONLY in the verified photo/grain/effects pipeline. No stray 3D geometry. All `\bthree\b` lowercase hits are English words / number-word lists. See §3. |

Co-reports (cross-cutting, files owned by other lanes — not edited here): see §4.

---

## 2. DEL-29 — Remote asset fetch at render, pattern `https://` in compositions — PASS (+ co-report)

### 2.1 Method
Grepped every repo-owned file under `src/skills/remotion-render/` (excluded `node_modules/**` and `package-lock.json` build metadata) for `https?://` and for `fetch(`.

### 2.2 Every hit, classified

| file:line | Text | Class | Verdict |
|---|---|---|---|
| `compositions/cinematic-documentary.jsx:47` | `http://www.w3.org/2000/svg` inside `url("data:image/svg+xml,…")` (FilmGrain `<AbsoluteFill>`) | SVG XML **namespace** in an inline **data URI**; `http://` not `https://`; zero network | LEGITIMATE / static string, not a fetch. Does not literally match DEL-29's `https://`. |
| `qa-scripts/fetch-sfx-library.mjs:63,64` | `https://raw.githubusercontent.com/…kenney-interface-sounds…` BASE + LICENSE_URL | **build/pre-render SFX fetch script** (audit-audio's file) | DESIGNED build-time fetcher — not a render-frame path. Noted for audit-audio only. |
| `b-roll-manifest-ch-fixture.json` (15× `source_url`, lines 13–114) | `https://commons.wikimedia.org/wiki/File:…` | attribution/provenance **TEXT-RECORD**; `broll.js` reads only `f.local`, never `source_url`; manifest read via `readFileSync` | TEXT-RECORD — fine. Never fetched at render. |
| `fetch-fonts.js:62,64` | `https://fonts.googleapis.com/css2…` (CSS + woff2 URLs) | **build/pre-render font fetcher** (my owned file; fetching phase) | DESIGNED build-time fetcher — positive checks AST-15/-16 apply (manifest trust + keyword overlap). Not a composition/render path. |

`fetch(` calls package-wide (excl. node_modules): only `fetch-fonts.js:68,88` and `qa-scripts/fetch-sfx-library.mjs:140` — all in build-time fetchers. **No composition or render-frame code path contains a live `https://` fetch.**

### 2.3 Why the render-time sources are all local (the positive AST side)
- `image-assets.js` (my file) resolves `path: asset.publicPath` (local `asset-library/…`) and b-roll `local` paths — file header states "No network, no rembg, nothing at render time".
- `fetch-library.js:233` sets `publicPath` = `asset-library/<channel>/<file>` (local, copied into `public/`); the remote `downloadUrl`/`sourceUrl` stay as manifest attribution records only.
- `render.js:370` wires `imageForSection` → `resolveImageAssets` (local); compositions load everything via `staticFile(...)`.

### 2.4 Verdict
**DEL-29 = PASS** against the encoded pattern (`https://` returns zero hits in `compositions/**`).

### 2.5 Co-report (DOES NOT match the literal pattern; relevant to DEL-29 intent)
`compositions/scenes/evidence-scenes.jsx:163`:
```js
src={asset.path.startsWith("http") ? asset.path : staticFile(asset.path)}
```
This is a **render-frame branch** capable of a live remote image fetch **if** `asset.path` were ever an http URL. In the current pipeline `asset.path` is always a local `publicPath`/b-roll file (see §2.3), so the remote arm is **currently dead**. It contains **no literal `https://`**, so DEL-29's encoded grep is unaffected. Flagging so it is not papered over: filing to **audit-encoding** (owns `compositions/scenes/*.jsx`) — either confirm-and-annotate it as a defensive guard, or tighten it to reject http at render. Not blocking DEL-29.

---

## 3. DEL-26 — Three.js / WebGL geometry, pattern `three|THREE.` — AMEND (co-owned; audit-motion primary)

### 3.1 Method
Grepped the package source (excl. node_modules) for `THREE\.` and `\bthree\b`.

### 3.2 `THREE.` (uppercase namespace) — the real Three.js usage, ALL in the verified pipeline
- `effects/PhotoTreatment.jsx:101` — `useLoader(THREE.TextureLoader, src)` (MY owned file — the seed)
- `effects/PhotoTreatment.jsx:102` — `texture.colorSpace = THREE.SRGBColorSpace;`
- `effects/PhotoTreatment.jsx:6` — `import * as THREE from "three"`; `:7` — `LUTCubeLoader` from `three/examples/jsm`
- `effects/CanvasGrain.jsx:2-3` — `ThreeCanvas` from `@remotion/three`, `@react-three/postprocessing` (audit-color's file — grain)
- `effects/PostFxReadyGate.jsx:2` — `useThree` from `@react-three/fiber` (render-sync helper, unassigned)
- Comment-only `THREE.` mentions: `PhotoTreatment.jsx:36`, `generate-editorial-lut.mjs:4` ("Three.js's LUTCubeLoader")

### 3.3 No stray WebGL / 3D geometry
Ran a scene-building construct scan (`<mesh|Geometry|ThreeCanvas|@react-three|<planeGeometry`). The only `<planeGeometry>`/`<mesh>` instances in the whole package are `PhotoTreatment.jsx:125-127` and `CanvasGrain.jsx:84-86` — the rectangular textured surfaces the treated image / grain is drawn on, inside the two effect components. There is **no 3D object / lit scene / box-sphere-extrusion geometry anywhere else** (register §3.12.9 removed the fake-3D bevels).

### 3.4 `\bthree\b` lowercase hits = English-word false positives
All are the English word "three" in prose/comments or number-word regex lists (`beats.js:405,772`; `mg-package.js:73`; `semantics.js:37`; dozens of comment lines in scene/layout/visual files). None are the Three.js library.

### 3.5 Verdict
Per the co-owner brief seed: the ONLY `THREE.` uses are inside the verified photo/grain/effects pipeline → **DEL-26 = AMEND**, no FAIL. **CONFIRMS** audit-motion (primary) `data/audit/15/audit-motion.ledger.md` §DEL-26, including its proposed amended row text (allowed inside the verified `@remotion/three` + `@react-three/postprocessing` photo-treatment/grain/effects pipeline + required dependency declarations; any 3D object geometry outside that pipeline remains FAIL; case-bind the pattern).

Honest contribution: the positive pair cited should note that **AST-16 is logged PARTIAL, not PASS** (a real keyword-overlap defect already recorded in CHECK-REGISTER §3.x, row 355), and SLOP-04 (`scripts/slop-check.js:196-205`) verifies every IMAGE_BEAT image carries attribution (i.e. is a treated asset). The AMEND's scope-out rests on *the pipeline being the verified photo treatment*, which AST-16/SLOP-04 substantiate only partially — worth noting in the register note so the amendment is not over-sold. No deletion required.

---

## 4. Co-reports (files owned by other lanes — NOT edited, per ownership)

| ID (primary lane) | file:line | Finding | Class |
|---|---|---|---|
| DEL-28 `grain` (audit-color) | `effects/PhotoTreatment.jsx:14,29,81` | `grain` appears in MY owned file **only in comments** (file-header prose and a cross-reference to `CanvasGrain.jsx`). No code-level `grain` identifier in any owned asset file. The live grain implementation is `effects/CanvasGrain.jsx` (+ the `Noise` postprocessing effect), which is audit-color's file — not adjudicated here. | COMMENT-ONLY. Co-report for audit-color to weigh against the mg-background grain question. |
| DEL-18 `gradient` (audit-color) | — | **Zero** `gradient` matches in all my owned files (image-assets.js, broll.js, fetch-fonts.js, icons-data.js, fonts-loader.js, decode-png.js, PhotoTreatment.jsx, b-roll-manifest-ch-fixture.json). | CLEAN. |
| DEL-23 `Math.random` (hard blocker) | — | **Zero** `Math.random` in every owned file. | CLEAN — no blocker. |
| DEL-29 latent remote-fetch guard (audit-encoding) | `compositions/scenes/evidence-scenes.jsx:163` | Render-frame branch `asset.path.startsWith("http") ? asset.path : staticFile(asset.path)`; remote arm currently dead (asset.path always local). No literal `https://`; does not affect DEL-29's encoded gate. | Co-report to audit-encoding to confirm/tighten. |

## 5. SHARED-FILE REQUESTS

None filed this stage. No deletion or edit was required outside my ownership for either primary row (DEL-29 passed; DEL-26 is an AMEND whose register row lives in `CHECK-REGISTER.md`, which is read-only for this lane — the amendment is proposed by audit-motion primary and I endorse it; the register keeper applies it, not this lane).

## 6. Honest limits / out-of-scope notes
- SFX attribution URLs in `sfx-manifest.json` / `sfx-library.js` are audit-audio's files; I only noted the pattern (build-time fetcher in `qa-scripts/fetch-sfx-library.mjs`) and did not edit them.
- `node_modules/**` and `package-lock.json` were excluded as vendored third-party / build-lock metadata; DEL patterns are judged against repo-owned render code.
- Register §4.1: passing DEL-29 is not evidence the local-asset pipeline "works" — that is AST-15/AST-16's job (AST-16 PARTIAL). Register §4.2 DEL-17 retired/inverted — ignored as instructed.

## FINAL VERDICT
**DEL-29 PASS** (literal `https://` grep-clean in compositions; all package `https://` are build-time fetchers or attribution TEXT records) **with one co-report** (latent `startsWith("http")` guard at `evidence-scenes.jsx:163`, routed to audit-encoding). **DEL-26 AMEND** (co-owned; endorses audit-motion primary — `THREE.` confined to the verified photo/grain/effects pipeline, no stray geometry). Cross-cutting: DEL-28 `grain` = comment-only in my files (co-report to audit-color); DEL-18 = clean; DEL-23 = clean (no blocker). No SFRs. No edits made.
