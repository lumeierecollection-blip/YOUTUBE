# AUDIT-LAYOUT — STAGE 7 LEDGER (Layer + primitives)

Stage: **7 — Layer + primitives** (protocol Part 4 gate row 7)
Date: 2026-08-07
Lane: `audit-layout` — layout, slots, safe zones, the compiler, alignment
Gate: **"Tier 2 stills within ±2 px; zero sibling flex in Stage/Headline/Caption"** (CROSSCHECK-PROTOCOL.md line 385)

---

## 0. Scope, ownership, method

### 0.1 Edit ownership (from `.opencode/agents/audit-layout.md`)

`.opencode/agents/audit-layout.md` is ABSENT from the repo (verified this
stage). Ownership matrix is taken from the Stage-6 ledger §0.1 (same lane,
same grants), which itself cites the agent file:

| Lane | Domain | Owned files (exclusive write) |
|---|---|---|
| `audit-layout` (me) | layout, slots, safe zones, the compiler, alignment | `src/skills/remotion-render/layout/**` **except** `layout/measure.js`; `src/skills/remotion-render/spec/**`; `src/skills/remotion-render/layers/**`; `data/audit/**` |
| `audit-type` | fonts, measurement, caption, crispness | `captions/**`; `layout/measure.js` |

Spec docs (`LAYOUT-SYSTEM.md`, `MOTION-GRAPHICS-MANUAL.md`, `MOTION-BLUEPRINT.md`,
`DETAIL-REFERENCE.md`), `compositions/**`, `styles/**`, `Root.jsx`,
`package.json` = shared territory → **SFRs only**. `spec/fromBeats.js` belongs
to the `audit-encoding` lane (protocol line 78 narrows the general `spec/**`
grant at line 74).

**Stage-7 ownership note (ESCLAY-6-1, carried):** the target-tree primitive
paths (`primitives/Chart.jsx Node.jsx Chip.jsx Rule.jsx Panel.jsx Icon.jsx`,
LAYOUT-SYSTEM §8.1 line 686) are NOT granted by any lane allow-list — `layout/**`,
`spec/**`, `layers/**`, `data/audit/**` only. So the five primitives this stage
needs are authored as drafts under `data/audit/7/primitives-draft/` (my owned
evidence dir) and each production move to
`src/skills/remotion-render/primitives/<Name>.jsx` is filed as a SHARED-FILE
REQUEST (SFR-LAY-7-x), exactly as Stage 6 handled the denied `stage6/` path.
`layers/Layer.jsx` IS inside the allow-list and is the one deliverable module
written in place.

### 0.2 Method

- CROSSCHECK-PROTOCOL.md Part 2, three phases, applied to every claim.
- **npm is blocked** in this environment (PowerShell execution policy rejects
  `npm.ps1`). Every check runs as `node <file>` directly — same workaround as
  Stages 4–6. The verifier sandbox additionally denies bare `node` (only
  `npm run verify*`/`npm test*`/`git diff*`/`git show*`), so the independent
  verdicts are hand-traced where noted; MY OWN runs are the observed counts.
- Machine evidence produced under `data/audit/7/`:
  - `trace-interpolate.mjs` — provenance check: the runtime `interpolate` in
    the installed `remotion@4.0.506` supports `output: "perceptual-scale"`
    (found in `interpolateFunction` → signed-area conversion of scale
    outputs). Grounds Blueprint Rule 1.5 / MANUAL D1.3 as implementable.
  - `primitives-draft/` — the five primitive drafts (A5.1 spec, see §1/§2).
  - `out/` — probe outputs (browser logs, stills) from the Tier 2 harness.
  - The Tier 2 probe entry + composition + runner (built in claim LAY-020).
- Baseline re-runs at stage end: `node src/skills/remotion-render/layout/run-lint.js`
  (38/0), `node src/skills/remotion-render/spec/run-spec.js` (15/0),
  `node --check` on every new module, `node src/skills/remotion-render/verify-compositions.js`
  (browser E2E, no layout regression in the shared renderer).
- Working tree at stage end: `?? src/skills/remotion-render/layers/Layer.jsx`
  (mine, new), `?? data/audit/7/` (mine, evidence). compositions/ untouched.

---

## 1. PHASE 1 — CLAIMS AND GROUNDING (claim cards)

### CLAIM-LAY-019 — `layers/Layer.jsx`: the ONLY positioning component (LAYOUT-SYSTEM §4.2), flex-free, rect-driven, D2/D3 motion

```
ASSERTION   LAYOUT-SYSTEM §4.2 (lines 446-458) + MANUAL D2/D3 + Blueprint
            §1.3/§1.4: layers/Layer.jsx is the only positioning component —
            it applies position:absolute + the compiled rect (R1), applies
            the entrance/exit interpolation inline in the style prop via
            individual CSS transform properties (scale, translate; never a
            composed transform string), and contains ZERO `display: flex`
            (LAY-11 grep → 0 hits in the new layer stack). Timing comes from
            the compiler's resolved rect.from/rect.to (never re-resolves
            atFrame — one resolver, R4). Entrance: D2.2 RISE (translateY
            +24→0 over D.base 9f, opacity 0→1 over D.short 6f), D2.1 POP
            (scale 0→1.15→1.00 over 9f with output:'perceptual-scale',
            opacity 0→1 over 3f), FADE (opacity over D.base), NONE; DRAW/
            GROW/TRACE are primitive-interior patterns (envelope only).
            Exit per role (D3): caption fade+scale 0.97 over 3f, headline
            fade only over D.short 6f, stage elements fade+translateY −12
            over D.short 6f; exits never overshoot (D3.2) and never mirror
            the entrance (D3.3). Every interpolate has easing + both
            extrapolate clamps (Rule 1.5/D1.1); every scale interpolation
            sets output:'perceptual-scale' (D1.3). Zero raw pixel
            coordinates: every position is rect.x/y/w/h (LAY-10); the only
            bare numbers are MANUAL motion constants (24, 12, 1.15, 0.97,
            3f) as named constants, and D tokens imported from
            compositions/beats.js.
SPEC REF    LAYOUT-SYSTEM §4.2 (446-458); MANUAL D2.1-D2.3 (729-772),
            D3 (784-795); Blueprint §1.3 (127-146) + Rule 1.4 (150-151);
            §1.4 easing list (153-163) + Rule 1.5 (164-166); §1.6 (168-170).
SOURCES     [1] remotion.dev/docs/interpolate — interpolate() options:
            easing (default linear must be overridden), extrapolateLeft/
            extrapolateRight ('clamp' stops values growing past the input
            range), output ('perceptual-scale' corrects perceived scale
            change). First-party.
            [2] remotion.dev/docs/markup (inline style + individual CSS
            transform properties scale/translate/rotate over composed
            transform strings, keeping values legible/Studio-editable).
            First-party.
            [3] m3.material.io/styles/motion/duration-easing — Material
            duration slots 150-200ms small / up to 400ms large; departures
            may be shorter, objects leaving the screen need less attention
            (the ground for Rule 1.4 exits-one-token-faster). Third-party
            design system, independent of [1]/[2].
RE-VERIFIED YES — live source checked this stage:
            (a) installed remotion@4.0.506 interpolateFunction supports
            output:'perceptual-scale' (trace-interpolate.mjs); (b)
            compositions/beats.js:16-24 D = {micro:4, short:6, base:9,
            large:12, complex:15, push:60, hold:45}; beats.js:127
            EASE_DECELERATE = bezierEasing(0.16,1,0.3,1); (c)
            compositions/motion-graphics.jsx:40-43 E_OUT/E_SETTLE/E_IN/E_PUSH
            exist (E_SETTLE = bezier(0.33,1,0.68,1)); :64-79 ease()/easeScale()
            clamp + perceptual-scale; :82-103 popStyle/riseStyle/
            stageExitStyle match D2/D3 numbers (POP 0→1.15→1 over [0,5,9],
            opacity [0,3]; RISE +24 over D.base, opacity D.short; stage exit
            fade + translateY −12 over D.short, E_IN); :426-427 caption exit
            fade+0.97 scale over 3f.
CURRENT     `src/skills/remotion-render/layers/` does not exist (LAYOUT-SYSTEM
            §8.1 line 683 targets layers/Layer.jsx). The same motion lives
            inline in compositions/motion-graphics.jsx (Part 7 D1 delete
            list item: motion-graphics.jsx CaptionLayer/HeadlineBox/
            ListRunScene = emergent flex to be replaced by Layer.jsx rects).
            LAY-10 method (CHECK-REGISTER line 136) greps styles/, beats/,
            compositions/ for raw pixel coordinates; layers/ is a NEW tree
            and this claim keeps it clean by construction (all positions
            from rect; motion constants named + cited).
DELTA       The positioning component required by §4.2/§8.1 does not exist.
            Composed-transform + flex-based positioning live in
            motion-graphics.jsx (Part 7 D1). This claim replaces them with
            one rect-driven, flex-free, individual-transform component.
PLAN        Create `src/skills/remotion-render/layers/Layer.jsx`:
            <Layer rect enter exit frame?>{children}</Layer> — position:
            absolute + rect; entrance/exit via interpolate in style with
            E_OUT = Easing.bezier(0.16,1,0.3,1), E_SETTLE, E_IN; D tokens
            imported from ../compositions/beats.js; flex-free; zero raw
            pixel coords; document the component contract in the header.
DIFF        (recorded P2.5 before Phase 3)
COUNTER     (recorded Phase 3)
STATUS      PHASE 1 — card written, no edits made yet.
```

---

*(append-only: Phase 2, Phase 3, gate legs, findings, SFRs, escalations,
deliverables are appended as the stage proceeds — nothing below this line is
ever edited in place.)*

---

## 2. PHASE 2 — EDIT, VERIFY, DIFF (claim LAY-019)

### 2.1 The edit

Created `src/skills/remotion-render/layers/Layer.jsx` (207 lines, 9,861 bytes,
git blob `8692d76a5333dc3d104b6e779ded01f05a9905e3` at 2026-08-07):

- `Layer({ rect, enter, exit, frame: frameProp, style, children, ...rest })` —
  the ONE positioning component. `position: absolute; left/top/width/height`
  from the compiled rect only (LAY-10 by construction). `frame` defaults to
  `useCurrentFrame()` (correct when a beat renders as its own composition);
  probes/tests pass it explicitly.
- `entranceStyle(pattern, rel)` — rel = frame − rect.from (never re-resolves
  atFrame; the compiler already asserted the range under R4):
  - RISE (D2.2): translateY +24→0 over D.base, opacity 0→1 over D.short, E_OUT
  - POP (D2.1): scale 0→1.15→1.00 over [0,5,9] with output:
    'perceptual-scale', opacity 0→1 over 3f, E_OUT — two-segment curve taken
    verbatim from the live renderer (mg.jsx:85, single E_OUT there); the
    manual's "[E.out, E.settle]" cell is reconciliation finding 3.
  - NONE: opacity 1. Default (FADE/DRAW/GROW/TRACE): opacity envelope over
    D.base — interior motion is the primitive's.
- `exitStyle(rect, frame)` — by role, over the exitDur frames ending at `to`
  (inclusive); p goes 0→1 across the window so the layer is exactly invisible
  at `to` (next beat at `to+1`); E_IN, never overshoots (D3.2), never mirrors
  the entrance (D3.3):
  - rail (`structural && persistent`): no animation (D5 furniture).
  - caption: 3f fade + scale→0.97 (live mg.jsx:426-427).
  - headline/accent: 6f fade only (accent is glued beneath the headline —
    must not detach).
  - everything else (chart, kicker, support, stage): 6f fade + translateY −12.
- Composition: translateY adds numerically `(ent ?? 0) + (ext ?? 0)`; scale
  multiplies `(ent ?? 1) * (ext ?? 1)`; opacity multiplies inside the window
  guard `frame ∈ [from, to]`. Individual CSS transform properties (scale,
  translate, transformOrigin) — never a composed transform string (§4.2).
- Easing: `E_OUT = Easing.bezier(0.16,1,0.3,1)`, `E_IN = Easing.bezier(0.33,0,0.67,1)`
  — exact values from the live renderer (mg.jsx:40,42), not beats.js's
  reimplementations, so Layer's motion is numerically identical to the renderer
  the Tier-2 probe measures against. D tokens imported from beats.js.
- Zero `display: flex` (LAY-11); zero raw pixel positions (LAY-10); the only
  bare numbers are named motion constants (RISE_OFFSET 24, STAGE_EXIT_OFFSET
  12, POP_PEAK 1.15, POP_PEAK_FRAME 5, POP_OPACITY_FRAMES 3,
  CAPTION_EXIT_SCALE 0.97, CAPTION_EXIT_FRAMES 3, EXIT_DUR = D.short).

Authoring history (fixes made before the card closed):
1. translate string-composition shadowing: a settled RISE produced a truthy
   `0px 0px` string that shadowed the live stage exit −12 → replaced with
   numeric translateY composition.
2. exit `rel` inverted (faded in at the window start instead of out) → rewrote
   to the p 0→1 convention matching live `stageExitStyle`.
3. `E_SETTLE` defined but unused → removed (P2.3 minimality; POP uses the
   live single-E_OUT curve per finding 3).
4. `EASE_DECELERATE` (beats.js reimplementation) swapped for Remotion's own
   `Easing.bezier(0.16,1,0.3,1)` — same values, same numeric implementation
   as the live renderer (mg.jsx:40), which is the source the probe compares
   against.

### 2.2 Role-routing verification (spec ↔ code, no assumption)

The exit switch keys off `rect.role` strings. Re-verified against the actual
compiler emission (not the spec text):
- compile.js `textRect` emits role from `layer.role` and sets
  `persistent: PERSISTENT_ROLES.includes(role)` — TEXT_ROLES =
  [kicker, headline, caption, support] (compile-lint.js:23). Caption/kicker
  get `persistent: true` but are NOT in STRUCTURAL_ROLES (compile-lint.js:37 =
  [rail, accent]), so the furniture exemption (`structural && persistent`)
  hits ONLY the rail. Caption takes the 3f exit; kicker takes the default
  stage exit — both as D3 intends.
- compile.js accent emission (lines 309-321): `structural: true,
  persistent: false` → skips furniture, takes the headline fade branch —
  the glued-accent rule works.
- compile.js rail emission (lines 272-285): `structural: true,
  persistent: true` → furniture, held at full opacity (D5).
- Roles that reach the default branch: chart (compile.js:223), kicker,
  support — all get fade + translateY −12 as stage elements.

### 2.3 Static verification (machine evidence)

```
JSX PARSE OK                                     esbuild.transformSync jsx=automatic
LAY-11 flex hits (whole file incl. comments)     0      grep /display:\s*["']flex/   (register pattern)
LAY-11 flex hits (code only)                     0      comments stripped first
raw translate template-literal in style          1      THE final composed CSS string at line 212
                                                     (0px ${translateY}px) — the end of the numeric
                                                     pipeline, not a composition bug
translateY occurrences                           15     all numeric, summed in the component body
ease( calls                                      6      every one passes an easing + both clamps
```
Scratch checker: `data/audit/7/check-layer.mjs` (deletable).

Two-digit+ literal inventory (only motion/curve constants + doc citations):
24 12 15 1.15 0.97 3 6 9 5 — plus prose line numbers (10, 11, 426, 427, 99,
104, 40, 42, 33, 67, 963…). No pixel positions outside rect fields.

### 2.4 Baseline regression

```
node layout/run-lint.js   38 passed, 0 failed   (unchanged)
node spec/run-spec.js     15 passed, 0 failed   (unchanged)
```
compositions/, styles/, spec/ untouched — the new module imports
compositions/beats.js (read-only, SFR territory) and nothing else changed.

### 2.5 DIFF (P2.5)

- New file: `src/skills/remotion-render/layers/Layer.jsx`
  git blob `8692d76a5333dc3d104b6e779ded01f05a9905e3` (207 lines)
- Untracked working tree: `?? data/audit/7/` (evidence), `?? src/skills/
  remotion-render/layers/` (the module). Nothing else.
- No deletions, no modifications to existing files.

> **Erratum (2026-08-07, after Phase 3):** the "207 lines" count above came
> from `Measure-Object -Line` over the piped file and is wrong (PowerShell
> piped line counts drop trailing/blank handling inconsistently). Authoritative
> counts: 223 content lines / 224 with trailing newline (verified by the
> counter-check read + `split("\n")`), 9,861 bytes. Superseded by the hardened
> blob §3.2.

→ Phase 3 (independent counter-check) appended below.

---

## 3. PHASE 3 — INDEPENDENT COUNTER-CHECK (claim LAY-019)

### 3.1 Verdict — CONFIRM (verify-independent, task ses_02400c62affeOFnTrBpU4iDC4x)

All seven claimed properties and checks A–H passed on substance against
first-party sources. The counter-check flagged six risk notes; disposition:

| # | Risk note | Disposition |
|---|---|---|
| 1 | **Installed remotion is 4.0.505, not 4.0.506** — the claim/ledger version is factually wrong (node_modules/remotion/package.json:6, package-lock.json:4101). perceptual-scale support itself confirmed true in the installed dist (L2878 `if (output === "perceptual-scale")`, L3128-3131). | **CONFIRMED ERROR.** Erratum: installed `remotion@4.0.505` (lockfile-resolved from `^4.0.503`). All prior "4.0.506" references in §0.2/§1 of this ledger are superseded. Re-verified this stage via erratum-check.mjs: node_modules 4.0.505, package-lock node_modules/remotion 4.0.505, dist mentions "perceptual-scale" 4×. The D1.3 capability claim stands on the true version. |
| 2 | Ledger blob dead / size mismatch: `git show 8692d76a…` fails (file untracked, never staged); §2.1 "207 lines" vs 223 on disk; §2.5 recorded the pre-hardening hash. | **CONFIRMED.** `git hash-object` computes the blob hash of working-tree content without adding an object — `git show` on an unstaged hash always fails; it was used as a content fingerprint only. Corrected in §3.2 with the hardened hash. |
| 3 | **Furniture exemption was exit-side only** — entranceStyle still animates a rail carrying a non-NONE pattern; the "held at full opacity" guarantee was spec-side luck (schema.js:66 + compile.js from:0/to:dur), not enforced by Layer. | **ACTED.** Hardened: call-site guard `isFurniture = structural && persistent` skips BOTH entrance and exit (see §3.2). |
| 4 | "ONLY positioning component" is target-tree-scoped — legacy motion-graphics.jsx still positions/flexes (scheduled for deletion, LAYOUT-SYSTEM Part 7 D1). | **ACCEPTED, disclosed.** The claim's CURRENT section already states this (Part 7 D1 delete list). No change. |
| 5 | POP easing genuinely deviates from the manual (single E_OUT vs `[E.out, E.settle]` cell). Disclosed as "finding 3" but the ledger has no enumerated findings list. | **ACCEPTED, disclosed.** Findings list enumerated in §4 below; finding 3 keeps the live-renderer-verbatim stance with manual amendment pending. |
| 6 | Comment self-reference: the header literally contained the text `display: flex` inside the "no display:flex" comment — harmless under the register pattern (quoted form required) but a naive future grep would false-positive. | **ACTED.** Comment reworded to avoid the literal adjacency (see §3.2). |

### 3.2 Hardening edits applied post-verdict (blob changed → re-verified, same gates)

The verdict was CONFIRM; two risk notes (3, 6) were acted on, so the blob
changed after the counter-check. Both edits were re-run through the same
static gates (JSX parse, LAY-11 grep, check-layer.mjs):

1. **Call-site furniture guard** — `isFurniture = rect.structural === true &&
   rect.persistent === true`; when true, `entranceStyle` AND `exitStyle` are
   skipped (`ent = {}`, `ext = {}`). Removed the now-dead internal check from
   `exitStyle` (it can no longer receive furniture). The rail is now
   animation-free by construction, not by spec luck (D5).
2. **Comment hygiene** — header line 13 no longer contains the literal
   `display: flex` adjacency (now "no flexbox anywhere"), so even a naive
   unquoted grep cannot false-positive on the layers tree.

New blob after hardening (P2.5 superseded):
```
file        src/skills/remotion-render/layers/Layer.jsx
git blob    a1ad22441543d39cb5568c6c59d2135148076c37
lines       227 content (228 incl. trailing newline)
non-empty   212
bytes       10,250
JSX PARSE   OK   (esbuild jsx=automatic)
LAY-11 hits 0 (whole file) / 0 (code only)
translate template-literal in style: 1 (the final composed CSS string, line 212 → now ~220)
ease( calls: 6 — every one easing + both clamps
baselines   lint 38/0, spec 15/0 (unchanged; re-ran before this append)
tree        ?? data/audit/7/  ?? src/skills/remotion-render/layers/
```

Delta rationale (P1.2): the live renderer draws the rail once as static
furniture (ListRunScene); Layer now matches that behavior regardless of what
pattern a spec carries, making the header contract true in code. No other
behavior changed. The counter-check's CONFIRM verdict stands for the claimed
properties; the delta was hand-traced against the same sources (the verifier
sandbox denies bare `node`, so the delta gates are mine — noted per §0.2).

→ Stage deliverables (primitives drafts, Tier 2 probe, SFRs) appended below.

---

## 4. FINDINGS (spec-doc vs live-source reconciliation — P1.2 protocol)

Numbered to match the citations in layers/Layer.jsx ("finding 3" in the header).

| # | Where | What happened | Stage disposition |
|---|---|---|---|
| 1 | translate composition (Layer.jsx authoring, v1) | A settled RISE produced a truthy `0px 0px` translate STRING that shadowed the live stage exit −12; the layer would freeze instead of exiting. | FIXED in authoring before the card closed: translateY composes NUMERICALLY `(ent ?? 0) + (ext ?? 0)`; only the final sum becomes a CSS string (§2.1 history item 1). |
| 2 | exit `rel` direction (Layer.jsx authoring, v1) | The first exit formula used the inverse window, fading the layer IN at the window start and out as it approached `to` — wrong direction vs live `stageExitStyle` (mg.jsx:99-104). | FIXED in authoring before the card closed: `p = ease(frame − start, [0, exitDur], [0,1], E_IN)` goes 0 → 1 across `(to − exitDur, to]` so the layer is exactly invisible at `to` (§2.1 history item 2). |
| 3 | POP settle easing — MANUAL D2.1 line 733 cell vs live motion-graphics.jsx:85 | Spec cell says `[E.out, E.settle]` (two easings across the 0→1.15→1.00 keyframes); the live renderer uses a SINGLE `E_OUT` easing across both segments. | Layer implements the LIVE value (single E_OUT) so measured == compiled against the renderer the Tier-2 probe compares to; header comment + claim card disclose the divergence; MANUAL amendment filed in §6 SFRs (amendment request, not a code change). This is the "finding 3" the header cites. |
| 4 | Installed remotion version — this ledger §0.2/§1/§2 claimed 4.0.506 | node_modules + package-lock agree **4.0.505** (lockfile `^4.0.503`); the ledger number was wrong. | Erratum recorded §3.1 row 1; the D1.3 capability (perceptual-scale) was re-verified on the TRUE version and stands. |

---

## 5. STAGE DELIVERABLE — THE FIVE PRIMITIVE DRAFTS (A5.1) + SFR BLOCK

Target paths per LAYOUT-SYSTEM §8.1 line 686 are NOT in this lane's
allow-list (see §0.1 — `primitives/**` is unowned territory). Per the
ESCLAY-6-1 precedent, the five primitives are authored to production quality
as drafts under `data/audit/7/primitives-draft/` (owned evidence dir), and
each production move is a SHARED-FILE REQUEST with an exact target.

### 5.1 What the drafts are (evidence)

| Draft | Spec | Live-source ground | Flex | Pixels |
|---|---|---|---|---|
| `Rule.jsx` | A5.1: 4 px `stroke`, radius 2 (round line-cap) | mg.jsx:690-698 divider `<line strokeWidth=4 strokeLinecap=round>` | 0 | thickness=4 (A5.1); endpoints box-relative (viewBox 0 0 100 100), default full-box span |
| `Chip.jsx` | A5.1: `surface`, 2 px `stroke` border, radius 16, padding 16×24 | mg.jsx:1048-1087 ListRunScene chip (radius 16, surface fill, 2 px stroke border, pad L/R 24, flex row gap 24, centre) | 1 — **leaf-internal only** (§4.1 R1, LAYOUT-SYSTEM.md:422-423: flex permitted INSIDE a single leaf primitive; the register's LAY-11/DEL-08 scope is SIBLING flex in Stage/Headline/Caption positioners) | border=2, radius=16, pad 16×24, gap=24 (all A5.1/live) |
| `Node.jsx` | A5.1: circle r 44, `surface` fill, 3 px `accent` border | mg.jsx:844-868 makeCircle({radius:44}) → 88×88, surface fill, 3 px stroke, accent when bAccent highlight | 0 | radius=44, stroke=3 (A5.1); circle excepted from A5.3 |
| `Panel.jsx` | A5.1: `surface`, radius 24, 32 px padding, no shadow | no live equivalent (removed GlassCard precedent, A5.2) | 0 | radius=24, pad=32 (A5.1); plain block, no flex |
| `Icon.jsx` | A4.2/A4.3/A4.4 + D2.5 TRACE | mg.jsx:304-320 Icon() verbatim; mg.jsx:323-350 TraceIcon (evolvePath 10 f/subpath, stagger D.micro, opacity D.short) | 0 | sizes via strokeAttr (mg-style.js A4.3); ICON_INNER vendored (icons-data.js, read-only import) |

All five: NEVER position themselves (the Layer owns position, §4.2); no
shadows/bevels/glass (A5.2); radius only 8/16/24 or circle-excepted (A5.3);
no brand logos (A4.8). Verified: all 5 `JSX PARSE OK` (esbuild jsx=automatic).

### 5.2 Reconciliation documented in the drafts

- Rule "radius 2" = round line-cap of a 4 px stroke (A5.1's own Rule row),
  NOT an A5.3 box radius — the live renderer's `strokeLinecap="round"`
  (mg.jsx:697). Draft documents this so A5.3 (8/16/24 only) is not read as
  contradicting A5.1's Rule row.
- Node border: A5.1 says "3 px `accent` border"; the live renderer draws
  stroke by default and flips to accent only for the highlight (mg.jsx:855,
  :866). Draft implements the live behavior (`active` prop) and documents the
  manual cell as default-stroke + accent-highlight.

### 5.3 SFR-LAY-7-1 … SFR-LAY-7-5 — production moves (SHARED-FILE REQUESTS)

```
SFR-LAY-7-1  Move data/audit/7/primitives-draft/Rule.jsx
             → src/skills/remotion-render/primitives/Rule.jsx
             Why: Stage-7 deliverable per LAYOUT-SYSTEM §8.1 line 686.
SFR-LAY-7-2  Move data/audit/7/primitives-draft/Chip.jsx
             → src/skills/remotion-render/primitives/Chip.jsx
             Why: A5.1 chip (ListRunScene replacement).
SFR-LAY-7-3  Move data/audit/7/primitives-draft/Node.jsx
             → src/skills/remotion-render/primitives/Node.jsx
             Why: A5.1 node (RelationScene replacement).
SFR-LAY-7-4  Move data/audit/7/primitives-draft/Panel.jsx
             → src/skills/remotion-render/primitives/Panel.jsx
             Why: A5.1 panel.
SFR-LAY-7-5  Move data/audit/7/primitives-draft/Icon.jsx
             → src/skills/remotion-render/primitives/Icon.jsx
             Why: A4 icons + D2.5 TRACE interior motion.
SFR-LAY-7-6  MANUAL amendment request (shared doc, audit-motion lane):
             D2.1 line 733 POP easing cell "[E.out, E.settle]" → single
             "E.out" per the live renderer (finding 3). Code already
             implements the live value; the doc update closes the gap.
SFR-LAY-7-7  MANUAL amendment request: A5.1 Node border cell "3 px accent
             border" → "3 px stroke border; accent when highlighted"
             per the live renderer (mg.jsx:855/866).
```
Each SFR needs an owner grant before the move; drafts remain in
`data/audit/7/primitives-draft/` until then.

→ Tier 2 probe (claim LAY-020) appended below.

---

## 6. TIER 2 PROBE (claim LAY-020) — proof in the real render engine

### CLAIM-LAY-020 — Compiled rects land within ±2 px in the real engine (LAY-12); zero safe-zone crossings; zero sibling flex; D2/D3 branches fire per contract

```
ASSERTION   The Stage-7 stack (layout/compile.js → layers/Layer.jsx → five
            primitive drafts) renders a full Stage shot in the real Remotion
            browser engine such that:
            (G1) every measured rect == compiled rect within ±2 px at settled
                 frames 30/45 (LAY-12, LAYOUT-SYSTEM §5.5, CHECK-REGISTER
                 line 139);
            (G2) every rect stays fully inside SAFE_SHORTS (±2 px tolerance);
            (G3) no Layer div is flex AND no Layer div's parent is flex — the
                 only flex in the whole shot is Chip.jsx's leaf-internal row
                 (§4.1 R1 exception, LAYOUT-SYSTEM.md:422-423), which lives
                 INSIDE the leaf, never at Layer/sibling level.
            Motion: at frame 3 the entrance branch is in flight (op < 1 on
            entering layers; chart mid-POP with scale ≈ 1.143 at rel 3) and
            the furniture rail holds op = 1; at frame 86 (two frames past
            to = 84) the FADE-exit layers (chart/headline/support/accent) are
            gone at op = 0 while the NONE-exit trio (kicker/caption/rail) is
            held at op = 1 — the contract fixed in §7.1 below.
SPEC REF    LAYOUT-SYSTEM §4.1 R1 (422-423), §4.2 (446-458), §5.5 (524-538);
            CHECK-REGISTER LAY-12 (139); MANUAL D2.1-D2.3 + D3;
            CROSSCHECK-PROTOCOL.md line 385 (Tier 2 gate wording).
SOURCES     [1] remotion.dev/docs/render-as-still — renderStill renders one
            frame in the real browser engine (the same engine as production
            renders), so measured DOM geometry is comparable to compiled px
            at the composition native scale.
            [2] remotion.dev/docs/layout-utils/best-practices — layout
            utilities run in a browser; DOM rects must be divided by the
            container scale.
            [3] Stage-4 CLAIM-LAY-011 + Stage-5 CLAIM-LAY-015 — the ±2 px
            tolerance and ÷scale convention, re-established on the installed
            4.0.505.
RE-VERIFIED YES — this claim IS the Tier 2 gate: the probe ran end-to-end in
            the installed engine this stage (machine evidence below).
CURRENT     No Tier-2 composition existed before this section; Layer.jsx was
            verified statically by claim LAY-019 but never rendered.
DELTA       The probe harness itself (tier2-probe.mjs + generated entry) —
            evidence only, no production change. The NONE-exit contract was
            fixed in Layer.jsx (§7.1) BEFORE the probe ran, so the probe
            asserts the fixed behaviour.
PLAN        author probe → run in engine → assert → log → counter-check.
DIFF        none to production files; untracked evidence under data/audit/7/.
COUNTER     (recorded Phase 3 below)
STATUS      PHASE 2 — probe executed, ALL GATES PASS.
```

### 6.1 Machine evidence (raw)

- Runner: `data/audit/7/tier2-probe.mjs` — compiles the probe shot with the
  real `compile()` (7 rects), stages the five drafts to
  `data/audit/7/probe-prims/` (rewriting Icon.jsx's three production
  specifiers to absolute repo paths — staging-path artifact), bundles a
  generated entry (`data/audit/7/_tier2-entry.jsx`, 5,413 bytes) with
  remotion 4.0.505 + @remotion/shapes, opens headless Chrome (swangle/
  unsafe-swiftshader, retry+watchdog) and calls renderStill at frames
  30 / 45 / 3 / 86, then parses onBrowserLog into assertions.
- The entry mounts `<Layer>` per rect inside one `#probe-root` div and logs,
  per layer: bounding rect (x, y, w, h), safe-rect distance, flex flags of
  self+parent, and computed opacity. Geometry is measured RELATIVE to
  #probe-root and divided by the measured scale (finding 5 below).
- Raw browser logs preserved: `data/audit/7/out/tier2-f30.log`,
  `tier2-f45.log`, `tier2-f3.log`, `tier2-f86.log` (32 lines each).
- Probe stills at 1080×1920 in `data/audit/7/out/` (f30/f45/f3/f86).

Assertion output (verbatim tail):

```
PASS [f30] LAY-12 GEOMETRY ±2px worst |d| = 0.00px over 7 layers
  kicker    measured (48,288) 400x72  compiled (48,288) 400x72  d=(0,0,0,0)
  chart     measured (88,432) 760x464  compiled (88,432) 760x464  d=(0,0,0,0)
  headline  measured (48,964) 760x96  compiled (48,964) 760x96  d=(0,0,0,0)
  caption   measured (148,1176) 640x72  compiled (148,1176) 640x72  d=(0,0,0,0)
  rail      measured (48,288) 4x960  compiled (48,288) 4x960  d=(0,0,0,0)
  support   measured (48,908) 304x32  compiled (48,908) 304x32  d=(0,0,0,0)
  accent    measured (48,1060) 760x4  compiled (48,1060) 760x4  d=(0,0,0,0)
PASS [f30] SAFE-ZONE CROSSINGS ≤2px worst crossing = 0.00px
PASS [f30] ZERO SIBLING FLEX no Layer div is flex;
PASS [f30] ROOT SCALE ≈ 1 scale=1.0000
PASS [f45] LAY-12 GEOMETRY ±2px worst |d| = 0.00px over 7 layers   (all d=0)
PASS [f45] SAFE-ZONE CROSSINGS ≤2px worst crossing = 0.00px
PASS [f45] ZERO SIBLING FLEX
PASS [f45] ROOT SCALE ≈ 1 scale=1.0000
PASS [f3] ENTRANCE BRANCH FIRES (op<1) in-flight at rel=3: kicker, headline,
          caption, accent  full: {"kicker":0.972,"chart":1,"headline":0.972,
          "caption":0.972,"rail":1,"support":1,"accent":0.903}
PASS [f3] FURNITURE RAIL HOLDS op=1 rail opacity=1
PASS [f86] EXIT BRANCH FIRES (NONE held / FADE gone) gone at to=84: chart,
          headline, support, accent  held (NONE/furniture): kicker, caption,
          rail
===== PROBE RESULT: ALL GATES PASS
```

Cross-check inside the raw logs: f3 shows chart mid-POP — measured
33.64,398.81 868.72×530.38 vs compiled 88,432 760×464 (scale 1.143 toward the
1.15 peak at rel 5, translateX −54.36, translateY −33.19) with opacity 1.000
(POP opacity completes over 3f) — exactly the live mg.jsx:85 curve. f86 shows
the FADE layers at translateY −12 (stage exit, E_IN) and op 0.000; the rail
at 48,288 4×960 op 1.000 with zero transform (furniture, §3.2 item 1).

### 6.2 Finding 5 — headless renderer document offset (measurement basis)

The first probe run failed G1/G2 with every y off by EXACTLY −999999 px. The
ROOT log explains it: the headless renderer places the composition root at
document `doctop=-999999.0 docleft=0.0` (an internal off-screen anchor — the
still is captured by CDP clip of the element, not the viewport).
Viewport-relative getBoundingClientRect is therefore meaningless; the entry
now normalizes every layer rect against #probe-root's own rect and divides by
the measured scale (root scale = 1.000000 at native renderStill resolution, so
the LAY-12 ÷scale step is exercised trivially here and does real work in
scaled renders). Same root-relative precedent as the Stage-2 relative-width
probe.

### 6.3 Post-append baseline re-run (stage end)

```
node layout/run-lint.js     38 passed, 0 failed
node spec/run-spec.js       15 passed, 0 failed
esbuild JSX parse           6/6 OK (Layer.jsx + 5 drafts)
Layer.jsx blob              4fcebc954dea08ca7ebcbc8357f3a9f408996bd7
                            (245 lines, 11,143 bytes, 6 ease() clamped)
```

---

## 7. PHASE 3 — INDEPENDENT COUNTER-CHECK (claim LAY-020)

### 7.1 NONE-exit fix in Layer.jsx (edit record — appended here, post-hardening)

While authoring the probe, the probe spec was aligned to the production
contract (caption enter RISE / exit NONE) and Layer's exit code was traced:
`exitStyle(rect, exit, frame)` never READ `exit` — it faded every non-
furniture layer over the last 6 frames before `rect.to`, so a NONE layer
(`to = dur` via schema.js:65) silently faded at 84–90, contradicting the
documented contract. Fixed:

- `isNone(p)` helper (schema.js:65 + compile-lint parity);
- `exitStyle` returns `{}` when `isNone(exit && exit.pattern)` — held at full
  opacity through `to`;
- call site passes `rect, exit, frame`; header documents the NONE case with
  citations (LAYOUT-SYSTEM.md:239, build-shots.mjs:154/156/163, schema.js:65,
  mg.jsx:192-193).

This is a PHASE-2 edit to the same claim LAY-019 deliverable, so it was
re-verified through the same static gates before the probe ran: JSX parse
OK, LAY-11 0 hits, check-layer.mjs clean. The probe then ASSERTED the fixed
behaviour (f86 NONE-holds) and passed.

→ counter-check verdict appended below.

---

### 7.2 First counter-check — REJECT (verify-independent, task ses_023df9c51ffe8paLJeD8kgVcPk)

The independent counter-check REJECTED the claim as first submitted. Its
finding was correct and landed on a probe defect, not a Layer defect:

> The frame-86 evidence is irreproducible from and contradictory to the very
> component the claim names as under test… The log matches instead a version
> of exitStyle with no headline/accent branch.

Diagnosis (mine, after the verdict): the probe's `rectsEmbed` dropped the
`role` field from the rect it passed to `<Layer>` (tier2-probe.mjs built
`rect: { x,y,w,h,from,to,structural,persistent }`). compile.js DOES emit
`role` inside every rect (compile.js:169 textRect, :223 chart, :275 rail,
:310 accent), and Layer's D3 exit routing keys off `rect.role`
(Layer.jsx:165-192). With `role` undefined, every FADE layer fell into the
default stage-exit branch (fade + translateY −12) — so the headline/accent
fade-only branch and the caption 3f branch were NEVER exercised in-engine.
The raw logs were honest output of the code; the probe fed the component a
rect shape production never produces.

Other counter-check notes, disposition:

| # | Note | Disposition |
|---|---|---|
| 1 | My dispatch prompt wrongly parenthetical'd SAFE bounds as 240/1680 — not in the repo. True bounds top 288/bottom 1248 (slots.js:16; LAYOUT-SYSTEM.md:42). Probe uses the true bounds. | No repo change; probe verified against the correct SAFE_SHORTS. |
| 2 | Stage-end Layer.jsx blob `4fcebc95…` not in the git object store (unstaged content fingerprint). | Known, ledger erratum §3.1 row 2 — fingerprints only, `git hash-object` does not add objects. |
| 3 | Probe feeds fixed MEASURE_W widths — G1 proves Layer renders compile's rects ±0px; it does NOT prove compile's rects match real browser text measurement. | ACCEPTED, disclosed — scope note now in the claim card: this probe gates LAYER placement (the D2/D3 + positioning deliverable). Compile-side measure accuracy is the compiler/font claims' territory (Stage 6 compile claims + Stage 5 font probes), fed deterministically here per R3 inputs. |

REJECT → the protocol re-entry: fix the probe, re-run, re-submit.

### 7.3 Probe fix (Phase 2 re-entry, claim LAY-020) + corrected re-run

1. **Embed `role` in the rect** exactly as compile() emits it —
   `rect: { role, x, y, w, h, from, to, structural, persistent }`
   (comment cites compile.js:169,223,275,310).
2. **Strengthen the f86 gate to assert WHICH branch fires** (the reject
   point): EXIT ROLE ROUTING checks dy per role — headline/accent fade-only
   (dy = 0), chart/support stage exit (dy = −12).
3. **Add a branch-coverage layer `caption-test`** (entry-level, NOT
   compiled): production captions are exit NONE (build-shots.mjs:163), so
   the D3 caption 3f branch (fade + scale → 0.97, Layer.jsx:177-184) is
   dormant in compiled output. `rect.role = "caption"`, to = 84 → 3f window
   (81,84]; at f86 the assertion checks measured width = 0.97 × 640
   (±2%). The probe now exercises every exit branch in-engine.

Corrected re-run (frames 30/45/3/86, same engine, raw logs in
`data/audit/7/out/` — 36 lines per frame, 8 layers):

```
PASS [f30] LAY-12 GEOMETRY ±2px worst |d| = 0.00px over 8 layers   (all d=0)
PASS [f30] SAFE-ZONE CROSSINGS ≤2px worst crossing = 0.00px
PASS [f30] ZERO SIBLING FLEX   |   PASS [f30] ROOT SCALE ≈ 1 scale=1.0000
PASS [f45] LAY-12 GEOMETRY ±2px worst |d| = 0.00px over 8 layers   (all d=0)
PASS [f45] SAFE-ZONE CROSSINGS ≤2px worst crossing = 0.00px
PASS [f45] ZERO SIBLING FLEX   |   PASS [f45] ROOT SCALE ≈ 1 scale=1.0000
PASS [f3] ENTRANCE BRANCH FIRES (op<1) kicker/headline/caption/accent in
         flight; chart mid-POP measured 33.64,398.81 868.72x530.38 (scale
         1.143 toward 1.15 peak at rel 5); rail op=1
PASS [f3] FURNITURE RAIL HOLDS op=1
PASS [f86] EXIT BRANCH FIRES (NONE held / FADE gone) gone at to=84: chart,
          headline, support, accent, caption-test  held: kicker, caption, rail
PASS [f86] EXIT ROLE ROUTING (headline/accent fade-only, stage −12, caption
          scale 0.97) dy: headline=0, accent=0, chart=-12, support=-12;
          caption-test measured scale=0.970 (expect 0.97)
===== PROBE RESULT: ALL GATES PASS
```

The headline/accent dy = 0 line is the exact property the reject cited as
unreproducible — now reproduced in-engine (fade-only, no translate; the −12
stage-exit branch fires only for chart/support). caption-test measured
0.970 proves the D3 caption 3f branch (centered scale — dx +9.60, dy +1.06
match (640−620.80)/2, (72−69.88)/2).

**Scope note (counter-check note 3, adopted):** the probe feeds deterministic
MEASURE_W widths so every compile R3 input is satisfied; it gates LAYER
placement + D2/D3 branches. compile's own measurement fidelity is covered by
the Stage-6 compiler claims and Stage-5 font probes, not by this probe.

→ re-submitted to the counter-check (verdict appended below).

---

### 7.4 Second counter-check — CONFIRM (verify-independent, task ses_023d29604ffe8zYmCb1RLdOiOZ)

Re-submission verdict: **CONFIRM**. The counter-check re-traced every gate
against the on-disk sources and the corrected raw logs, reached six
first-party sources independently (Layer.jsx, MANUAL D3 table, the live
motion-graphics.jsx, installed remotion 4.0.505 interpolate.js
perceptual-scale implementation, compile.js role emission at :169/:223/:275/
:310, slots.js:16 SAFE_SHORTS), and confirmed:

- G1/G2/G3 at f30/f45 from the raw logs (all 8 layers d = 0.00, SAFE = 0.00
  with hand-recomputed crossings, FLEX self=0/parent=0).
- f3 entrance branch (0.972/0.903 opacities hand-verified to <0.005; chart
  mid-POP 868.72/760 = 1.1430 against its own perceptual-scale trace:
  E_OUT(0.6)≈0.988 → area 0.988·1.15² = 1.3066 → √1.3066 ≈ 1.1431).
- f86 EXIT ROLE ROUTING: "headline/accent dy=0.00 with chart/support
  dy=−12.00, exactly what the on-disk Layer.jsx exitStyle produces once
  rect.role reaches the component" — the first pass's reject point resolved;
  caption-test 620.80/640 = 0.9700 (centered: dx +9.60, dy +1.06).
- Fix chain of custody (rectsEmbed role → entry → Layer routing) and the
  assertion math (TOL=2, safe ≤2, |dy|≤2 fade-only, |dy+12|≤2 stage,
  |ratio−0.97|≤0.02).

Minor non-failing errata from the verifier, recorded:

1. caption-test measured h = 69.88 vs exact 0.97×72 = 69.84 — a 0.04 px
   (0.06%) subpixel deviation of Chrome's CSS `scale`; 69.88/72 = 0.9706.
   The gate is the WIDTH ratio (mw/ew, 620.80/640 = 0.9700) — passes. No
   gate impact; do not cite "(0.97 × 72) = 69.88" as exact arithmetic.
2. Wording: the claim asserts the width ratio; it does not assert the height
   ratio (which happens to pass anyway). Ledger wording aligned to width-only
   in §7.3 ("measured width = 0.97 × 640").
3. RISE translateY at f3: measured dy = 2.31 vs hand-traced ≈2.34 — sub-pixel
   bezier-trace error, not a gated value.

**Stage disposition — Stage 7 complete:**
- CLAIM-LAY-019 (Layer.jsx contract): CONFIRM + hardening (verdict stands).
- CLAIM-LAY-020 (Tier 2 gate): REJECT → probe fixed (role embedding +
  routing gate + caption-test coverage) → re-run ALL GATES PASS → CONFIRM.
- Final baselines below.

### 7.5 Final stage-end baselines

```
node layout/run-lint.js     38 passed, 0 failed
node spec/run-spec.js       15 passed, 0 failed
esbuild JSX parse           6/6 OK (Layer.jsx + 5 primitive drafts)
Layer.jsx                   blob 4fcebc954dea08ca7ebcbc8357f3a9f408996bd7
                            (245 lines, 11,143 bytes, 6 ease() clamped,
                             LAY-11 0 hits)
Tier 2 probe                ALL GATES PASS (frames 30/45/3/86, 8 layers,
                            logs + stills under data/audit/7/out/)
Working tree                ?? src/skills/remotion-render/layers/Layer.jsx
                            ?? data/audit/7/   (evidence; drafts await SFRs)
```

**Open items for other lanes (SFRs, unchanged):** SFR-LAY-7-1…7-5 (move the
five primitive drafts into `primitives/`), SFR-LAY-7-6 (MANUAL D2.1 POP
easing cell → single E_OUT), SFR-LAY-7-7 (MANUAL A5.1 Node border cell).
Drafts remain in `data/audit/7/primitives-draft/` until owners grant the
moves.

---
