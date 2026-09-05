# data/audit/15/audit-type.ledger.md — Stage 15 delete-list sweep, `audit-type` lane

- Lane: `audit-type` (type, fonts, measurement, captions, crispness)
- Stage: 15 (Delete-list sweep — LAYOUT-SYSTEM D1–D14 / FINISH-SPEC R01–R30 re-encoded as `DEL-*` in CHECK-REGISTER §3.4)
- Date: 2026-08-30
- Owner rows: DEL-09, DEL-21, DEL-27. Cross-cutting co-reports in owned files tracked below.
- Method: fresh greps over `src/skills/remotion-render/` (NOT the register's State column). Every hit recorded file:line and classified.

---

## Per-row verdict

| Row | Pattern | Hits in scope | Verdict | Rationale |
|---|---|---|---|---|
| DEL-09 | `chunkVoiceover` | 4 (render.js:134,153; verify-compositions.js:22,36) | **PASS after SFR (deletion), not AMEND** | Wrapper is a pure passthrough to the already-imported `chunkTextClauseAware`. Grep can genuinely reach 0 hits by deleting the wrapper and pointing both call sites at the delegate. Not a design feature (no positive check backs the *wrapper name*); real behaviour lives in `chunkTextClauseAware` which stays. SFR-audit-type-del09 filed (both files outside ownership). Also updates register TYP-11 (line 167, currently FAIL → PASS). |
| DEL-21 | `skew\|rotate(` on text | 6 rotate hits; 0 skew; 1 on a text element (structure-scenes.jsx:726) | **FAIL → AMEND** | Of 6 hits, 5 are `<g transform=...rotate(...)>` on shape/scene/canvas elements (OUT of DEL-21's "on text" scope; legitimate, backed by rotation infra / LAY-15). Exactly 1 hit is a text element: structure-scenes.jsx:726 `transform: "rotate(-90deg)"` on the causal-marker annotation label — an intentional, comment-documented design feature (vertical label riding on a gate at the point causality happens), not slop. Per §4.2 DEL-17 precedent: a real design feature backed by a positive check (rotation is a supported, checked layer op — LAY-15 manages pivot correctness globally) is an AMENDMENT, not a deletion. |
| DEL-27 | `textTransform.*uppercase` in caption path | 0 hits in `captions/**`, `beats.js`, `buildCaptionPages`, or the caption render (motion-graphics.jsx:706 is `textTransform: "none"`) | **PASS** | No `textTransform` at all in the caption path; the caption element explicitly sets `"none"`. The two `textTransform: "uppercase"` hits (cinematic-documentary.jsx:298,396) are `textOverlay` section titles in a DIFFERENT style composition, not captions — out of the DEL-27 caption-path scope. Co-reported below. |

### Classification detail — DEL-09 hits

| File:Line | Code | Class |
|---|---|---|
| render.js:134-136 | `function chunkVoiceover(text, maxWords = 7) { return chunkTextClauseAware(text, maxWords); }` | LIVE VIOLATION (vestigial wrapper matching the gate; no positive check backs the name) |
| render.js:153 | `content: chunkVoiceover(s.voiceover),` | LIVE VIOLATION (call site) |
| verify-compositions.js:22-24 | same 2-line wrapper | LIVE VIOLATION (vestigial wrapper) |
| verify-compositions.js:36 | `content: chunkVoiceover(s.voiceover),` | LIVE VIOLATION (call site) |

`chunkTextClauseAware` is already imported in BOTH files (render.js:37, verify-compositions.js:9) with the same `maxWords = 7` default. Every call site passes a single argument, so `chunkVoiceover(s.voiceover)` → `chunkTextClauseAware(s.voiceover)` is byte-identical behaviour. `chunkVoiceover` is a module-local function in each file — no external imports (whole-repo grep confirms). Deletion is safe and behaviour-neutral.

**Correction to the carried SFR-cap-001 description**: the old carried card said the fallback is "the raw voiceover single-element array (the no-chunking path)". That is NOW WRONG — the current wrapper delegates to `chunkTextClauseAware`, not a raw single-element array. The deletion must preserve clause-aware chunking by pointing the call sites at `chunkTextClauseAware` directly. The exact SFR below reflects current source, not the stale card.

### Classification detail — DEL-21 hits

| File:Line | Code | Class |
|---|---|---|
| structure-scenes.jsx:726 | `transform: "rotate(-90deg)"` on a `<div>` holding text (`{short(marker, 14)}`) | DESIGN FEATURE → AMEND (see proposed row text) |
| structure-scenes.jsx:759 | `<g transform=...+rotate(...)>` | LEGITIMATE REUSE (shape/scene group, not text — out of scope) |
| quantity-scenes.jsx:203 | `<g ... rotate(...)>` | LEGITIMATE REUSE (shape/scene group, out of scope) |
| GeospatialRadiusScene.jsx:253,351,378 | `<g transform=...rotate(...)>` | LEGITIMATE REUSE (scene/canvas groups, out of scope) |

`skew` / `skewX` / `skewY`: **0 hits** in the whole package.

### Classification detail — DEL-27 hits

| File:Line | Code | Class |
|---|---|---|
| cinematic-documentary.jsx:298,396 | `textTransform: "uppercase"` on `{section.textOverlay}` | OUT OF SCOPE — `textOverlay` section title in cinematic-documentary composition, not a caption and not in the caption path. Co-reported. |
| motion-graphics.jsx:706 | `textTransform: "none"` (caption element) | LEGITIMATE REUSE — value is `none`, not uppercase |
| layout/measure.js:39 | comment mentioning `textTransform` | COMMENT-ONLY |
| captions/**, beats.js, buildCaptionPages | *(no `textTransform` at all)* | — |

The `.toUpperCase()` string calls in beats.js (185,221,303,307) and elsewhere are JS string methods, not the `textTransform` CSS property — they do not match DEL-27's grep pattern.

---

## Co-reports (matches of other DEL/check patterns inside, or touching, owned files)

1. **DEL-27 pattern present outside caption scope**: `textTransform: "uppercase"` at cinematic-documentary.jsx:298,396 (`textOverlay` section titles). Not captions, not caption path → DEL-27 passes in scope. BUT flag to type lane/orchestrator: whether an uppercase text overlay violates TYP-19 ("No uppercase body or caption text", grep `textTransform`, 0 in caption/body) is TYP-19's call — `textOverlay` is a section title, arguably neither body nor caption; I do not assert it. Out of `audit-type` owned files either way.
2. **Stale doc refs to `chunkVoiceover`** (once DEL-09 lands, these go stale): `LAYOUT-SYSTEM.md:152` ("still live at render.js:118" — line number already drifted; now 134), `LAYOUT-SYSTEM.md:654` (D2 row: render.js:118, verify-compositions.js:38 — drifted; currently 134/22), `MOTION-BLUEPRINT.md:243`. Out of `audit-type` ownership (documentation). Consistency sweep recommended by orchestrator.
3. **Stage-9 audit gate asserts the old state**: `data/audit/9/frombeats-archetype-gate.mjs:502` `check("chunkVoiceover still live in render.js + verify-compositions.js (informational — TYP-11/DEL-09 stage 10)", ...)` will fail once the wrapper is deleted. It is a stage-9/10 historical artifact, not a live pipeline gate, but should be updated to the DEL-09/TYP-11 passed state when the deletion lands. Out of `audit-type` ownership.
4. **Beats.js `.toUpperCase()` calls** (185,221,303,307): JS string uppercasing of headline/kicker/label text — not the `textTransform` property, so matches no DEL pattern; noted for TYP-19 awareness only.

---

## SHARED-FILE REQUEST blocks

### SFR-audit-type-del09 — delete `chunkVoiceover` wrapper (DEL-09 / TYP-11)

Both target files are OUTSIDE `audit-type` ownership AND outside `audit-render`'s ownership for `verify-compositions.js`. Owner: orchestrator (stage-15 sweep) or the owning lanes. Exact before→after:

**File 1: `src/skills/remotion-render/render.js`**

BEFORE (lines 128-136):
```
// PART 4.2 of the motion-graphics rebuild: this used to be a blind
// word-count split (DEL-09 / TYP-11 in CHECK-REGISTER.md — a real shipped
// defect: "...found: 1,980 meters below the" stranded an article as the
// last word of a caption). chunkTextClauseAware (beats.js) does the same
// ≤maxWords grouping but repairs any boundary that would orphan an
// article, preposition, conjunction, or a number split from its unit.
function chunkVoiceover(text, maxWords = 7) {
  return chunkTextClauseAware(text, maxWords);
}
```
AFTER (keep the explanatory narrative, strip the gate-matching symbol name):
```
// PART 4.2 of the motion-graphics rebuild: this used to be a blind
// word-count split (DEL-09 / TYP-11 in CHECK-REGISTER.md — a real shipped
// defect: "...found: 1,980 meters below the" stranded an article as the
// last word of a caption). chunkTextClauseAware (beats.js) does the same
// ≤maxWords grouping but repairs any boundary that would orphan an
// article, preposition, conjunction, or a number split from its unit.
```

BEFORE (line 153): `      content: chunkVoiceover(s.voiceover),`
AFTER: `      content: chunkTextClauseAware(s.voiceover),`

**File 2: `src/skills/remotion-render/verify-compositions.js`**

BEFORE (lines 22-24):
```
function chunkVoiceover(text, maxWords = 7) {
  return chunkTextClauseAware(text, maxWords);
}
```
AFTER: *(delete the wrapper entirely — no replacement text)*

BEFORE (line 36): `    content: chunkVoiceover(s.voiceover),`
AFTER: `    content: chunkTextClauseAware(s.voiceover),`

Expected result: `rg "chunkVoiceover" src/skills/remotion-render/` → **0 hits**. `chunkTextClauseAware` import stays as-is (already present in both files; still used). Behaviour byte-identical (both call sites pass one arg; default `maxWords = 7` preserved). TYP-21 clause-boundary chunking preserved. Register TYP-11 (line 167) → **PASS**.

---

## Final VERDICT

- **DEL-09**: **PASS (after SFR-audit-type-del09 lands)** — grep goes to 0 hits via behaviour-neutral wrapper deletion; NOT an amendment. Update register TYP-11 → PASS.
- **DEL-21**: **AMEND** — 1 text-element `rotate` (structure-scenes.jsx:726, causal-marker annotation) is a genuine design feature backed by the rotation subsystem (LAY-15); delete-list gate re-scoped.
- **DEL-27**: **PASS** — 0 hits of `textTransform.*uppercase` inside the caption path.

**Proposed amended DEL-21 row text** (for orchestrator approval):
`| DEL-21 | Text transform / skew / rotate | `skew\|rotate(` on text | MINOR | **AMENDED 2026-08-30** — `skew` 0 hits; `rotate` scoped to `skew\|rotate(` on *body/caption/supporting* text only. Excepted: vertical causal-marker annotation label in `structure-scenes.jsx` (line 726), a designed feature whose pivot is governed by LAY-15. Scene/`<g>` canvas transforms (structure 759, quantity 203, geospatial 253/351/378) are shape-scope and out of scope by definition. |`
