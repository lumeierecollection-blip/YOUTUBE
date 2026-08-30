# data/audit/15/audit-motion.ledger.md

Audit lane: **audit-motion** — Stage 15 (Delete-list sweep).
Date: **2026-08-30**.
Domain: timing, easing, springs, stagger, drag, blur.
Method: CROSSCHECK-PROTOCOL Part 2 (three-phase applies only to edits I
make in my owned files) + the Stage 15 lane sweep (grep, classify, verdict).
All greps re-run live this session against `src/skills/remotion-render/`
(excluding `node_modules`); nothing copied from a register State column.

Ownership (edit allowed): `visual/states.js`, `visual/composition.js`,
`compositions/beats.js`, `compositions/scenes/stage.jsx`, `data/audit/**`.
Everything else read/grep-only; deletions there = SHARED-FILE REQUEST.

Scope note: the DEL table in CHECK-REGISTER §3.4 (grid) IS the gate list for
Stage 15. My primary rows: DEL-15, DEL-16, DEL-23, DEL-24, DEL-25, DEL-26.
Cross-cutting DEL matches inside my owned files are co-reported.

---

## Per-row verdict table

| Row | Pattern | Live-code hits | Verdict | Rationale |
|---|---|---|---|---|
| DEL-15 | `Easing.linear\|easing: *undefined` | 0 | **PASS** | No `Easing.linear` and no `easing: undefined` anywhere in the package. All `linear` matches are comments (motion-graphics.jsx:66 "linear is banned (D1.1)"), SVG `<linearGradient>` element names (not easing), and prose. D1.1 positive check satisfied (E_OUT/E_IN = bezier, springs = `MOT-09` damping-ratio family). |
| DEL-16 | `Math.sin(` outside arc helper | 11 hits | **FAIL** (+ AMEND proposal for designed uses) | Two background *breathe* idle pulses (motion-graphics.jsx:360, :393) are continuous `Math.sin(frame…)` background scales — the D5.1/MOT-14 "sine pulse" class. One temporal sine *wobble* (abstract-scenes.jsx:92) conflicts with D7. The other 8 hits are designed deterministic-seeded / static-spatial / arc-helper usage (see per-hit table). |
| DEL-23 | `Math.random` | 0 live | **PASS** (BLOCKER clean) | 8 hits, all block-comment lines (verified: every hit line begins with `*`). 0 executable occurrences. MOT-16 ("seeded jitter deterministic — grep Math.random = 0 hits") holds. |
| DEL-24 | `particle` | 0 live | **PASS** | Single hit stage.jsx:34 is a prose comment ("glow, particles and constant zoom get …"). No live particle system. |
| DEL-25 | `parallax` | pervasive, all inside designed system | **AMEND** | Every hit is either a comment or part of the positive-checked DEPTH-plane system (`visual/composition.js` planes, `run-visual-tests.js` parallax-factor + gradient + anchor tests, `stage.jsx` Plane, `abstract-scenes.jsx` plane comments, `strategies.js` drift label). No stray/un-designed parallax. Amend row to scope out the designed system (per §4.1 pairs-with-positive-check + DEL-17 precedent). |
| DEL-26 | `three\|THREE\.` | only verified `effects/` pipeline | **AMEND** | Live three.js/WebGL code exists ONLY in `effects/PhotoTreatment.jsx`, `effects/CanvasGrain.jsx`, `effects/PostFxReadyGate.jsx` — the verified `@remotion/three` + `@react-three/postprocessing` pipeline (register §3.12.12 real-photo render). All other `three` matches are the English word/dependency declarations. No stray 3D/lit geometry. Amend row to scope out the verified effects pipeline. |

---

## DEL-15 — Linear easing — PASS

Grep (`Easing\.linear|easing:\s*undefined` across package, non-node_modules): **0 hits**.
Broader `linear` (case-insensitive) grep: all matches are comments, the
`<linearGradient>` SVG element name (stage.jsx:355/421 — an SVG gradient def,
not easing; flagged separately under co-reports), or prose. No `Easing.linear`
and no `easing: undefined` in any code path. The positive check D1.1 ("linear
is banned", MOTION-GRAPHICS-MANUAL §D1.1) holds: all easing routes through
`E_OUT = Easing.bezier(0.16,1,0.3,1)` / `E_IN = Easing.bezier(0.33,0,0.67,1)`
(motion-graphics.jsx:79-83) and springs. **Verdict: PASS.**

---

## DEL-16 — Idle sine pulses — FAIL (with amendment proposal)

Own grep of `Math.sin(` — 11 live-code hits + the colour hit. Per-hit
classification against the DEL-16 target (an *idle / perpetual* pulse that
moves during a hold, per D5.1 and DETAIL-REFERENCE:287 "perpetual sine … the
definition of robotic"; MOT-14 "frames inside a hold differ" FAIL).

| File:line | Code | Class | Verdict |
|---|---|---|---|
| motion-graphics.jsx:94 | `jitter()` → `Math.sin(seed*12.9898)*43758.5453` | DESIGN FEATURE — deterministic seeded hash for ±20% duration variance (PART 7); `seed` is a constant per instance, sine evaluated once per entrance, NOT `Math.sin(frame)`. Backed by MOT-16/MOT-17 (jitter deterministic, touches only timing/overshoot). | AMEND-OK |
| motion-graphics.jsx:116 | `popStyle` overshoot `1.03+\|Math.sin(start*7.13)\|*0.05` | DESIGN FEATURE — D2.1 POP per-instance overshoot in [1.03,1.08]; constant per instance. | AMEND-OK |
| motion-graphics.jsx:118 | `popStyle` tilt `Math.sin(start*3.7)*tiltMax` | DESIGN FEATURE — D2.1 POP per-instance tilt that settles to 0; constant per instance. | AMEND-OK |
| motion-graphics.jsx:360 | Background dotGrid `breathe = 1 + BREATHE_AMPLITUDE*Math.sin((2π*frame)/(fps*20))` | **LIVE VIOLATION** — continuous `Math.sin(frame)` scale on the background dot-grid layer, moving during every hold. Background "breathing" is exactly what D5.1 bans ("No idle pulsing, no breathing"). | **FAIL** |
| motion-graphics.jsx:393 | Background CanvasGrain `scale: 1 + BREATHE_AMPLITUDE*0.6*Math.sin((2π*frame)/(…*1.4)+π/3)` | **LIVE VIOLATION** — continuous `Math.sin(frame)` scale on the grain layer (phase-shifted). Same idle-pulse class as 360. | **FAIL** |
| motion-graphics.jsx:553 | `DashedRing` `ey = y + bigR*Math.sin(rad)` | LEGITIMATE REUSE — circular-arc endpoint (pie-slice clip). This IS the arc helper the DEL-16 pattern exempts. | OK |
| abstract-scenes.jsx:92 | `VisualMetaphorScene` destabilising mode: `wobble = [0,1,2,3].map(i => Math.sin(frame*0.13+i*1.7)*9*a)` | **LIVE VIOLATION** — temporal sine `wobble` on `PressureWalls` (register §3.12.9). Continuous `Math.sin(frame…)` wall wobble; D7 lists "wobble" as forbidden; not positive-checked (register §3.12.9 states the PressureWalls path "has NOT been rendered and looked at"). | **FAIL** |
| primitives.jsx:91 | `seeded()` `Math.sin(seed*12.9898)*43758.5453` | DESIGN FEATURE — deterministic pseudo-random hash; constant per seed; used for stable scatter positions. Backed by MOT-16. | AMEND-OK |
| stage.jsx:391 | `FieldGround` `yy = y + Math.sin(s*1.3+seeded(…)*6)*wobbleAmp` | DESIGN FEATURE — static spatial contour wave (sine over *spatial* index `s`, not over `frame`); deterministic per-frame, never moves during a hold. Register §3.12.9 documents the wavy-band FieldGround as the positive redesign replacing the concentric-ring bullseye. | AMEND-OK |
| structure-scenes.jsx:822 | Relationship chain `droop = Math.sin(t*π)*sag` (`t = i/(n-1)`) | LEGITIMATE REUSE — static spatial hanging-chain arc (sine over index `t`, not time). Not an idle pulse. | OK |
| tokens.js:101 | `b: C*Math.sin(hr)` | OTHER-SCOPE — OKLab hue→RGB colour maths. Colout-lane domain (`styles/tokens.js`), not mg motion. Co-reported. | (colour lane) |

**Verdict: FAIL.** The mg background *breathe* (motion-graphics.jsx:360, :393)
and the PressureWalls *destabilising* wobble (abstract-scenes.jsx:92) are live
idle/temporal sine motions. The designed deterministic-seeded / static /
arc-helper uses are AMEND candidates and should NOT be deleted.

**IMPORTANT CORRECTION to the brief's premise (evidence, verified this
session):** the brief said the mg background "breathe" (motion-graphics.jsx
~360/393) was "reportedly re-engineered as a gated texture effect under
stage-12 COL gates". That is **NOT supported**. The stage-12 audit-color
ledger (`data/audit/12/audit-color.ledger.md`, SFR-12-COL-1, Diff A/B) carried
the `breathe` line through verbatim from BEFORE→AFTER — i.e. the colour lane
**retained** it, it did not gate or re-engineer it. The COL gates that landed
(COL-17/18 dot-grid density, COL-19 absolute pitch, check-dot-grid-density.mjs)
check grid density/geometry, NOT whether the breathe is an allowed idle pulse.
No COL gate sanctions continuous background breathing. The breathe therefore
remains a live D5.1/MOT-14-class violation, and the register's own MOT-14
("Frames inside a hold differ <0.5%", **FAIL — sine pulse**) corroborates that
a live sine pulse is the current known defect.

**AMENDMENT PROPOSAL — DEL-16 (per DEL-17 format, register §4.2):** keep the
row but scope its pattern to the *idle/continuous* class while excluding the
designed deterministic-seeded / static-spatial / arc-helper uses. Proposed
amended row:

```
| DEL-16 | Idle sine pulses | `Math.sin(frame\*\|Math.sin,`) OP `Math.random` | MAJOR |
```

is NOT the right form; DEL patterns are single-grep. Proposed amended
definition and register note:

> **DEL-16 — Idle sine pulses.** Pattern: `Math.sin\(` where the argument
> depends on the live frame counter (a *perpetual / idle* pulse) — NOT a
> deterministic seeded sampling (`Math.sin(seed…)`, evaluated once per
> instance: `jitter()`/`popStyle()` motion-graphics.jsx:94/116/118,
> `seeded()` primitives.jsx:91), NOT a static spatial sine (`FieldGround`
> stage.jsx:391, chain `droop` structure-scenes.jsx:822), and NOT the arc
> helper (motion-graphics.jsx:553, already exempt). Positive pairs: D5.1
> "no idle pulsing/breathing", MOT-14 (hold-stability), MOT-16 (deterministic
> seeded jitter), D2.x entrance set. Retains the fail on the background
> breathe (`Motion-graphics.jsx:360/393`) and any wall wobble
> (`abstract-scenes.jsx:92`).

**Deletion needed (SHARED-FILE REQUEST, file outside my ownership):**
- Remove the idle `breathe` scale from the mg background (motion-graphics.jsx
  :360 and :393, and the BREATHE_* constants :353-354) so the dot-grid and
  grain texture layers are static per-frame.
- Resolve the PressureWalls destabilising wobble (abstract-scenes.jsx:92):
  either ground it as a designed, hold-safe archetype (AMEND with evidence) or
  remove it (D7 forbids wobble; not render-verified).

---

## DEL-23 — `Math.random` — PASS (BLOCKER clean)

Grep `Math.random` — 8 hits, every one a comment line (verified by reading the
leading 40 chars of each: all begin `*`). 0 executable occurrences.

stage.jsx:262, primitives.jsx:107, quantity-scenes.jsx:121,
structure-scenes.jsx:131, GeospatialRadiusScene.jsx:80, composition.js:34,
director.js:388, sound-design.js:337 — all comment-only ("no Math.random … so
the same script renders identically"). MOT-16 holds. **Verdict: PASS.**

---

## DEL-24 — Particle systems — PASS

Grep `particle` (case-insensitive) — 1 hit, stage.jsx:34, a prose design
comment ("glow, particles and constant zoom get …"). No live particle system,
no `Particles`/`particleField` component. **Verdict: PASS.**

---

## DEL-25 — Parallax / depth layers — AMEND

The rebuild deliberately re-implements a depth-plane system
(`visual/composition.js` DEPTH profiles + `Shot`/`planeOffset`), positive-
checked by `run-visual-tests.js` — three dedicated tests:
- "depth planes are far enough apart to be seen as depth" (≥2× parallax
  gradient, ≤4 planes) — run-visual-tests.js:518
- "a plane ends up moving exactly its parallax factor times the camera" —
  run-visual-tests.js:541
- "every plane carries a depth anchor, and the subject stays sharp"
  (blur/saturate/opacity) — run-visual-tests.js:576

Every `parallax` hit belongs to one of:
- the designed plane table/factor logic (`composition.js:258,262-264,270-273,
  298`),
- comments about the system (`composition.js:29,233,248,283`; `stage.jsx:32,
  161,169,176`; `abstract-scenes.jsx:232,289`; `structure-scenes.jsx:129`;
  `strategies.js:306` drift label),
- the parallax-factor motion tests (`run-visual-tests.js:520,532,541,551,567,
  568,577,592`).

No stray / un-designed parallax outside the system. Per register §4.1 (every
DEL pairs with a positive check) and the DEL-17 inverted precedent (§4.2), this
is an AMEND, not a deletion.

**AMENDMENT PROPOSAL — DEL-25.** Proposed amended row + register note:

> **DEL-25 — Parallax / depth layers.** Pattern `parallax`: AMENDED — the
> designed DEPTH-plane system (`visual/composition.js` DEPTH_PROFILES +
> `Shot`/`planeOffset`, `compositions/scenes/stage.jsx` Plane, tested in
> `visual/run-visual-tests.js` depth tests) is a deliberate, positive-checked
> feature (parallax-factor motion tests, COL-20). A `parallax` match inside
> that system is NOT a violation. Any OTHER parallax (outside the plane
> system, or a plane without a blur/saturate/opacity depth anchor) is a FAIL.
> Positive pairs: run-visual-tests.js depth tests; COL-20.

---

## DEL-26 — Three.js / WebGL geometry — AMEND

The only live three.js/WebGL code is in the verified `effects/` pipeline:
- `effects/PhotoTreatment.jsx` — `import * as THREE from "three"`;
  `THREE.TextureLoader` (:101), `THREE.SRGBColorSpace` (:102);
  `LUTCubeLoader` from `three/examples/jsm`; `ThreeCanvas` from
  `@remotion/three`; `useLoader` + postprocessing effects
  (`Vignette, Noise, ChromaticAberration, LUT, DotScreen`). Verified end-to-
  end against a real sourced photo in register §3.12.12 (`qa-render-image-
  evidence.mjs`).
- `effects/CanvasGrain.jsx` — `ThreeCanvas` + `@react-three/postprocessing`
  `NoiseEffect` for the harvest grain; wired into the mg background
  (motion-graphics.jsx:397).
- `effects/PostFxReadyGate.jsx` — `useThree` from `@react-three/fiber`.

All other `three`/`THREE.` matches are: the English word "three" in
prose/comments/fixtures/numbers, or dependency declarations
(`three`, `@remotion/three`, `@react-three/*`, `@types/three`) in
package.json / package-lock.json — required to run the verified pipeline, not
stray usage. There is no stray 3D geometry (no `<mesh>`, no box/plane
geometry creating fake 3D objects) anywhere else; register §3.12.9 confirms
fake-3D bevels were removed.

**AMENDMENT PROPOSAL — DEL-26 (per DEL-17 format).** Proposed amended row +
register note:

> **DEL-26 — Three.js / WebGL geometry.** Pattern `three\b\|THREE\.`: AMENDED —
> allowed inside the verified `@remotion/three` + `@react-three/postprocessing`
> photo-treatment/grain/effects pipeline (`effects/PhotoTreatment.jsx`,
> `effects/CanvasGrain.jsx`, `effects/PostFxReadyGate.jsx`) and the dependency
> declarations (`three`, `@remotion/three`, `@react-three/*`) those require.
> Positive pair: register §3.12.12 (verified real-photo render via
> `@remotion/three`). Any THREE/three.js geometry that renders a 3D *object*
> (mesh/geometry/primitive) outside that pipeline, or any fake-3D lit scene,
> remains a FAIL (see §3.12.9 "do NOT use fake 3D bevels"). The English word
> "three" is a pattern false positive and must be case-bound (`THREE\.` /
> `react-three`) to be meaningful.

Note: `CanvasGrain` being wired into the mg background raises a related but
distinct question under DEL-28 ("Global film grain in this style — `grain` in
mg style", MINOR, another lane's row). Not adjudicated here (out of my row
set), co-reported for the owning lane.

---

## Co-reports

1. **DEL-26 partial / DEL-28 overlap.** `effects/CanvasGrain.jsx` is wired into
   the mg background (`compositions/motion-graphics.jsx:397`). Whether applying
   postprocessing grain to the flat mg canvas violates the DEL-28 "no global
   film grain in this style" MINOR is the owning (audit-color/audit-render)
   lane's call; the `THREE.`/three.js usage itself is confined to the verified
   effects pipeline (see DEL-26 above).

2. **`tokens.js:101` `Math.sin` — colour lane.** `b: C*Math.sin(hr)` is OKLab
   hue→RGB colour maths in `styles/tokens.js`. This is colour-domain, not mg
   motion.

3. **`<linearGradient>` defs in `stage.jsx` (my owned file) — DEL-18 / COL-13
   observation for the audit-color lane.** `SubstanceGround` (stage.jsx:355),
   `AtmosphereGround` (stage.jsx:421) define *live* SVG `<linearGradient>`
   elements used via `fill="url(#sub-floor)"` / `fill="url(#atmo-haze)"` as the
   ground-floor and altitude-haze depth anchors of the designed depth-plane
   system. These:
   - match DEL-18's `gradient` pattern (other lane's row), and
   - were NOT listed in the audit-color stage-12 COL-13 scan (which found only
     comment/removal hits and stage.jsx:169 comment) — either these defs were
     added after stage 12 or the COL-13 grep missed them.
   They appear justified as atmospheric depth cables (depth anchors are
   positive-checked), but the owning lane should re-scan and formally resolve
   the DEL-18/COL-13 status. Not my row; not edited.

---

## SHARED-FILE REQUESTS (all deletions in files OUTSIDE my ownership)

### SFR-motion-15-1 — remove the mg background idle "breathe"

**File:** `src/skills/remotion-render/compositions/motion-graphics.jsx`
(orchestrator-owned shared file; not in my write list).

**Why:** the background `breathe` is a live DEL-16 idle sine pulse (continuous
`Math.sin(frame…)` scale on the dot-grid and grain layers) that the manual's
D5.1 bans and that the register's MOT-14 flags ("FAIL — sine pulse").

**Requested before→after (delete-then-replace):**

```jsx
// BEFORE
const BREATHE_PERIOD_SEC = 20;
const BREATHE_AMPLITUDE = 0.015;
// ...
  const breathe = 1 + BREATHE_AMPLITUDE * Math.sin((2 * Math.PI * frame) / (fps * BREATHE_PERIOD_SEC));
```
and the two `scale:` applications:
- :373 `style={{ ..., scale: `${breathe}`, transformOrigin: "center" }}` on the dotGrid `Solid`
- :393 `scale: `${1 + BREATHE_AMPLITUDE * 0.6 * Math.sin((2*Math.PI*frame)/(fps*BREATHE_PERIOD_SEC*1.4)+Math.PI/3)}``  on the CanvasGrain wrapper

```jsx
// AFTER — texture layers static (no scale on the dot grid / grain layers)
// dotGrid Solid:  style={{ position:"absolute", inset:0, opacity: grid.opacity }}
// CanvasGrain wrapper:  style={{ position:"absolute", inset:0 }}
```
Remove the `BREATHE_*` constants (:353-354) and the `breathe` computation
(:360). Keep `useCurrentFrame()`'s `frame`: it is still consumed at :363 by
`dotGridStateForFrame(sectionRanges, beats, frame)`, so it does NOT become
unused. (Also update the :345-352 / :386-389 comments that describe the
breathing-edge rationale and "parallax" between the two layers, since the depth
cue they described is the breathe.)

**Not in scope:** the dot-grid density wiring (COL-17/18, intact), the
CanvasGrain itself (DEL-28 lane), the `Math.sin` designed-seeded uses.

### SFR-motion-15-2 — resolve the PressureWalls destabilising wobble

**File:** `src/skills/remotion-render/compositions/scenes/abstract-scenes.jsx`
(not in my write list).

**Why:** the `destabilising` mode passes a temporal sine `wobble`
(`Math.sin(frame*0.13 + i*1.7)*9*a`) to `PressureWalls`, which translates the
four walls by up to 9 px. D7 lists "wobble" as forbidden; the register §3.12.9
records this path as not render-verified; no positive check sanctions the sine.

**Request:** either (a) ground it as a designed, hold-safe destabilise
archetype (AMEND with a rendered frame + a positive check), or (b) delete the
wobble term so the destabilise mode is carried by the standoff/settle motion
alone (which is D5/D7-clean). Exact before→after for (b):
```jsx
// BEFORE :92
wobble = [0, 1, 2, 3].map((i) => Math.sin(frame * 0.13 + i * 1.7) * 9 * a);
// AFTER
wobble = [0, 0, 0, 0];
```
(and drop `frame`/`a` from the wobble if they become unused).

---

## Final verdict

**DEL-15 PASS · DEL-16 FAIL · DEL-23 PASS · DEL-24 PASS · DEL-25 AMEND ·
DEL-26 AMEND.**
The Stage-15 sweep for the motion domain is **NOT clean**: the mg background
`breathe` (motion-graphics.jsx:360/393) and the PressureWalls destabilising
`wobble` (abstract-scenes.jsx:92) are live idle/temporal sine-pulse DEL-16
failures. Two SFRs filed (motion-15-1, motion-15-2). All other primary rows
pass or are clean AMEND candidates backed by positive checks. Honest note:
DEL-16 cannot be marked PASS until the two live sine pulses are resolved, and
only the orchestrator can apply the SFRs (files outside my ownership).
