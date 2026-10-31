# Editor Green Audit — channels 1, 2, 48

Date: 2026-10-31
Branch: `fix/editor-green-iteration`
Baseline run: 41014238003 (workflow `Daily Pipeline — Optimized v2`, id `357940354`)

This is the audit that precedes the editor fixes. It records what the baseline actually rendered, what the current gates do and do not measure, and the change list this branch will implement. Every finding points at a committed file or a baseline artifact/log line.

## Baseline evidence

### Channel 1 — university-of-southampton-ai-maritime-history-discovery

- 54.016 s, 810x1440 render, 8 scenes, 1619 frames.
- One verified photo (University of Southampton) reused in two scenes; six full-frame statement posters.
- `mean_luma: 37.71`; QA returned `pass: true`.
- Auto-timeline log:

```
[auto-timeline] ch-1 university-of-southampton-ai-maritime-history-discovery-shorts-script:
8 scenes, 1619 frames ... (timing from voiceover, 1 photo(s))
  [0] 0-8s statement card
  [1] 8-19.42s photo of University of Southampton
  [2] 19.42-24.9s statement card
  [3] 24.9-27.08s statement card
  ...
```

- The first two scenes alone are 8 s and 11.4 s. The photo is held for 11.4 s. For a Short, that is a slide, not an edit.

### Channel 2 — anthropic-claude-haiku-5-5-october-2026-price-breakdown

- 6 scenes. One Anthropic photo appears twice (`6.59-19.02`, then `23.62-31.44`): a 12.4 s first hold.
- The remaining scenes are figure/statement cards.
- The photo asset under `entities/orgs/anthropic.jpg` has a source URL for "Slack offices, Howard Street, San Francisco". It is not a verified photo of Anthropic. The render presents it as the subject.

### Channel 48 — european-airline-pilots-fatigue-survey-2026

- 6 scenes, 1518 frames, 50.65 s: one photo, three figure cards, two statement posters.
- The resolver reported:

```
[1] no verified photo of European Cockpit Association:
no verified photo of organization "European Cockpit Association" in 3 attempts
```

- The fallback is acceptable only if it is designed, not a near-black key-word poster.

### Run 41044446681 (branch build)

- Overall failure: `render (21)` failed `Assert a video was rendered`. Artifacts existed for rendered channels 4, 7 and 11, not 21. This is a separate render-path failure and is not fixed by plan changes alone.

## Root causes

1. **Sentence-sized scenes.** `scripts/editor/auto-plan.mjs` builds exactly one scene per spoken sentence. A 5-12 s sentence becomes a 5-12 s hold. Only photo scenes longer than 7.5 s are split, and only once, at 45-60% of the span. Figure cards and posters are never split.

2. **Concept queries fail silently into posters.** `scripts/editor/auto-timeline.mjs` calls `conceptQueries()` once per video; `scripts/editor/concept-photo.mjs` parses the answer and returns `null` for every sentence on any unrecognised shape. A null query is not an error, so the plan falls straight through to a statement poster. The baseline log contains no `[concept-photo]` lines: either every query was null, or every Commons search returned no usable record. The current code cannot distinguish those cases.

3. **Full-frame key-phrase posters read as slides.** `scripts/editor/styles.mjs` draws `poster()` on a full-frame flat background. Vox uses `#0B0B0C`, anti-slop uses the channel background (`#050510` in the baseline), mograph-critic uses `#07070D`. A 54 s Short with six of them looks like a deck. The posters carry a key phrase, not the sentence, and the caption duplicates the sentence below.

4. **QA counts SVG cards as images.** `scripts/editor/video-qa.js` treats an SVG layer as an image layer, so `imageShare` reaches 100% and a text-only video can pass. `maxStaticRun` is 4.0 s with a 0.2 diff at 2 fps: a slow zoom on a poster passes it. There is no gate for dark-frame share, scene cadence, poster share, asset reuse, entity coverage, or provenance.

5. **Entity/asset provenance is not checked.** `scripts/entity-assets.cjs` returns an asset and `source_url`, but the plan does not compare the asset metadata to the entity it claims to show. The Anthropic/Slack case is the concrete failure. Attribution sources (a newsroom named as the source of a claim) are also eligible for subject photos, so an outlet's office can illustrate a claim about something else.

6. **Card provenance is wrong by construction.** `scripts/editor/auto-timeline.mjs` writes every card asset with `source_url` set to `script.sources_used[0]`. Figure cards therefore cite the first source in the script, not the source of the figure.

7. **Look selection is random.** `pickLook()` returns the channel's home look about half the time and another look otherwise. That is deliberate variety, but it means a channel's visual identity changes video to video. This is a product decision, not a bug; it is listed here because any change must update `scripts/__tests__/editor-auto-plan.test.js`, which asserts the 50% home-look share.

8. **Captions are small.** `caption_style` is `{ x: 80, y: 1540, w: 920, h: 210, size: 38 }`. 38 px on a 1080-wide vertical frame is below comfortable Shorts caption size.

## Change list for this branch

The fixes are ordered by what changes the rendered result first.

1. **Clause-level scenes, word-timed.** Split each spoken sentence into clause spans at punctuation and conjunction boundaries, then time each clause from `-vo-words.json`. Keep captions sentence-level. Target 2-4 s per clause, with a hard maximum; split any remaining long clause. A scene must tile the audio with no gap or overlap.

2. **Deterministic concept queries.** Derive a Commons query per scene from the script's own `b_roll` / `visual_cue` and the sentence's concrete nouns, then sanitise camera/film words. Use the model query only as an additional candidate, never as the sole source. Log every candidate and every rejection so a silent null cannot recur.

3. **Skip attribution sources.** Reuse `isAttributionSource()` from `scripts/entity-coverage.js`; an organisation named as the source of a claim is not the subject of the scene.

4. **Entity provenance guard.** For organisations and places, accept a photo only when the resolver's `source_url` / `credit` contains a significant token of the entity name. For persons, keep the existing `verify-person-image.cjs` identity check. A mismatch falls through to a concept photo or a designed plate, never to a mislabelled subject.

5. **Designed fallback plates instead of near-black posters.** Country/region: flag or highlighted map. City/place: map plate with pin. Organisation: organisation plate. Person: non-identifying silhouette plate. Number/date: figure or date plate. A key-word poster remains the last resort and is capped as a share of total scene time.

6. **Per-card provenance.** `buildAutoPlan()` returns card metadata (`kind`, `entity`, `figures`, `source`, `source_url`); `auto-timeline.mjs` writes each card asset with its own provenance instead of `sources_used[0]`.

7. **QA metrics and gates.** Add pure `scripts/editor/qa-metrics.mjs` for dark-second share, median/max scene duration, statement-poster time share, consecutive asset reuse, caption size and entity coverage. Wire it into `scripts/editor/video-qa.js` and pre-render validation. Fail closed: a missing metric is not a pass.

8. **Captions.** Raise the default caption size and box height; keep the existing wrap and safe-area rules.

## Acceptance criteria

A branch render of channels 1, 2 and 48 must satisfy all of the following before it is called green:

- First scene ends at or before 4 s.
- Median scene duration is 2-4 s; no scene exceeds 7.5 s without a deliberate split.
- Statement-poster time share is at most 35% of the video.
- No asset is used in two consecutive scenes; no asset appears more than three times.
- Dark-frame share (mean luma below 20) is below 20% of sampled frames.
- Every named entity in the narration is either shown by a verified asset, a designed plate, or explicitly recorded as a miss in the report.
- Every card/source URL traces to the research artifact; no card cites `sources_used[0]` by default.
- A wrong-entity asset (the Anthropic/Slack case) is rejected by the provenance guard.
- `scripts/__tests__` passes, including new tests for clause times, deterministic queries, provenance, poster share and the dark-share metric.

## Where this audit stops

- The baseline concept-query null result is not fully explained. The fix removes the dependency on a single model call, but the exact provider response shape that produced the nulls has not been reproduced from the baseline log.
- The render `(21)` failure in run `41044446681` is outside this audit's visual scope; it needs a separate render-run diagnosis.
- The provenance guard is a metadata check, not an image classifier. It stops the known Anthropic/Slack mismatch and any source URL that does not name the entity; it cannot prove that a correctly named file shows the right thing. The existing person identity verifier and the concept-photo vision check remain the image-level checks.
