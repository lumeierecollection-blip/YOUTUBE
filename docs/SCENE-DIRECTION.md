# Scene direction (scene briefs)

One brief per beat, built after the render from the script, research, plan and render manifest. It records what each scene is
for and how to tell whether it did its job. Schema: `schemas/scene-brief.json`.

- `scripts/direction/scene-brief.mjs` `buildSceneBriefs({script, research, plan, manifest, channel, grammar, referenceDirection, wordTimings?})` is pure.
- `scripts/direction/check-briefs.mjs` `checkBriefsAgainstRender(briefs, {manifest, publicDir})` tests the OBJECTIVE criteria and returns
  `{defects, new_defects, for_vision_review}`. Defects use `scripts/qa/defects.mjs` (source `objective`, `scene_id` set, check `brief:<name>`).
  Subjective criteria (`objective:false`) are passed through untouched for the vision judge.
- `scripts/direction/brief-cli.mjs --script --research --plan --manifest --channel [--reference-direction] --out DIR` writes `<stem>-scene-briefs.json/.md`.
- `scripts/qa/advisory.mjs` runs it for every queued video. Inputs are located from the video name (`locateInputs`); when any is
  missing the reason is logged (`[scene-briefs] skipped: ...`) and nothing is added. Advisory only; never gates.

## Rules the builder keeps

- `scene_id` = `<video stem>-s<beat>-<sha1(normalised narration)[0..6]>`: stable across re-runs, changes if the sentence changes.
- Narration is the manifest's `canvas.sentence` (else plan). Evidence is matched by shared figures (2+ digits) or shared named entities;
  an entity named in most facts (the topic, the city) does not match alone. No match means `evidence_status: "none"` and a flag, never a guess.
- Transition and sound intent come from reference observations only at confidence medium/high with valid frame ids (`f###`); the brief cites
  them as `ref:<video>#<frame>`. `measured-only` directions contribute nothing. Else the clone profile's measured grammar; else the brief says
  nothing was specified.
- Rendered SFX (`manifest.sfx`) are recorded as the scene's cues. A reference cue is only placed (at the scene start) when nothing rendered.
- Colour is never set here.

## Objective criteria and what they can really test

`hero_visible_by` (asset recorded in the manifest beat; timing only if a producer writes `hero_at_s`, render.js does not yet),
`asset_file_exists`, `entity_photo_verified` (`verified_as`/`place_check` present), `display_words_subset`, `max_hold` (`grammar.laws.gap_max_s`).
Whether the pixels show it is the vision judge's job.
