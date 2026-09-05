# data/audit/12/audit-color.ledger.md

Audit lane: **audit-color** — Stage 12 (Background + depth).
Process: CROSSCHECK-PROTOCOL Part 2 (3-phase) + Part 4 stage 12, per
`visual guide.txt` §30 (background = subtle environment) and
`DETAIL-REFERENCE.md` Part B.

Ownership: may write `config/channels.json`, `styles/tokens.js`,
`effects/CanvasGrain.jsx`, `effects/generate-editorial-lut.mjs`,
`data/audit/**`. Everything else = SHARED-FILE REQUEST (below).

Checks: COL-17, COL-18 (build), COL-12, COL-13, COL-19, COL-22 (re-verify).

Session artifacts created alongside other lanes' (do not clobber):
- `check-dot-grid-density.mjs` — compiler probe for COL-17/18,
- `node_modules/@remotion/captions/` stub (gitignored; see probe header),
- this ledger.

---

## SHARED-FILE REQUEST — SFR-12-COL-1 (application site, orchestrator-owned)

**File:** `src/skills/remotion-render/compositions/motion-graphics.jsx`

**Reason:** COL-17/18 require the dot grid's *application* to consume the
density table. The composition is orchestrator-owned; every render/verify
lane agrees the JSX stays presentational and all scene-level decisions are
made in the package (mg-package.js) or tokens. The density table and pure
helpers live in `styles/tokens.js` (audit-color's file; dependency-free ESM
by its header) — the orchestrator applies this exact diff.

**Violations today (evidence, live source):**
1. `Background()` line 367: `dotGrid({ dotSize: 8, gridSize: 80 })` @ opacity
   0.06 — violates B2.3 (pitch must be 64 px) and B2.4 (dot diameter must be
   4 px). COMMENT line 336 already reads "dotGrid (stroke 6%)" — the 6% is
   real but shared indiscriminately (applies to every section regardless of
   archetype; no per-archetype differentiation → COL-17 N/B; one density for
   the whole video).
2. `ListRunScene` line 999: `dotGrid({ dotSize: 6, gridSize: 56 })` @ opacity
   **0.1** — violates B2.3/B2.4 AND **B5** ("any texture at above 8% opacity"
   is a forbidden background treatment; 0.1 > 0.08).

**Diff A — Background (density-driven):**

Replace the current `Background` beginning (lines 355–369 as of this session):

```jsx
function Background({ colors }) {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const breathe = 1 + BREATHE_AMPLITUDE * Math.sin((2 * Math.PI * frame) / (fps * BREATHE_PERIOD_SEC));
  return (
    <>
      <Solid width={width} height={height} color={colors.bg} style={{ position: "absolute", inset: 0 }} />
      <Solid
        width={width}
        height={height}
        color={colors.stroke}
        effects={[dotGrid({ dotSize: 8, gridSize: 80 })]}
        style={{ position: "absolute", inset: 0, opacity: 0.06, scale: `${breathe}`, transformOrigin: "center" }}
      />
```

with:

```jsx
function Background({ colors, beats = [], sectionRanges = {} }) {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const breathe = 1 + BREATHE_AMPLITUDE * Math.sin((2 * Math.PI * frame) / (fps * BREATHE_PERIOD_SEC));
  // B2.1–B2.4 — density per archetype (6%/4%/0%, nothing between), per-section
  // min (B2.2), fixed 64 px pitch / 4 px dot (B2.3/B2.4). 0% renders no layer.
  const grid = dotGridStateForFrame(sectionRanges, beats, frame);
  return (
    <>
      <Solid width={width} height={height} color={colors.bg} style={{ position: "absolute", inset: 0 }} />
      {grid ? (
        <Solid
          width={width}
          height={height}
          color={colors.stroke}
          effects={[dotGrid({ dotSize: grid.dotSize, gridSize: grid.gridSize })]}
          style={{ position: "absolute", inset: 0, opacity: grid.opacity, scale: `${breathe}`, transformOrigin: "center" }}
        />
      ) : null}
```

**Diff B — imports + call site:**

Add to the top import block of the same file:

```js
import { DOT_DIAMETER, DOT_GRID_PITCH, DOT_GRID, dotGridStateForFrame } from "../styles/tokens.js";
```

Change the call site (line 1201):

```jsx
<Background colors={colors} />
```

to:

```jsx
<Background colors={colors} beats={mg?.beats || []} sectionRanges={mg?.sectionRanges || {}} />
```

**Diff C — ListRunScene panel grid (B2.3/B2.4/B5 + LIST_ITEM table row):**

Replace lines 995–1001:

```jsx
<Solid
  width={LIST_PANEL.width}
  height={LIST_PANEL.height}
  color={colors.stroke}
  effects={[dotGrid({ dotSize: 6, gridSize: 56 })]}
  style={{ position: "absolute", inset: 0, opacity: 0.1 }}
/>
```

with (delete-then-replace; also fixes the B5 >8% violation):

```jsx
<Solid
  width={LIST_PANEL.width}
  height={LIST_PANEL.height}
  color={colors.stroke}
  effects={[dotGrid({ dotSize: DOT_DIAMETER, gridSize: DOT_GRID_PITCH })]}
  style={{ position: "absolute", inset: 0, opacity: DOT_GRID.LIST_ITEM }}
/>
```

**Gate after applying:** `node data/audit/12/check-dot-grid-density.mjs` must
report `APPLICATION_SITE: PASS` (the probe's static scan asserts every
`dotGrid(` call uses DOT_DIAMETER/DOT_GRID_PITCH geometry and opacity within
{B2 densities} ∪ {section densities}, ≤ 8% everywhere).

**Not in scope of this SFR:** elevation L values (B1 — superseded by the
flat-bg rebuild documented in tokens.js header and prior stage-3 ledgers),
CaptionLayer's drop-shadow (B1.4 carve-out), CanvasGrain (COL-owned,
verified separate).

---

## Phase 1 — CLAIM COLOR-12-1 (dot-grid density table + section resolution)

**Claim:** The motion-graphics dot grid has exactly three densities — 6%,
4%, 0%, nothing between (B2.1) — keyed to the eight live beat archetypes
(HERO_NUMBER 6%, TERM_DEFINE 6%, LIST_ITEM 4%, CONTRAST 4%, PROGRESS 0%,
RELATION 6%, IMAGE_BEAT 0%, STATEMENT 6%), resolved per section as the
minimum of its beats' densities, changing only at the section wipe (B2.2),
rendered at a fixed absolute 64 px square pitch with 4 px dot diameter
(B2.3/B2.4), determined by the archetype and never by the channel (B2.1),
expressed as the grid layer's opacity (repo convention — motion-graphics.jsx
line 336 comment "dotGrid (stroke 6%)", opacity 0.06).

Evidence (independent + first-party; ≥3):

1. **DETAIL-REFERENCE.md Part B2 table + B2.1–B2.4** — the per-archetype
   6/4/0 table, the min-rule, the 64 px pitch (with the LAYOUT-SYSTEM §0.7
   "never percentage-based" rationale), the 4 px diameter (with the H.264
   quantisation rationale). First-party spec. The table's exact figures are
   TABLE-OWNED; see P3.5/SPEC AMENDMENT note below.
2. **Remotion docs, `@remotion/effects` `dotGrid()`** (remotion.dev/docs/
   effects/dot-grid, fetched this session): `dotSize` = "Diameter of each
   circular dot in pixels" (default 16), `gridSize` = "Distance between
   adjacent dot centers in pixels" (default 20) — the library's parameters
   are absolute-px, confirming B2.3's "absolute pitch, never %" is how the
   effect works. First-party, independent of the repo.
3. **Liamrjohnston/remotion-motion-graphics-skill** (the controlling
   prompt's §1 designated reference; fetched this session):
   `skills/motion-graphics/SKILL.md` sanctions "light grid" / "dark grid" as
   legitimate surfaces, demands flat restrained surfaces, zero neon/glow,
   and "$background" as research-validated choice — technique grounding that
   a dot grid is a legitimate *subtle* background in this genre. Independent
   of the repo, authoritative for technique.
4. **Third-party editorial/UI practice** (fetched this session):
   DesignRevision ("dot grid … add subtle texture… never compete"), Toolsti
   ("opacity control: keep the grid subtle… support text, not compete";
   "values between 0.08 and 0.22 often work well"), utilitykit.tools SVG
   pattern generator ("Use 5-10% alpha on the pattern color so the texture
   whispers behind body text"), Hyperiux dotted-grid ("quiet technical
   structure behind readable foreground copy… keep density low enough to
   protect text"), shadcn halftone, Pacgie dots. These bracket the spec's
   6%/4% at or *below* the common UI floor — consistent with §30's "subtle
   environment", never a competing texture.
5. **Live application sites** (first-party evidence of the defect):
   motion-graphics.jsx lines 367 & 999 — dotSize 8/gridSize 80 @ 0.06 and
   dotSize 6/gridSize 56 @ **0.1**; the latter exceeds B5's 8% ceiling.
   beats.js `classifyBeat` + schemas/script.mg.json confirm the eight
   archetype names are LIVE data keys (not strategy-layer names).

**SPEC AMENDMENT / P3.5 note:** the exact numbers (6/4/0, 64 px, 4 px) are
table-owned — no independent source states those precise figures; the
sources ground the *practice* (low-opacity dot-grid textures behind content,
absolute-px geometry). Per protocol this is "RE-VERIFIED CHANGED/SPEC
AMENDMENT": implemented exactly as the live table states, amendment recorded
here so the numbers are traceable to DETAIL-REFERENCE B2 rather than to
imagination. No factual claim about the world is being made by these values;
they are determinative design constants.

**Phase 2 action (next):** one minimal diff — append the DOT_GRID table +
pure helpers to `styles/tokens.js`; record diff hash. Probe
`data/audit/12/check-dot-grid-density.mjs` compiles real mg packages (with a
gitignored @remotion/captions stub) and asserts COL-17 (exact) / COL-18
(single value per section) + B2.3/B2.4 geometry + B5 ceiling at BOTH the
helper level and the application site.

---

## Gating re-verification (Stage 12, live greps, this session)

| Check | Definition (register) | Grep | Result |
|---|---|---|---|
| COL-12 | Zero `boxShadow` in the style | Grep tool `boxShadow` over `src/skills/remotion-render` | **0 hits** → PASS |
| COL-13 | Zero `gradient` in code | Grep tool `gradient` (all hits inspected) | 13 hits, ALL in comments/removal-comments (cinematic-documentary.jsx 28,30,212,213,246; minimal.jsx 21,22; motion-graphics.jsx 48,351; run-visual-tests.js 520,534; scenes/stage.jsx 169; scenes/elements/chart.jsx 38) → **0 code hits** → PASS |
| COL-19 | Dot grid uses absolute square pitch, no `%` | Grep `gridSize|dotSize` | 2 hits, both integer px (80,56 / 8,6); no `%` anywhere in grid params → PASS for the `%` condition; B2.3's *64 px* value is enforced by COL-17/18 build + SFR |
| COL-22 | No mood-based colour grading | Grep `moodFrom` | 1 hit, comment only (cinematic-documentary.jsx:31) → **0 code hits** → PASS |

Re-verified against live source this session; matches register rows 225
(COL-12), 232 (COL-19), 235 (COL-22); COL-13's row carries removal-comment
hits at the same lines the rebuild documented.

---

## Phase 2 — applied diff (CLAIM COLOR-12-1)

One minimal diff to `src/skills/remotion-render/styles/tokens.js`: appended
the "Background texture — dot grid" section (DOT_GRID_PITCH=64,
DOT_DIAMETER=4, DOT_GRID frozen table, dotGridDensityForArchetype,
dotGridDensityPerSection, dotGridStateForFrame). Pure, dependency-free,
append-only — no existing export or behaviour touched.

- Diff SHA256: `28611986655ca8ea531b65f9f0c9567cbd94e78fb1ab108768ba67b4b23b6d9a`
  (git-diff byte stream; counter-checker noted the hash is line-ending
  sensitive on Windows and verified the diff's CONTENT instead — confirmed
  exact 102-line append, all named exports present).
- Post-apply sanity: the helper edits include one functional fix made during
  Phase 2 itself — `dotGridStateForFrame` applies a section's density from
  its `from` until the NEXT section's `from` (gaps + tail hold the density;
  B2.2 "changes only at the wipe"), not until its own `to`. Verified by the
  Tier-1 frame sweep (`0.06@4/64, 0.06@4/64, 0.06@4/64, 0.06@4/64, null`).

## Probe run — `node data/audit/12/check-dot-grid-density.mjs`

Environment: this Windows machine (no Remotion deps installed).

- TIER 1 (plain Node): **ALL PASS** — 8/8 archetype table values exact vs
  DETAIL-REFERENCE B2; keys = exactly the live schema enum; densities only
  in {0.06,0.04,0} and all ≤ B5's 8%; pitch 64 / dot 4 integers (never %);
  unknown archetype throws; min-rule (HERO_NUMBER+CONTRAST→0.04,
  PROGRESS+STATEMENT→0); per-archetype sections all correct; frame sweep
  wipe-only; PROGRESS→no layer; empty→no layer.
- TIER 2 (real ch-fixture mg package): **SKIPPED** on this machine —
  `@remotion/captions` not installed (error recorded). The probe is
  environment-adaptive: on the render sandbox (npm-installed, e.g. the
  environment that ran pull-quote-probe.mjs) it builds the REAL package via
  compositions/mg-package.js and re-runs every assertion on real beats,
  including the wipe-only frame sweep across the full timeline. This ledger
  records the Tier-2 verdict as PENDING — must be run on the sandbox (or
  post-`npm install`) before COL-17/18 are declared green end-to-end.
- APPLICATION SITE: **PENDING (SFR-12-COL-1)** — scan of motion-graphics.jsx
  finds exactly 2 dotGrid calls, both geometry-failed vs B2.3/B2.4, and
  line 999's opacity 0.1 flagged as the B5 >8% violation. Orchestrator
  applies SFR-12-COL-1, then this scan must read PASS.

## Phase 3 — independent counter-check (verify-independent)

Verdict: **CONFIRM** (session `ses_fb18fe608fferSyry79eztC5Lc`). Agent
re-read every file itself: B2 table match byte-for-byte (DETAIL-REFERENCE
347-356 vs tokens.js 295-304); schema enum = the 8 names (script.mg.json
29-32, beats.js 89-98); (archetype, sectionIndex) correctly authored per
beat; both application-site defects reproduced (mov-gr 367-368: 8/80@0.06;
999-1000: 6/56@0.1 — the latter also >8% B5); ownership clean (only
tokens.js among tracked render files + new data/audit/12 files).

Correction incorporated (COL-13 wording): my GATE table row said "ALL in
comments". The verifier flags run-visual-tests.js:534 is a diagnostic
MESSAGE STRING ("gradient" as a plane-ratio parameter in the parallax-depth
QA check per the vendored reference at 519-521), not a gradient fill. The
gate's substance — zero gradient fills/code — still holds (12 genuinely
comment/removal-comment hits + 1 message string). Register row stands.

Verifier could not: re-run the probe (its shell denied bare `node`; traced
the probe by reading and confirmed every assertion reproduces its own
findings), nor recompute the diff byte-hash (line-ending sensitivity;
content verified). Both recorded; neither changes the verdict.

## Final per-check status

| Check | State | Evidence |
|---|---|---|
| COL-17 dot-grid density matches archetype table, compiler, exact | **BUILT** (helper level PASS; app-site PENDING SFR-12-COL-1) | probe Tier 1 all pass; counter-check CONFIRM; ledger CLAIM-12-1 |
| COL-18 density constant within a section, compiler, 1 value | **BUILT** (helper level PASS; app-site PENDING) | min-rule + wipe-only sweep (Tier 1), Tier 2 pending on sandbox |
| COL-12 zero boxShadow | **PASS** | 0 hits (live grep; register 225) |
| COL-13 zero gradient in code | **PASS** | 0 fills/code; 12 comment + 1 diagnostic-string hits (register-compatible) |
| COL-19 absolute square pitch, no % | **PASS** | grid params integer px only; B2.3's 64 exact via COL-17/18 build + SFR |
| COL-22 no mood grading | **PASS** | 0 code hits, 1 comment (register 235) |

Residuals (honest, not papered over):
1. Tier 2 real-package compile must run on the npm-installed render sandbox
   before COL-17/18 are end-to-end green.
2. SFR-12-COL-1 must be applied by the orchestrator; probe's application
   scan is the re-run gate.
3. B2.4's "current 3 px" statement in DETAIL-REFERENCE does not match live
   code (8/6 px) — the register/spec text predates the drift; this session's
   build closes the drift to the spec's 4 px. Note for the spec owner.

---

## Phase 4 — re-entry: gate failure on the application-site scan (fixed)

**Trigger:** orchestrator re-ran `node data/audit/12/check-dot-grid-density.mjs`
after applying SFR-12-COL-1 (verified byte-exact at motion-graphics.jsx
356-375/1207/1001-1007). Gate output:

```
== Application site (motion-graphics.jsx dotGrid wiring) ==
  APPLICATION_SITE: PENDING — SFR-12-COL-1 not yet applied.
    - 0 dotGrid call(s) — expected exactly 2 (Background + ListRunScene panel)

TIER 1: ALL PASS
```

**Root cause (orchestrator-confirmed, this lane agrees):** the probe's old
scan regex only matched NUMERIC LITERALS in the effects array:

```js
// BEFORE — data/audit/12/check-dot-grid-density.mjs (~line 220)
const dotGridRe = /effects=\{\[dotGrid\(\{ dotSize: (\d+), gridSize: (\d+) \}\)\]\}/g;
// + opacity sniffed from the next 240 chars as /opacity: (0?\.?\d+)/
```

SFR-12-COL-1 wires both sites SYMBOLICALLY (`grid.dotSize/grid.gridSize/
grid.opacity`; `DOT_DIAMETER/DOT_GRID_PITCH/DOT_GRID.LIST_ITEM`). A correctly
applied SFR can therefore never match a numeric-literal regex → the probe was
the wrong tool, not the wiring. Tier 1 and Tier 2 verdicts unchanged (Tier 2
still SKIPPED here — no @remotion/captions on this machine).

**Probe change (method (b), per this lane's header):** replaced the
literal-sniffing regex with a 5-part structural wiring scan, and made
application-site failures count toward the exit code (PASS required):

1. **Tokens import** — the file must import `DOT_DIAMETER`,
   `DOT_GRID_PITCH`, `DOT_GRID`, `dotGridStateForFrame` from
   `styles/tokens.js` (a sneak import from another module fails).
2. **Exactly two `dotGrid({ ... })` application sites**, nothing else in the
   file.
3. **Background state wiring** — exactly one bare
   `const <v> = dotGridStateForFrame(sectionRanges, beats, frame);` (chained
   `|| {...}` fails) AND the `<Background>` call site feeds
   `mg?.beats` / `mg?.sectionRanges` (empties would silently produce `null`
   for every frame).
4. **Site classification** — each call site's `dotSize`/`gridSize`/`opacity`
   expressions must be either `<stateVar>.dotSize/.gridSize/.opacity`
   (Background) or the exact names `DOT_DIAMETER` / `DOT_GRID_PITCH` /
   `DOT_GRID.LIST_ITEM` (ListRunScene); exactly one of each. Any numeric
   literal (even "correct-looking" 4/64/0.04) or chained expression
   (`DOT_DIAMETER + 4`) fails — constants are single-sourced in tokens.js by
   construction. The named-constant site is resolved against the imported
   module (`T`), which Tier 1 pins to 4/64/.04 — token drift fails both
   levels.
5. **Conditional render** — the Background layer must be wrapped in
   `{<v> ? ( ... ) : null}` (0% density = no layer).

```js
// AFTER — data/audit/12/check-dot-grid-density.mjs (application-site section)
const attrOf = (region, name) => {           // bare symbol / member access only
  const m = new RegExp(name + ":\\s*([^,}]+)").exec(region);
  if (!m) return null;
  const t = m[1].trim();
  return /\s/.test(t) ? null : t;            // `DOT_DIAMETER + 4` -> null (fails)
};
const isLiteral = (e) => /^(\d+(\.\d+)?|\.\d+)$/.test(e);   // any literal fails
// ... 5-part scan per the list above; failures += siteIssues.length drives exit 1.
```

Also added an optional argv path override (`argv[2]`, inert with no args) so
the scan can be pointed at mutant fixtures — this is how the sneak tests
below were run. Documented in the probe header.

**Re-run — real composition (repo root):**

```
== Application site (motion-graphics.jsx dotGrid wiring) ==
  ok   tokens import carries DOT_DIAMETER
  ok   tokens import carries DOT_GRID_PITCH
  ok   tokens import carries DOT_GRID
  ok   tokens import carries dotGridStateForFrame
  ok   exactly 2 dotGrid({ ... }) application sites (Background + ListRunScene panel)
  ok   Background state: const grid = dotGridStateForFrame(sectionRanges, beats, frame)
  ok   Background call site feeds mg?.beats / mg?.sectionRanges — density data wires in
  ok   ListRunScene panel: DOT_DIAMETER / DOT_GRID_PITCH / DOT_GRID.LIST_ITEM resolve 4/64/0.04 (B2.3/B2.4/B5)
  ok   grid grid element conditionally rendered — 0% density renders no layer
  APPLICATION_SITE: PASS — both sites wired to styles/tokens.js, no literals: ...
TIER 1: ALL PASS
EXIT_CODE=0
```

(Full reasoning lines printed under PASS as captured in the run log.)

**Sneak verification — real teeth, not a formality** (throwaway fixtures
generated from the live composition, scanned via the argv override, then
deleted; generator `make-sneaks.mjs` was throwaway too):

| Fixture | Sneak | Result |
|---|---|---|
| sneak-a | Background hardcoded `8/80` + `opacity 0.1` (the original B2.3/B2.4/B5 violation) | **FAIL, exit 1** — "line 372: unwired site — dotSize 8 hardcoded literal … gridSize 80 hardcoded literal … opacity 0.1 hardcoded literal — exceeds B5 8% ceiling" |
| sneak-b | ListRunScene hardcoded *correct-looking* `4/64/0.04` literals | **FAIL, exit 1** — "line 1005: unwired site — dotSize 4 hardcoded literal (constants must come from tokens, not be duplicated)…" |
| sneak-c | Background call site feeds `beats={[]} sectionRanges={}` | **FAIL, exit 1** — "Background call site does not pass the mg package's beats / sectionRanges — density would silently be empty" |

No check was loosened to make the real run pass — the sneaks prove the scan
is the gate, not a formality.

**Status:**
- COL-17 / COL-18 application-site wiring: **PASS** (with Tier-1 evidence
  unchanged); the SFR wiring itself needed no revision → **no SFR-12-COL-2**.
- Tier 2 (real-package compile on npm-installed sandbox) remains **PENDING**
  as before — unchanged residual, out of scope on this machine.
- Files changed this re-entry: `data/audit/12/check-dot-grid-density.mjs`
  only (owned). `motion-graphics.jsx` untouched by this lane (still exactly
  the orchestrator's SFR application; `git status` unchanged).