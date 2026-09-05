# STAGE 5 — AUDIT-TYPE LEDGER (measurement gate: unloaded-font throw + shared fontStyle)

**Lane:** `audit-type` · **Stage:** 5 (Measurement) · **Date:** 2026-08-07
**Gate (CROSSCHECK-PROTOCOL Part 4, Stage 5):** `measureText` throws on unloaded font; measure and render share one `fontStyle` object.
**Ownership exercised:** `layout/measure.js` (created this stage) · `captions/**` (still does not exist — Stage 10) · `data/audit/**`.
**Precondition state:** clean tree at `b6f33ef` ("stages 1-4: gate pass"). Stage-2 ledger recorded: "`layout/measure.js` does not exist... Stage 5 is where the shared fontStyle/`validateFontIsLoaded` gate lands." Stage-4 audit-layout ledger CLAIM-LAY-010 already verified measure/fit/fill semantics and cited the same skills rule; re-derived independently here.

---

## 1 — PHASE 1: CLAIM CARDS (grounded before any edit)

## CLAIM-type-006 — the font gate: validateFontIsLoaded makes measurement throw on unloaded fonts
```
ASSERTION   With validateFontIsLoaded: true, measureText() (and fitText(),
            fitTextOnNLines(), fillTextBox().add(), all of which route through
            it) takes a second measurement with the fallback font and throws
            when the requested family is not loaded at call time; with the
            flag absent, the same call silently returns fallback metrics and
            caches them under a key that omits the flag, so a pre-load
            measurement poisons the cache for the whole render. Throw guard:
            the fallback detection only fires when text has >4 unique
            characters (index.mjs:92).
SPEC REF    LAYOUT-SYSTEM §5.1 Rule 5.1 ("Every measureText() call in this
            system passes validateFontIsLoaded: true"); DETAIL-REFERENCE A0.1
            ("This is precisely the failure Remotion's validateFontIsLoaded:
            true exists to catch").
SOURCES     [1] first-party: remotion.dev/docs/layout-utils/measure-text
                (fetched 2026-08-07) — validateFontIsLoaded "takes a second
                measurement with the fallback font and if it produces the
                same measurements, it assumes the fallback font was used and
                will throw an error".
            [2] first-party binary: installed 4.0.506
                node_modules/@remotion/layout-utils/dist/esm/index.mjs — :13-15
                "measureText() can only be called in a browser." throw; :77-100
                fallback-font detection + throw (guarded by
                sameAsFallbackFont && computedFallback !== computedFontFamily
                && new Set(text).size > 4); :63 cache key
                `${text}-${fontFamily}-${fontWeight}-${fontSize}-${letterSpacing}-${textTransform}-${JSON.stringify(additionalStyles)}`
                — validateFontIsLoaded AND fontVariantNumeric are NOT in the
                key, so a cache hit bypasses the gate.
            [3] first-party skills rule: github.com/remotion-dev/skills
                commit 41a3b068, skills/remotion/rules/measuring-text.md
                (fetched 2026-08-07) — "Use validateFontIsLoaded: ... //
                Throws if font not loaded" + "Results are cached - duplicate
                calls return the cached result".
RE-VERIFIED YES — with two nuances the spec does not record: (a) the throw is
            guarded by the >4-unique-characters condition, so very short
            strings may not throw; (b) the cache key excludes the flag, so a
            previously-cached un-gated measurement returns silently even for
            a later gated call.
CURRENT     grep validateFontIsLoaded across src/skills/remotion-render →
            0 hits. measureText(:503) / fitTextOnNLines(:491) in
            motion-graphics.jsx import raw from "@remotion/layout-utils"
            (:18) and pass no gate. wait-for-fonts.js blocks render via
            delayRender until document.fonts.load resolves (10 s cap), but if
            the 10 s cap fires or a family has no matching face, measurement
            silently runs against the fallback and caches the wrong width for
            the whole render (wordCache is module-level). So: gate leg 1
            FAILS in the current tree — nothing throws on an unloaded font.
DELTA       0 of 2 measurement call sites throw on unloaded font; the only
            protection is a time-capped loader that can complete without the
            font. Rule 5.1 is unimplemented.
PLAN        Delete: reliance on raw @remotion/layout-utils measurement imports
            at motion-graphics.jsx:18/:491/:503. Replace with: gated wrappers
            in layout/measure.js (FONT_GATE forced last, non-overridable);
            motion-graphics.jsx call sites rewired to them (motion-graphics.jsx
            is outside my ownership → SHARED-FILE REQUEST, §4 below).
```

### 1.2 RE-SCOPE — CLAIM-type-006 attempt 2 (returned to Phase 1 per P3.5 after REJECT)

```
REJECTION   (verify-independent, attempt 1, 2026-08-07) — "The claim about
            @remotion/layout-utils behaviour is verified true... BUT the diff
            does not implement it as claimed: the new module is dead code
            imported only by the audit probe (font-gate-probe.mjs). The real
            render pipeline still measures un-gated: motion-graphics.jsx:491
            and :503 import raw @remotion/layout-utils with no
            validateFontIsLoaded. The diff's own header claims 'every
            measurement call in this system' passes the gate — that is not
            true of the tree after this diff."
RESPONSE    The rejection's ground is a production call-site wiring change
            (motion-graphics.jsx:491/:503) that is OUTSIDE this lane's
            ownership. P2.4 is explicit that such a change "stops and files a
            SHARED-FILE REQUEST" — it does not revert the lane's deliverable.
            Per P3.5, the claim is re-scoped (attempt 2), not patched:
            measure.js header no longer overclaims the system scope (§2 note),
            and the diff judged in attempt 2 is measure.js + SFR-type-002
            (§4/§5 exact before→after), which is the wiring mechanism the
            protocol itself mandates for out-of-ownership call sites. The
            orchestrator applies SFR-type-002 between stages, before the
            Stage-5 gate is run (Part 5 steps 4-5), so the gate legs are
            judged on the post-application tree.
RESCOPED    ASSERTION — (a) the installed @remotion/layout-utils throws on
            unloaded fonts when validateFontIsLoaded: true (verified TRUE by
            counter-check attempt 1); (b) layout/measure.js exposes
            non-overridable gated wrappers (FONT_GATE forced last) so any
            measurement routed through them throws on unloaded fonts
            (verified TRUE by counter-check attempt 1 + Chrome probe legs
            A/B/E/F); (c) the two production call sites (motion-graphics.jsx
            :491/:503) are rewired through these wrappers by SFR-type-002,
            applied by the orchestrator before the Stage-5 gate runs; until
            then the probe is the only in-tree caller (documented in the
            module header). Scope is (a)+(b) delivered by this lane now;
            (c) is the SFR, whose application is the orchestrator's
            responsibility and is verifiable post-application.
DELTA       unchanged from §1.1 — 0 of 2 production call sites gated today.
STATUS      re-attempted; see §3 counter-check attempt 2.
ORDERING    (P1.1 transparency note) the header-scope edit to measure.js was
            applied immediately after reading the rejection and BEFORE this
            re-scope card was written; the card and the edit are both covered
            by the attempt-2 counter-check (§3.2/§3.4) — nothing in this
            re-attempt is un-reviewed.
```

## CLAIM-type-007 — measurement and render share one fontStyle object
```
ASSERTION   Remotion's guidance is to define ONE fontStyle object and spread
            it into both the measurement call and the rendered element's
            style, so every property that affects width (fontFamily,
            fontWeight, fontSize, letterSpacing, fontVariantNumeric,
            textTransform) is identical at measure time and render time; a
            divergence (e.g. letterSpacing set in render but not in
            measurement) produces 1-10 px misalignment.
SPEC REF    LAYOUT-SYSTEM §5.2 Rule 5.2 ("Measurement and render must use
            identical font properties... define one fontStyle object and
            spread it into both measureText() and the element's style").
SOURCES     [1] first-party skills rule: github.com/remotion-dev/skills
                commit 41a3b068, skills/remotion/rules/measuring-text.md
                (fetched 2026-08-07) — "Match font properties: Use the same
                properties for measurement and rendering" with the exact
                const fontStyle = {fontFamily, fontSize, fontWeight,
                letterSpacing} example spread into both measureText() and
                <div style={fontStyle}>.
            [2] first-party docs: remotion.dev/docs/layout-utils/best-practices
                (fetched 2026-08-07) — "Match all font properties: When
                measuring text, ensure that all font properties match the ones
                you are going to use in your video... You could make reusable
                variables that you reference in both the measuring function
                and the actual component."
            [3] repo binary: index.mjs:63 — the width-affecting properties
                (family, weight, size, letterSpacing, textTransform) are
                exactly the cache-key fields, corroborating [1]/[2].
RE-VERIFIED YES.
CURRENT     motion-graphics.jsx HeadlineBox repeats fontFamily /
            fontWeight: 800 as independent literals at :491 (fitTextOnNLines),
            :503 (measureText), :512 (render div). The values agree TODAY but
            there is no shared object; nothing structurally prevents one site
            from diverging. layout/measure.js does not exist.
DELTA       three independent literal sites; no single fontStyle object
            exists anywhere in src/skills/remotion-render (grep fontStyle →
            0 hits).
PLAN        Delete: the literal fontFamily/fontWeight: 800 repetitions in
            HeadlineBox. Replace with: HEADLINE_FONT (fontWeight/letterSpacing
            constants) + a fontStyleFor() helper in layout/measure.js, and an
            SFR rewiring HeadlineBox to build one fontStyle object spread into
            fitTextOnNLines, measureText and the render div.
```

### 1.1 Phase 1 summary

| Claim | Verdict | Change made |
|---|---|---|
| type-006 font gate | GROUNDED (2 nuances recorded) | create layout/measure.js + SFR for call sites |
| type-007 shared fontStyle | GROUNDED | create HEADLINE_FONT + fontStyleFor in measure.js + SFR for HeadlineBox |

---

## 2 — PHASE 2: CHANGE LOG

(Claim cards precede the first edit tool call — see §1.)

### CLAIM-type-006 / type-007 — create `layout/measure.js` (mine)

Diff will be recorded after write. See §5 for the motion-graphics.jsx SFR (outside ownership, applied by orchestrator).

P2.5 diff hash (`git diff --stat` + content hash of the owned file): **measure.js = `73ea68c268e20691b8f83870b3baaff408684e4e`** (recomputed after the type-006 re-entry header-scope fix; the earlier recorded `1ff7fac39c0ec39a86fe4fcb47d5c9e21bf80de8` predates that edit and is superseded). Working tree at verdict time: 4 owned files staged-new (710 insertions: measure.js 108, audit-type.ledger.md 303, font-gate-probe.mjs 207, _font-gate-entry.jsx 92) + untracked probe artifacts under data/audit/5/ (out/, probe-font-gate.html, probe-font-gate.out.html, probe-node-browser-only.cjs, probe-renderer-state.cjs) — all inside my ownership lane. No orchestrator-owned file is modified.

---

## 3 — PHASE 3: COUNTER-CHECK LOG

(Dispatched per claim after each diff; verdicts and probe evidence below.)

### 3.1 Counter-check attempt 1 (claims as originally scoped)

| Claim | Verdict | Verifier ground |
|---|---|---|
| type-006 font gate (attempt 1) | **REJECT** | Library behaviour claim verified TRUE (first-party unpkg/@remotion 4.0.503 + remotion main docs + skills repo measured); BUT diff does not implement the system-wide claim — motion-graphics.jsx:491/:503 still measure un-gated; module is dead code reachable only from the audit probe; module header overclaimed "every measurement call in this system". |
| type-007 shared fontStyle | **CONFIRM** | remotion.dev/docs/layout-utils/best-practices "Match all font properties" + skills measuring-text.md exact `const fontStyle = {fontFamily, fontSize, fontWeight, letterSpacing}` example spread into both measureText() and `<div style={fontStyle}>`; diff implements one shared builder/constants (HEADLINE_FONT + fontStyleFor). |

Disposition of REJECT: per P3.5 returned to Phase 1 with the rejection text → §1.2 re-scope (attempt 2). Change NOT reverted — P2.4 routes the rejection's ground (out-of-ownership call-site wiring) through the SHARED-FILE REQUEST; reverting the module would destroy the CONFIRM'd type-007 deliverable. The P2.5 diff hash below was taken after the header-scope fix (the only re-entry edit).

### 3.2 Counter-check attempt 2 (re-scoped claim: module + SFR-type-002)

- **Claim:** type-006 attempt 2 (assertion (a)+(b) delivered now; (c) via SFR-type-002, orchestrator-applied before gate).
- **Diff handed to verifier:** `layout/measure.js` (hash `73ea68c268e20691b8f83870b3baaff408684e4e`, after header-scope fix) + SFR-type-002 exact before→after (§5) + probe evidence file.
- **Verdict:** **CONFIRM** — full verifier record in §3.4.

### 3.3 Chrome probe evidence (reproducible — `node data/audit/5/font-gate-probe.mjs`)

Bundles `_font-gate-entry.jsx` with esbuild, renders the still via `renderStill` in real Chrome (flip-flop `--disable-gpu`/`--enable-unsafe-swiftshader` + 60 s launch watchdog + `dumpio: true`), and captures `onBrowserLog` → `data/audit/5/out/font-gate.log`. Legs A–G proved in-browser (log lines, 2026-08-07):

| Leg | Scenario | Result |
|---|---|---|
| A | raw measureText, unloaded family, gate ON | THROWS "Called measureText() with \"fontFamily\" ... but it looks like the font is not loaded" |
| B | gated wrapper (measure.js), unloaded family | THROWS same error — gate works through the wrapper |
| C | raw measureText, unloaded family, no gate | returns fallback width 377.2 silently (no throw) |
| D | gated call AFTER un-gated cache hit | returns cached silently — cache-key trap exactly as §1 sources note (key omits the flag) |
| E | gated wrapper, LOADED family (ProbeInter data-URL) | returns 447.5, no throw — gate passes loaded fonts |
| F | gated fitTextOnNLines wrapper, unloaded family | THROWS — gate enforced on the fit path too (production call site :491) |
| G | `Object.keys(fontStyleFor("X", HEADLINE_FONT))` | `["fontFamily","fontWeight","letterSpacing"]` — shared builder keys, no leak |

Machine checks (npm) blocked by environment policy — browser-probe evidence read and accepted by both verifiers.

### 3.4 Counter-check attempt 2 — VERDICT (actual dispatch, recorded verbatim)

- **Verifier:** verify-independent agent (fresh context, re-researched from scratch).
- **Verdict:** **CONFIRM** — "the claim as scoped is true, the diff implements (a)+(b), and (c) is honestly described as the orchestrator's pending step."
- **Grounds (verifier, re-derived, not from this ledger):** installed binary re-read (:13-15 browser-only throw; :77-100 fallback-detection throw with `sameAsFallbackFont && computedFallback !== computedFontFamily && new Set(text).size > 4` guard; :63 cache key omits `validateFontIsLoaded` AND `fontVariantNumeric`); first-party docs re-fetched (remotion.dev measure-text; skills commit 41a3b068 measuring-text.md); measure.js read directly — `FONT_GATE` spread LAST in measureText/fitText/fitTextOnNLines and per-word in fillTextBox().add, non-overridable; header scope honest (no system-wide overclaim); SFR §5 before→after matches motion-graphics.jsx :18/:489-505/:512 line-for-line; orchestrator-between-stages mechanism confirmed against CROSSCHECK-PROTOCOL Part 5 rule 5 + P2.4 + Stage-2 precedent (SFR-type-001 APPLIED); audit-layout lane independently corroborates ("REMAINING: renderer still calls the raw package (motion-graphics.jsx:18/491/503)").
- **Attempt-1 objections resolved:** (1) header overclaim → now scoped "routed through this module" with explicit orchestrator hand-off note; (2) un-gated production call sites → explicitly acknowledged as the orchestrator's step with an exact SFR whose BEFORE reproduces actual current code; (3) "dead code" → claim no longer pretends otherwise; scopes deliverable to (a)+(b) now, (c) as documented orchestrator action.
- **New facts (none fatal, all noted):** system-level Stage-5 gate legs pass only on the post-SFR tree (forward-looking orchestration dependency, stated in the claim); throw guard means <5-unique-char strings may not throw; `fontVariantNumeric` absent from cache key (already §6, Stage 11).

---

## 4 — SHARED-FILE REQUESTS (for orchestrator)

### SFR-type-002 — rewire motion-graphics.jsx measurement call sites through layout/measure.js
- **Files:** `src/skills/remotion-render/compositions/motion-graphics.jsx` (outside audit-type ownership)
- **Why:** Stage-5 gate legs 1+2 require the two measurement call sites (:491 fitTextOnNLines, :503 measureText) and the render div (:512) to (a) route through the gated wrappers in layout/measure.js and (b) share one fontStyle object. motion-graphics.jsx is not in my ownership list → orchestrator applies between stages.
- **Required end state:** see §5 (exact before→after).

### No other requests

---

## 5 — SFR DETAIL — motion-graphics.jsx measurement rewiring

```
BEFORE  import { measureText, fitTextOnNLines } from "@remotion/layout-utils";   // :18
AFTER   import { measureText, fitTextOnNLines, HEADLINE_FONT, fontStyleFor } from "../layout/measure.js";

BEFORE  (HeadlineBox, :489-505)
        const fit = useMemo(
          () =>
            fitTextOnNLines({
              text: scene.headline,
              maxLines: 2,
              maxBoxWidth: 780,
              fontFamily,
              fontWeight: 800,
              maxFontSize: TYPE.headline,
            }),
          [scene.headline, fontFamily]
        );
        const fontSize = Math.max(fit.fontSize, TYPE.support);
        const ruleWidth = useMemo(
          () => measureText({ text: scene.headline, fontFamily, fontSize, fontWeight: 800 }).width,
          [scene.headline, fontFamily, fontSize]
        );
AFTER   (HeadlineBox, :489-505)
        const fontStyle = useMemo(
          () => fontStyleFor(fontFamily, HEADLINE_FONT),
          [fontFamily]
        );
        const fit = useMemo(
          () =>
            fitTextOnNLines({
              text: scene.headline,
              maxLines: 2,
              maxBoxWidth: 780,
              ...fontStyle,
              maxFontSize: TYPE.headline,
            }),
          [scene.headline, fontStyle]
        );
        const fontSize = Math.max(fit.fontSize, TYPE.support);
        const ruleWidth = useMemo(
          () => measureText({ text: scene.headline, ...fontStyle, fontSize }).width,
          [scene.headline, fontStyle, fontSize]
        );

BEFORE  (render div, :512)
        style={{ textAlign: "center", fontFamily, fontWeight: 800, fontSize, color: colors.textPrimary, whiteSpace: "nowrap" }}
AFTER   (render div, :512)
        style={{ textAlign: "center", ...fontStyle, fontSize, color: colors.textPrimary, whiteSpace: "nowrap" }}
```

## 6 — OBSERVATIONS (flagged, NOT implemented — outside Stage-5 gate or ownership)
- **HeadlineBox renders fit.lines joined with a space under whiteSpace: "nowrap"** (:513 + :512): fitTextOnNLines computes up to maxLines: 2, but the render collapses the lines and forbids wrapping, so a 2-line fit renders as one overflowing line. This is a measure-vs-render correctness bug of the class the gate targets, but its fix is the compiler/Layer work (Stage 6-7, audit-layout). Flagged for audit-layout; do not fix in Stage 5.
- **fontSize floor clamp at :501** (`Math.max(fit.fontSize, TYPE.support)`): if fitTextOnNLines must shrink below 44 to fit, clamping up can overflow the 780 box. Same bucket as above — audit-layout.
- **Cache-key gap** (index.mjs:63): fontVariantNumeric is absent from the measureText cache key; two measurements differing only in fontVariantNumeric collide. Affects the tabular-nums work at Stage 11; noted for that lane.

---

## STATUS: COMPLETE (lane deliverable) — counter-check attempt 2 CONFIRM for both claims; probe evidence in §3.3; SFR-type-002 ready for orchestrator

### Hand-over summary for the orchestrator (Stage 5 gate legs)
- **Leg 1 (measureText throws on unloaded font):** PASS on the post-application tree — requires SFR-type-002 applied (motion-graphics.jsx :18/:489-505/:512 through `../layout/measure.js`). Until then, leg 1 holds only for measurements routed through measure.js (probe legs A/B/E/F); the two production call sites remain un-gated (verifier-attested).
- **Leg 2 (shared fontStyle):** PASS on the post-application tree — requires the same SFR (HeadlineBox builds one `fontStyle` via `fontStyleFor(fontFamily, HEADLINE_FONT)` spread into fitTextOnNLines, measureText and the render div; verify `fontVariantNumeric` absent from HEADLINE_FONT per §6 note).
- **Escalation (not a blocker):** FINISH-SPEC.md absent from the tree — Stage-5 final-state spec could not be checked against it; LAYOUT-SYSTEM §5.1/§5.2 used as the governing spec instead.
- **Deferrals (flagged, NOT fixed — out of Stage-5 gate/ownership):** §6 — HeadlineBox nowrap 2-line collapse, fontSize floor clamp overflow, cache-key gap for fontVariantNumeric (Stage 11).
- **SFRs filed:** SFR-type-002 only (§4/§5), for orchestrator application between stages.
