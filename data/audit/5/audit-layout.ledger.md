# AUDIT-LAYOUT — STAGE 5 LEDGER (Measurement)

Stage: **5 — Measurement** (protocol Part 4 gate row 5)
Date: 2026-08-07
Lane: `audit-layout` — layout, slots, safe zones, the compiler, alignment
Parallel lane: `audit-type` — fonts, measurement, caption, crispness
Gate: **`measureText` throws on unloaded font; measure and render share one `fontStyle` object**

---

## 0. Scope, ownership, method

### 0.1 Edit ownership (from `.opencode/agents/audit-layout.md`)

| Lane | Domain | Owned files (exclusive write) |
|---|---|---|
| `audit-layout` (me) | slots, safe zones, the compiler, alignment | `layout/**` **except** `layout/measure.js`; `spec/**`; `layers/**`; `data/audit/**` |
| `audit-type` | fonts, measurement, caption, crispness | `captions/**`; `layout/measure.js` |

Spec docs (`LAYOUT-SYSTEM.md`, `MOTION-GRAPHICS-MANUAL.md`, `MOTION-BLUEPRINT.md`, `DETAIL-REFERENCE.md`), `compositions/**`, `styles/**`, `Root.jsx`, `package.json` = shared territory → **SFRs only**.

### 0.2 Method

- CROSSCHECK-PROTOCOL.md Part 2, three phases, applied to every claim.
- **npm is blocked** in this environment (PowerShell execution policy rejects `npm.ps1`). Every check ran as `node <file>` directly — same workaround as Stage 4.
- Machine evidence produced under `data/audit/5/`:
  - `probe-font-gate.html` + `probe-font-gate.out.html` — **end-to-end browser probe** (headless Chrome `--dump-dom`) that loads the *actual installed* `@remotion/layout-utils@4.0.506` CJS source unmodified (CommonJS shim) and exercises the font gate in 5 cases.
  - `probe-node-browser-only.cjs` — Node probe: what the measurement functions do outside a browser.
  - `probe-renderer-state.cjs` — static scan of `src/skills/remotion-render/**` computing the CURRENT state of both gate legs (call sites, `validateFontIsLoaded` usage, shared `fontStyle` usage).
- Baseline re-run at stage end: `node layout/run-lint.js` → **12 passed, 0 failed**; `node spec/run-spec.js` → **15 passed, 0 failed**. Working tree: clean at `b6f33ef` plus untracked `data/audit/5/` (mine, evidence) and `src/skills/remotion-render/layout/measure.js` (**audit-type's parallel deliverable**, appeared mid-stage; verified by reading, not edited).

---

## 1. PHASE 1 — CLAIMS AND GROUNDING (claim cards)

### CLAIM-LAY-012 — Rule 5.1 font gate: `measureText` throws on an unloaded font

```
ASSERTION   With validateFontIsLoaded: true, measureText() in @remotion/
            layout-utils@4.0.506 throws when the requested font family is not
            loaded, instead of silently returning fallback metrics; the option
            is OFF by default in the 4.0.x line (ON in 5.0).
SPEC REF    LAYOUT-SYSTEM §5.1 (lines 476-486), §8.4 build-order step 3;
            protocol Part 4 gate row 5 ("measureText throws on unloaded font").
SOURCES     [1] first-party remotion.dev/docs/layout-utils/measure-text —
            "validateFontIsLoaded (AvailableFrom v4.0.136) ... takes a second
            measurement with the fallback font and if it produces the same
            measurements, it assumes the fallback font was used and will throw
            an error." Also "Only works in the browser, not in Node.js or Bun."
            [2] first-party remotion.dev/docs/layout-utils/best-practices —
            "Use the validateFontIsLoaded option ... applies to measureText(),
            fitText(), fillTextBox(), and fitTextOnNLines() ... Starting with
            Remotion 5.0, validateFontIsLoaded defaults to true" (=> 4.0.x
            default false).
            [3] first-party github.com/remotion-dev/skills →
            skills/remotion-best-practices/remotion-markup/measuring-text.md —
            "Use validateFontIsLoaded: Catch font loading issues early:
            measureText({ ..., validateFontIsLoaded: true, // Throws if font
            not loaded })". (Spec cites this file as "remotion-markup/
            measuring-text.md" — path confirmed live at repo tree; shorthand
            citation is accurate.)
            [4] first-party installed source
            node_modules/@remotion/layout-utils/dist/cjs/layouts/measure-text.js
            (4.0.506), lines 50-93: throw iff validateFontIsLoaded &&
            text.trim().length > 0 && sameAsFallbackFont &&
            computedFallback !== computedFontFamily && new Set(text).size > 4.
RE-VERIFIED YES
CURRENT     Machine-computed (browser E2E probe, actual installed 4.0.506):
            caseA  unloaded family "ProbeMissing", gate ON  -> THREW
                   ("Called measureText() with \"fontFamily\": \"ProbeMissing\"
                   but it looks like the font is not loaded ...")
            caseB  unloaded family, gate OFF                -> ok w=275.5 h=47
            caseC  loaded (real vendored Inter-400.woff2), gate ON -> ok
                   w=313.4 h=49  (positive control: throw is NOT unconditional)
            caseD  loaded, gate OFF (baseline)              -> ok w=313.4 h=49
            caseE  "Hi" (2 unique chars), unloaded, gate ON -> ok
                   (installed guard new Set(text).size > 4 suppresses false
                   positives; the public docs do not mention this guard)
            Node probe: measureText/fitTextOnNLines/fillTextBox/fitText ALL
            throw "measureText() can only be called in a browser." in Node.
            Renderer CURRENT: compositions/motion-graphics.jsx:491
            fitTextOnNLines({...}) and :503 measureText({...}) call the RAW
            @remotion/layout-utils — the gate is NOT armed anywhere in the
            renderer. measure.js (audit-type, present from mid-stage) arms it:
            FONT_GATE = {validateFontIsLoaded:true} spread LAST in wrappers
            (measureText/fitText/fitTextOnNLines/fillTextBox.add).
DELTA       Claim itself: none — mechanism verified end-to-end. System side:
            the renderer must call the gated wrappers (or pass the flag) for
            "every measureText() call in this system" to pass the gate.
PLAN        Delete: (renderer raw calls — shared file). Replace with: imports
            of layout/measure.js wrappers. Filed as SFR-LAY-5-1 (below);
            measure.js itself is audit-type's file, not edited here.
DIFF        none (no owned-file change)
COUNTER     n/a — zero Phase-2 changes (Stage-4 precedent). Evidence offered
            to the orchestrator for gate re-check: probe-font-gate.html out.
STATUS      RE-VERIFIED — claim true; mechanism + arming verified.
```

### CLAIM-LAY-013 — Rule 5.2: measure and render share one `fontStyle` object

```
ASSERTION   Remotion's guidance is to define ONE fontStyle object and spread
            it into both measureText() and the element's style, so measurement
            and render use identical font properties.
SPEC REF    LAYOUT-SYSTEM §5.2 (lines 488-492); protocol gate row 5 ("measure
            and render share one fontStyle object").
SOURCES     [1] first-party github.com/remotion-dev/skills →
            skills/remotion-best-practices/remotion-markup/measuring-text.md —
            "Match font properties: Use the same properties for measurement
            and rendering: const fontStyle = { fontFamily, fontSize,
            fontWeight, letterSpacing }; measureText({ text, ...fontStyle });
            <div style={fontStyle}>" (verbatim pattern).
            [2] first-party remotion.dev/docs/layout-utils/best-practices —
            "Match all font properties ... This includes fontFamily, fontSize,
            and fontWeight, letterSpacing and fontVariantNumeric. You could
            make reusable variables that you reference in both the measuring
            function and the actual component."
            [3] third-party deepwiki.com/shreefentsar/remotion-video-toolkit/
            4.2-text-measurement (2026-03-18) — "Pattern 1: Consistent Font
            Properties — Use a shared font style object for both measurement
            and rendering ... shown in rules/measuring-text.md 121-137."
RE-VERIFIED YES
CURRENT     Machine-computed (probe-renderer-state + measure.js read):
            measure.js exports HEADLINE_FONT = {fontWeight:800,
            letterSpacing:"normal"} and fontStyleFor(fontFamily, overrides) =
            {fontFamily, ...overrides}; smoke-import verified all 7 exports;
            fontStyleFor("Inter", HEADLINE_FONT) =
            {fontFamily:"Inter", fontWeight:800, letterSpacing:"normal"} —
            identical to the renderer's inline props today (motion-graphics.jsx
            :512 fontWeight:800, no letterSpacing => normal). RENDERER DOES
            NOT import/use fontStyleFor yet: inline font props duplicated
            (scan totals: fontWeight:800 x10, 700 x4, 400 x5, 900 x2 across
            renderer files); zero occurrences of a shared fontStyle object in
            motion-graphics.jsx.
DELTA       Mechanism exists (measure side). Render side not wired: the
            renderer's HeadlineBox must spread the same fontStyleFor() object
            into the fit/measure calls AND the element style.
PLAN        Delete: inline font-prop literals in the renderer (shared file).
            Replace with: spread of the shared fontStyleFor object. Filed as
            SFR-LAY-5-1.
DIFF        none
COUNTER     n/a — zero Phase-2 changes. Evidence offered to orchestrator.
STATUS      RE-VERIFIED — claim true; mechanism landed; render wiring SFR'd.
```

### CLAIM-LAY-014 — §5.1 caching hazard: an un-gated pre-font measurement is cached wrong for the whole render

```
ASSERTION   measureText() caches by arguments; a measurement taken before the
            font loads is cached wrong for the whole render, and the cache key
            does not include validateFontIsLoaded, so the gate must be armed
            on every call.
SPEC REF    LAYOUT-SYSTEM §5.1 (lines 478-482).
SOURCES     [1] first-party measuring-text.md (remotion-dev/skills) — "Results
            are cached - duplicate calls return the cached result."
            [2] first-party remotion.dev/docs/layout-utils/measure-text —
            "This function has a cache. If there are two duplicate arguments
            inputs, the second one will return the first result without
            repeating the calculation."
            [3] first-party installed source measure-text.js:4 wordCache Map,
            :51 key = text-fontFamily-fontWeight-fontSize-letterSpacing-
            textTransform-additionalStyles (validateFontIsLoaded NOT in key).
RE-VERIFIED YES
CURRENT     The renderer's raw call at motion-graphics.jsx:503 can populate
            the cache un-gated. wait-for-fonts.js resolves before RENDER
            (imported at motion-graphics.jsx:20) with a 10 s race cap and
            font-display: swap — a font that arrives late (or fails) means the
            renderer measures with fallback metrics and caches them for the
            whole render. measure.js's comment (lines 32-36) reasons this
            correctly and its forced gate closes the hole for gated callers.
DELTA       Renderer migration (SFR-LAY-5-1) closes the live hole.
PLAN        Delete: raw renderer calls. Replace with: gated wrappers only.
DIFF        none
STATUS      RE-VERIFIED
```

### CLAIM-LAY-015 — `useCurrentScale()` division for `getBoundingClientRect` (LAY-12)

```
ASSERTION   Remotion scales the video container; DOM measurements from
            getBoundingClientRect() must be divided by useCurrentScale() to
            compare with compiled rects (tolerance ±2 px).
SPEC REF    LAYOUT-SYSTEM §5.5 (lines 524-538); CHECK-REGISTER LAY-12
            ("doc conflict 4.0.111 vs 4.0.125, resolved by 4.0.505 install").
SOURCES     [1] first-party github.com/remotion-dev/skills →
            skills/remotion-best-practices/remotion-markup/measuring-dom-nodes.md
            — "Remotion applies a scale() transform to the video container,
            which affects values from getBoundingClientRect(). Use
            useCurrentScale() ... width: rect.width / scale, height: rect.height / scale."
            [2] first-party remotion.dev/docs/layout-utils/best-practices —
            "Server-side rendering: The layout utilities need to be run in a
            browser" (the ÷scale probe is a browser-time check, per §5.5).
            [3] Stage-4 ledger CLAIM-LAY-011 — RE-VERIFIED with the same
            sources plus the installed 4.0.505+ behaviour.
RE-VERIFIED YES (re-fetched this stage)
CURRENT     probe-renderer-state: 0 occurrences of useCurrentScale /
            getBoundingClientRect / getComputedStyle anywhere in the current
            renderer — expected: the Tier-2 audit composition is a Stage-7
            deliverable (layers/Layer.jsx). No delta this stage.
DELTA       none
PLAN        none (lands Stage 7)
DIFF        none
STATUS      RE-VERIFIED
```

### 1.1 Phase 1 summary

| Claim | Verdict | Machine evidence | Change made |
|---|---|---|---|
| CLAIM-LAY-012 | RE-VERIFIED | browser E2E probe, 5 cases | none (SFR-LAY-5-1) |
| CLAIM-LAY-013 | RE-VERIFIED | renderer scan + measure.js read/smoke | none (SFR-LAY-5-1) |
| CLAIM-LAY-014 | RE-VERIFIED | installed source + renderer scan | none (SFR-LAY-5-1) |
| CLAIM-LAY-015 | RE-VERIFIED | renderer scan | none |

---

## 2. PHASE 2 — CHANGES

None. All four claims verified. The only deltas land in shared files or
audit-type's `measure.js` → routed as SFR-LAY-5-1. P2.2 (one claim, one
change, one commit) had no work.

## 3. PHASE 3 — COUNTER-CHECKS

No `verify-independent` dispatch: the protocol's Phase 3 judges a diff
(P3.3: "does the diff implement the claim?"); this stage made zero owned-file
changes, same as Stage 4. For orchestrator-level re-check, the claim cards,
sources, and probe artifacts are in this ledger. The two gate legs are
additionally machine-verifiable by the orchestrator: re-run the browser probe
(`chrome --headless=new --dump-dom data/audit/5/probe-font-gate.html`) and the
Node probe (`node data/audit/5/probe-node-browser-only.cjs`).

---

## 4. GATE LEG REPORT

**Leg 1 — "measureText throws on unloaded font"**
- MECHANISM: CONFIRMED end-to-end on the installed 4.0.506 (browser probe
  cases A–E above). Docs (measure-text, best-practices) + first-party rule
  (measuring-text.md) agree. Precision notes: (a) gate is opt-in in 4.0.x
  (default false; true only in Remotion 5.0); (b) the throw fires only when
  the fallback and requested measurements are dimensionally identical AND the
  computed families differ AND the text has ≥5 unique characters — short
  texts never throw (false-positive guard, absent from the docs).
- SYSTEM ARMING: landed in `layout/measure.js` (audit-type) — `FONT_GATE`
  spread LAST in all four wrappers so no caller can disable it; cache-key
  reasoning correct (validateFontIsLoaded excluded from the key ⇒ gate must be
  on every call). Verified by full read + ESM smoke import (7 exports).
- REMAINING: renderer still calls the raw package (motion-graphics.jsx:18/491/
  503) → the only un-gated measurement path in the system → SFR-LAY-5-1.

**Leg 2 — "measure and render share one fontStyle object"**
- MECHANISM: CONFIRMED — first-party rule (measuring-text.md "Match font
  properties") and best-practices ("Match all font properties") + third-party
  mirror. `layout/measure.js` provides `fontStyleFor(fontFamily, overrides)`
  + `HEADLINE_FONT`; `fontStyleFor("Inter", HEADLINE_FONT)` equals exactly the
  renderer's current inline props, so the contract is already coherent.
- REMAINING: renderer does not consume `fontStyleFor` (inline literals
  duplicated) → SFR-LAY-5-1.

---

## 5. FINDINGS AND DELTAS

1. **CONTRADICTION — the compiler cannot call `measureText()` in Node.**
   LAYOUT-SYSTEM §4 (lines 391-393): "compositions/layout/compile.js — pure,
   synchronous, runs in Node **before** any browser starts." R3 (line 430):
   "Any rect whose size depends on text calls `measureText()` at compile
   time". Machine evidence: all four measurement functions throw
   "measureText() can only be called in a browser." in Node (probe);
   remotion.dev docs state the same ("Only works in the browser, not in
   Node.js or Bun."). measure.js itself documents "Importable in Node ...
   as long as the wrappers are not CALLED in Node". The Stage-6 compiler must
   resolve this: (a) measure in the browser/compositor before render and feed
   the compiler, (b) Node-side metrics from the vendored woff2 (new dep),
   or (c) spec amendment. **Escalated** — no unilateral implementation.
2. Renderer measurements are currently **un-gated** (raw package calls) —
   the §5.1 "cached wrong for the whole render" hazard is live until
   SFR-LAY-5-1 lands.
3. No NEW conflict surfaced in the two gate-leg claims; the spec's citation
   of `remotion-markup/measuring-text.md` was confirmed at its live path.

---

## 6. SHARED-FILE REQUESTS

**SFR-LAY-5-1 — migrate the renderer to the gated wrappers + shared fontStyle**
- WHY: every measurement in the system must pass `validateFontIsLoaded: true`
  (Rule 5.1) and spread ONE `fontStyle` object into measurement and render
  (Rule 5.2). `layout/measure.js` (audit-type) provides both; the renderer is
  the missing consumer.
- FILES: `src/skills/remotion-render/compositions/motion-graphics.jsx`
  (shared territory — orchestrator/shared lanes only).
- CHANGE: delete raw `import { measureText, fitTextOnNLines } from
  "@remotion/layout-utils"` (line 18); replace with
  `import { measureText, fitTextOnNLines, fontStyleFor, HEADLINE_FONT } from
  "../layout/measure.js"`. In HeadlineBox (lines 489-505): build
  `const fontStyle = fontStyleFor(fontFamily, HEADLINE_FONT);` once, spread it
  into `fitTextOnNLines({ text, ...fontStyle, maxLines, maxBoxWidth,
  maxFontSize })`, `measureText({ text, ...fontStyle, fontSize })`, and the
  element style (`{ ...fontStyle, fontSize, ... }`); keep `fontSize`
  single-source (the fit result) so measurement and render share it.
- NOT BLOCKING the gate: mechanism + arming are in place; this wires the
  render side. Suggested with stage 6 (compiler) or stage 7 (Layer.jsx) work.
- SFR-LAY-5-2 (note, not urgent): roles beyond headline (kicker/caption/chip)
  will need their own `fontStyleFor` role constants when the compiler + layers
  land (stages 6-7) — the pattern extends, no new mechanism.

---

## 7. ESCALATIONS

1. **ESCLAY-5-1 — compile-in-Node vs browser-only measurement** (see §5.1).
   Needs a decision before Stage 6 (Compiler). Candidates: browser-time
   measurement feeding the compiler / woff2 metric parsing in Node / spec
   amendment to §4+R3.
2. **ESCLAY-5-2 — `FINISH-SPEC.md` missing from the repo** (carried from
   stages 0-4; not a blocker for this stage).
3. Note: `layout/measure.js` cites its own source paths as "index.mjs:13-15"
   and "index.mjs:77-100" (ESM build); the installed 4.0.506 ships only
   `dist/cjs`. Cosmetic — the semantics it cites were verified against the
   installed CJS. Flagged for audit-type's awareness, no action needed.

---

## 8. DELIVERABLES & GATE STATUS

| Check | Result |
|---|---|
| `node layout/run-lint.js` | **12/12 PASS** |
| `node spec/run-spec.js` | **15/15 PASS** |
| Gate leg 1 mechanism (browser E2E, installed 4.0.506) | **CONFIRMED** |
| Gate leg 1 system arming (measure.js, audit-type) | **VERIFIED by read + smoke import** |
| Gate leg 2 mechanism (first-party rule + docs) | **CONFIRMED** |
| Gate leg 2 mechanism (measure.js `fontStyleFor`) | **VERIFIED by read + smoke import** |
| Gate legs' render-side wiring | **SFR-LAY-5-1** |
| Owned-file changes | 0 (probes are evidence, under `data/audit/5/`) |
| Claims | 4 RE-VERIFIED, 0 WRONG, 0 ABANDONED |

Artifacts: `data/audit/5/probe-font-gate.html`, `probe-font-gate.out.html`,
`probe-node-browser-only.cjs`, `probe-renderer-state.cjs`,
`audit-layout.ledger.md` (this file).

---

## 9. FINAL MESSAGE

**READY — Stage 5 (audit-layout lane) complete.**

- **Gate leg 1** (`measureText` throws on unloaded font): mechanism CONFIRMED
  end-to-end on the actual installed `@remotion/layout-utils@4.0.506` via a
  headless-Chrome probe (5 cases: throw with gate on + font unloaded; no throw
  with gate off; no throw with the real vendored Inter loaded; short-text
  guard confirmed). System arming landed in audit-type's `layout/measure.js`
  (`FONT_GATE` forced-last in all four wrappers), verified by read + ESM smoke
  import.
- **Gate leg 2** (measure and render share one `fontStyle` object): first-party
  rule (measuring-text.md "Match font properties") and docs confirm the
  pattern; `fontStyleFor`/`HEADLINE_FONT` landed in `measure.js` and its output
  matches the renderer's current inline props exactly.
- **Verdicts**: 4 claims RE-VERIFIED, 0 WRONG. **Phase 2 changes: 0** (all
  deltas route through shared files). Lint 12/12, spec 15/15.
- **SFRs**: SFR-LAY-5-1 — migrate `motion-graphics.jsx` from the raw package
  to the gated wrappers + shared `fontStyleFor` (the only un-wired piece of
  both gate legs; shared territory, orchestrator/shared lanes).
- **Escalations**: ESCLAY-5-1 — LAYOUT-SYSTEM §4/R3 says compile.js calls
  `measureText()` in Node, but the installed package (and docs) throw in Node;
  Stage 6 needs a decision. ESCLAY-5-2 — FINISH-SPEC.md still missing.
