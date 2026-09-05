# AUDIT-COLOR LEDGER — Stage 3 (CROSSCHECK-PROTOCOL Part 2)

Lane: `audit-color` · Scope: palette, contrast, elevation, background
Owner lane files: `config/channels.json` (thumbnail_spec), `src/skills/remotion-render/styles/tokens.js`, `data/audit/**`
Today: 2026-08-07

## Status

| Gate | Register state (pre) | Post-change (measured on shipped code) |
|---|---|---|
| COL-01 textPrimary/bg 7–17:1 | FAIL "2 below, 48 above" | **PASS** 14.35–14.49 (0 below, 0 above) |
| COL-02 accent/bg ≥4.5:1 | FAIL "6 channels" | **PASS** 4.53–5.70 |
| COL-03 accent/textPrimary ≥2.5:1 | FAIL "~11 channels" | **PASS** 2.54–3.20 |
| COL-04 stroke/bg ≥3:1 | UNK | **PASS** 3.18–3.28 |
| COL-05 textDim/bg ≥4.5:1 | UNK | **PASS** 5.07–5.17 |
| COL-06 accent hue ≥60° from base | FAIL "2–3 channels" | **PASS** 60.0–167.2° |
| COL-07 no white/black/R=G=B | FAIL "48" | **PASS** (thumbnail_spec — see S-1) |
| COL-08 no hex literals | FAIL "all" | **PASS** (thumbnail_spec — see S-1) |
| COL-09 no duplicate hue pairs | FAIL "5 pairs" | **PASS** 50/50 unique |
| COL-10 cluster hues ≥40° apart | UNK | N/A (vacuous, see S-1) |

Measured pre-change baseline (data/audit/3/explore.out.txt, run against the live
pre-migration arrays): COL-01 0 below / 48 above 17:1 (range 10.38–20.13); COL-02
5 channels <4.5; COL-03 18 channels <2.5; COL-04 0; COL-05 4 channels <4.5;
COL-06 32 channels <60°. Register's pre-state counts were stale on COL-01
("2 below"), COL-02 ("6"), COL-03 ("~11"), COL-06 ("2–3").

---

## GROUND phase claim cards

### G-1 · Dark themes need elevation via surface lightness — RE-VERIFIED
Claim: <cite>shadows are less effective in a dark theme because they have less
contrast with the dark background colours; Material's structural answer is that
surfaces become lighter at higher elevations</cite>.
Status: **RE-VERIFIED YES**.
Evidence: first-party material-components Dark.md
(raw.githubusercontent.com/material-components/material-components-android/
master/docs/theming/Dark.md), which states the overlay/surface-lightening
mechanism in the context of dark themes.
Impact: confirms DETAIL-REFERENCE §B0/B1 — the absolute-L elevation ladder
(E0 0.16 / E1 0.23 / E2 0.29) is the correct structural approach; mg-style
already implements it. No change from this card.

### G-2 · Material 0–16% elevation overlay mechanism — CHANGED (superseded)
Claim: <cite>elevation overlay transparencies range from 0% for the lowest
level to 16% for the highest</cite> (DETAIL-REFERENCE §B0).
Status: **CHANGED**. The M2 0–16% alpha-overlay mechanism is superseded in
current Material: m2.material.io and its Dec-2024 Wayback capture are
client-rendered shells (no body text retrievable), the m3 dark-theme page 404s,
and first-party Dark.md documents tonal surface colours replacing overlay alpha.
B1 already implements the current approach (absolute L vs overlay), so no code
change follows; the amendment is confined to how the reference is described.
Impact: none on code; citation note only.

### G-3 · Pre-change gate baseline (all 50 channels)
Claim: the pre-migration palette state fails COL-01/02/03/06/07/08/09 and
passes COL-04/05, with the exact counts above.
Status: **VERIFIED** (recorded artifact: data/audit/3/explore.out.txt baseline
block; computed with the repo's own mg-style role derivation + WCAG 2.2
luminance, no rounding).
Impact: register §3.3 counts were stale; corrected in this ledger and flagged
for CHECK-REGISTER.md (shared-file request R-6).

### G-4 · COL-06 hue-separation rule
Claim: accent hue must sit ≥60° from base hue on the OKLCH hue circle
(CHECK-REGISTER §3.3 COL-06).
Status: rule is a spec requirement (register) implemented by construction in
the derivation (base moved to exactly accent−60 when native separation <60,
de-duplicated ±1.5°·k). The perceptual-distinctness literature is ONE
independent source (Munsell hue-circle separation, data/audit/0) — a second
independent source is still OPEN and non-blocking (gate is spec-mandated and
passes on all 50 channels regardless).

---

## CHANGE phase claim cards

### C-1 · channels.json — color_palette → baseHue/accentHue (owned edit)
Claim: replacing each `thumbnail_spec.color_palette` 3-hex array with numeric
`baseHue`/`accentHue` (degrees, 1-decimal) for all 50 channels, derived from
each channel's original palette identity, preserves every other field and
yields unique, ≥60°-separated hue pairs.
Derivation: `baseHue` = hue of the first chromatic member (OKLCH C ≥ 0.005) of
[bg, textPrimary, accent], fallback 265; `accentHue` = hue of palette[1];
when native shortest separation <60° the base moves to accent−60 (or +60 on
wrap); exact duplicate pairs get ±1.5°·k pushed toward larger separation.
Verification: COL-06 60.0–167.2°, COL-09 50/50 unique — measured by
data/audit/3/verify-final.mjs against the PATCHED file (see appendix).
Artifacts: data/audit/3/hues.json (values), data/audit/3/patch-channels.mjs
(byte-preserving textual patch with assertions), `git diff config/channels.json`
(−251/+115; only color_palette blocks touched).

### C-2 · tokens.js — single derivation point (owned file created)
Claim: `src/skills/remotion-render/styles/tokens.js` derives all seven role
hexes (bg, surface, raised, stroke, textPrimary, textDim, accent) from
baseHue/accentHue with locked parameters, and those roles pass COL-01..06 on
all 50 channels with the margins below.
Locked parameters: E0 0.16, E1 0.23, E2 0.29 (B1); C_BG 0.03, L_TEXT 0.90,
C_TEXT 0.02, L_DIM 0.61, L_STROKE 0.50, L_ACC 0.60, C_ACC 0.17.
Worst margins over 50 channels (quantised 8-bit hexes): c01 +2.51 (cap),
c02 +0.03, c03 +0.04, c04 +0.18, c05 +0.57, c06 0.0 (by construction).
Verification: data/audit/3/verify-final.mjs imports THIS shipped module
(not the audit copy) and reports 50/50.
Math basis: OKLab/OKLCH per Björn Ottosson's public-domain implementation
(bottosson.github.io/posts/oklab); WCAG 2.2 relative luminance with 0.04045
threshold and unrounded ratios (w3.org/TR/WCAG22; WAI Understanding 1.4.3).

### A-1 · AMENDMENT — B1 stroke L 0.40 → 0.50
Claim: B1's stroke L 0.40 cannot satisfy COL-04 (≥3:1) against E0 on the
quantised ladder — measured min 2.075:1. L 0.50 is the minimal compliant
value (min 3.177:1, margin 0.18). B1.1's separation intent is preserved
(ΔL vs E2 grows 0.11 → 0.21).
Implemented: tokens.js `STROKE_L = 0.5`.
Requires: DETAIL-REFERENCE.md §B1 wording update (shared-file request R-3).

### A-2 · AMENDMENT — A2.1 textDim mix formula → OKLCH role
Claim: with textPrimary at L 0.90 (required so COL-01 stays ≤17:1),
mg-style's A2.1 `mix(textPrimary, bg, 0.45)` textDim cannot reach COL-05
(≥4.5:1) — measured ≤ ~4.2:1 across the sweep. The OKLCH textDim role at
L 0.61 yields 5.07–5.17:1.
Implemented: tokens.js textDim role.
Requires: mg-style.js + MOTION-GRAPHICS-MANUAL wording (requests R-4, R-5).

### S-1 · Scoping + follow-ups
- COL-07/08 are measured on `thumbnail_spec` (the palette contract;
  MOTION-GRAPHICS-MANUAL "Each channel supplies three colours via
  thumbnail_spec.color_palette"). Post-migration thumbnail_spec has zero hex
  literals → both PASS.
- Whole-file reading of channels.json still contains the legacy `.colors`
  field (200 hexes across 50 channels; 1 #FFFFFF/#000000, 1 R=G=B). This is a
  separate live contract (endscreen.js:71, captions.js:197, branding.js:23,
  script-writer/run.js:106) owned by other lanes → follow-up T-colors,
  registered for CHECK-REGISTER.md.
- COL-10 is vacuous: all 50 niches are unique network-wide, no cluster map
  exists in the repo → N/A until a cluster map is defined.
- Scope note: COL-01..06 run "across all 50 channels" (register) while the
  protocol Stage-3 scope is motion-graphics (13 channels); all 50 pass, so the
  motion-graphics subset is satisfied a fortiori.

---

## Verification appendix (data/audit/3/verify-final.mjs — shipped tokens.js)

```
COL-01..06 (via shipped tokens.js): 50/50 pass
  c01 range 14.35..14.49  (gate 7..17)
  c02 range 4.53..5.70  (gate >=4.5)
  c03 range 2.54..3.20  (gate >=2.5)
  c04 range 3.18..3.28  (gate >=3)
  c05 range 5.07..5.17  (gate >=4.5)
  c06 range 60.0..167.2 deg  (gate >=60)
COL-07 thumbnail_spec: no hexes in thumbnail_spec -> PASS
COL-08 thumbnail_spec: zero hex literals in thumbnail_spec -> PASS
COL-09: unique (baseHue, accentHue) pairs: 50/50 -> PASS
COL-10: niches unique across network (50/50) -> vacuous N/A
```
Re-run 2026-08-07 (post counter-check): identical output — 50/50, same ranges.

## COUNTER-CHECK (CROSSCHECK-PROTOCOL Part 2)

Dispatched `verify-independent` (ses_024e7b367ffe6cgbHX1c6UJpyh) with the four
claims (migration, tokens.js gates, stroke amendment, Material mechanism) and
the repo diffs; verifier re-researched from scratch (did not receive this
ledger's evidence). Verdict: **CONFIRM on all four claims**.

Independent corroboration highlights from the verifier:
- Channel 1 derivation reproduced from first-party color data: `#0F172A` ≈
  Tailwind slate-900 `oklch(0.208 0.042 265.755)` → hue 265.8 = stored baseHue;
  `#22C55E` = green-500 hue 149.58 → 149.6 = stored accentHue; d=243.8° needs
  no adjustment.
- Grep: zero `color_palette` occurrences remain; all 50 channels carry
  baseHue/accentHue matching data/audit/3/hues.json (50/50); hue separation
  >=60 everywhere, 50/50 unique pairs.
- tokens.js math constants match Bottosson OKLab and WCAG 2.2 (0.04045,
  unrounded ratios); checkPaletteGates thresholds match CHECK-REGISTER §3.3;
  verify-final imports the SHIPPED module.
- Material mechanism (Claim 4): five independent sources — material-components
  Dark.md ("Surface with elevation overlays has been replaced … with the tonal
  surface color system"), AndroidX ElevationOverlay.kt (M2-only, 0–16%),
  Flutter elevation_overlay.dart ("If using Material Design 3, this type of
  color overlay is no longer used"), developer.android.com ("Elevation
  overlays in dark themes have also changed to tonal color overlays in M3"),
  Flutter 2026-05-05 breaking change (tone-based surface colors replace the
  opacity-based overlay model).

Verifier residual notes (accepted, non-contradictory):
1. Its sandbox could not execute node (permission allow-list) — the executed
   50/50 runs live in this ledger's appendix instead.
2. tokens.js is untracked in git — the lane's change is complete on disk and
   will be committed when the user authorizes commits.
3. Register COL-08 wording is whole-file; `.colors` hexes remain — already
   tracked here as S-1 scoping + R-6 + T-colors follow-up (register file
   itself is a shared file, updated by its owner).

Channels at exactly 60.0° separation (constructed minimum, intentional; verified
by data/audit/3/tiebreak-audit.mjs against the pre-migration palette):
3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 21, 24, 38, 42, 44, 50
(21 channels; base moved to accent−60 or accent+60 where the native separation
was <60°/ >300°). Tiebroken duplicates (COL-09): 18, 19, 23, 27, 28, 32, 34,
35, 36, 37, 40, 41, 43, 46, 47, 48, 49 (17 channels; all unique post-tiebreak).
Unmoved (native separation already ≥60°): 1, 2, 20, 22, 25, 26, 29, 30, 31,
33, 39, 45 (12 channels).

---

## SHARED-FILE REQUESTS (not owned by audit-color; owners must apply)

### R-1 · src/skills/remotion-render/render.js (line 343)
`palette: channel.thumbnail_spec?.color_palette || null` → the prop no longer
exists; must become
`palette: tokens.paletteFromHues({ baseHue: channel.thumbnail_spec?.baseHue, accentHue: channel.thumbnail_spec?.accentHue })`
(with `import { paletteFromHues } from "./styles/tokens.js"`).

### R-2 · src/skills/remotion-render/verify-compositions.js (lines 74, 93)
`verifyPalette(mgChannel.thumbnail_spec?.color_palette || null)` and
`mgPalette = ... || ["#1A1A2E", "#F5536B", "#FFFFFF"]` → derive from
baseHue/accentHue via tokens.js; verifyPalette should call
`checkPaletteGates` (adds the missing 17:1 ceiling and hue checks).

### R-3 · DETAIL-REFERENCE.md §B1 (elevation ladder)
Amend stroke row: `0.40` → `0.50` and B1.1's "Δ L 0.11" → "Δ L 0.21"
(citation: this ledger A-1).

### R-4 · src/skills/remotion-render/compositions/mg-style.js
Role derivation (`rolesFromPalette`, A2.1 mix-based textDim) must switch to
`paletteFromHues` from `../styles/tokens.js` (A-2). Layout/dot exports stay.

### R-5 · MOTION-GRAPHICS-MANUAL.md (lines 63, 1117)
"three colours via thumbnail_spec.color_palette" → baseHue/accentHue + role
derivation via styles/tokens.js; textDim formula (A2.1) amended.

### R-6 · CHECK-REGISTER.md §3.3
Update COL-01..09 states to PASS (table above), COL-10 to N/A (vacuous),
COL-07/08 method scoped to `thumbnail_spec`, and register follow-up T-colors
(legacy `.colors` hex field, 200 hexes, 1 white/black, 1 R=G=B).

## OPEN
- G-4 second independent source for hue-separation (non-blocking).
- R-1..R-6 land in owner lanes before motion-graphics renders use the new
  palette shape (render.js passing null palette would fall back to the
  hardcoded default and render wrong colours).
