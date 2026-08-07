# AUDIT-MOTION LEDGER — Stage 7 (Layer + primitives)

**Lane:** `audit-motion` — timing, easing, springs, stagger, drag, blur
**Stage:** 7 (CROSSCHECK-PROTOCOL Part 4 row 7, gate: "Tier 2 stills within ±2px; zero sibling flex in Stage/Headline/Caption" — shared with `audit-layout`)
**Mission:** re-verify every value in `MOTION-BLUEPRINT.md` §1.3 (D table @30fps), §1.4 (easing/spring/stagger/exits), §5 Rule 5.3 (`durationRestThreshold`); deliver the VERIFIED TOKEN TABLE; file SPEC-AMENDMENT SFRs; counter-check every claim via `verify-independent`.
**Ownership (edit):** `data/audit/**` only. **Not written:** `beats/**`, `compositions/**`, `layers/**` (Stage 7 is the audit stage; blueprint values land as verified spec, applied in later stages).
**Status:** Phase 1 (GROUND) complete — 13 claims. Phase 2 n/a (verification-only, zero code edits). Phase 3 (COUNTER-CHECK) complete: 13/13 resolved — 12 CONFIRMED via counter-check (001-006, 008-013) + 007 CONFIRMED (value) via orchestrator decision 2026-08-07 (Option A+D, P3.5). Verdicts appended in §5.

---

## §0 — Current state snapshot (pre-audit, all re-read this session)

- `compositions/beats.js:13` `export const FPS = 30`.
- `compositions/beats.js:16-24` — the D table: `micro:4` (133ms), `short:6` (200ms), `base:9` (300ms), `large:12` (400ms), `complex:15` (500ms), `push:60` (2.0s), `hold:45` (1.5s). Matches MOTION-BLUEPRINT §1.3 verbatim.
- `compositions/motion-graphics.jsx:40-43` — `E_OUT = Easing.bezier(0.16,1,0.3,1)`, `E_SETTLE = Easing.bezier(0.33,1,0.68,1)`, `E_IN = Easing.bezier(0.33,0,0.67,1)`, `E_PUSH = Easing.spring({damping:200})`.
- `compositions/motion-graphics.jsx:64-79` — `ease()`/`easeScale()`: both `extrapolate` clamps + `output:'perceptual-scale'` on scale (Rule 1.5 implemented).
- `compositions/motion-graphics.jsx:81-96` — `popStyle` scale 0→1.15→1 over 9f / opacity over 3f; `riseStyle` translateY +24→0 over 9f (`D.base`), opacity over `D.short` (Rule 1.4 exit/entrance mix).
- `compositions/motion-graphics.jsx:98-104` — `stageExitStyle`: exits over `D.short` (6f) with `E_IN`, "never overshoots" — Rule 1.4 implemented (entrances use `D.base`).
- `compositions/motion-graphics.jsx:106-114` — `growSpring`: `{damping:16, stiffness:90}`, `durationInFrames:24` — §7.2's one permitted overshoot site (ζ=0.843 < 1, see G3).
- `compositions/motion-graphics.jsx:925-941` — `StatementScene`: icon POP at `tA−D.micro` (4f), headline RISE at `tA`; comment "Nothing else." — Rule 1.6 primary-first + stagger implemented. `HEADLINE_DELAY` map at :48-57.
- `compositions/motion-graphics.jsx:950` — `Easing.spring({damping:200})(ease(...,[0,D.push],...))` — the push.
- `layers/Layer.jsx:66-72` — `E_OUT = Easing.bezier(0.16,1,0.3,1)` ("the exact value the live renderer uses"), `E_IN = Easing.bezier(0.33,0,0.67,1)`; :103-109 `easeScale` with `output:'perceptual-scale'` (D1.3).
- **Legacy springs (pre-blueprint, flagged — not this stage's code):** `minimal.jsx:31-34` `{damping:100,stiffness:120}`, `{90,100}`, `{80,90}`; `cinematic-documentary.jsx:120,124,155` `{100,100}`, `{100,80}`, `{50,200}`. Probe G3 shows all are ζ 1.77-5.59 → **all overdamped, none actually overshoot** — consistent with the no-bounce policy; §7.1 says minimal "no springs with overshoot", §7.3 "no springs. Everything eases". `motion-graphics.jsx:226` kicker spring `{90,80}` → ζ=5.03.
- **`springTiming`/`TransitionSeries` usage: ZERO** in `src/skills/remotion-render` (grep: only two comment mentions — `motion-graphics.jsx:34` documents the deliberate divergence: "TransitionSeries would shorten it and desync beats from audio"; `beats.js:748` comment). Rule 5.3 is a spec instruction for build step §11.7; currently unimplemented but not contradicted.
- Installed (root hoist): `remotion@^4.0.503` family incl. `@remotion/transitions@^4.0.503`. Binary facts: `spring-utils.js:35` ζ = c/(2√(km)); defaults `{damping:10, mass:1, stiffness:100}`; :59 oscillation branch only for ζ<1; `measure-spring.js:11` `threshold = 0.005` default; springTiming passes `options.durationRestThreshold` through.
- `data/audit/7/` already holds the stage-7 `audit-layout` artifacts (`audit-layout.ledger.md`, `tier2-probe.mjs`, `check-layer.mjs`, …). This ledger is `audit-motion`'s; both coexist under the shared stage directory.

## §0.1 — Sources of record (Phase 1, all fetched live this session)

First-party (Part 3 list): `remotion.dev/docs/*`, `github.com/remotion-dev/skills`, `m3.material.io` + `material-components-android`, `m1.material.io`.
Third-party: NN/g, Figma Learn, equal.design, designsystems.one, Flutter `motion.dart`, pub.dev `material_design`, Physics LibreTexts, MathWorks, Wikipedia Damping, Google Earth Studio, aibrify, opus.pro, motionedits, gabrielpulecio, Quora.

Machine-verifiable artifacts written this stage: `data/audit/7/motion-probe.mjs` (G1 frame→ms, G2 slot mapping, G3 ζ + characteristic roots, G4 installed-binary checks) — **G1-G4 ALL PASS** (exit 0).

---

## §1 — CLAIM CARDS

### CLAIM-motion-001 — D.micro = 4f @30fps = 133.3ms (blueprint arithmetic, not a raw Material slot)
ASSERTION   At 30 fps the blueprint's D.micro token is 4 frames = 133.3 ms, which is the blueprint's own frame arithmetic (4/30 s), not a raw Material slot value — Material's slots bracket it at short2 = 100 ms and short3 = 150 ms.
SPEC REF    MOTION-BLUEPRINT §1.3 (line 138, `micro: 4 // 133ms`).
SOURCES     [1] first-party: m3.material.io/styles/motion/easing-and-duration/tokens-specs — 16 M3 duration slots, short2 = 100 ms, short3 = 150 ms (fetched via MDC Motion.md + Flutter motion.dart mirrors; m3.material.io blocks direct fetch).
            [2] first-party: github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md — duration slot table (50-1000 ms).
            [3] third-party: github.com/flutter/flutter/blob/main/packages/flutter/lib/src/material/motion.dart — `Durations.short2 = 100ms`, `short3 = 150ms` (Material spec reference implementation).
            [4] third-party: pub.dev/packages/material_design — M3MotionDuration short1-4 (50-200 ms), medium1-4 (250-400 ms), long1-4 (450-600 ms), extraLong1-4 (700-1000 ms).
RE-VERIFIED YES — 4/30 s = 133.33 ms (arithmetic, probe G1); slot neighbours verified; the blueprint's own `// 133ms` comment is its own 4-frame arithmetic, which the card states explicitly.
CURRENT     beats.js:17 `micro: 4 // 133ms — accent flash, counter tick, chip pop`. Stagger usage: motion-graphics.jsx:929 `start = tA - D.micro` (StatementScene icon). Counter tick: :587.
DELTA       None. Precision note recorded: 133.33 ms is NOT a Material slot (Material has 100 and 150); the D.micro card does not claim it is.
PLAN        None — verification-only (Stage 7 audit; no beats/** writes this stage).
DIFF        n/a — zero code edits. Evidence artifact: data/audit/7/motion-probe.mjs G1/G2 (PASS).
COUNTER     (appended after Phase 3)
STATUS      CONFIRMED (P3) — verdict in §5.1

### CLAIM-motion-002 — D.short = 6f @30fps = 200.0ms = Material short4
ASSERTION   At 30 fps the blueprint's D.short token is 6 frames = 200.0 ms, which exactly equals Material's short4 duration slot (200 ms).
SPEC REF    MOTION-BLUEPRINT §1.3 (line 139, `short: 6 // 200ms`).
SOURCES     [1] first-party: m3.material.io tokens-specs — short4 = 200 ms.
            [2] first-party: MDC Motion.md — short4 = 200 ms.
            [3] third-party: Flutter motion.dart — `Durations.short4 = Duration(milliseconds: 200)`.
            [4] third-party: pub.dev material_design + github.com/aldefy/compose-skill animation.md — M3 table short4 = 200 ms.
RE-VERIFIED YES — 6/30 s = 200.0 ms (probe G1); slot exact (probe G2).
CURRENT     beats.js:18 `short: 6 // 200ms — small element entrance`. Used for exits: motion-graphics.jsx:101-102 `stageExitStyle` over D.short; opacity over D.short in riseStyle :93.
DELTA       None.
PLAN        None — verification-only.
DIFF        n/a — zero code edits (probe G1/G2 PASS).
COUNTER     (appended after Phase 3)
STATUS      CONFIRMED (P3) — verdict in §5.2

### CLAIM-motion-003 — D.base = 9f @30fps = 300.0ms = Material medium2
ASSERTION   At 30 fps the blueprint's D.base token is 9 frames = 300.0 ms, which exactly equals Material's medium2 duration slot (300 ms).
SPEC REF    MOTION-BLUEPRINT §1.3 (line 140, `base: 9 // 300ms`).
SOURCES     [1] first-party: m3.material.io tokens-specs — medium2 = 300 ms.
            [2] first-party: MDC Motion.md — medium2 = 300 ms.
            [3] third-party: Flutter motion.dart — medium2 = 300 ms.
            [4] third-party: equal.design/blog/5-rules-for-motion-in-ui-transitions — Material suggests 150-200 ms small / up to 400 ms large; 200-500 ms larger transitions (bracket contains 300 ms).
RE-VERIFIED YES — 9/30 s = 300.0 ms (probe G1); slot exact (probe G2).
CURRENT     beats.js:19 `base: 9 // 300ms — standard entrance`. Entrances: popStyle :85 (9f), riseStyle :94 (D.base), Layer.jsx:125 (D.base).
DELTA       None.
PLAN        None — verification-only.
DIFF        n/a — zero code edits (probe G1/G2 PASS).
COUNTER     (appended after Phase 3)
STATUS      CONFIRMED (P3) — verdict in §5.3

### CLAIM-motion-004 — D.large = 12f @30fps = 400.0ms = Material medium4
ASSERTION   At 30 fps the blueprint's D.large token is 12 frames = 400.0 ms, which exactly equals Material's medium4 duration slot (400 ms).
SPEC REF    MOTION-BLUEPRINT §1.3 (line 141, `large: 12 // 400ms`).
SOURCES     [1] first-party: m3.material.io tokens-specs — medium4 = 400 ms.
            [2] first-party: MDC Motion.md — medium4 = 400 ms.
            [3] third-party: Flutter motion.dart — medium4 = 400 ms.
            [4] third-party: equal.design — "up to 400 ms for larger ones" (Material).
RE-VERIFIED YES — 12/30 s = 400.0 ms (probe G1); slot exact (probe G2).
CURRENT     beats.js:20 `large: 12 // 400ms — large element`. Usage: motion-graphics.jsx:511 ruleProg over D.large, :635 dividerProg, :840 connProg.
DELTA       None.
PLAN        None — verification-only.
DIFF        n/a — zero code edits (probe G1/G2 PASS).
COUNTER     (appended after Phase 3)
STATUS      CONFIRMED (P3) — verdict in §5.4

### CLAIM-motion-005 — D.complex = 15f @30fps = 500.0ms = Material long2
ASSERTION   At 30 fps the blueprint's D.complex token is 15 frames = 500.0 ms, which exactly equals Material's long2 duration slot (500 ms).
SPEC REF    MOTION-BLUEPRINT §1.3 (line 142, `complex: 15 // 500ms`).
SOURCES     [1] first-party: m3.material.io tokens-specs — long2 = 500 ms.
            [2] first-party: MDC Motion.md — long2 = 500 ms.
            [3] third-party: Flutter motion.dart — long2 = 500 ms.
            [4] third-party: equal.design — Fluent 2 "up to 500 ms for complex motions".
RE-VERIFIED YES — 15/30 s = 500.0 ms (probe G1); slot exact (probe G2).
CURRENT     beats.js:21 `complex: 15 // 500ms — full layout shift`.
DELTA       None.
PLAN        None — verification-only.
DIFF        n/a — zero code edits (probe G1/G2 PASS).
COUNTER     (appended after Phase 3)
STATUS      CONFIRMED (P3) — verdict in §5.5

### CLAIM-motion-006 — D.push = 60f @30fps = 2.0s (cadence-grounded, not a Material slot)
ASSERTION   At 30 fps the blueprint's D.push token is 60 frames = 2000 ms, inside the published 1.5-3.0 s beat/b-roll cadence (a slow push-in substitutes for a cut; IMAGE_BEAT budget 60-90 frames), and is NOT a Material slot value (slots end at 1000 ms).
SPEC REF    MOTION-BLUEPRINT §1.3 (line 143, `push: 60 // 2.0s — slow camera push / Ken Burns, ONE at a time`), §1.1 Rule 1.1, §4.1 IMAGE_BEAT row, §7.3.
SOURCES     [1] third-party: aibrify.com/blog/short-form-video-editing-captions-b-roll-guide (live, 2026-04-22) — "a slow push-in can substitute for a cut if it delivers equivalent visual change"; "1.5-3 seconds per b-roll shot in a short-form edit under 60 seconds".
            [2] third-party: opus.pro/blog/ideal-youtube-shorts-length-format-retention (live, 2025-11-11) — "high-performing Shorts average one cut every 2-4 seconds"; "Each visual change resets the viewer's attention span slightly".
            [3] third-party: motionedits.com/the-art-of-pacing-how-we-edit-for-maximum-engagement (live, 2025-03-17) — "The 3-5 Second Rule": something visually meaningful every 3-5 s; shots beyond 5 s lose attention.
RE-VERIFIED YES — 60/30 s = 2000 ms (probe G1); 2.0 s sits inside aibrify's 1.5-3 s b-roll window and inside Rule 1.1's 45-90 frame beat budget; slot ceiling verified at 1000 ms (extraLong4, probe G2).
CURRENT     beats.js:22 `push: 60 // 2.0s`. Usage: motion-graphics.jsx:950 push spring over [0, D.push]; :587 counter over D.push. Blueprint §7.3: Ken Burns 105% → 100% over D.push.
DELTA       None. Precision note recorded: push/hold exceed Material's slot ceiling (extraLong4 = 1000 ms) — by design; they are cadence/readability-grounded, not slot-grounded.
PLAN        None — verification-only.
DIFF        n/a — zero code edits (probe G1/G2 PASS).
COUNTER     (appended after Phase 3)
STATUS      CONFIRMED (P3) — verdict in §5.6

### CLAIM-motion-007 — D.hold = 45f @30fps = 1.5s (readability floor) — [CLOSED: CONFIRMED (value) via orchestrator decision 2026-08-07]
ASSERTION   At 30 fps the blueprint's D.hold token is 45 frames = 1500 ms, the blueprint's minimum on-screen time floor. 1500 ms is a genuinely published caption/subtitle minimum duration (AVTpro Subtitling Style Guide, Norwegian edition: 1.5 s minimum; Corus: 1.5 s minimum for up to 32 characters), and it equals the blueprint's own formula (chars ÷ 12 + 0.5) at 12 characters. Precision note (SFR-motion-4): the blueprint's cited "180-220 wpm" bracket (cite 39-1) exceeds the UK broadcast subtitle caps — Ofcom and BBC publish 160-180 wpm, ITC ≤140 wpm (180 exceptional); DCMP's caps are content-tiered (120-160 wpm standard, 225/235 wpm adult-theatrical), so "at/above caps" is not universal. Value correction: none.
SPEC REF    MOTION-BLUEPRINT §1.3 (line 144, `hold: 45 // 1.5s — minimum on-screen time for readable text (§3.3)`), §3.3 Rule 3.2 `holdFrames` (lines 242-255, cite 39-1).
SOURCES     [1] third-party: avtpro.ooona.net — AVTpro Subtitling Style Guide (Norwegian edition): "minimum duration of a subtitle on screen is 1.5 seconds" (other language editions set 1.0 s).
            [2] third-party: assets.corusent.com — Corus captioning/accessibility specs: 1.5 s minimum for up to 32 characters.
            [3] third-party: capcut.com — caption guidance: caption blocks 1.5-6 s (independent restatement of the same floor family).
            [4] broadcast caps (precision note only, NOT grounding): ofcom.org.uk Access Service Code A1.19 (pre-recorded 160-180 wpm, >200 "difficult for many viewers"); bbc.co.uk Subtitle Guidelines (160-180 wpm); ITC 1999 (≤140 wpm, 180 exceptional); dcmp.org Captioning Guidelines + Captioning Key (content-tiered: 120-130 lower-middle, ~130-160 upper, 150-160 adult special-interest, 225/235 adult theatrical).
            [DROPPED] gabrielpulecio.com — flagged by verifier 007 as possibly circular (uses the repo's own vocabulary "to align with beats"); no longer grounds this claim.
RE-VERIFIED YES — 45/30 s = 1500 ms (probe G1); formula self-check: (12 ÷ 12) + 0.5 = 1.5 s exactly (machine arithmetic). Value CLOSED CONFIRMED by orchestrator decision 2026-08-07 (Option A): grounding = AVTpro-Norwegian 1.5 s minimum + Corus 1.5 s/≤32 chars + own-formula floor; wpm precision note corrected to verifier-confirmed facts (see §5.17).
CURRENT     beats.js:23 `hold: 45 // 1.5s`. Rule 3.2 `holdFrames` (blueprint lines 249-251) caps beat density at ≥ D.hold.
DELTA       None — value unchanged. Wording corrected per P3.4 then per orchestrator decision 2026-08-07 (Option A); wpm precision note corrected; SFR-motion-4 filed (cite 39-1 amendment).
PLAN        None — verification-only.
DIFF        n/a — zero code edits (probe G1 PASS).
COUNTER     ATTEMPT 1 REJECTED — verifier ses_023bbb40dffeRWIFeoSPJ1iQVy (see §5.7): no published "1.5-3.0 s range for a 3-7 word line"; 180-220 wpm above broadcast caps; "1.5-3.0 s" span is the repo's own formula output (circular); gabrielpulecio flagged non-independent. ATTEMPT 2 REJECTED — verifier ses_023b6587affeYuEBqoxMUPnPe6 (see §5.11): arithmetic + AVTpro-Norwegian + Corus + formula all CONFIRMED; failures were the DCMP conjunct in the precision note (DCMP's caps are content-tiered, not a flat 140-180) and "at/above caps" not being universal. NO attempt 3 — P3.4 cap; ESCALATED; orchestrator decision 2026-08-07 = Option A + D (see §5.17): value CONFIRMED, wording corrected, no further dispatch.
STATUS      CONFIRMED (P3 + orchestrator decision 2026-08-07) — value; verdicts in §5.7, §5.11, §5.17

### CLAIM-motion-008 — E_PUSH = Easing.spring({damping:200}) → ζ = 10.0 → no bounce
ASSERTION   Easing.spring({damping: 200}) with Remotion's default config (mass 1, stiffness 100) gives a damping ratio ζ = 200/(2·√(100·1)) = 10.0, i.e. 10× critical damping, so the spring is overdamped and cannot bounce — matching Remotion's docs guidance that increasing damping removes the bounce.
SPEC REF    MOTION-BLUEPRINT §1.4 ("Push with no bounce: Easing.spring({damping: 200})", cite 6-1), §7.1/§7.3 no-overshoot rules, §7.2 the one overshoot exception.
SOURCES     [1] first-party: remotion.dev/docs/spring — "To disable the default bounce, increase the `damping` parameter"; defaults damping 10, mass 1, stiffness 100.
            [2] first-party: github.com/remotion-dev/skills/blob/main/skills/remotion-markup/timing.md — verbatim "A nice push movement with no bounce" = `Easing.spring({damping: 200})`.
            [3] first-party (machine): node_modules/remotion/dist/cjs/spring/spring-utils.js:35 `const zeta = c / (2 * Math.sqrt(k * m))`; :59 oscillation branch only for ζ < 1.
            [4] third-party: en.wikipedia.org/wiki/Damping — ζ > 1 = overdamped: "the solution is simply a sum of two decaying exponentials with no oscillation".
            [5] third-party: phys.libretexts.org — ζ = γ/2√(mk); ζ > 1 → "overdamped behavior, in which x returns to 0 with an exponential decay without any oscillations".
RE-VERIFIED YES — ζ(200,100,1) = 200/20 = 10.0 computed (probe G3); characteristic roots λ = −0.501, −199.499 both real & negative → monotone decay, zero overshoot (probe G3); docs verbatim.
CURRENT     motion-graphics.jsx:43 `E_PUSH = Easing.spring({ damping: 200 })`; :950 push. growSpring :111 `{damping:16, stiffness:90}` → ζ = 0.843 < 1 → the ONE underdamped/overshoot site §7.2 permits. Legacy springs minimal.jsx:31-34 + cinematic-documentary.jsx:120-155 → ζ 1.77-5.59, all overdamped (probe G3) — none actually bounce despite being the "bouncy" legacy path; consistent with the policy.
DELTA       None.
PLAN        None — verification-only.
DIFF        n/a — zero code edits (probe G3/G4 PASS).
COUNTER     (appended after Phase 3)
STATUS      CONFIRMED (P3) — verdict in §5.8

### CLAIM-motion-009 — E_OUT = Easing.bezier(0.16,1,0.3,1) is Remotion's decelerate guidance, not Material's curve
ASSERTION   Easing.bezier(0.16, 1, 0.3, 1) is Remotion's own documented standard-decelerate guidance (timing.md "Bézier easing"), not Material's curve — Material's standard-decelerate token is cubic-bezier(0, 0, 0, 1).
SPEC REF    MOTION-BLUEPRINT §1.4 ("Standard decelerate: Easing.bezier(0.16, 1, 0.3, 1)"), §12 sources list.
SOURCES     [1] first-party: github.com/remotion-dev/skills/blob/main/skills/remotion-markup/timing.md — verbatim "Bézier easing — Pass values like you would to a CSS cubic-bezier function." with `Easing.bezier(0.16, 1, 0.3, 1)`.
            [2] first-party: material-components-android docs/theming/Motion.md — `motionEasingStandardDecelerateInterpolator` = cubic-bezier(0, 0, 0, 1) (the blueprint's own first-party citation for Material, and the correct M3 value).
            [3] third-party: github.com/happyvertical/smrt/blob/main/packages/smrt-ui/src/theme/tokens.ts — M3 literals: standardDecelerate = 'cubic-bezier(0, 0, 0, 1)', standard = 'cubic-bezier(0.2, 0, 0, 1)'.
            [4] third-party: github.com/NahanaBanahnah/react-easy-ease — GM_StandardDecelerate preset = same M3 curve family.
RE-VERIFIED YES for the Remotion attribution (timing.md verbatim). Precision note: the live M3 standard-decelerate token is cubic-bezier(0,0,0,1) per first-party MDC — the blueprint's §1.4 does NOT itself assert an M3 curve value, so there is nothing to amend; the M3 value is recorded here so no future reader mistakes (0.16,1,0.3,1) for a Material curve.
CURRENT     motion-graphics.jsx:40 `E_OUT = Easing.bezier(0.16, 1, 0.3, 1)`; layers/Layer.jsx:69 (header comment :66-67 explicitly notes this is "the exact value the live renderer uses").
DELTA       None.
PLAN        None — verification-only.
DIFF        n/a — zero code edits.
COUNTER     (appended after Phase 3)
STATUS      CONFIRMED (P3) — verdict in §5.9

### CLAIM-motion-010 — Rule 1.4: exits one token faster (base 9f in → short 6f out)
ASSERTION   Exits run one duration token faster than entrances (blueprint Rule 1.4: a 9-frame/300 ms base entrance exits in 6 frames/200 ms short) — matching Material M1 (225 ms enter vs 195 ms exit), M3 standard pair (250 ms enter vs 200 ms exit), NN/g (300 ms appear vs 200-250 ms disappear) and UI Craft (~75% exit duration).
SPEC REF    MOTION-BLUEPRINT §1.3 Rule 1.4 (lines 150-151), cite 12-1.
SOURCES     [1] first-party: m1.material.io/motion/duration-easing.html — enters 225 ms, exits 195 ms (exit ≈ 87% of enter).
            [2] first-party: m3.material.io/styles/motion/easing-and-duration/applying-easing-and-duration — Standard decelerate 250 ms enter the screen; Standard accelerate 200 ms exit (exit = 80%).
            [3] third-party: nngroup.com/articles/animation-duration/ — "a popup window may take 300ms to appear, but only 200 or 250ms to disappear".
            [4] third-party: skills.smoothui.dev/docs/motion — "Exit runs at ~75% of entrance duration. This is the one rule that matters most."
RE-VERIFIED YES — D.base→D.short is 300→200 ms = 67%; the live sources bracket 67-87% (all exits < entrances, ratio 67-87%) — the one-token rule is the Material-style expression of the same directional finding; blueprint's own cite 12-1 (Material: "objects leaving the screen may use shorter durations") re-confirmed by the M1/M3 pairs.
CURRENT     motion-graphics.jsx:98-104 `stageExitStyle` — exit over D.short (6f) with E_IN, "never overshoots", while entrances (pop/rise) run over D.base (9f) with E_OUT. Layer.jsx:175-181 exit over `exitDur` with E_IN.
DELTA       None.
PLAN        None — verification-only.
DIFF        n/a — zero code edits.
COUNTER     (appended after Phase 3)
STATUS      CONFIRMED (P3) — verdict in §5.10

### CLAIM-motion-011 — Rule 1.6: one primary mover first + stagger D.micro (4f) — [PHASE 1 RE-ENTRY per P3.4, 2026-08-07]
ASSERTION   The primary mover — per Rule 1.6 the element that animates "first, largest" — is the icon, which animates first at tA − D.micro (4 frames = 133 ms); the secondary headline animates at tA, i.e. 133 ms BEHIND the hero (blueprint Rule 1.6). The 133 ms offset sits inside equal.design's related-items bracket (80-150 ms) and below the 300 ms primary animation duration (Figma: offsets significantly shorter than the animation duration), while exceeding the tighter per-item/sibling ranges (Material choreography ≤20 ms per item; designsystems.one 40-80 ms; UI Craft 30-80 ms) — recorded as a bracket finding, not a match claim.
SPEC REF    MOTION-BLUEPRINT §1.4 Rule 1.6 (lines 168-170), §4.3 Rule 4.3 ("Furniture never animates during a content beat").
SOURCES     [1] third-party: help.figma.com/hc/en-us/articles/41239278373271-Motion-design-fundamentals-Sequencing — "the hero should animate first without delay. Delaying the primary object in a sequence can make the UI feel unresponsive"; "offsets between objects should be significantly shorter than the duration of each animation" (133 ms ≈ 44% of the 300 ms primary — shorter, but borderline for "significantly").
            [2] third-party: equal.design/blog/5-rules-for-motion-in-ui-transitions — "closely related items can appear after a delay of 80-150 milliseconds, while distinct groups might follow after 200-300 milliseconds" (the bracket containing 133 ms).
            [3] first-party: m1.material.io/motion/choreography.html — "Begin each item's staggered entrance no more than 20ms apart" (133 ms exceeds this per-item cap; corroborated by mdui.org mirror).
            [4] third-party: designsystems.one/foundations/motion — "Stagger by 40-80 ms per item" (133 ms exceeds this band).
            [5] third-party: skills.smoothui.dev/docs/motion — "Stagger is 30-80 ms between siblings" (133 ms exceeds this band).
RE-VERIFIED YES — 133.33 ms = 4/30 s (probe G1); memberships and exclusions confirmed by two independent verifiers (80-150 in; ≤20 / 40-80 / 30-80 out; 133 < 300). Attempt-2 wording ("hero at tA, no delay") REJECTED — the implementation puts the hero ICON at tA−4 and the secondary headline at tA, so the hero LEADS and the secondary trails 133 ms behind; corrected to mirror the code. Earlier card notes removed: "matching all three brackets" (false) and "top of the 20-80 ms ranges" (numerically false — 133 ∉ 20-80).
CURRENT     StatementScene (motion-graphics.jsx:925-941): icon POP at tA−4 (=D.micro), headline RISE at tA, comment "Nothing else." HEADLINE_DELAY map :48-57 (0-18 frame offsets). Rule 4.3: stage furniture animates only at section boundaries.
DELTA       None (value stands: 133 ms is inside published related-items guidance). Wording SFR-motion-2 (already filed) covers "alone" → "unopposed" and now carries the accurate bracket split (see §3).
PLAN        None — verification-only.
DIFF        n/a — zero code edits.
COUNTER     ATTEMPT 1 REJECTED — verifier ses_023b64b6affe0Q3ytivZXPBDyf: 133 ms violates two of the three named brackets (6.7× MDC's 20 ms ceiling; 1.7-3.3× the 40-80 ms band); only equal.design's 80-150 ms contains it. ATTEMPT 2 REJECTED — verifier ses_023b164d4ffeb26TaHnuAWEmVn: all external brackets verified; failure was the implementation conjunct ("hero at tA, no delay" contradicts the code — hero icon at tA−4, secondary headline at tA). ATTEMPT 3 CONFIRMED — verifier ses_023acc4b2ffei6TJXWg7ooybpe: all four conjuncts pass; wording mirrors the code. See §5.16.
STATUS      CONFIRMED (P3) — verdict in §5.16 (after 3 attempts)

### CLAIM-motion-012 — Rule 5.3: springTiming durationRestThreshold 0.001 (default 0.005)
ASSERTION   springTiming()'s durationRestThreshold default is 0.005 and Remotion's docs recommend a low threshold, using 0.001 in their own example — the blueprint's Rule 5.3 value of 0.001 matches the docs.
SPEC REF    MOTION-BLUEPRINT §5 Rule 5.3 (lines 395-396), cite 11-1.
SOURCES     [1] first-party: remotion.dev/docs/transitions/timings/springtiming — `durationRestThreshold` default 0.005; "Recommendation: Set a low duration rest threshold"; docs' own example `springTiming({config: {damping: 200}, durationInFrames: 30, durationRestThreshold: 0.001})`.
            [2] first-party (machine): node_modules/remotion/dist/cjs/spring/measure-spring.js:11 — `threshold = 0.005` default; node_modules/@remotion/transitions/dist/timings/spring-timing.js + dist/esm/index.mjs — `options.durationRestThreshold` passed through (probe G4).
RE-VERIFIED YES — default 0.005 machine-confirmed; the docs' recommendation text and their 0.001 example confirm the blueprint's value and its own caveat ("accepting a slightly longer animation").
CURRENT     ZERO springTiming/TransitionSeries usage in src/skills/remotion-render (grep: only comments). motion-graphics.jsx:32-34 documents the deliberate divergence (TransitionSeries would desync beats from audio); the stage-7 implementation crossfades the Stage over 12 frames instead. Rule 5.3 therefore applies to build step §11.7, not to current code — unimplemented, not contradicted.
DELTA       None (value verified). Current-state note: rule not yet wired; §11.7 is the wiring step.
PLAN        None — verification-only.
DIFF        n/a — zero code edits (probe G4 PASS).
COUNTER     (appended after Phase 3)
STATUS      CONFIRMED (P3) — verdict in §5.13

### CLAIM-motion-013 — Rule 1.5: always clamp + output:'perceptual-scale' on scale
ASSERTION   Every interpolate() must set both extrapolate clamps and every scale interpolation must pass output: 'perceptual-scale' (blueprint Rule 1.5) — both are stated verbatim in Remotion's timing.md, and scale-change perception is non-linear, so the compensation is a real principle, not a Remotion-ism.
SPEC REF    MOTION-BLUEPRINT §1.4 Rule 1.5 (lines 164-166), §12 sources list.
SOURCES     [1] first-party: github.com/remotion-dev/skills/blob/main/skills/remotion-markup/timing.md — clamp example verbatim; "Animating scale … if the output is linear, the perceived scale would be smaller the larger the scale gets. Use this option to compensate:" with `output: 'perceptual-scale' // <- Add this to scale animations`; the option also appears in the multi-keyframe example.
            [2] first-party: remotion.dev/docs/interpolate — `extrapolateLeft`/`extrapolateRight: 'clamp'` API; without clamps "the value can go outside the range".
            [3] third-party: earth.google.com/studio/docs/advanced-features/logarithmic-adaptation/ — independent statement of the same perception principle for scale: "A camera, moving at a constant speed towards Earth, will seem to move much faster the closer it gets… This is an issue of human perception"; compensation (Logarithmic Altitude) makes the motion "appear perfectly linear".
RE-VERIFIED YES — timing.md verbatim (both rules, incl. the `perceptual-scale` comment); interpolate docs confirm clamp semantics; the perception principle independently corroborated.
CURRENT     motion-graphics.jsx:64-79 — `ease()` sets both clamps; `easeScale()` adds `output:'perceptual-scale'`; comment :60-62 ("every interpolate clamps (D1.2), every scale sets output: 'perceptual-scale' (D1.3), linear is banned (D1.1)"). layers/Layer.jsx:95-109 same. All scale sites route through easeScale (grep: `easeScale` at :85,:369,:423,:427, Layer.jsx:104).
DELTA       None — implemented.
PLAN        None — verification-only.
DIFF        n/a — zero code edits.
COUNTER     (appended after Phase 3)
STATUS      CONFIRMED (P3) — verdict in §5.14

---

## §2 — VERIFIED TOKEN TABLE (Stage-7 deliverable)

### 2.1 Duration tokens (MOTION-BLUEPRINT §1.3 @ FPS=30)

| Token | Frames | ms (computed) | Material M3 slot | Grounding | RE-VERIFIED |
|---|---|---|---|---|---|
| micro | 4 | 133.33 | between short2 (100) and short3 (150) — blueprint's own arithmetic, NOT a raw slot | §1.3 + M3 slots live | YES (001) |
| short | 6 | 200.00 | short4 = 200 ms — exact | M3 slot live | YES (002) |
| base | 9 | 300.00 | medium2 = 300 ms — exact | M3 slot live | YES (003) |
| large | 12 | 400.00 | medium4 = 400 ms — exact | M3 slot live | YES (004) |
| complex | 15 | 500.00 | long2 = 500 ms — exact | M3 slot live | YES (005) |
| push | 60 | 2000.00 | beyond slots (ceiling 1000 = extraLong4) — cadence-grounded | aibrify 1.5-3 s b-roll; opus 2-4 s; motionedits 3-5 s; Rule 1.1 45-90f | YES (006) |
| hold | 45 | 1500.00 | beyond slots — readability-grounded floor | AVTpro-Norwegian 1.5 s min; Corus 1.5 s ≤32 chars; formula chars/12+0.5 (gabrielpulecio dropped as circular) | YES (007, orchestrator-closed) |

### 2.2 Easing / spring values

| Value | Blueprint §1.4 | Behaviour (computed) | Repo current | RE-VERIFIED |
|---|---|---|---|---|
| E_PUSH = Easing.spring({damping:200}) | push with no bounce | ζ = 10.0 → overdamped → no oscillation (probe G3) | mg.jsx:43, :950 | YES (008) |
| E_OUT = Easing.bezier(0.16,1,0.3,1) | standard decelerate (Remotion guidance) | not Material's curve; M3 standard-decelerate = cubic-bezier(0,0,0,1) | mg.jsx:40, Layer.jsx:69 | YES (009) |
| E_IN = Easing.bezier(0.33,0,0.67,1) | accelerate (exits) | — | mg.jsx:42, Layer.jsx:72 | context |
| E_SETTLE = Easing.bezier(0.33,1,0.68,1) | settle | — | mg.jsx:41 | context |
| growSpring {damping:16, stiffness:90} | §7.2 one overshoot site | ζ = 0.843 < 1 → underdamped → overshoot | mg.jsx:111 | YES (008) |
| Legacy springs (minimal/cinematic-doc, damping 50-120) | pre-blueprint | ζ 1.77-5.59 → all overdamped, none bounce | minimal.jsx:31-34, cinematic-documentary.jsx:120-155 | observation (008) |

### 2.3 Rules

| Rule | Value | Sources | Repo current | RE-VERIFIED |
|---|---|---|---|---|
| Rule 1.4 exits one token faster | base 9f (300 ms) in → short 6f (200 ms) out | M1 225/195; M3 250/200; NN/g 300→200-250; UI Craft ~75% | mg.jsx:98-104 (exit over D.short, E_IN) | YES (010) |
| Rule 1.6 primary mover + stagger | hero first/alone; secondary +D.micro (4f=133 ms) | Figma; equal.design 80-150 ms; MDC ≤20 ms; UI Craft 30-80 ms | mg.jsx:925-941 (icon tA−4, headline tA) | YES (011) — wording note SFR-motion-2 |
| Rule 1.5 clamps + perceptual-scale | both clamps + output:'perceptual-scale' on scale | timing.md verbatim; interpolate docs; Google Earth Studio (perception) | mg.jsx:64-79; Layer.jsx:95-109 | YES (013) |
| Rule 5.3 durationRestThreshold | 0.001 (default 0.005, docs recommend low) | springTiming docs; measure-spring.js:11 (binary) | no springTiming usage yet (§11.7) | YES (012) |

---

## §3 — SPEC-AMENDMENT SFRs filed

### SFR-motion-1 (Wording — MOTION-BLUEPRINT.md, §12 line 607)
- **Target:** orchestrator-owned `MOTION-BLUEPRINT.md`.
- **Before:** `material-components-android/docs/theming/Motion.md — duration slot values (50–500 ms)`
- **After:** `material-components-android/docs/theming/Motion.md — duration slot values (50–1000 ms; the 16 slots: short1 50ms, short2 100ms, short3 150ms, short4 200ms, medium1 250ms, medium2 300ms, medium3 350ms, medium4 400ms, long1 450ms, long2 500ms, long3 550ms, long4 600ms, extraLong1 700ms, extraLong2 800ms, extraLong3 900ms, extraLong4 1000ms)`
- **Grounds:** the live first-party MDC Motion.md + Flutter motion.dart list 16 slots to 1000 ms; the blueprint's own §1.3 prose also stops at long2. D.micro..complex (50-500 ms) are the tokens in use, so no value is wrong — the range note is incomplete. Verifier-re-derived from the same first-party sources.
- **Value changes?** No — precision only.

### SFR-motion-2 (Wording — MOTION-BLUEPRINT.md, Rule 1.6 lines 168-170)
- **Target:** orchestrator-owned `MOTION-BLUEPRINT.md`.
- **Before:** "One primary mover per beat. The hero element animates first, largest, and alone. Secondary elements stagger `D.micro` (4f) behind it. Never three elements moving the same way at the same time."
- **After:** "One primary mover per beat. The hero element animates first, largest, and unopposed — no element animates with the same motion at the same time. Secondary elements stagger `D.micro` (4f) behind it and may overlap the primary's animation (offsets shorter than the animation duration; `D.micro` = 133 ms sits inside equal.design's 80-150 ms related-items bracket, while per-item sequences use tighter ranges — Material ≤20 ms per item, designsystems.one 40-80 ms, UI Craft 30-80 ms). Never three elements moving the same way at the same time."
- **Grounds:** every live source (Figma Sequencing, equal.design, MDC choreography, UI Craft, designsystems.one) has secondary elements starting WHILE the primary animates (overlap). "Alone" read literally (primary finishes first) contradicts the offset-shorter-than-duration rule the blueprint's own §1.4 cites. Value unchanged.
- **Value changes?** No — wording precision only. (Bracket summary amended after counter-check 011: the earlier "20-150 ms" blend was replaced with the accurate split — 133 ms matches only the 80-150 ms related-items bracket.)

### SFR-motion-4 (Wording — MOTION-BLUEPRINT.md, cite 39-1, §3.3 line 244)
- **Target:** orchestrator-owned `MOTION-BLUEPRINT.md`.
- **Before:** `<cite index="39-1">Comfortable reading is roughly 180–220 words per minute (about 3–4 words per second); a seven-word line typically needs 1.8–2.5 seconds on screen, and a practical display-time formula is seconds = (characters ÷ 12) + 0.5, rounded up to the nearest 0.25 s to align with beats.</cite>`
- **After:** `<cite index="39-1">Comfortable reading is roughly 180–220 words per minute (about 3–4 words per second); a seven-word line typically needs 1.8–2.5 seconds on screen, and a practical display-time formula is seconds = (characters ÷ 12) + 0.5, rounded up to the nearest 0.25 s to align with beats. Broadcast subtitle standards are tighter: Ofcom and BBC publish 160–180 wpm (Ofcom: pre-recorded "should not normally exceed 160 to 180 words per minute"; above 200 "difficult for many viewers"), ITC caps at ≤140 wpm (180 exceptional), and DCMP's caps are content-tiered (120–160 wpm standard, 225–235 wpm adult theatrical) — so D.hold is a conservative minimum floor, not a reading duration.</cite>`
- **Grounds:** two independent verifier sessions (ses_023bbb40dffeRWIFeoSPJ1iQVy, ses_023b6587affeYuEBqoxMUPnPe6) confirmed the value (45f = 1500 ms; AVTpro-Norwegian T7.1 = 1.5 s minimum; Corus "minimum of 1.5 seconds for up to 32 characters") but rejected the cite's wpm framing as not broadcast-accurate: 180-220 wpm exceeds Ofcom/BBC/ITC caps, and DCMP's caps are tiered, so "at/above caps" is not universal. Filed per orchestrator decision 2026-08-07 (Option D).
- **Value changes?** No — the D.hold value (45f = 1.5 s) and Rule 3.2 formula are unchanged; the cite gains an accurate broadcast-standards framing sentence.

---

## §4 — Observations (non-claim findings)

1. **Legacy springs never bounce.** All legacy `spring()` configs in `minimal.jsx:31-34` and `cinematic-documentary.jsx:120-155` have ζ between 1.77 and 5.59 (probe G3) — every one is overdamped. The old "bouncy" path cannot produce overshoot under Remotion's ζ formula. This is consistent with the blueprint's no-bounce policy and §7.1/§7.3; the only underdamped site in the repo is `growSpring` (ζ=0.843), which §7.2 explicitly permits. Stages 8-11 replace the legacy files anyway; no SFR.
2. **Rule 5.3 is currently unwired by documented choice.** `motion-graphics.jsx:32-34` explains the crossfade decision ("TransitionSeries would shorten it and desync beats from audio"). The value itself (0.001) is correct; the wiring is §11.7.
3. **`M3 standard-decelerate = cubic-bezier(0, 0, 0, 1)`** (first-party MDC + two third-party mirrors). The blueprint correctly attributes `(0.16,1,0.3,1)` to Remotion only; recorded here so no future reader conflates the two curves.
4. **Stagger value bracket finding (counter-check 011).** `D.micro` = 133 ms as a stagger offset is inside equal.design's related-items bracket (80-150 ms) but exceeds Material choreography's ≤20 ms per-item cap and the 40-80 ms / 30-80 ms per-item bands. Defensible as published related-items guidance; any value change is an orchestrator decision — SFR-motion-2 is wording-only.

---

## §5 — Counter-checks (Phase 3, appended after dispatch)

### §5.1 — CLAIM-motion-001 (D.micro): **CONFIRM**
- VERIFIER: `verify-independent` ses_023bfd7a2ffewd92Sq0Rfp88eC (hostile re-research; arithmetic re-derived by hand, not from probe)
- VERIFIER'S OWN SOURCES (P3.6): m3.material.io tokens-specs (short2=100ms, short3=150ms); Flutter `motion.dart` via api.flutter.dev + raw.githubusercontent (Durations.short2/short3 — note: re-labeled first-party Google, correcting the researcher's "third-party" label); md3-react.ngs.io + Glavo/md3-reference-hub mirrors (same values)
- VERDICT NOTES: 4/30 s = 133.33 ms re-derived independently; beats.js:17 `// 133ms` comment confirmed as blueprint's own frame arithmetic; 133.33 ms falls strictly between short2 and short3, matching probe G2 `slotAt(133.33) === null`. `npm run verify` blocked by host PS execution policy — environment, not claim failure.

### §5.2 — CLAIM-motion-002 (D.short): **CONFIRM**
- VERIFIER: `verify-independent` ses_023bfd0d0ffe58vEJwaevfIFQG
- VERIFIER'S OWN SOURCES (P3.6): m3.material.io tokens-specs (`md.sys.motion.duration.short4 | 200ms`); MDC-Android `docs/theming/Motion.md` (`?attr/motionDurationShort4 | 200ms`); beats.js:13,18
- VERDICT NOTES: 6/30 × 1000 = 200.0 ms exact (IEEE-754 note: (6/30)*1000 = 200.00000000000003, within probe tolerance and conventionally 200.0); both first-party sources independent of each other; git diff empty consistent with zero-DIFF.

### §5.3 — CLAIM-motion-003 (D.base): **CONFIRM**
- VERIFIER: `verify-independent` ses_023bfca74ffeOHt2ChCkmcgk3r
- VERIFIER'S OWN SOURCES (P3.6): m3.material.io tokens-specs (`medium2 | 300ms`); material-web `tokens/versions/v0_192/_md-sys-motion.scss` (`duration-medium2: 300ms`); hamen/material-3-skill mirror; md3-react.ngs.io (`medium2 | 300ms | Expansion`)
- VERDICT NOTES: 9/30 = 0.3 s exact; also cites blueprint §1.3 (lines 133-140) as its own source confirming the "only duration table" framing.

### §5.4 — CLAIM-motion-004 (D.large): **CONFIRM**
- VERIFIER: `verify-independent` ses_023bfc459ffe0hHVDj2wDFdTq3
- VERIFIER'S OWN SOURCES (P3.6): m3.material.io tokens-specs (`medium4 | 400ms`); Flutter `motion.dart` raw fetch (`Duration(milliseconds: 400)` — "generated from data in the Material Design token database"); material-foundation/material-tokens `css/motion.css` (`--md-sys-motion-duration-400: 400ms`)
- VERDICT NOTES: two directly-fetched first-party sources + live spec table; 12/30 × 1000 = 400.0 exact; no off-by-one, no adjacent-claim substitution.

### §5.5 — CLAIM-motion-005 (D.complex): **CONFIRM**
- VERIFIER: `verify-independent` ses_023bfbdfaffeDun9Nmjx75MPBB
- VERIFIER'S OWN SOURCES (P3.6): Flutter `motion.dart` (main branch raw, `long2 = Duration(milliseconds: 500)`); MDC-Android `docs/theming/Motion.md` (16-slot table `motionDurationLong2 | 500ms`, slots short1=50ms … extraLong4=1000ms); m3.material.io tokens-specs + applying-easing-and-duration ("Enter transition has a long duration of 500ms"); pub.dev material_design (third-party corroboration)
- VERDICT NOTES: verifier additionally confirmed the full 16-slot ladder (50 → 1000 ms), the same ladder recorded in probe G2; flagged that the researcher's source labels called Flutter motion.dart "third-party" where it is first-party — strengthens, no correction needed.

### §5.6 — CLAIM-motion-006 (D.push): **CONFIRM**
- VERIFIER: `verify-independent` ses_023bbbd51ffeXmEpbDkYN6J4Hn
- VERIFIER'S OWN SOURCES (P3.6): aibrify.com blog (1.5-3 s per b-roll shot; "a slow push-in can substitute for a cut if it delivers equivalent visual change"); opus.pro (one cut every 2-4 s); mediacollege.com ("Zoom instead of cutting" for jump cuts); clickyapps.com (zoom cuts create perceived motion without cutting); m3.material.io tokens-specs (slots terminate at extraLong4 = 1000 ms); api.flutter.dev `Durations.extralong4` (= 1000 ms); repo MOTION-BLUEPRINT.md:98 (Rule 1.1 45-90f), :308 (§4.1 IMAGE_BEAT 60-90f), MOTION-GRAPHICS-MANUAL.md:1083
- VERDICT NOTES: all five parts re-verified: 60/30 = 2000 ms exact; 2.0 s inside 1.5-3.0 s cadence; push-substitutes-for-cut is genuinely published guidance; IMAGE_BEAT budget 60-90f confirmed in repo spec; 2000 > 1000 ms ceiling → not a slot. Implementation read directly (motion-graphics.jsx:950, scale 1.05−push×0.05).

### §5.7 — CLAIM-motion-007 (D.hold): **REJECT** (attempt 1) — re-entered Phase 1, see corrected card
- VERIFIER: `verify-independent` ses_023bbb40dffeRWIFeoSPJ1iQVy
- VERIFIER'S OWN SOURCES (P3.6): BBC Subtitle Guidelines (160-180 wpm; ~0.3 s/word min); Ofcom Access Service Code A1.19 (160-180 wpm; >200 wpm "difficult for many viewers"); ITC 1999 (≤140 wpm pre-recorded); Netflix Timed Text (min 20 frames ≈ 833 ms); AVTpro Subtitling Style Guide Norwegian (1.5 s min — but Tr/It/De/Es/Zh/Sv editions set 1.0 s); DCMP (≤160 wpm; ≥2 s on screen); UniMelb (≤180 wpm; ≥2 s); ABC Delivery Specs (1 s/1 word, 2 s/≤26 chars, 3 s/≤40 chars); adlerschmidt legibility.info (13 chars/s ≈ 2.3 s per 30-char line)
- VERDICT NOTES: arithmetic half CONFIRMED (45/30 = 1500 ms exact). Grounding half REJECTED on three counts: (1) no published "1.5-3.0 s range for a 3-7 word line" exists — floors range 0.83 s (Netflix) to 2.0 s (DCMP/UniMelb); (2) "180-220 wpm" is above every broadcast subtitle speed cap (140-180 wpm); (3) the "1.5-3.0 s" span is the repo's own formula output relabeled (circular), and the formula's implied ~120-131 wpm contradicts the stated 180-220 wpm. gabrielpulecio.com flagged as possibly non-independent (uses the repo's own vocabulary "to align with beats") and dropped from grounding. Value (1500 ms) is compatible with real minimums (AVTpro Norwegian 1.5 s; Corus 1.5 s ≤32 chars) — corrected card re-entered Phase 1 (P3.4, attempt 2 in flight).

### §5.8 — CLAIM-motion-008 (E_PUSH ζ=10.0 no bounce): **CONFIRM**
- VERIFIER: `verify-independent` ses_023bba82cffe6ryS9WYpfTjBV6
- VERIFIER'S OWN SOURCES (P3.6): Wikipedia "Damping" (ζ>1 = overdamped, "no oscillation"); Physics LibreTexts 8.2 Damped Harmonic Oscillator (same ζ = γ/2√(mk) formula, real negative roots); MathWorks damped-oscillator page; remotion.dev/docs/spring ("To disable the default bounce, increase the damping parameter"; defaults damping 10 / mass 1 / stiffness 100); remotion.dev/docs/easing (Easing.spring delegates into same solver); installed binary spring-utils.js:35,59 + easing.js:55-82
- VERDICT NOTES: ζ = 200/20 = 10.0 exact; oscillation branch only for ζ<1 confirmed in installed binary; Easing.spring({damping:200}) mapping to the same solver confirmed at easing.js:55-82.

### §5.9 — CLAIM-motion-009 (E_OUT is Remotion's curve, not M3's): **CONFIRM**
- VERIFIER: `verify-independent` ses_023bb9b46ffejDFB999gv02B82
- VERIFIER'S OWN SOURCES (P3.6): remotion-dev/skills timing.md ("Bézier easing" section, verbatim `Easing.bezier(0.16, 1, 0.3, 1)`); remotion-dev/remotion monorepo skills timing.md (identical content, blob SHA 4c224f8); remotion PR #6973 (JonnyBurger: "Prefer Bézier easing over springs" — provenance); MDC-Android docs/theming/Motion.md (`motionEasingStandardDecelerateInterpolator` = cubic-bezier 0,0,0,1); Flutter motion.dart (`standardDecelerate = Cubic(0.0, 0.0, 0.0, 1.0)`); prisma-ui + material-3-skill mirrors
- VERDICT NOTES: both halves first-party ×2. Curves genuinely different (x1 0.16 vs 0; y1 1 vs 0). Nuance: the literal phrase "standard decelerate" is the blueprint's own label — the claim's parenthetical anchors correctly to timing.md's "Bézier easing" section.

### §5.10 — CLAIM-motion-010 (Rule 1.4 exits one token faster): **CONFIRM**
- VERIFIER: `verify-independent` ses_023bb8f7cffeqdAGCRgb1vkDn1
- VERIFIER'S OWN SOURCES (P3.6): m1.material.io duration-easing (225 ms enter / 195 ms exit); m3.material.io applying-easing-and-duration (Standard 250 enter / 200 exit; worked example Enter 500 / Exit 200); nngroup.com/articles/animation-duration (300 ms appear / 200-250 ms disappear — verbatim); ui-craft references/motion.md ("Exit runs at ~75% of entrance duration"; --motion-medium 280 → ~200); LottieFiles motion-design-skill (65-75%); Atlassian (reduce exit 50-100 ms vs entrance)
- VERDICT NOTES: every quoted number matches its source verbatim; direction (exits shorter) unanimous across all sources; 67% ratio sits inside the 67-83% envelope; code read directly (stageExitStyle D.short/E_IN vs entrances D.base; Layer.jsx:88 EXIT_DUR = D.short, :175-181).

### §5.11 — CLAIM-motion-007 (D.hold) attempt 2: **REJECT** — ESCALATED to user (P3.5; 2 re-attempts exhausted)
- VERIFIER: `verify-independent` ses_023b6587affeYuEBqoxMUPnPe6
- VERIFIER'S OWN SOURCES (P3.6): AVTpro_StyleGuide_No.pdf (T7.1 "The minimum duration of a subtitle on screen is 1.5 seconds" — edition-specific; Sv/De/It editions set 1.0 s); Corus Closed_Captioning_Standards_Protocol.pdf ("minimum of 1.5 seconds duration for up to 32 characters"; "Do not display any caption for less than 1.5 second"); DCMP-hosted NAD copy of the Corus protocol; Ofcom Access Service Code A1.19 (160-180 wpm pre-recorded); BBC (160-180 wpm); ITC 1999 (≤140 wpm, 180 exceptional); DCMP Captioning Guidelines + Captioning Key (content-tiered caps: 120-130 lower-middle, ~130-160 upper, 150-160 adult special-interest, 225/235 adult theatrical)
- VERDICT NOTES: arithmetic (45/30 = 1500 ms), AVTpro-Norwegian 1.5 s minimum, Corus 1.5 s/≤32 chars, and formula self-check (12/12+0.5 = 1.5 s) ALL CONFIRMED. Two failing conjuncts, both in the precision-note sentence: (1) "(Ofcom/BBC/ITC/DCMP: 140-180 wpm)" misattributes a 140-180 cap to DCMP — its caps are tiered 120-160 with 225/235 for adult theatrical; (2) "180-220 wpm sits at/above caps" is not universal — DCMP adult-theatrical 225/235 exceeds the bracket. Escalated per P3.5; recommendation: correct the precision-note conjunct (drop DCMP from the 140-180 list; note its tiered caps) and accept the value.

### §5.12 — CLAIM-motion-011 (Rule 1.6): **REJECT** (attempt 1) — re-entered Phase 1, corrected card, attempt 2 in flight
- VERIFIER: `verify-independent` ses_023b64b6affe0Q3ytivZXPBDyf
- VERIFIER'S OWN SOURCES (P3.6): help.figma.com 41239278373271 ("hero should animate first without delay"; offsets "significantly shorter than the duration of each animation"); m1.material.io/motion/choreography.html ("Begin each item's staggered entrance no more than 20ms apart"; "Do not wait for each item to fully animate"); mdui.org mirror of the same page; designsystems.one ("Stagger by 40-80 ms per item"); skills.smoothui.dev ("Stagger is 30-80 ms between siblings"); equal.design ("closely related items … 80-150 milliseconds")
- VERDICT NOTES: first half solid (arithmetic; implementation read directly — icon POP at tA−4, headline RISE at tA; Figma rule verbatim; Material ≤20 verbatim). Failure: the claim presented all three stagger brackets as "matched" — 133 ms is only inside equal.design's 80-150 ms; it is 6.7× MDC's 20 ms ceiling and 1.7-3.3× the 40-80 ms band. Verifier additionally flagged the card's own RE-VERIFIED note ("at the top of the 20-80 ms per-item ranges") as numerically false — 133 ∉ 20-80. Corrected card re-entered Phase 1; SFR-motion-2 "After"-text brackets amended; §4 observation filed.

### §5.13 — CLAIM-motion-012 (durationRestThreshold 0.001): **CONFIRM**
- VERIFIER: `verify-independent` ses_023b64144ffetwmttQF9UfiS4O
- VERIFIER'S OWN SOURCES (P3.6): remotion.dev/docs/transitions/timings/springtiming ("Default: 0.005"; section "Recommendation: Set a low duration rest threshold" — "we recommend 0.001"; the docs' own example passes `durationRestThreshold: 0.001`); github.com/remotion-dev/remotion measure-spring.ts + spring-timing.ts (0.005 default; genuine pass-through); installed binaries measure-spring.js:11, @remotion/transitions dist/timings/spring-timing.js:13,27, dist/esm/index.mjs:1275,1289
- VERDICT NOTES: all three legs confirmed, including installed binaries (remotion 4.0.505 / @remotion/transitions 4.0.506). Blueprint Rule 5.3 (lines 395-396) value 0.001 matches the docs' own example and recommendation.

### §5.14 — CLAIM-motion-013 (Rule 1.5 clamps + perceptual-scale): **CONFIRM**
- VERIFIER: `verify-independent` ses_023b63497ffeti3jCbkExZsNfg
- VERIFIER'S OWN SOURCES (P3.6): remotion.dev/docs/interpolate (extrapolate defaults to `extend`; `clamp` keeps output in range; `output` option available from v4.0.490, `perceptual-scale` returns Math.sqrt(0.5) at halfway); raw.githubusercontent remotion-dev/skills `skills/remotion-best-practices/remotion-markup/timing.md` (verbatim clamps example + `output: 'perceptual-scale' // <- Add this to scale animations` + "the perceived scale would be smaller the larger the scale gets"); installed binary interpolate.js:327 (signed-area sqrt branch) + interpolate.d.ts; Wikipedia "Stevens's power law" (visual-area exponent 0.7); appstate.edu psychophysics lecture; PubMed 13441853 (Stevens 1957, "On the psychophysical law")
- VERDICT NOTES: all three gates pass. Nuance (not rejection): timing.md demonstrates both-clamps as its standard example form; the mandatory wording is the blueprint's codification (Rule 1.5). Remotion package.json confirmed 4.0.505 ≥ 4.0.490 — `output` option supported in the installed binary.

### §5.15 — CLAIM-motion-011 (Rule 1.6) attempt 2: **REJECT** — re-entered Phase 1, implementation conjunct corrected, attempt 3 (final re-attempt) dispatched
- VERIFIER: `verify-independent` ses_023b164d4ffeb26TaHnuAWEmVn
- VERIFIER'S OWN SOURCES (P3.6): equal.design blog (80-150 ms related items); m1.material.io/motion/choreography.html ("Begin each item's staggered entrance no more than 20ms apart") + archived Google spec + mdui.org mirror; designsystems.one ("Stagger by 40-80ms per item"); skills.smoothui.dev ("30-80ms between siblings"); help.figma.com 41239278373271 (hero first without delay; offsets significantly shorter than duration)
- VERDICT NOTES: gates (a)-(d) all PASS (arithmetic 133.33 ms; equal.design 80-150; Material ≤20; 40-80 / 30-80). Failure: the implementation conjunct — "hero at tA, no delay" contradicts the cited code AND the card's own CURRENT line: the hero icon is at tA−4 (leading) and the secondary headline is at tA (trailing 133 ms behind the hero). The verifier notes no role assignment made the claim as worded true. Corrected assertion now mirrors the code (hero at tA−D.micro, secondary at tA); attempt 3 = final re-attempt per P3.4 — escalates if REJECTED.

### §5.16 — CLAIM-motion-011 (Rule 1.6) attempt 3 (final): **CONFIRM**
- VERIFIER: `verify-independent` ses_023acc4b2ffei6TJXWg7ooybpe
- VERIFIER'S OWN SOURCES (P3.6): m1.material.io/motion/choreography.html ("no more than 20ms apart"; mdui.org mirror); designsystems.one ("Stagger by 40-80ms per item"; "Keep individual delays small"); skills.smoothui.dev ("30-80ms between siblings … never more than 80ms per item"); equal.design ("closely related items … 80-150 milliseconds"); help.figma.com 41239278373271 ("offsets … significantly shorter than the duration"); repo files read directly (motion-graphics.jsx:48-57, 480-533, 925-941; beats.js:13,17,19; MOTION-BLUEPRINT.md:168-170)
- VERDICT NOTES: all four conjuncts pass. Code confirmed: icon (size 120, largest — line 936) POP at tA−4 (line 929 `Math.max(tA - D.micro, 0)`); headline RISE at tA (`HEADLINE_DELAY.STATEMENT = 0`, line 52; start at line 487). Hero leads, secondary trails 133 ms; 133 ∈ 80-150 and < 300 ms; 133 exceeds all three per-item/sibling ranges. Wording mirrors the code; both prior rejection causes addressed.

### §5.17 — CLAIM-motion-007 CLOSURE — orchestrator decision (P3.5), 2026-08-07: **CONFIRMED (value)**
- DECISION: Option A + Option D as recommended. No third verifier dispatch — the facts are established by both sessions; only the researcher's phrasing was wrong.
- APPLIED (Option A): precision-note corrected to verifier-confirmed facts ONLY — arithmetic 45f/30fps = 1500 ms; AVTpro-Norwegian T7.1 = 1.5 s minimum; Corus = "minimum of 1.5 seconds for up to 32 characters"; formula self-check (12/12+0.5 = 1.5 s). REMOVED: DCMP from the "(Ofcom/BBC/ITC/DCMP: 140-180 wpm)" list (replaced by an accurate standalone note — DCMP content-tiered 120-160 standard / 225-235 adult-theatrical); the "180-220 wpm sits at/above caps" conjunct (not universal); gabrielpulecio.com as a source (possibly circular — uses the repo's own vocabulary).
- FILED (Option D): SFR-motion-4 — amend MOTION-BLUEPRINT.md cite 39-1's "180-220 wpm" bracket to broadcast-standard-accurate framing. Exact BEFORE/AFTER in §3 (SFR-motion-4).
- RESULT: CLAIM-motion-007 = CONFIRMED (value). All 13 claims resolved: 12 CONFIRMED via counter-check + 007 CONFIRMED via orchestrator decision.
