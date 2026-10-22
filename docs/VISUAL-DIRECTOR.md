# Visual director — scene construction, not template selection

Status: being built on `feat/visual-director` (2026-10-22). Proven only by GitHub Actions
runs of `.github/workflows/visual-director-proof.yml`; nothing here counts as working
until a CI-rendered video and its CI critique say so.

## Why this exists

Every rejected iteration so far classified a sentence into a category and rendered that
category's component: TYPE/ICON alternation, then 6 "treatments" (2026-09-11), then the
current planner's 15 `VISUAL_TYPES`, where `scene-translate.js` turns the model's free-form
description back into one of 15 boxes. A bigger vocabulary is the same trap. Run
39817297912 (ch-1, Bayeux) and qa-proof 39819712458 (ch-4, Great Fire) show the result:
name-only type cards, a lone "13,200" held for 10 s, cropped plaques, and pictures that
answer "what does this sentence name?" rather than "what does it mean?".

## The pipeline

```
sentence
 -> semantic model   subject / state / action / relationship / change / consequence / environment
 -> visual question  "what would an excellent motion designer show to make THIS land?"
 -> mechanism        a verb (reveal, separation, erosion, accumulation, scale-reveal, ...)
                     + a one-off construction of real things in a space
 -> shots (1-4)      each: camera move + its motivation, materials, the physical action,
                     optional supporting text synced to a narration word, transition, sfx
 -> materials        what each picture must LITERALLY show + search queries; resolved and
                     vision-verified by the resolver, never by the director
 -> render           src/skills/remotion-render/shots/ (Remotion, existing render.js path)
 -> critic           full question set (below); may answer DELETE
 -> rebuild          deleted/weak scenes re-directed with the critique as input, re-rendered,
                     old vs new compared — bounded attempts
```

Contract: `schemas/scene-direction.json`. It has no "visual type" field on purpose.

## Hard gates on a direction (scripts/visual-director/gate.mjs)

- Schema-valid; one beat per narration sentence, timings inside the voiceover.
- `statement` (typography carries the beat) at most 2 beats and at most 20% of beats.
- No mechanism family on more than 40% of beats; no two adjacent beats with the same family
  AND the same camera move.
- A chart / number / timeline is legal only as `kind: data` with sourced `data` values whose
  source is in the script's `sources_used`. A sentence that is not a quantity comparison
  does not get a chart.
- Every named person / place / organisation / artefact the sentence turns on needs a material
  whose `must_show` names it. If the resolver cannot verify one, the scene is rebuilt around
  what CAN be shown; it is never filled with a look-alike (CLAUDE.md: real, verified photos only).
- Camera motivation must follow from the mechanism (reveal: start close, pull out; scale-reveal:
  detail then wide; comparison: establish A, reframe to B, return to both). `hold` needs a reason.
- Every shot has at least one material and a physical `action`. Text never stands in for a picture.
- Colour is never in a direction: it comes from `config/channels.json`.

## Critic question set (scripts/visual-director/critic.mjs, vision model in CI)

Asked per scene, over that scene's CI-extracted frames, with its direction and sentence:
1. What is visibly happening?
2. What relationship or change does it communicate?
3. Can it be understood with the sound off? (compare to `mute_test`)
4. Is it decorative, an infographic, a reusable template, or AI-looking?
5. Is the material believable and is it the thing `must_show` names?
6. Does the camera contribute meaning?
7. Verdict: KEEP / REBUILD (with what to change) / DELETE (the scene is wrong, start over).

The critic is never told to preserve existing work. DELETE and REBUILD scenes go back to the
director with the critique; nothing is patched cosmetically (no added glow, labels or particles).

## Loop budget

`VD_MAX_ROUNDS` (default 2 rebuild rounds), `VD_MAX_MS`, and the existing model token caps.
The run stops with unresolved scenes recorded, never loops unbounded.

## Evidence produced by every CI run (artifact `visual-director-<run>`)

direction.json (each round), materials report (what was found, verified, rejected), the MP4 of
each round, per-scene frames, a contact sheet per round, critic.json, and a step summary that
lists every scene's verdict. Old vs new contact sheets sit side by side for rebuilt scenes.

## Ownership while building

| Area | Files |
|---|---|
| Director | `scripts/visual-director/direct.mjs`, `gate.mjs`, `prompts/visual-director.md`, tests |
| Materials | `scripts/visual-director/materials/**`, tests |
| Shot renderer | `src/skills/remotion-render/shots/**`, registration in `Root.jsx`, a render entry |
| Critic, loop, CI | `scripts/visual-director/critic.mjs`, `loop.mjs`, `.github/workflows/visual-director-proof.yml` |
