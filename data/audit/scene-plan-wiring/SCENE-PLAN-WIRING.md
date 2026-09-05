# Scene-Director Wiring — Grounded Change Plan (claim card)

**Stage owner:** mg-orchestrator (diagnosis + plan) → **execution lane:** the
lane with edit permission over the render subpackage (per-opencode edit
allow-list: `Root.jsx`, `motion-graphics.jsx`, `mg-style.js`, `package.json`).
The files this change touches are **not** in the orchestrator's edit
allow-list, so this document is the GROUND phase; the *change* itself must be
made by the owning lane under the three-phase protocol in
`CROSSCHECK-PROTOCOL.md` Part 2.

**Complaint (user):** "from content made i realise that its the same few
graphics over and over like a template, thats should change ... find a skill to
make it less robotic."

**Chosen scope (user picked option 1):** wire the `scene-director` per-video
scene-plan pass into the render flow.

---

## CLAIM-sceneplan-001 — the scene-plan pass is not wired in

**ASSERTION**   The render subpackage has no per-video scene-plan pass: nothing
produces, loads, or applies a `plans/<video-id>.scene-plan.json` from the
`scene-director` skill, so every video is composed by the same deterministic
`visual/director.js` planner and leans on the same few strategies.

**SPEC REF**    `.opencode/skills/scene-director/SKILL.md` (whole file).

**SOURCES**
- Repo: `scene-director/SKILL.md:18-24` — "This skill runs once per video,
  before any rendering, and emits a scene plan that the renderer executes
  literally."
- Repo: `scene-director/SKILL.md:23` — "The renderer should make zero aesthetic
  decisions." (Rendering a plan therefore presupposes a plan exists to render.)

**RE-VERIFIED** YES (against repo source of record, not a spec doc — both are
first-party).

**CURRENT** — Computed by grep + read, not described:
- `grep -r "scene-plan\|scenePlan\|plans/" src/skills/remotion-render` →
  **zero matches** (searched `src/skills/remotion-render`, all of `render/*`,
  `.github/**`, `scripts/*`).
- No `plans/` directory exists anywhere under `src/skills/remotion-render`.
- Production planning path is `mg-package.js:665-718` (VISUAL DIRECTION loop)
  → `planVisual()` (`visual/director.js:341`). `director.js` reads
  `beat.visual` authoring at `fromAuthored()` (`director.js:116-141`) but a
  scene plan never supplies one, so `provenance` is "deterministic" for every
  script in the repo (none carry authored `sections[].beats[].visual`).

**DELTA**   The `scene-director` pass described in the skill would author one
`visual{}` per staged beat; nothing in the codebase produces or consumes one.
Result: variety relies only on `REPEAT_PENALTY=0.14`/`RUN_PENALTY=0.3`
(`director.js:165-173`) and the variant-ordinal
(`mg-package.js:704-705`) — anti-repetition pressure, not art direction.

**PLAN**
- Delete: nothing (no wrong code exists — this is an absence, not a defect).
- Replace with (the wiring, in order):
  1. `visual/scene-plan.js` — pure loader/validator/adapter (new module).
  2. `scene-director/SKILL.md` — document that each scene entry MUST carry the
     renderer's `strategy` field (the adapter contract) so the plan is
     literally executable.
  3. `mg-package.js` `buildMgPackage()` — accept `opts.scenePlan`; apply it to
     staged beats (set `beat.visual`) before the VISUAL DIRECTION loop.
  4. `render.js` — accept an optional scene-plan path and pass it through.
  5. `scripts/render-and-qa.js` — look for `<slug>.scene-plan.json` next to a
     script and pass it to `render.js`.
  6. `visual/run-visual-tests.js` — add tests: valid plan applies; unregistered
     strategy falls back with a logged reason; missing data falls back; the
     plan is never a rubber stamp.

**COUNTER**     (to be completed by `verify-independent` when the lane makes
the change — see protocol P3.)

**STATUS**      PLANNED — authoring labelled as the owning lane's job.

---

## The exact integration points (for the executing lane)

Matching is deterministic: plan scene `index` = the Nth **staged** beat
(non-`LIST_ITEM`) across the video, in order. `LIST_ITEM` beats are chips
(`mg-package.js:673-687,722`), never stage scenes, so they are never planned or
matched. The adapter emits only the schema's `visual{}` keys; missing data is a
fallback reason, never invented.

| Hook | File:line | What it does |
|---|---|---|
| Beat carries authored visual | `beats.js:1027` (`authored.visual`) | Every beat already copies `sections[].beats[].visual` → `beat.visual`. |
| Authored beat wins | `director.js:347-351` (`planVisual`) | `fromAuthored()` runs first; a valid `beat.visual` is selected, else deterministic. |
| Authored validation | `director.js:116-141` (`fromAuthored`) | Validates `strategy` vs `STRATEGIES`; `unmetNeed()` checks `dataNeeds`; invalid → `rejected` with reason (logged fallback). |
| Plan production | `mg-package.js:665-718` | VISUAL DIRECTION loop; apply `opts.scenePlan` → `beat.visual` here, before `planVisual`. |
| Render opts entry | `render.js:360-376` | `buildMgPackage(srtText, {...})`; add `scenePlan` to opts. |
| Plan discovery | `scripts/render-and-qa.js` (`renderOne`) | Pass a `--plan` arg / colocated `<slug>.scene-plan.json`. |
| Schema contract | `schemas/script.mg.json:54-91` | The exact `visual{}` shape to emit (`strategy` required; `concept`, `primary`, `secondary`, `data` optional). |

The renderer already executes a valid `beat.visual` "literally" — variants,
shots (`attachShot`), states (`buildStates`) and the scene router all hang off
`beat.visualPlan`. So the change is **producer + adapter + validation** only; no
scene component needs to change and no existing deterministic default is broken.

---

## What the executing lane must also verify (honesty gate)

1. **Schema match.** `sceneEntryToVisual` output must satisfy
   `schemas/script.mg.json sections[].beats[].visual` (can validate with ajv in
   a test). Emitting an unknown data key is a rejection, not a drop.
2. **No silent fallback.** Every unapplied plan entry must land in the run's
   fallback log / `visual-report.json`, same as deterministic rejections,
   so "the plan was ignored" is visible in the run that produced it.
3. **Determinism.** Same plan + same script → byte-identical frames. No
   `Math.random` in `scene-plan.js`.
4. **The aesthetic claim is NOT verifiable in this session.** This orchestrator
   model cannot read frames (image input unsupported). The executing lane must
   render a probe with a plan and have a **vision-capable reviewer** (human at
   the contact sheet, or `scripts/vision_critic.py` / `qa_frames.py`) confirm
   the planned video no longer reads as "same few graphics over and over" —
   per `CLAUDE.md`: "never claim a rendered visual works without an actual
   rendered frame."
