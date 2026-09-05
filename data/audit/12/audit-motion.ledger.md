# audit-motion ledger — Stage 12 (Background + depth)

Owner: `audit-motion` · Domain: timing, easing, springs, stagger, drag, blur
Stage: 12 · Check built this stage: **MOT-18** (motion blur only inside a
transition subtree)

Append-only. A SHARED-FILE REQUEST is filed here whenever a change needs a
file outside this lane's ownership (`visual/states.js`, `visual/composition.js`,
`compositions/beats.js`, `compositions/scenes/stage.jsx`, `data/audit/**`).

---

## CLAIM-motion-118 (MOT-18)

```
ASSERTION   Motion blur may exist only inside a transition subtree (a
            section-boundary camera move / presentation); everywhere else —
            holds, subtitle stages, end card — it must be 0 (zero
            motion-blur primitives, zero frame-driven blur).
SPEC REF    CHECK-REGISTER.md §3.4 MOT-18 (row 259). Controlling prompt §11
            CAMERA (hold → move → settle; move has a reason), §28 VISUAL
            RHYTHM (variation follows meaning), §30 (background = subtler,
            foreground = mechanism, etc.), banned list lines 1095-1114
            (no "excessive depth-of-field" — which is the adjacent failure
            this check must not regress into). DETAIL-REFERENCE B3.1 / the
            ground-plane-constant rule are audit-color's domain, not this
            lane's; noted here only so it is not confused with MOT-18.
SOURCES     [1] first-party: Remotion docs @remotion/motion-blur
            <CameraMotionBlur> — "produces natural looking motion blur ...
            similar to what would be produced by a film camera"; the blur is
            an average of `samples` time-offset frames, so its amount is
            proportional to actual per-frame motion; "The technique is
            destructive to colors. Keep the `samples` property as low as
            possible." → motion blur IS motion; a frame with no movement
            averages identical pixels and degrades the image for nothing.
            (https://www.remotion.dev/docs/motion-blur/camera-motion-blur,
            fetched live this session)
            [2] independent: Wikipedia, Motion blur (media) — motion blur
            "records when a subject or camera moves while a video frame is
            being exposed"; no motion → no blur; "extra motion blur can
            unavoidably occur ... when it is not desired" is the failure
            class MOT-18 prevents. (fetched live this session)
            [3] independent: Autodesk, "What Is Motion Blur?" — "Camera
            motion blur is used when the camera moves quickly, like during
            fast pans or cutscenes"; "Too much motion blur can ... disorient"
            → restraint; blur belongs to the move, not the rest.
            (https://www.autodesk.com/solutions/media-entertainment/motion-blur,
            fetched live this session)
            [4] independent (vendored Apache-2.0 reference, already cited by
            composition.js): vendor/video-shotcraft demos confine
            CameraMotionBlur to camera-move / transition segments only:
            demos/camera/crash-zoom-punch/CrashImpactReal.tsx "blur 只包急推段"
            (blur wraps only the rapid-push segment); demos/transition/
            shot-transitions/WhipPanReal.tsx "blur 只包甩动段 ... 0–35 A hold →
            35–43 甩(糊) → 43–120 B hold(真静止)" (blur wraps only the whip
            segment; the holds either side are truly static);
            PortalWipeV2.tsx deliberately withholds blur so the settled scene
            reads clear. This is the exact transition-only boundary MOT-18
            encodes, in the reference's own words.
RE-VERIFIED YES for [1][2][3][4]. NOTE: the controlling prompt's
            Liamrjohnston cinematic-camera SKILL.md URL is now 404 (account
            renamed; tracked as liamrjohnston30, that depth also 404 on
            fetch). RE-VERIFIED: CHANGED / source moved — flagged for SPEC
            AMENDMENT below. Grounding for the same practice is carried by
            [1] and [4] instead.
CURRENT     Zero motion-blur primitives anywhere in src/:
            grep @remotion/motion-blur | CameraMotionBlur | <Trail → 0 hits.
            `@remotion/motion-blur` is NOT installed in the render subpackage.
            The ONLY blur in the live tree is the static per-plane DEPTH blur
            in DEPTH_PROFILES (composition.js:258-276: background 2px, far
            3px, foreground 3/3.5px, subject ALWAYS 0px), applied by
            stage.jsx:194-216 from the resolved plane value — a fixed
            constant per layer, never a function of frame/progress. It is
            DEPTH blur, not MOTION blur, and it is not animated. (Computed
            by importing composition.js and walking DEPTH_PROFILES: subject
            blur 0 in every profile; every non-subject plane blur is a
            fixed number in {2, 3, 3.5}.)
DELTA       MOT-18 is unbuilt (State N/B): there is no runnable check that
            (a) counts motion-blur primitives in the composition graph and
            (b) fails if any lands outside a transition subtree. The current
            tree trivially satisfies "0 elsewhere"; the check must exist so
            a future change that adds CameraMotionBlur to a hold, a caption
            stage, or the end card is caught.
PLAN        Delete: nothing (no motion blur exists to remove; and the DEPTH
            blur is allowed and must stay — it is not in scope for removal).
            Replace with: add MOT-18 to visual/composition.js —
            MOTION_BLUR_SIGNALS (the primitives that count as motion blur),
            scanMotionBlurSource(src, {isTransitionContext}) (pure scanner,
            returns detected signals), and gateMotionBlur(sourceMap) (the
            check: for each scanned file classify signal-in-transition vs
            signal-outside, fail iff outsideTransition > 0). Then a probe in
            data/audit/12/probe-mot18.mjs that (a) runs gateMotionBlur over
            the real composition/render graph, (b) computes the real
            DEPTH-blur inventory from imported DEPTH_PROFILES (the allowed,
            distinct axis), and (c) runs negative fixtures (E3) — a planted
            CameraMotionBlur in a hold/caption/end-card context MUST fail
            the check and a planted one in a transition context MUST pass —
            to prove the scanner has teeth.
RE-VERIFIED [live anghoring] composition.js is importable standalone (pure,
            no Remotion): verified `node --input-type=module -e
            "import('./visual/composition.js')` → OK; composeShot('PROCESS')
            → planes background:2px, subject:0px, foreground:3px.
STATUS      PHASE 1 COMPLETE — no code edited yet.
```

### SPEC AMENDMENT — cinematic-camera source moved (Phase 1 note)

The controlling prompt §11/§13 and the CROSSCHECK-PROTOCOL "sources of
record" list point at
`github.com/Liamrjohnston/remotion-motion-graphics-skill/.../cinematic-camera/
SKILL.md`. That URL now returns 404 and the repo account is renamed
(`liamrjohnston30`); the renamed path also 404s on fetch today. The
grounding it supplied (rejected "slow zoom as the only camera idea";
"14-24 frame travel is a useful baseline"; "stable end hold"; "no decorative
camera movement") is independently reproduced in this repo by the vendored
`vendor/video-shotcraft` reference and by the Remotion docs, so no MOT-18
decision depends on it. Flagging for the orchestrator to update the source
list / controlling prompt to the reachable canonical location.

---

<!-- end of this entry -->


---

## Phase 2 — CHANGE (MOT-18 measurement built; composition.js gate blocked → SFR)

P2.1 Delete-then-replace: nothing exists to delete (no motion blur in the
live tree to remove; the DEPTH blur is allowed and stays). The change is the
addition of the MOT-18 measurement.

P2.2/2.3 One claim, one change, minimal:
  - `data/audit/12/probe-mot18.mjs`  — the Tier-1 compiled measure (new file).
    Imports the REAL composition.js (pure) for DEPTH_PROFILES and, if the
    SFR lands, the gate functions; falls back to a bundled copy of the same
    logic otherwise. Walks 43 real composition-graph files
    (compositions/, visual/, effects/, styles/, Root.jsx), counts motion-blur
    signals, classifies each against transition-context, computes the real
    depth-blur inventory, and runs three negative fixtures (E3).
  - `data/audit/12/mot18-report.json` — machine-readable output.
  - This ledger.

P2.4 Ownership: the only code file the check naturally lives in is
`visual/composition.js`, but the loaded edit allow-list for this session only
permits `data/audit/**` (and the deleted `beats/**`). The edit to
`visual/composition.js` was DENIED by the loaded permission list. Per the
SESSION CAVEAT the diff is NOT bypassed via bash; it is filed as a
SHARED-FILE REQUEST below for the orchestrator to apply between stages. The
probe measures with a functionally-identical bundled copy, so the check
EXISTS and RUNS now.

P2.5 Diff hashes (the exact bytes written):
  | file | hash |
  |---|---|
  | data/audit/12/probe-mot18.mjs | `9d95974f53560fee51e8d4da7f3eec65e8f69b57` |
  | data/audit/12/mot18-report.json | `e495ea3ca48d0d0824d6b4da662d4976dad8e36a` |
  (`visual/composition.js` unchanged — no hash; the SFR below carries the diff.)

PROBE OUTPUT (measured on the real graph):
  files scanned: 43
  motionBlur total: 0   (inside transition 0, OUTSIDE transition 0)
  @remotion/motion-blur installed: false
  depth blur (allowed): 8 plane values; subject-not-sharp: 0; non-constant: 0
  fixtures (E3): 3/3 ok
  VERDICT: PASS

STATUS: PHASE 2 COMPLETE (measurement built + run; permanent gate via SFR).

---

## SHARED-FILE REQUEST — SFR-motion-12-1 (audit-motion → orchestrator)

Target file: `src/skills/remotion-render/visual/composition.js`
(the MOT-18 permanent gate; the probe already consumes it when present and
falls back to an identical copy until then).

Append the following after the existing `shotSignatures` function (the file
ends at line 406 today). This is the same logic the probe exercises in
bundled form; applying it makes `data/audit/12/probe-mot18.mjs` report
`source: composition.js (SFR applied)` instead of `bundled copy`.

```js
// ─────────────────────────────────────────────────────────────────────────────
// MOT-18 — motion blur only inside a transition subtree
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The primitives that count as MOTION blur in this composition graph,
 * distinct from DEPTH blur. The only blur today is DEPTH blur: the fixed
 * per-plane `blur` constants in DEPTH_PROFILES, applied by stage.jsx from the
 * resolved plane value — never a function of frame/progress, so it can never
 * read as motion. MOTION blur is temporal: Remotion's CameraMotionBlur
 * averages `samples` time-offset frames, so on a frame with no motion it
 * averages a frame with itself — a useless, colour-destructive smear of
 * what-did-not-move. The vendored shotcraft reference confines CameraMotionBlur
 * to camera-move / transition segments only (demos/transition/shot-transitions/
 * WhipPanReal.tsx: "blur 只包甩动段 ... 0–35 A hold → 35–43 甩(糊) → 43–120 B
 * hold(真静止)"). MOT-18: these may exist ONLY inside a transition subtree;
 * everywhere else (holds, subtitle stages, end card) they must be 0.
 */
export const MOTION_BLUR_SIGNALS = [
  { name: "@remotion/motion-blur package", re: /@remotion\/motion-blur/ },
  { name: "<CameraMotionBlur>", re: /<CameraMotionBlur\b/ },
  { name: "<Trail> (motion-blur package)", re: /<Trail\b/ },
];

/**
 * A `blur(...)` whose radius is driven by frame/progress is a blur that
 * follows motion (motion blur), not the static per-plane depth blur.
 * `blur(${plane.blur}px)` (stage.jsx) does NOT match: after `blur(` comes a
 * resolved constant, never a frame token. Catches a future mistake that
 * animates the depth blur per frame, which would turn a depth anchor into
 * motion blur.
 */
export const FRAME_BLUR_RE = /blur\(\s*.*?(?:interpolate\s*\(|ease\s*\(|progressOf\s*\(|Math\.(?:sin|cos)\s*\(|\bframe\b|\bp\b\s*[*+])/;

/**
 * Pure scanner: given one source file's text and whether that file is a
 * transition context, return its motion-blur signals, each tagged with line
 * and in/out of transition. Pure (takes text, not paths) so a test can feed
 * planted source and prove the scanner has teeth.
 */
export function scanMotionBlurSource(src, { isTransitionContext = false } = {}) {
  const hits = [];
  const lines = String(src).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const sig of MOTION_BLUR_SIGNALS) {
      if (sig.re.test(line)) hits.push({ line: i + 1, signal: sig.name, inTransition: isTransitionContext });
    }
    if (/blur\(/.test(line) && FRAME_BLUR_RE.test(line)) {
      hits.push({ line: i + 1, signal: "frame-driven blur (a blur that follows motion)", inTransition: isTransitionContext });
    }
  }
  return hits;
}

/**
 * A file path is a transition context when it is the transition subsystem
 * itself (a transition/presentation component, or the transition code in
 * beats.js). Every other file is by definition a hold/subtitle/resting
 * context, so a motion-blur signal there is OUTSIDE any transition subtree.
 */
export function isTransitionContextFile(filePath) {
  const base = String(filePath).toLowerCase().replace(/\\/g, "/");
  return /(?:^|\/)(?:transition|transitions|presentation|presentations)\b/.test(base);
}

/**
 * MOT-18 gate over the whole graph. `sourceMap` maps path -> source text.
 * Pass iff every motion-blur signal is inside a transition subtree
 * (outsideTransition === 0).
 */
export function gateMotionBlur(sourceMap) {
  const outside = [];
  const inside = [];
  let totalHits = 0;
  for (const [file, src] of Object.entries(sourceMap)) {
    const inTransition = isTransitionContextFile(file);
    for (const h of scanMotionBlurSource(src, { isTransitionContext: inTransition })) {
      totalHits += 1;
      (h.inTransition ? inside : outside).push({ file, ...h });
    }
  }
  return {
    pass: outside.length === 0,
    totalMotionBlur: totalHits,
    outsideTransition: outside.length,
    insideTransition: inside.length,
    detail: { inside, outside },
  };
}
```

Verification after applying: `node data/audit/12/probe-mot18.mjs` from
`src/skills/remotion-render` must print `modules: composition.js (SFR
applied)` and still `VERDICT: PASS` with fixtures 3/3.

STATUS: APPLIED — the orchestrator applied this block verbatim
(composition.js:407-496, hash `7e1d1eb3fac3feae6e23819b351201ec10b26638`;
apply record: data/audit/12/apply-sfr-12.mjs + sfr-motion-12-1-block.txt).
Phase 4 re-entry then found this applied block SELF-MATCHES the scanner (the
gate reports its own declaration text as OUTSIDE-transition motion blur):
MOT-18 gate FAILED on the real graph. The fix replaces part of this block via
SFR-motion-12-2 (see Phase 4 below); the probe at data/audit/12/probe-mot18.mjs
was updated accordingly (new hash in Phase 4).


---

## Phase 3 — COUNTER-CHECK (verify-independent)

VERDICT: **CONFIRM**. The verifier researched independently (different wording,
per P3.2) and reached its own source set:
  - first-party: Remotion docs `remotion.dev/docs/motion-blur/camera-motion-blur`
    + the CameraMotionBlur.tsx source — motion blur is a temporal frame-sampled
    effect (Freeze + plus-lighter), i.e. a MOTION artifact that smears frames
    that moved; a static held frame has nothing to smear.
  - independent: Nikon shutter-angle guide, Insta360, Unity "motion blur static
    camera", Envato/Uppbeat/maxon "camera shake transition" — blur is produced
    only by relative camera/subject motion; camera-shake+blur is the idiom
    BETWEEN shots (transitions), never on resting frames.
The verifier confirmed: (A) the claim is true per domain practice; (B) the
diff implements it — a real runnable measure (walks 43 real graph files,
counts + classifies in/out of transition, gates outsideTransition===0) with
teeth-proven negative fixtures (manual trace matched the recorded PASS 3/3).

P3.6 Verifier sources are recorded above; they are independent of the
lane's [1][2][3][4] and reach the same conclusion — both the lane and the
verifier cite Remotion first-party plus independent cinematography sources.
Strong pass.

VERIFIER-RAISED COSMETIC FIX (addressed, same commit scope — NOT a new claim):
the report object omitted `.pass` on `report.motionBlur`, so the console
"OUTSIDE-TRANSITION MOTION BLUR FOUND:" block printed spuriously even on PASS
(because `!undefined` is truthy). Fixed by adding `pass: gateResult.pass` to
the report. Re-ran: PASS, 3/3 fixtures, no spurious line. Updated hashes:
  | file | hash |
  |---|---|
  | data/audit/12/probe-mot18.mjs | `8819230a3fc3f2517ea519aef9c777cfcb9a7b0d` |
  | data/audit/12/mot18-report.json | `9f245cf20698fb7f469c140cf9c54cdd8ba8f2d4` |

STATUS: MOT-18 LANDED (measurement built + run + counter-checked CONFIRM).
Permanent gate in visual/composition.js pending SFR-motion-12-1.

## MOT-18 RESULT — PASS

Measured on the real composition graph (43 files: compositions/, visual/,
effects/, styles/, Root.jsx):
  - motion-blur total: 0; outside any transition subtree: 0  (threshold 0)
  - @remotion/motion-blur package installed: false
  - depth blur (allowed, distinct axis): subject plane 0 in every profile;
    every non-subject plane a fixed constant {2,3,3.5}px — never frame-driven
  - three negative fixtures (E3) all fire correctly: a planted CameraMotionBlur
    in a hold/end-card and a planted frame-driven blur in a caption file are
    caught OUTSIDE a transition; a planted CameraMotionBlur in a transition
    presentation is allowed INSIDE.
So MOT-18 passes (vacuously — zero motion blur in the live tree — but the
check exists, runs, and provably guards regressions).

DOMAIN-CONSTRAINT confirmed: ground-plane luminance / mood-grading / hue
rotation (B3.1, COL-20/22) is audit-color's domain, not this lane's; no
change here touches it.

STOP — no commit, no merge.

---

## Phase 4 — RE-ENTRY: MOT-18 gate GATE-FAILED (self-match); fix filed as SFR-motion-12-2

### Gate failure (exact orchestrator output, `node data/audit/12/probe-mot18.mjs`)

```
MOT-18 probe over real composition graph
  modules:            composition.js (SFR applied)
  files scanned:      43
  motionBlur total:   4
    inside transition: 0
    OUTSIDE transition: 4  (threshold 0)
  @remotion/motion-blur installed: false
  depth blur (allowed, distinct):  8 plane values; subject-not-sharp: 0; non-constant: 0
  fixtures (E3 teeth-prove):
    ok   hold/end-card camera motion blur must be outside a transition (outside=1, expect 1)
    ok   transition presentation camera motion blur is allowed inside a transition (outside=0, expect 0)
    ok   frame-driven blur in a caption file is motion blur → outside (outside=1, expect 1)
VERDICT: FAIL
OUTSIDE-TRANSITION MOTION BLUR FOUND:
  visual/composition.js:426 @remotion/motion-blur package
  visual/composition.js:427 <CameraMotionBlur>
  visual/composition.js:428 <Trail> (motion-blur package)
  visual/composition.js:432 frame-driven blur (a blur that follows motion)
```

### Root cause (orchestrator's diagnosis, re-confirmed this session)

The probe scans 43 graph files including `visual/composition.js` itself — and
the SFR-1 gate block appended there SELF-MATCHES the scanner:
- composition.js:426-428 — the `name:` string literals in MOTION_BLUR_SIGNALS
  ARE the tokens the regexes detect (`"@remotion/motion-blur package"`,
  `"<CameraMotionBlur>"`, `"<Trail> (motion-blur package)"`);
- composition.js:432 — the FRAME_BLUR_RE doc comment pairs `blur(` with the
  standalone word `frame` on one line: "A `blur(...)` whose radius is driven
  by frame/progress…", which satisfies the frame-driven alternative.
Re-confirmed by re-running the probe and by a per-line reproduction of the
scanner against composition.js's own text (identical 4 lines: 426/427/428/432).
NOTE: the FRAME_BLUR_RE literal itself (line 439) is NOT a self-match — its raw
text spells `blur\(` (backslash-paren), so `/blur\(/.test(line)` is false on
it. Pre-SFR the same 43-file graph measured total 0 / outside 0; the block is
the entire delta, so the composition CONTENT is clean — the gate module's own
text is the defect.

### Change — gate fix (SFR-motion-12-2)

The declaration block is replaced so no signal token appears as a contiguous
string anywhere in the gate module, and no comment line pairs a blur call with
a frame token. Names and regexes are computed at import time from the SAME
fragments, so every runtime value is byte-identical to the original —
scanner semantics do not change. FRAME_BLUR_RE stays a literal (it is
inherently self-match-safe, see above). This is a BYTE-LEVEL exemption, not a
region/line skip: any OTHER file (or any other line of this file) that writes
a token as contiguous text still matches the same regexes.

BEFORE (composition.js:425-439, as SFR-1 left it):

```js
export const MOTION_BLUR_SIGNALS = [
  { name: "@remotion/motion-blur package", re: /@remotion\/motion-blur/ },
  { name: "<CameraMotionBlur>", re: /<CameraMotionBlur\b/ },
  { name: "<Trail> (motion-blur package)", re: /<Trail\b/ },
];

/**
 * A `blur(...)` whose radius is driven by frame/progress is a blur that
 * follows motion (motion blur), not the static per-plane depth blur.
 * `blur(${plane.blur}px)` (stage.jsx) does NOT match: after `blur(` comes a
 * resolved constant, never a frame token. Catches a future mistake that
 * animates the depth blur per frame, which would turn a depth anchor into
 * motion blur.
 */
export const FRAME_BLUR_RE = /blur\(\s*.*?(?:interpolate\s*\(|ease\s*\(|progressOf\s*\(|Math\.(?:sin|cos)\s*\(|\bframe\b|\bp\b\s*[*+])/;
```

AFTER (exactly `data/audit/12/sfr-motion-12-2-block.txt`):

```js
/**
 * PHASE 4 SELF-MATCH FIX (data/audit/12/audit-motion.ledger.md): the probe
 * scans THIS file as part of the composition graph, so the three signal
 * tokens below are declared SPLIT and assembled from fragments at import
 * time. No signal token appears as a contiguous string anywhere in this
 * module's source text; FRAME_BLUR_RE is a literal whose own raw text can
 * never satisfy its pattern, and the comment above it never pairs a blur
 * call with a frame token — so the whole gate module scans clean. This
 * exemption is BYTE-LEVEL, not a region skip: a real violation planted on
 * ANY line of ANY file still matches the same regexes (probe fixture 4
 * plants one two lines after this block and asserts it is caught). A
 * regression that rewrites these declarations as naive literals re-fails
 * the probe loudly, which is the point.
 */
const MOTION_BLUR_SIGNAL_TOKENS = {
  package: '@remotion' + '/' + 'motion-blur',
  camera: '<' + 'CameraMotionBlur',
  trail: '<' + 'Trail',
};
export const MOTION_BLUR_SIGNALS = [
  { name: MOTION_BLUR_SIGNAL_TOKENS.package + ' package', re: new RegExp(MOTION_BLUR_SIGNAL_TOKENS.package) },
  { name: MOTION_BLUR_SIGNAL_TOKENS.camera + '>', re: new RegExp(MOTION_BLUR_SIGNAL_TOKENS.camera + '\\b') },
  { name: MOTION_BLUR_SIGNAL_TOKENS.trail + '> (motion-blur package)', re: new RegExp(MOTION_BLUR_SIGNAL_TOKENS.trail + '\\b') },
];

/**
 * A filter whose radius is driven by frame or progress (written in code as
 * `blur( ... )`) is a blur that follows motion — motion blur, which MOT-18
 * bans outside a transition subtree. The depth blur in stage.jsx is a
 * resolved constant after the "blur(" — it can never match this class.
 * A future mistake that animates that depth blur per frame turns a depth
 * anchor into motion blur, and this regex catches it.
 */
export const FRAME_BLUR_RE = /blur\(\s*.*?(?:interpolate\s*\(|ease\s*\(|progressOf\s*\(|Math\.(?:sin|cos)\s*\(|\bframe\b|\bp\b\s*[*+])/;
```

Runtime parity: `MOTION_BLUR_SIGNAL_TOKENS.package + ' package'` →
`@remotion/motion-blur package`; `camera + '>'` → `<CameraMotionBlur>`;
`trail + '> (motion-blur package)'` → `<Trail> (motion-blur package)`;
`new RegExp(...)` sources are exactly the three original literals; FRAME_BLUR_RE
is textually unchanged. Same names, same regexes, same scanner behaviour.

### Change — probe (data/audit/12/probe-mot18.mjs)

1. Bundled fallback signal definitions now built from fragments (behavioural
   parity with the fixed gate; `data/audit/**` is never scanned, so this is
   consistency, not a fix — it keeps "fallback === gate behaviour" true).
2. GATE SELF-MATCH DETECTOR: while the applied gate self-matches, the probe
   prints the defect with the offending lines and FAILS the verdict
   ("a self-matching permanent gate is not certifiable") — a broken gate can
   never silently pass. The moment SFR-2 lands, the applied gate scans clean,
   the detector goes quiet, and the probe measures with composition.js itself
   (no probe re-edit needed).
3. Fixture 4 (new — the back-door proof, below).
4. `PROBE_MOT18_RENDER_DIR` test hook + `report.graphBase`: the probe can
   measure a STAGED tree (used to validate SFR-2 before application), and the
   machine-readable report always records which tree was measured, so a staged
   run can never be mistaken for the real tree.

### New negative fixture (fixture 4 — the back-door proof)

```js
const gateSrc = sourceMap['visual/composition.js'] || '';
const motAnchor = gateSrc.indexOf('MOT-18 — motion blur only inside a transition subtree');
const gateBlock = motAnchor === -1 ? 'export const MOTION_BLUR_SIGNALS = [];' : gateSrc.slice(motAnchor);
runFixture(
  "Phase-4 back-door proof: real violation planted 2 lines after the gate's own block in composition.js is still caught",
  "visual/composition.js",
  `${gateBlock}\n\nconst regression = () => <CameraMotionBlur shutterAngle={180} />;\n`,
  1
);
```

It takes the REAL MOT-18 gate block as it exists in the scanned
composition.js (banner → EOF), plants a real violation two lines later
(`<CameraMotionBlur shutterAngle={180}>`), and asserts outside === 1. Before
the fix the block text itself contributes 4 self-match hits, so the scan
returns 5 ≠ 1 and the fixture FAILS; after the fix it returns exactly 1. This
proves the exemption is token-absence, not a region a future editor could hide
a regression in — and that the gate cannot be disabled by the exemption.

### Probe re-runs

Run 1 — REAL tree, SFR-1 applied, SFR-2 NOT yet applied (after probe fix):

```
MOT-18 probe over real composition graph
  modules:            composition.js (SFR applied — SELF-MATCH DEFECT: SFR-motion-12-2 pending)
  files scanned:      43
  motionBlur total:   4
    inside transition: 0
    OUTSIDE transition: 4  (threshold 0)
  @remotion/motion-blur installed: false
  depth blur (allowed, distinct):  8 plane values; subject-not-sharp: 0; non-constant: 0
  fixtures (E3 teeth-prove):
    ok   hold/end-card camera motion blur must be outside a transition (outside=1, expect 1)
    ok   transition presentation camera motion blur is allowed inside a transition (outside=0, expect 0)
    ok   frame-driven blur in a caption file is motion blur → outside (outside=1, expect 1)
    FAIL Phase-4 back-door proof: real violation planted 2 lines after the gate's own block in composition.js is still caught (outside=5, expect 1)
VERDICT: FAIL
OUTSIDE-TRANSITION MOTION BLUR FOUND:
  visual/composition.js:426 @remotion/motion-blur package
  visual/composition.js:427 <CameraMotionBlur>
  visual/composition.js:428 <Trail> (motion-blur package)
  visual/composition.js:432 frame-driven blur (a blur that follows motion)
GATE SELF-MATCH DEFECT: the permanent gate in visual/composition.js flags its
  own declaration block as motion blur (self-match, not composition content).
  Apply SFR-motion-12-2 (data/audit/12/audit-motion.ledger.md Phase 4); the probe
  then measures with composition.js itself and this block disappears.
EXIT CODE: 1
```

Run 2 — STAGED tree with SFR-2 applied to composition.js (mirror differs from
the real tree ONLY in visual/composition.js — built by a data/audit/12/.stage
scratch, removed after the run; validated via `PROBE_MOT18_RENDER_DIR`):

```
MOT-18 probe over real composition graph
  modules:            composition.js (SFR applied)
  files scanned:      43
  motionBlur total:   0
    inside transition: 0
    OUTSIDE transition: 0  (threshold 0)
  @remotion/motion-blur installed: false
  depth blur (allowed, distinct):  8 plane values; subject-not-sharp: 0; non-constant: 0
  fixtures (E3 teeth-prove):
    ok   hold/end-card camera motion blur must be outside a transition (outside=1, expect 1)
    ok   transition presentation camera motion blur is allowed inside a transition (outside=0, expect 0)
    ok   frame-driven blur in a caption file is motion blur → outside (outside=1, expect 1)
    ok   Phase-4 back-door proof: real violation planted 2 lines after the gate's own block in composition.js is still caught (outside=1, expect 1)
VERDICT: PASS
EXIT CODE: 0
```

Run 2 is the exact output the orchestrator will see on the REAL tree after
running `node data/audit/12/apply-sfr-12.mjs` (anchor match for the replace
was verified exact and unique against the real file: 15/15 lines, 1 occurrence;
expected post-application composition.js hash below). Depth blur stays distinct
and allowed in both runs: 8 plane values, subject-not-sharp 0, non-constant 0.

## SHARED-FILE REQUEST — SFR-motion-12-2 (audit-motion → orchestrator)

**Application site (orchestrator-owned):** `src/skills/remotion-render/visual/composition.js`
(the permanent MOT-18 gate block appended by SFR-motion-12-1).

**Why an SFR:** the loaded permission list for this session denies edits to
`visual/composition.js` (allow-list: `data/audit/**`, `src/skills/remotion-render/beats/**`).
The orchestrator's brief said the file is this lane's, but the runtime denial
governs; per the established SESSION CAVEAT (Phase 2) the diff is NOT bypassed
via bash.

**What the orchestrator runs:**
   `node data/audit/12/apply-sfr-12.mjs`
(fix2Old = the 15 BEFORE lines of the SFR-1 declaration block, verified exact+unique
against the current file: 15/15 lines, 1 occurrence, before text at
composition.js:425-439; fix2New = `data/audit/12/sfr-motion-12-2-block.txt` with a
marker check. Idempotent: a re-run after application skips the step.)

**Expected post-application hash** (CRLF-preserving replace, as the apply script
writes): `75270eaaf30bc6c16cc2677524d507e15fadc91e`.

**Verification after applying:** the real-tree probe prints the Phase 4 "Run 2"
output (VERDICT: PASS, exit 0, 4/4 fixtures). Until it is applied the probe
honestly FAILS (exit 1) with a `GATE SELF-MATCH DEFECT` line: the SFR-1 gate
block flags its own declaration text (composition.js:426/427/428/432) as
outside-transition motion blur — a self-match, not composition content.

Full before/after text, root cause, and probe re-run outputs: § Phase 4 above.

### Phase 4 hashes (git blob)

| file | hash |
|---|---|
| data/audit/12/probe-mot18.mjs | `0859456ad6f057b53fe3cc10e5863ee7c116b11f` |
| data/audit/12/mot18-report.json | `4c4f6d42b4e28d1bca8c2b53f7e77e225387901d` |
| data/audit/12/sfr-motion-12-2-block.txt | `966c8fee7b9a19833b2caaba274704c5dcd7dc63` |
| data/audit/12/apply-sfr-12.mjs | `8766cf4441793513fdc775a4d3f1fd2ba5ac4932` |
| src/skills/remotion-render/visual/composition.js (current, pre-SFR-2) | `7e1d1eb3fac3feae6e23819b351201ec10b26638` |
| src/skills/remotion-render/visual/composition.js (expected post-SFR-2) | `75270eaaf30bc6c16cc2677524d507e15fadc91e` |

### Phase 4 STATUS

Probe fixed, fixture 4 added, SFR-motion-12-2 filed with verified anchors and a
demonstrated PASS (staged run, 4/4 fixtures, exit 0). Permanent gate fix is
pending the orchestrator running `apply-sfr-12.mjs`; the real-tree probe
honestly FAILS (exit 1, GATE SELF-MATCH DEFECT line) until then. No commit, no
merge.
