# Stage 3 — Colour system: GATE

Date: 2026-08-07
Orchestrator: mg-orchestrator
Lane: audit-color (ledger: data/audit/3/audit-color.ledger.md)
Stage definition: CROSSCHECK-PROTOCOL.md Part 4, row 3

## Verdict: PASS

## Per-check results

| # | Gate check | Result | Evidence |
|---|-----------|--------|----------|
| 1 | All 50 palettes derived from `baseHue`/`accentHue` | **PASS** | 0 `color_palette` occurrences remain; 50/50 channels carry `thumbnail_spec.baseHue` + `accentHue` (numeric OKLCH hue degrees). `git diff config/channels.json` = −251/+115, only palette blocks touched (lane claim C-1). |
| 2 | P1–P6 pass | **PASS** | COL-01 14.35–14.49 (7≤r≤17); COL-02 4.53–5.70 (≥4.5); COL-03 2.54–3.20 (≥2.5); COL-04 3.18–3.28 (≥3); COL-05 5.07–5.17 (≥4.5); COL-06 60.0–167.2° (≥60). 50/50 channels, measured on the shipped `styles/tokens.js` by `data/audit/3/verify-final.mjs` (re-ran by orchestrator, identical). Lane claim C-2 + counter-check CONFIRM. |
| 3 | Zero hex literals | **PASS** | 0 hex literals in `thumbnail_spec` across all 50 channels (measured by orchestrator probe). COL-08 register row updated. Scope note: whole-file reading still has legacy `.colors` hex field (200 hexes, 1 white/black, 1 R=G=B) — tracked as T-colors follow-up, owned by thumbnails/endscreen lanes, not audit-color. |
| 4 | Zero `#FFFFFF` / `#000000` | **PASS** | 0 channels contain #FFFFFF or #000000 in `thumbnail_spec`. COL-07 register row updated. Same T-colors caveat as above. |

## Lane counter-check summary (from ledger)

- GROUND cards G-1 (dark-theme elevation, RE-VERIFIED YES), G-2 (Material 0–16% overlay, RE-VERIFIED CHANGED — superseded by M3 tonal surfaces; B1's absolute-L ladder already implements the current approach), G-3 (pre-change baseline — register counts were stale: COL-06 actually failed 32/50, COL-03 18, COL-01 48 above), G-4 (hue separation — spec-mandated; second independent source still OPEN, non-blocking).
- CHANGE cards C-1 (hue migration, −251/+115 byte-preserving patch), C-2 (`styles/tokens.js` created — single derivation point, 7 roles from 2 hues).
- AMENDMENTS filed: A-1 (B1 stroke L 0.40 → 0.50 — 0.40 measures 2.075:1 < 3:1 minimum; 0.50 gives 3.177:1), A-2 (A2.1 textDim mix formula → OKLCH role at L 0.61 — the mix caps at ~4.2:1 < 4.5:1).
- Scoping S-1: COL-07/08 measured on `thumbnail_spec` (the palette contract); COL-10 vacuous (50/50 unique niches, no cluster map); all 50 pass so the 13-channel motion-graphics subset passes a fortiori.
- Counter-check: `verify-independent` CONFIRM on all four claims, independent reproduction of channel 1's hue pair from Tailwind/Material first-party data, independent grep (0 `color_palette`), independent math-constant check vs Bottosson OKLab + WCAG 2.2. Verifier could not run node in its sandbox — the executed 50/50 runs live in the ledger appendix (accepted, non-contradictory).

## Shared-file requests applied by orchestrator (R-1..R-6)

- **R-1** `render.js:343` — `palette: channel.thumbnail_spec?.color_palette || null` → `paletteFromHues({ baseHue, accentHue })` with import from `./styles/tokens.js`. APPLIED.
- **R-2** `verify-compositions.js:74,93` — palette derived from hues via tokens.js; `verifyPalette` now receives `{ baseHue, accentHue }`. APPLIED (+ fixed the two PNG-probe references that indexed the roles object as an array — same contract change).
- **R-3** `DETAIL-REFERENCE.md §B1` — stroke row 0.40 → 0.50, ΔL 0.11 → 0.21 (both the table row and B1.1 prose). APPLIED.
- **R-4** `compositions/mg-style.js` — `rolesFromPalette` now delegates to `paletteFromHues` (accepts hue pair, roles object, or legacy 3-hex array via `deriveHuesFromHexes`; null/malformed falls back to the FALLBACK_HEXES default so `verifyPalette(null)` reports rather than throws). `motion-graphics.jsx:1218` call site updated to pass the roles object through. APPLIED.
- **R-5** `MOTION-GRAPHICS-MANUAL.md` — A2 intro + line 1117 row updated from `color_palette` to `baseHue`/`accentHue` + `styles/tokens.js` derivation. APPLIED.
- **R-6** `CHECK-REGISTER.md §3.3` — COL-01..09 → PASS, COL-10 → N/A (all 50 rows, mojibake-safe prefix matching). APPLIED.
- **Companion (needed by R-1):** `compositions/visual.js` `resolveColors` now accepts the derived roles object (in addition to the legacy 3-hex array), so minimal + cinematic-documentary styles keep receiving the channel's hues-derived colours instead of silently falling back to hardcoded defaults. APPLIED.

All edited files pass `node --check`; JSX files pass esbuild transform (exit 0).

## End-to-end verification (orchestrator-run)

`node src/skills/remotion-render/verify-compositions.js`:
- `[mg-gate]` beats/captions/headlineOverlap/iconNames/chartData/**palette**: all **PASS**
- MG package: 32 beats, 47 pages, 2094f
- Rendered stills for cinematic (8 frames + leak probe), minimal, mg (12 frames)
- `mg f60 corner (bg #070D1A): 17,23,35 bg OK`; `mg f900 pixels near accent: 261 accent OK` — derived bg/accent genuinely render on frame
- `ALL STYLES OK`
- Hand-off note (not a Stage-3 defect): IMAGE_BEAT stage stddev ~10.3 vs 18 threshold — b-roll resolves (15/15 from Stage 2 measure) but the E2.5 35% desaturation lowers variance by design; the probe threshold predates the treatment. Flagged for Stage 9 (archetypes) to reconcile probe vs treatment.

## What changed / was deleted this stage

- Deleted: 50 `thumbnail_spec.color_palette` hex arrays from config/channels.json (−251 lines).
- Changed: config/channels.json (+115 lines of baseHue/accentHue), render.js, verify-compositions.js, compositions/mg-style.js, compositions/visual.js, compositions/motion-graphics.jsx, DETAIL-REFERENCE.md, MOTION-GRAPHICS-MANUAL.md, CHECK-REGISTER.md (§3.3 COL-01..10).
- Created: styles/tokens.js (derivation point), data/audit/3/* (ledger, verify-final.mjs, hues.json, patch script, baseline, tiebreak audit, apply scripts).

## Escalations / follow-ups (non-blocking)

- **T-colors**: legacy `.colors` field (200 hexes; 1 white/black, 1 R=G=B) still consumed by endscreen.js:71, captions.js:197, branding.js:23, script-writer/run.js:106 — other lanes' ownership. Registered in CHECK-REGISTER §3.3 note.
- G-4 second source for hue-separation rule (OPEN, non-blocking).
- IMAGE_BEAT probe vs desaturation treatment — Stage 9.
- FINISH-SPEC.md still absent (recurring; Stage 0/1/2 gates flagged).

## Next

Proceed to Stage 4 — Slot table + lint (audit-layout) per protocol, no pause per user instruction.
