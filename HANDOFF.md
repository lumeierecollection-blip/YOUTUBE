# Handoff — 2026-10-07

Session-closing state document. Written by an OpenCode session that spent its
length diagnosing why four newly registered channels could not render. Read
§7 first — everything else is reconstructable from `git log`, §7 is not.

**Last verified commit when this was written:** `f2063e6`
**Suite at that commit:** 230 pass / 0 fail
**`origin/main..HEAD`:** empty

---

## 1. What this repo is

An automated multi-channel YouTube system. A GitHub Actions workflow researches
a topic per channel, writes a script, generates a voiceover, renders a video
with Remotion, and publishes it. 52 rows exist in `config/channels.json`; 10
channels are approved to publish via `config/priority-channels.json` — the six
built ones (`ch-01`, `ch-02`, `ch-09`, `ch-26`, `ch-44`, `ch-49`) and four new
ones (`ch-05` Broadsheet, `ch-06` Archive Room, `ch-08` Ledger, `ch-10` Margin
Note). `CLAUDE.md` describes the design; `CHECK-REGISTER.md` is the single
source of truth for every check ID.

---

## 2. Current state

**Shipping:** `ch-01` Money Mind, `ch-02` Legal Brief, `ch-09` Border Lines,
`ch-26` Fraud Files, `ch-44` Skill Stack. Unverified this session — none of these
were dispatched.

**Registered, first video rendered 2026-10-07:**
- `ch-05` Broadsheet — rendered, **rejected**. See §4.
- `ch-06` Archive Room — never dispatched. Never rendered.
- `ch-08` Ledger — never dispatched. Never rendered.
- `ch-10` Margin Note — never dispatched. Never rendered.

**Last known good evidence that the pipeline works:** run `37550901882`,
2026-10-07, ch-05 only. Proved topic selection, rendering, and Layer 1 all
function when the channel is resolved correctly.

**Last failing run:** same run, `37550901882`. `render (5)` failed with
`VERDICT: FAIL (15/17 checks)` on `canvas-accent` and `pop-transitions`.

**Fleet run `37540546857`** (2026-10-06, all 10 channels) — ten different
failures, no shared gate:

| channel | exit | failure |
|---|---|---|
| ch-1, ch-8 | 143 | SIGTERM, killed, no render output — runner capacity |
| ch-2, ch-26 | 1 | `Visual planning failed (gemini, then ollama) — no plan, no render.` |
| ch-44, ch-9 | 1 | `challenger rejected the plan twice` |
| ch-10, ch-5, ch-49 | 1 | `canvas checks FAILED` (Layer 1) |
| ch-6 | 1 | `beat check FAILED` (Layer 1) |

---

## 3. Architecture, current

**Layer 1 — deterministic checks** (`scripts/local-audit.cjs`), hard unless noted.
The six canvas checks run on every render via `render-and-qa.js`:
`canvas-type`, `canvas-ground`, `canvas-coverage`, `canvas-accent`,
`motion-tiers`, `pop-transitions`, plus `beat-sentence-mechanism`,
`typography-count`, `mechanism-share`, `av-duration`.
`middle-zone-filled` is **advisory** (demoted in `6da8809` — every one of 53
reference frames passes, so the check could not discriminate; sparse aesthetic
judgement was handed to Layer 3).

**Layer 2 — CLIP style advisory** (`scripts/eval-layer2-style.js`). Threshold
`0.4570` in `channels/_shared/style-threshold.json`, calibrated on 142 frames.
Advisory only. Blank frames pass.

**WIRED (branch `work/gemini-decides-2026-10-07`, `ea3689a`).** The stub is gone;
`render-and-qa.js` calls `layer2Advisory()` from `scripts/eval-layer2-wire.js`
(a wrapper over `scoreStyleFile`, which is unchanged) and returns
`{advisory_score, frame_count, below_floor_count, timestamps_below_floor,
style_match, ...}`. `style_match` is `matched | clone_suspected | off_style`,
advisory only, never gating. HF cache step added to the v2 workflow.
**First real number (local, on the CI-rendered ch-05 MP4 of run `37687564970`):**
`advisory_score 0.6229`, 55 frames, 4 below the 0.4570 floor (at 20.9 s, 21.9 s,
22.9 s, 53.7 s), `style_match: matched`, 0 clone frames, best candidate-vs-reference
similarity 0.870 against a measured reference ceiling of 0.837 (config ceiling
0.9). **It has now run in CI** (runs `37691779624`, `37694022496`) — see §6.

**The eval loop runs before Layer 1's early-return (`f65f4ec`).**
`scripts/eval-loop-callsite.js` (`recordEvalLoop`) is called after the canvas checks
are measured and before their `return backupAudit(...)`. `runEvalLoop` takes
`recordOnLayer1Fail`: on a Layer 1 failure it runs Layers 2 and 3 once, records them,
retries nothing. Layer 1 still gates; the decision is data. The JSONL carries
`layer1_result`, `layer2`, `layer3`. Dry and live are identical on a Layer 1 failure.

**Planner: Gemini decides (`332e96c`, `e062fe0`).** The four mandates are now
defaults, not rules: per-beat `ground` (hex / white / transparent / description;
absent = white), beat type (beat 0 / last beat default to TYPE only when Gemini
didn't pick), major-beat count (old 2-3 logic only when Gemini marks none), and
composition (unknown names are logged `composition_unknown`, mapped to the nearest,
never failed; a `compositions_used` counter is logged per plan). The planner reads
`channels/<channel_id>/style-spec.json` as reference (`style_spec_missing` is
logged, not fatal). **Confirmed live in CI for ch-05:** the planner log shows
`style spec channels/ch-05/style-spec.json loaded as reference (16 field(s))`,
beat 0 was NUMBER-FULL (not forced TYPE), and Gemini chose grounds
`#F0F0F0 / white / #F0F0F0 / #2B2B2B / white / #F0F0F0 / white / #2B2B2B / white`
across the 9 beats — measured in the rendered frames (240, 255, 43 on the ground).

**Second gate, independent of the stub:** the whole block is wrapped in
`if (loopEnabled())` (`render-and-qa.js:1995`), and `loopEnabled()` is
`evalLoopMode(env) !== "off"` (`eval-retry-loop.js:70-72`). With
`EVAL_LOOP_MODE=off` — the cron default and what every diagnostic dispatch has
used — `runEvalLoop` never executes, so the Layer 2 stub and the Layer 3 judge
are both skipped. Dispatching with `off` cannot produce an advisory score even
after the stub is fixed.

**Layer 3 — Gemini full-video judge** (`scripts/eval-layer3-judge.js`, uploads
via `src/lib/gemini-files.js`). Axes: engagement, prompt-intent, composition,
style coherence. Model `gemini-3.5-flash`, fallback
`gemini-3.1-flash-lite-preview`. **Has never run in CI.** One local ch-2 run
scored aggregate 4.700 and correctly flagged white ground against a dark spec.

**Retry loop** (`scripts/eval-retry-loop.js`). `EVAL_LOOP_MODE` is a
workflow-dispatch **string** input (`off`/`dry`/`live`), default `off`, cron
inert. Call site is at `scripts/render-and-qa.js` after frame review. It **logs
decisions and does not route shipping** — `renderBeats` throws rather than
re-render partially, so `live` cannot actually apply revisions.

**Topic source.** `scripts/fetch-trending.cjs` — YouTube Data API v3
`videos.list chart=mostPopular`, filtered to 7 days, ranked by velocity. Keyed
by the bare dispatch key. `CATEGORY` maps bare id → YouTube category id. A
keyword-only niche filter ranks candidates against the channel's `niche` +
`content_pillars`; keyword overlap only, no embeddings.

**Provider chain.** `discover-topics` answers via `gemini-3.5-flash-lite` with
`ollama/qwen2.5:3b` as fallback. The visual planner uses `SCRIPT_GEMINI_MODEL`
directly against three numbered Gemini keys. Note `OPENCODE_MODELS`,
`OPENCODE_MODELS_RESEARCH` and `OPENCODE_MODELS_REASONING` are all set to
`ollama/qwen2.5:3b` workflow-wide while the planner bypasses them for Gemini —
two providers in one env block.

---

### 3b. Overnight 2026-10-08 — layout, references, overrides (commits `23f0917`..`aa512e7`)

**Layout is the planner's (`cbe8a04`, `1d023ca`, `5a1fa6c`, `7bc6b55`).** `canvasLayout()` no longer
places elements only from the per-composition table. The table (now `tableLayout()`) still computes
every element — its size, its text fit — and the beat's `layout` from the planner says WHERE:
`{cols, rows, slots:[{id, col, row, col_span, row_span, align, v_align} | {id,x,y,w,h}]}` on the
planner's own grid over x 48-1032, y 130-1340. A slot is a region (no alignment = keep the default
spot, moved only into the slot). The header furniture (kicker, rule) restacks above the text it
introduces; a figure's label, a statement's lead phrase / underline, a timeline's spine move with
their element. A planned layout is checked BEFORE render against Layer 1's geometry
(`layoutViolations`: zones, text overlap, centre line, 60% span); one that breaks a rule the table's
layout keeps is not used for that beat — the table is — and `plan_layout.rejected` / the log line
`[layout] beat N: plan layout NOT used ... — <rule>` says why. Legal layouts are drawn as planned
(`[layout] beat N: plan layout USED`). After the challenger's re-plan, unblocked beats that lost
their layout get the planner's own first-plan layout back (`197999f`).

**Reference frames reach the planner (`0855587`).** Every Gemini planner call carries 4 frames of
the channel's reference video as image parts (`scripts/reference-frames.js`; committed under
`channels/<id>/reference-frames/` for ch-05/06/08/10 from each spec's `reference_video`, and
`channels/_shared/reference-frames/` from `research/motion-graphics-ref/` for the rest), with "Use
them to understand the visual language … Do not copy them." Groq / Ollama fallbacks get text only.

**Planner overrides removed (`d39da91`).** Composition rotation, the TYPE cap / no-two-TYPE rule,
entrance styles and animation families no longer rewrite what the planner chose; they fill only
beats it left open (`planner_chose_type`). The grounding gate (a choice the sentence does not
ground is replaced) is unchanged — CLAUDE.md hard rule.

**Tests run on CI (`23f0917`, `e6fc025`).** `.github/workflows/tests.yml` runs every push:
`node --test scripts/__tests__/*.test.js` and the standalone `scripts/test-*.mjs`, five excluded by
name with the reason (test-composed-opacity needs a browser render; four stale tests whose
assertions were already false at `f649da2`, the queued stale tests not to be touched).

### 3c. Layout fallback rate and the beat-index resolver (2026-10-08, `aaf4b84`..`bfa240e`)

**Who draws a beat — measured, per beat.** render-and-qa logs one line per beat:
`[layout] beat N: SOURCE plan | plan(vertical K%) | plan-x | plan-y | plan-noop | table — moved … | adjusted … | rejected …`.
`plan-noop` (a layout that moved nothing) and `table` are both "the table drew it".

**Diagnosis (43 beat-plans, runs 37718157561 / 37722686373 / 37723570093):** no layout sent 17, span < 60%
13 (4 with a zone clash), centred 1, "used" 12 — and replaying 37723570093's real canvases showed
most "used" layouts moved nothing: 9 of 10 slots named a visual the RENDERED beat did not have (the
planner names the visual it planned; the grounding gate / scene translation drew another).

**Fixes (each with a mutation, each replayed on real CI canvases in `scripts/fixtures/layout-replay/`):**
- a slot naming a visual the beat lacks places the beat's own visual (`hero`) — `aaf4b84`;
- per-axis fallback: horizontal-only, vertical-only before the table — `aaf4b84`;
- the planner's horizontal placement with its vertical move eased toward the default in 10% steps,
  the nearest legal position (`y_blend`) — `3bc6a26`;
- box span kept within 1 point of the default's (boxes overstate ink; 37743696701 beat 1 passed the
  box rule at 60.3%, rendered 58.9%) — `a30b42d`;
- a placed element goes no lower than the table puts it, or 1316 (a cutout's shadow crossed y 1340
  in 37746025773) — `bfa240e`;
- prompt: a layout on every beat, `hero` for an unsure visual (`aaf4b84`); `center` offered only for a
  visual, not text (37746025773 centred text on 6/9 beats) (`bfa240e`).

**Beat-index resolver (`67f6a8a`).** `eval-layer3-judge.js` `resolveBeatIndices`: Layer 3's MM:SS ->
the manifest beat containing it (whole-second resolution, nearest-overlap at the edges);
malformed / out of range -> unresolved, never guessed; overlapping beats -> the earlier, marked
ambiguous. On CI (37741112569): `[layer3] weak beat 00:16 -> beat 3`, `revisions: 1, unresolved: 0`.
The loop now stops at the NEXT gap: `revise()` at the call site returns no plan patch and a re-render
is not permitted there — "planner returned no partial plan patch; a full re-render is not
permitted". Live cannot act until that is built (7.33).

### 3d. Board runs 2026-10-08 evening — branch `fix/ollama-and-gemini-fallback` (NOT merged)

Four dry-run board dispatches on the branch (publish is gated to main): 37795613343 (`9077ac2`),
37803694366 (`315e009`), 37810883817 (`5477743`), 37818249392 (`f6a7dca`). **First green video:
ch-5 on 37810883817** — `judge-dismisses-murder-robbery-charges-mid-trial`, Layer 1 17/17, beat-check
9/9, Layer 3 accept, frame review APPROVED, queued approved/; frames inspected by hand (Wikipedia
photos of Wilkes-Barre and the Luzerne County Courthouse, verified MATCH). Its image-credits.json is
empty although it uses two Wikimedia photos — attribution not recorded (open).

Fixed on the branch, each by mechanism:
- Runner shutdowns (7.37a): the Ollama model cache never restored, so each render job pulled ~17 GB
  and WARMED qwen2.5:7b / vl:3b / 14b in RAM beside Chrome + rembg. `warm: "false"`, 14b dropped
  (`9077ac2`). 0 runner shutdowns in 37 render jobs across the four runs (4/10 in 37776924101).
- Gemini: 503 tries sibling models; timeout/503 rotates untried keys first (`9077ac2`, `f83895a`).
  Beat-check maxTokens 2048 -> 6144 (gemini-3.5-flash truncated the verdict JSON).
- Wrong maps: ISO-3 aliases matched case-insensitively ("Are" = UAE on ch-1, "Can" = Canada on ch-9) —
  short codes need capitals (`315e009`); bare "Washington" drew Washington STATE on ch-9 and the video
  reached approved/ (beat-check said YES, frame review noted it and approved) — washington/georgia
  bare now resolve to nothing (`f6a7dca`). The gates did not stop a wrong place; the alias table did.
- visual-first no longer rewrites a planner-chosen beat; MONEY needs a physical money word, not an
  amount (`315e009`). Render-time rotation stays the canvas-type backstop (`5477743` reverted a lock
  that made ch-5/ch-49 fail Layer 1).
- composition-variety fallback 5 (two key nouns + arrow) OFF (`2f3afb5`): 12/12 seen failed beat-check.

Open, for the owner:
- After fallback 5 went off, frame review's TEMPLATE_MONOCULTURE (Gemini) holds most videos
  (ch-1/9/26/44/49 at 55-75% headline-dominated) — while Layer 3 accepts the same renders (ch-8 8.8
  twice, ch-9, ch-49 x3). Two Geminis disagree; fix is upstream (planner/script grounding more visual
  beats), not a code fallback.
- ch-6 (`cinematic-documentary`) and ch-10 (`minimal`) route to legacy compositions
  (render.js getCompositionForStyle) that never draw the Gemini canvas plan; ch-6 renders at 0.35 fps
  (swangle) vs 13-16 fps and hits the job cap. Switching them to the full-canvas engine changes the
  channel's registered identity — owner decision.
- pop-transitions on dark beats with a word-synced photo (ch-5 beat 9 on 37818249392) — 7.21 / 7.27.
- Prep `claims` gate skipped ch-2, ch-8, ch-10 on some topics — the hard rule working.

## 4. What works

| channel | renders | last verdict | Layer 1 | L2 | L3 |
|---|---|---|---|---|---|
| ch-01 Money Mind | yes, unverified this session | — | — | — | — |
| ch-02 Legal Brief | yes, unverified this session | — | — | — | local run only, agg 4.700 |
| ch-05 Broadsheet | **yes, first render 2026-10-07** | rejected | **15/17** | never | never |
| ch-06 / ch-08 / ch-10 | no, never dispatched | — | — | — | — |
| ch-09 / ch-26 / ch-44 / ch-49 | yes, unverified this session | — | — | — | — |

**ch-05 run `37550901882`, verbatim:**

```
topic: ch-5 doj-fraud-division-corporate-enforcement-directive-2026
[research] ch-5: focus pillar "press investigations" (0 recent topic(s) touch it)
Discovered 3 candidate topic(s)
[canvas] full-canvas style, accent (none — ink)
rendered 1 file(s) under data/renders
[local-audit] PASS beat-sentence-mechanism
[local-audit] PASS typography-count — 2 TYPOGRAPHY beat(s)
[local-audit] PASS mechanism-share — max share 33%
[local-audit] PASS av-duration — video 52.93s, audio 53.71s
[local-audit] FAIL canvas-accent — the manifest names no accent colour
[local-audit] FAIL pop-transitions — beat 2: the composition is empty at
  boundary frame(s) 6, 7, 8, 9, 10; beat 5: the composition is empty at ...
[local-audit] VERDICT: FAIL (15/17 checks)
[queue] ch-5: doj-fraud-division-corporate-enforcement-directive-2026-shorts-shorts-2026-10-07.mp4
  -> data/renders/rejected/ (rejected, failed canvas-checks, NOT uploaded)
```

Style match: **unverified.** Layer 3 never ran, so no judge has ever seen this
video. Do not describe the render as good or bad — nobody has looked.

---

## 5. What's broken — open bugs

**Fixed on `work/gemini-decides-2026-10-07` (not merged):** channel-resolution
sweep to `channel-lookup` (`232ecb6`, guarded by `channel-sweep.test.js`);
duplicate guard removed from `fetch-trending.cjs` (`4a57356`, §7.1 closed);
trending categories remapped and ch-49 added (`fc6aca4`); `youtube-publish`
reads `config/priority-channels.json` and refuses a channel whose credentials
path names another channel (`06ddcdb`, `11fb794`). 105/105 on the six test files
these commits touch (re-run 2026-10-07).

**BUG-1 status: no longer reproduces.** In run `37687564970` ch-05's
`canvas-accent` PASSED (`accent #2B2B2B in beat 7`). Cause not traced; do not
close it on one run.

**BUG-2 (`pop-transitions`) — FIXED for the ch-05 beat-5 class (`62683d7`).** Not the
`f766ae5` class: that gate is intact. In a TYPE-FULL beat with a concept visual and
`entrance_style: "visual-first"`, `ConceptVisual` delayed itself a further 0.45 s inside
a group the compositor already counted as "in" at frame 2; the outgoing beat had faded
to 0 by frame 6.5. Rendered before/after (qa-canvas-render.mjs, same beat shape, ink
rows above the caption row, threshold 12): before f7-f14 = 0, after f0-f16 all >= 105.
Confirmed in CI: run `37694022496` passed `pop-transitions` (16/17). One beat shape,
one run — other shapes are unproven.

**NEW BLOCKER — `zones-no-overlap` fails on every beat with a declared dark ground.**
See §6 and §7.20.

**BUG-1 — `canvas-accent`: config present, manifest empty. OPEN.**
`config/channels.json:2884` has `"canvas_accent": "#2B2B2B"` for ch-05.
`local-audit.cjs:408` fails with `the manifest names no accent colour
(channels.json colors.canvas_accent)` when `manifest.accent` is falsy.
`scripts/render-and-qa.js` only **reads** the manifest (written by the
Remotion renderer), and contains no code that populates `accent`. The
propagation path from `channels.json colors.canvas_accent` into the render
manifest was **not traced** — that is the remaining work.
Secondary concern, unverified: `#2B2B2B` is near-black, and on a white
newspaper-collage ground near-black *is* the ink. The log's `(none — ink)` is
consistent with the value being wrong for this channel independent of the
propagation bug.

**BUG-2 — `pop-transitions` on ch-05: empty compositions at boundaries. OPEN.**
Beats 2 and 5 report `the composition is empty at boundary frame(s) 6, 7, 8, 9,
10`. This is the same *message* as the `f766ae5` fix (hold the outgoing beat
until the incoming one has ink), but **a 5-frame consecutive run is not a
boundary pop** — it is a span. Not yet compared against ch-02's earlier
`pop-transitions` failure in run `37380168306`. `scripts/measure-boundary.mjs`
and `scripts/probe-arrival.mjs` exist to reproduce it and have not been run
against ch-05's frames.

**BUG-3 — ch-2 / ch-26 planner summary contradicts its own log. OPEN.**
Run `37540546857`. Both channels log a healthy first pass:
```
[planner] gemini key 1/3 answered
Gemini plan attempt 1 ha[s ...]
[translate] beat 0 / beat 1 (photo -> PHOTO) / beat 2 / beat 3
```
then the workflow emits `Visual planning failed (gemini, then ollama) — no plan,
no render.` Not quota (no 429/RESOURCE_EXHAUSTED), not starvation at attempt 1
(Ollama never appears in that window), and Gemini answered in ~5 s. Either a
second attempt failed after one that succeeded, or the summary fires on a
condition other than "no plan". **The window after `[translate] beat 3` in
ch-2's 2,285-line log was never read.**

**BUG-4 — `ch-48` is unresolvable. OPEN, low priority.**
`channel_id` is `ch-48` but its `id` is not 48, so `resolveChannel` throws
`channel_ambiguous`. Under the old id-based lookup it matched zero rows and
silently produced an empty context. Not in `config/priority-channels.json`, so
nothing dispatches it.

**BUG-5 — Gemini keys 1 and 2 appear dead. UNVERIFIED.**
Logs show `project: unknown (every probed API is ena...)` for keys 1 and 2 on
both ch-2 and ch-26; only `GEMINI_API_KEY_3` (project 662788814396) answered.
All five key secrets are present in the workflow env, which contradicts the
"dead keys" reading. **What `project: unknown` actually means in
`gemini-client.js` was never read. The claim that keys 1 and 2 are dead is
unretracted but unsupported.**

---

## 6c. CI state, 2026-10-08 (second overnight)

**Tests:** green on every push; last `37751614497` on `bfa240e` (397 node:test + standalone).

**Layout source per beat on CI (from the render manifest's plan_layout):**
- `37739128920` (`aaf4b84`): plan 5, plan-x 3, table 2 (beats 0, 4 NUMBER-FULL) — 20%; APPROVED.
- `37741112569` (`3bc6a26`): final render plan 10/10 (3 with vertical eased 10-40%) — 0% table;
  attempt 1 1/10 (a no-op). Frame review APPROVED; Layer 3 6.98; resolver: weak beat 00:16 -> beat 3.
- `37743696701` (`3bc6a26`, live): 9/9 plan — 0% table; Layer 3 7.9 (axes 8 / 9 / 7 / 8); Layer 1
  failed canvas-coverage 58.9% on one beat -> `a30b42d`.
- `37746025773` (`a30b42d`, live): 4/9 table (the planner centred text on 6 beats) -> `bfa240e`.
- `37751617230`, `37755289095` (`bfa240e`, live): SIGTERM before render (7.29, topic-specific).
- `37756444486` (`bfa240e`, ch-5 + ch-26, dry): **ch-5 final render 8/9 from the plan (plan 3, plan-x 3, plan(vertical 10% / 80%) 2), 1 plan-noop — 11% table.** Layer 1 pass; Layer 3 7.19 (engagement 7, prompt_intent 7.2, composition 7, style_coherence 7.5); loop decision `accept` — the first CI accept; frame review APPROVED, queued approved/; Layer 2 0.600, clone_frames 0. ch-26 SIGTERMed in asset resolution (7.37).

Replays of the four CI runs' real canvases on `bfa240e`: table-drawn <= 1/10 each
(`layout-replay.test.js`).

## 6a. CI state at the end of the overnight run (2026-10-08)

**Tests:** run `37723569488` on `aa512e7` — 376/376 node:test, standalone scripts all PASS, 5 SKIP
(named in tests.yml). Green on every push since `0855587`.

**First ch-05 render past every gate:** run `37703727115` (`994be17`, before planner layouts were
emitted) — Layer 1 17/17, frame review APPROVED, queued `approved/`. Layer 2 0.579, clone_frames 0;
Layer 3 6.59 (engagement 6.2, prompt_intent 6.8, composition 6.5, style_coherence 6.8), weak_beats [].

**Planner layouts in a Layer-1-passing render:** run `37723570093` (`aa512e7`) attempt 1 — 10/10
beats carried a planner layout; beats 1, 2, 3, 7, 8 USED, the rest fell back (span 16-47%,
headline in the visual's zone); `layer1_result.pass: true`; frame review then REJECTED it
(TEMPLATE_MONOCULTURE 50% headline-dominated). Attempt 2: 8/10 USED; Layer 1 failed only
pop-transitions on beat 2 (see 7.27). Layer 2 0.62-0.64, clone_frames 0, style_match matched;
Layer 3 5.19 / 5.65. Reference frames log, every run since `0855587`:
`[planner] ch-5: reference frames attached to the planner call: 4 from research/4_5917850534521349135.mp4 (ch-05/reference-frames/frame-01.jpg, …)`.

**Two renders differ, same composition:** MAP-CENTERED, default (run `37700319999` beat 1):
`kicker@511,130 headline@172,183 860x182`; planner layout (run `37723570093` beat 1):
`kicker@795,130 headline@321,187 711x182` (plan_layout.placed headline+kicker). The difference is
real but modest: the planner's legal layouts so far re-anchor the header more than they rearrange
the body.

**Two layout plans, two rendered arrangements — controlled proof on CI:** workflow
`layout-proof.yml`, run `37736259802` (`f0a8cca`). One NUMBER-FULL beat, ch-05 accent, rendered
twice by the real renderer with two fixed planner layouts (`scripts/fixtures/layout-proof/`):
A (2x3, headline right, figure bottom-left) placed `headline@291,130, number+label@48,781`;
B (4x3, headline left, figure bottom-right) placed `headline@48,130, number+label@750,781`. Rendered
pixels: middle-zone ink centroid x 0.165 (A) vs 0.814 (B); top-zone 0.566 vs 0.336. The job fails
if either layout falls back or the arrangements match. Tests green on the same commit: run
`37736259805`.

**Live:** not dispatched. Every Layer-1-passing run's Layer 3 either named no weak beat or named
beats with `beat_index` undefined (unresolved) — the beat-index resolver gap is now OBSERVED (runs
`37705693390`, `37718157561`, `37723570093`); fixing it was out of scope tonight by instruction.

## 6. Layer 2 / Layer 3 — first CI numbers (2026-10-07)

**Run `37694022496`** — merged `main` (`fbd12ae`), ch-05, `eval_loop_mode=dry`,
`dry_run=true`. Topic: `former-cop-fires-states-first-salvo-in-aka-murder-case`.
Layer 1: **FAIL (16/17)** — `zones-no-overlap` only; `pop-transitions` passed.
The eval-loop record, verbatim:

```
{"ts":"2026-10-07T22:17:34.716Z","mode":"dry","decision":"human_review","channel":"5","run_id":"former-cop-fires-states-first-salvo-in-aka-murder-case-shorts-script-a1","layer1_result":{"pass":false,"failures":[{"check":"zones-no-overlap"}]},"layer2":{"advisory_score":0.5662885991585376,"frame_count":47,"below_floor_count":0,"timestamps_below_floor":[],"style_match":"matched","clone_frames":0,"note":null},"layer3":{"aggregate_local":6.9,"axes":{"engagement":6.5,"prompt_intent":7,"composition":6.8,"style_coherence":7.2}},"retries_spent":0,"would_rerender":[],"rendered":[],"weak_beats":[],"unresolved":[],"why":"layer 1 failed (zones-no-overlap); layers 2 and 3 recorded, not acted on","duration_ms":34519}
```

Layer 3: model `gemini-3.5-flash`, 17.7 s, `weak_beats: []`, `aggregate_gemini: null`.
`aggregate_local 6.9` is below the 7.0 accept line, so **with Layer 1 passing this would
still be `human_review` (`nothing-revisable`)**: Layer 3 named no beat, so there is
nothing to retry. That is not the beat-index resolver gap (nothing was named to
resolve); the resolver remains unobserved. Live was therefore not dispatched.

**Baseline run `37691779624`** (commit `f65f4ec`, before the renderer fix, ch-05, a
different topic — `florida-lab-executive-convicted-medicare-fraud`): Layer 1 FAIL
(`zones-no-overlap`), `advisory_score 0.6123`, 51 frames, 4 below the floor,
`style_match matched`, 0 clone frames, `aggregate_local 6.48`. Its JSONL was runner
state and is lost (axes unrecoverable) — `fbd12ae` now logs the record and uploads
`data/audit/{eval-loop,layer3}` as the `eval-audit-*` artifact. **The two runs are
different videos** (each dispatch picks a new topic), so 6.48 -> 6.9 and 0.6123 ->
0.5663 are not a before/after of the renderer fix. There is no same-video baseline.

**Why `zones-no-overlap` fails (read from `local-audit.cjs:593-625` and the manifest,
not assumed):** the pixel part defines ink as luma < 235 or chroma > 30 "on the white
ground". Beats 3 and 7 of run `37694022496` have a Gemini-declared ground `#0E0E10`
(`dark: true`); on a dark ground every pixel is "ink", so all ~540 columns "cross"
both zone edges. The failing beats are exactly the dark-ground beats. In
`37687564970` the failing beat was a PORTRAIT on `#F0F0F0` (a different, unexplained
failure, 223/285 columns). Fixing this means measuring ink relative to the beat's own
ground (byte-identical on white) — a Layer 1 change, **not made**: the push forbade
touching Layer 1, and it is a judgement about what a declared dark ground should be
allowed to do. `pop-transitions` uses the same absolute `< 235` and passes a dark beat
trivially (§7.18).

Earlier runs, unchanged: `37681011877` stalled 2h40m in `Ensure ffmpeg/ffprobe` and
was cancelled (not investigated); `37674538629` (on `06ddcdb`) was cancelled with
ch-1/10/44 failing in Render + QA, reasons not read.

### Style comparison (ch-05 vs its three references)

Candidate: the 48 s 9:16 render of run `37694022496`; references
`4_5917850534521349135.mp4`, `...251.mp4`, `...262.mp4` (16:9, 60-79 s). Eight
evenly spaced frames from each. **Not assessed: motion / arrival pattern** — contact
sheets cannot show it and no frame-difference measurement was made; from the code the
candidate's text arrives by in-place scale pops (0.94 -> 1.04 -> 1.00, words popped one
by one), nothing slides.

- **Ground.** Candidate: a full-bleed photo beat, near-white beats (some faintly warm,
  a slight off-white gradient low in two beats), and one `#0E0E10` near-black beat
  (beats 3 and 7 are declared dark). References: textured, off-white newsprint with
  grain and vignette (251, 262), a navy world map and a cream/yellow paper grid (135).
  Gemini chose grounds per beat; the one dark beat has no counterpart in the 251/262
  references. None of the references has a flat pure-white ground.
- **Palette.** Candidate: black ink on white, one dusty mauve-grey word colour in a
  headline, white caption text on the photo. References: warm paper greys, a plum /
  maroon wash over greyscale photos (262), yellow and pink highlighter bars (135, 251),
  navy and teal (135). Shared: restrained, mostly monochrome; not shared: the
  highlighter yellow and the plum tint do not appear in the candidate.
- **Typography.** Candidate: a high-contrast didone serif headline (bold + light
  mix), sentence case, oversized single-word / numeral heroes ("Rulings", "9", "7"),
  small sans captions with an underlined emphasis word. References: serif newspaper
  headlines (251 "Photorealistic", "UNDERDOGS" in a condensed sans), typewriter body
  text, small black label bars with white sans (262), highlighter on key phrases.
  Serif-led and newspaper-adjacent in both; the references' textured body copy and
  highlighter marks are absent.
- **Composition / content.** Candidate: flat vector diagrams (circles + arrow), big
  numerals, one real photograph full-bleed. References: photos inside black frames on
  newsprint (262), layered paper and halftone (251), template-demo screens (135).
- **Copy check.** Not a copy: Layer 2 `clone_frames 0`, best candidate-to-reference
  similarity 0.8415 against a reference ceiling of 0.9; the content, aspect ratio,
  subject and every frame differ. Layer 2 `style_match: matched` — CLIP-level
  similarity, advisory.

## 6b. Known issues, unproven

- Layer 2 and Layer 3 have **never run in CI**. Layer 2's reason is now known and
  is not the one assumed: it is **not wired** (`render-and-qa.js:2006` is a stub
  returning `advisory_score: null`), and separately `EVAL_LOOP_MODE=off` skips
  the whole eval block. Neither is a file problem, so `159ac9f` changed nothing
  about either. Layer 3 is wired (`judge(...)`) but likewise never runs, because
  it lives inside the same `loopEnabled()` gate.
- `EVAL_LOOP_MODE=live` **cannot apply revisions** — no partial renderer exists.
  `renderBeats` throws.
- `gemini caching unavailable, using full prompt` on every logged run.
  `cachedContents` does not work in CI; every plan pays full prompt cost.
- `middle-zone-filled` was demoted to advisory after measuring, never re-run
  against a real render since.
- Nine `content_pillar` values across the four new channels were rewritten by
  byte-splice; they have been parsed and diff-verified but never seen by a
  human reader.
- `data/topic-log.json` now contains four `moth-wing`/`google-flow-music`
  entries for ch-05 that were produced by the lookup bug. They are real
  reservations and will suppress genuinely-new topics.

---

## 7. Overlookable issues — read this first

**7.1 — The collision guard in `fetch-trending.cjs` is a duplicate, not the
shared one.** `scripts/lib/channel-lookup.cjs` was extracted specifically so the
guard would live in one place, but `fetch-trending.cjs:74-95` **still carries
its own `KNOWN_COLLISIONS` copy** with its own `console.warn`. The extraction
never deleted the original. Editing the shared module will not change
`fetch-trending`'s behaviour.

**7.2 — "both namespaces agree" is the rule, and pure `channel_id` normalisation
is WRONG.** Nine rows duplicate a `channel_id`, and for the three that ship
daily the namespaces disagree in *opposite* directions:
```
ch-26 "Fraud Files"  id=26  channel_id=ch-26   consistent  -> wins key 26
ch-26 "Harmony"      id=5   channel_id=ch-26   inconsistent -> loses key 26
```
A first-match implementation of `channel_id` normalisation resolves key 26 to
**Harmony**, regressing a channel that was shipping correctly. The rule is: a
candidate wins only when `normalize(channel_id) === normalize(key) AND
normalize(id) === normalize(key)`. Both sides normalised. This was caught by a
test asserting *what it resolved to*, not by the guard.

**7.3 — Guards are narrower than they look.** `fetch-trending.cjs`'s guard
checked only keys present in `CATEGORY`. `build-discovery-context.js` had no
guard at all and did its own lookup, in the same run, with the same ambiguity.
Being "guarded" in one file says nothing about the next file.

**7.4 — Tests that passed without covering the wiring.** Three separate times
this session, a suite went green while the actual path was broken:
- The first niche-filter mutation **survived** because tests called pure helpers
  and `main()`'s wiring was untested. Fixed by extracting `rankAndFilter` as the
  tested seam.
- Run `37548436088` then died with `dropped is not defined` **inside `main()`**.
  Fixed, and `main()` was exported plus `data/audit/trending-e2e.cjs` written.
- `ollama-agent.js:462` logs `ch-?` because `--channel-id` is never passed to
  the agent. The channel it is working on is invisible in its own logs.

**7.5 — `canvas_accent` is a config field that does not propagate.** Present in
`config/channels.json`, read by `local-audit.cjs` as `manifest.accent`, and
nothing in `render-and-qa.js` writes it. A field that exists in config and is
absent at the point of use reads as "handled" and is not.

**7.6 — Two id namespaces, disagreeing, with 9 duplicate `channel_id` rows and
duplicate `id` values.** `config/channels.json` has 52 rows, both `id` and
`channel_id` are non-unique, and for 4 rows they disagree outright. Any code
touching either field without going through `channel-lookup.cjs` is a latent
bug. The bare set of colliding `channel_id`s: 26, 30, 31, 35, 39, 44, 46, 47, 49.

**7.7 — `config/channels.json` must never be round-tripped.** It is CRLF
throughout and carries 7 literal `\u00e2` escape texts.
`JSON.parse → JSON.stringify` rewrites them. Every edit this session was a
byte-splice with a byte-identity check against `HEAD`. **The mojibake itself is
still there and unrepaired** — deliberately, by instruction, in every push.

**7.8 — The committed blob is LF-only; the working tree checks out CRLF.**
Comparing them raw gives a false length mismatch (93,535 vs 96,609). Normalise
to LF before any byte comparison or you will "discover" a corruption that does
not exist.

**7.9 — `ollama-agent.js:45` does not exist.** That was the line cited in a
brief as holding the `data/trending/${c.id}.json` read. The real reader was
`build-discovery-context.js:55`. Line/file references in briefs can be wrong;
grep before trusting them.

**7.10 — "It works" meaning "it was never tried."** The four new channels have
produced exactly one video between them, ever. Layer 2, Layer 3 and
`EVAL_LOOP_MODE=dry`/`live` have never run on any channel in CI. No channel has
ever reached a publish. (See 7.11 and 7.12 for why the last two of those are
structural, not just untried.)

**7.11 — Layer 2 looks implemented and is not.** `eval-layer2-style.js` is a
complete, unit-tested module exporting `scoreStyleFile`, `embedFiles`,
`scoreStyle`, a calibrated threshold, and a CLI. Its docstring, its tests, its
committed reference videos, and this document all read as "Layer 2 exists." It
has no caller. `render-and-qa.js:2006` hands the eval loop a literal
`{ advisory_score: null, note: "advisory not wired at this call site yet" }`.
Presence of a module, a threshold file, reference videos and passing tests is
not evidence of a call site. Grep for the import, not the file.

**7.12 — `EVAL_LOOP_MODE=off` skips Layer 2 *and* Layer 3 entirely.** Both are
arguments inside `runEvalLoop`, and `render-and-qa.js:1995` wraps the call in
`if (loopEnabled())` where `loopEnabled()` is `evalLoopMode(env) !== "off"`
(`eval-retry-loop.js:70-72`). `off` is the cron default and the value used by
every diagnostic dispatch in this session's history. **Any claim that "Layer 2/3
would run if only the config were right" is false until a dispatch uses
`dry` or `live`.**

**7.13 — No cache for `~/.cache/huggingface` in CI.** Layer 2's CLIP weights
(`Xenova/clip-vit-base-patch32`, `eval-layer2-style.js:53`) cache to
`~/.cache/huggingface/hub`. The workflow caches `node_modules`, `~/.cache/pip`,
`~/.cache/remotion`, ollama models and `data/trending` — **not** the HF path.
`@xenova/transformers` downloads on first use by default, so it would work but
re-download ~350 MB every run. Add a cache step whenever Layer 2 is wired;
until then it is dead config.

**7.14 — `Research/*.mp4` is committed in a PUBLIC repo.** 18 third-party video
files are permanently in history (`159ac9f`) and downloadable; history rewrite
would be `git filter-repo` + force-push, disruptive and incomplete once forked.
Owner confirmed after being told the repo is public.

**7.15 — (resolved by `f65f4ec`) The eval loop used to be unreachable behind Layer 1.**
It now runs before the canvas-check early-return. It still sits after silence-detect and
`verifyRender`, which return earlier, so a render rejected by those records nothing.

**7.16 — The manifest's `ground` field says `"white"` on beats that are not
white.** `manifest.beats[i].canvas.ground` is `"white"` for every beat of the ch-05
render, while `ground_color` carries the real colour (`#2B2B2B` on beats 3 and 7,
`#F0F0F0` on 0/2/5) and `dark: true` is set. Anything reading `.ground` to learn the
colour gets the wrong answer; read `ground_color`.

**7.17 — `canvas-ground` passes on declared grounds by design.** It reports "reads
uniform white on every non-photo beat" while beats 3 and 7 are `#2B2B2B`: declared
grounds are exempt from the white measurement. A green `canvas-ground` no longer
means the video is white.

**7.18 — `pop-transitions` measures "ink" as luminance < 235.** On a dark ground
every pixel is "ink", so the check passes trivially on `#2B2B2B` beats; on a
`#F0F0F0` ground (luminance 240) only real content counts. Untested whether a dark
beat can pass while genuinely empty.

**7.19 — The `[plan]` log reports `compositions_used` for planned types, not
rendered ones.** ch-05: `NUMBER-FULL 2, PORTRAIT 3, DOCUMENT 2, TYPE-FULL 1,
TYPE-SPLIT 1` planned; rendered manifest was NUMBER-FULL, PROCESS-FULL, PORTRAIT,
TYPE-SPLIT, PROCESS-FULL, TYPE-FULL x2, TYPE-SPLIT, SCENE-FULL. Plan repair and
rotation rewrite the plan after the counter is logged. The >60%-of-beats templating
signal needs many runs; one run says nothing.

**7.20 — Gemini deciding the ground and Layer 1 contradict each other.** The planner may
declare any ground; `zones-no-overlap` (and `pop-transitions`, §7.18) measure ink as
`luma < 235` on an assumed white ground. A declared dark ground therefore fails
`zones-no-overlap` on 100% of such beats, regardless of the layout. `canvas-ground`
exempts declared grounds (§7.17); these two do not. Until one of them changes, "Gemini
decides the ground" and "Layer 1 gates" cannot both hold for dark beats.

**7.21 — The `f766ae5` hold cannot show anything after frame 6.5.** The held outgoing
beat is drawn with `popOutState(local)`, which is 0 for `local > 6.5`
(`full-canvas.jsx` PopGroups returns null at opacity <= 0.001). The commit message says
the held beat "keeps rendering its LAST frame"; its content is that frame, but invisible.
Latent: `popGroups()` always schedules a first group at <= frame 1, so the hold never
needed to show more. Not changed.

**7.22 — Every dispatch picks a new topic.** Run-to-run score deltas compare different
videos. For a same-video before/after, re-render a committed script
(`render_only: true`) instead of dispatching discovery.

**7.23 — A merged `main` now carries a workflow that uploads audit state.** The
`eval-audit-*` artifact (14-day retention) holds `data/audit/{eval-loop,layer3}`; the
public repo's artifacts are downloadable by anyone with read access.

**7.24 — Six tests fail on a checkout without gitignored fixtures** (`channels/_shared/ref-frames/`,
a `data/audit/a1-ci/...mp4`): five in `eval-layer2-style.test.js`, one in
`gemini-files.test.js`. 314 of 320 pass. Environmental, not this branch; regenerate the
frames with ffmpeg from `research/motion-graphics-ref/`.

**7.25 — Gemini's layouts are mostly illegal by Layer 1's rules.** Across runs `37707115528` …
`37723570093` the planner's layouts most often broke the 60% span or put the headline in the
visual's zone. They now fall back per beat (logged) instead of losing the video, but "the planner
decides the layout" is true only for the beats whose layout is legal — about half in the last run.

**7.26 — The planner copies its examples.** With the worked example's 2x3 layout it used 2x3 on
7-10 of 10 beats; earlier 1x2 / 1x1 everywhere. Logged as `layouts templating_signal` (report
only). Not enforced — enforcing variety would be a new mandate.

**7.27 — A declared dark ground + a word-synced photo leaves a near-empty stretch.** Run
`37723570093` beat 2 (SCENE-FULL, ground #0E0E10, photo synced to frame 113): frames 6-14 show only
a ghosted first word (the dark theme's track colour on #0E0E10). The ground-aware pop-transitions
calls it empty, correctly. Fixing it means changing hard-coded theme colours (SCR-13 territory) or
the word-sync rule — left for a decision.

**7.28 — Layer 3 penalises the planner's dark grounds.** Its style_coherence findings cite "the
channel spec requires a light/white background" (runs `37705693390`, `37718157561`). The planner
picks grounds; the judge reads the spec as a rule. Two Geminis disagree; nothing reconciles them.

**7.29 — Two Render + QA steps were SIGTERMed (exit 143) mid-run** (`37713312537`, `37722686373`),
both ~2 min into asset resolution of the same topic, no error of their own, no concurrent run.
Cause not found (memory pressure from Chrome + a 14b Ollama model is a guess, unverified).

**7.30 — The daily cron runs this code.** Everything above is on `main`; the 06:00 UTC schedule runs
the approved channels with publishing on (private first). No live eval loop is involved (cron
default `EVAL_LOOP_MODE=off`).

**7.31 — "plan" includes partial vertical moves.** `plan(vertical K%)` keeps only K% of the planner's
vertical move (K = 10-90). On 37741112569 three beats kept 10-40%. The planner's horizontal
placement is whole; its vertical intent is honoured only as far as Layer 1 allows.

**7.32 — The planner still uses two grids.** 37741112569: 2x3 / 1x3 on 10/10 beats (attempt 1),
1x3 / 2x3 / 1x4 (attempt 2). Report-only signal; not enforced.

**7.33 — (resolved by `4c53802`) Live revise is built.** `scripts/eval-revise.js` asks Gemini with
the owner's revise prompt (verbatim) and the facts of each flagged beat; every gate is re-checked in
code (no revision at >= 7.0 after a Layer 1 pass; flagged beats only, max 2; layout field only;
a visible consequence in words; drawable as given; moves something; the planner's side kept). Live
backs up the original, renders the patched plan, re-runs Layer 1, judges again, and keeps the
revision only if it passes Layer 1 and is not judged lower — else restores the original. On CI:
`37762984901` Layer 3 7.0 -> accept, no revision; `37764608991` Layer 1 failed -> record only;
`37766249863` Layer 3 6.30, weak beat 00:26 -> beat 5, the reviser returned an EMPTY patch ("Gate 2:
incorrect geographical stock imagery (Alexandria Egypt vs Virginia) … a content re-plan issue") ->
`ship_as_rendered`. A non-empty patch has been exercised only by the tests (fakes), not yet on CI.
The earlier text follows for history.

**7.33a — (superseded) Live cannot act yet, for a new reason.** Indices resolve (`67f6a8a`); the call site's
`revise()` returns `{planPatch: null}` and `renderBeats` refuses a re-render
(`scripts/eval-loop-callsite.js`). Making live act means (a) a planner call that patches the named
fields of the named beats and (b) re-rendering and re-gating the video — which changes what ships,
the "separate decision" recorded at the call site. Not built.

**7.34 — Layer 3 reads `config/channels.json`, not the style spec.** `loadStyleSpec()` sends
`bg_mode: "white"` and `colors.bg: "#F0F0F0"` — fields of the older minimal / cinematic renderers —
and the judge scores the planner's dark grounds against them ("the channel's light canvas
specification"). `channels/ch-05/style-spec.json` names no ground at all (environment
"newsprint", palette greys incl. #2B2B2B). Reported, not changed.

**7.35 — Layer 3, table vs planner layouts (ch-05, 2026-10-07/08).** Table-drawn renders: 6.9, 6.77,
6.59, 6.40, 6.00, 5.40 (mean 6.34). Planner-layout renders before tonight's fixes: 5.95, 5.08,
5.46, 5.19, 5.65 (mean 5.47). After: 6.52 (37739128920), 6.59 / 6.98 (37741112569), 7.9
(37743696701), 5.5 (37746025773). Confounded by grounds: the two all-dark table runs scored 6.00 and
5.40. Drops were in composition and style_coherence. Different topics each run — not a controlled
comparison.

**7.36 — Dark ground + word-synced photo ghosting (37723570093 beat 2):** timing, not a missing
element or an opacity bug — the photo is synced to its word at frame 113, the header's unspoken words
are drawn in the dark theme's track colour (#2B2B2E on #0E0E10), so frames 6-14 are near-empty.
Fixing it means a theme colour (SCR-13) or the word-sync rule. Not changed.

**7.38 — A wrong-place photo passed into a render.** CI run 37766249863 beat 5: Layer 3 and the
reviser both identified an Alexandria, Egypt image for Alexandria, Virginia; beat-check then failed
the video (approved-review, not uploaded). The place-photo verification accepted it — the CLAUDE.md
hard rule (verified photos for named places) is held only by the later gates here. Not investigated.

**7.39 — A placed element's descenders.** `2b549a7`: the bottom limit now counts the table's `desc`
(37764608991: an emphasis word's 60 px of descenders crossed y 1340).

**7.37a — CAUSE FOUND (2026-10-08, scheduled run 37776924101): runner shutdowns.** Four of ten
production renders (ch-1, 6, 8, 49) died with exit 143 and GitHub's own annotation "The runner has
received a shutdown signal. This can happen when the runner service is stopped, or a manually started
runner is canceled." The hosted runner VM was shut down under the job — not this repo's code (nothing
here sends SIGTERM). The earlier single-channel kills had the same exit code and timing. Unresolved:
WHY the hosted runners are being shut down (resource exhaustion on the VM is the likely reading, with
Chrome + Ollama + asset processing; not verified). In this run it cost 4/10 channels.

**7.40 — The beat-visual resolver in production (run 37776924101, `3d42aac`).** Decisions logged as
"[visual-choice]": ch-9 beat 4 skipped "entities/places/ankara.jpg (wrong place)" for a line about the
African coast -> type card; ch-2 beat 6 used a document surface for a co-sponsored bill (one sponsor's
photo only); correct portraits and logos kept (DeWine, Erdogan, Earhart, Port Louis, SEC, Springer
Nature, ScienceDirect, Fast Company, Marvel). No render failed because of it; the failures were Layer 1
(ch-2 pop-transitions, ch-9 zones), beat-check (ch-10, ch-44), challenger (ch-26) and the runner
shutdowns above.

**7.37 — Render + QA steps are SIGTERMed during asset resolution.** Five times: four on the ch-5
"former CIA official … gold bars" script (37713312537, 37722686373, 37751617230, 37755289095) and once
on ch-26 (37756444486, a Ponzi topic) — so not topic-specific, though the same ch-5 script also
completed twice (37705693390, 37756444486). Exit 143, one to two minutes into "[resolve] starting PNG
fetch"; no runner-shutdown annotation, no timeout message, nothing in the repo sends SIGTERM, not
137. Leading guess (unverified): memory pressure during asset resolution (image fetch / rembg cutout
while Ollama is resident). Instrument memory in that step to confirm.

---

## 8. In-flight work

Nothing uncommitted. `git status` clean except untracked `Research/*.mp4`
(reference video downloads, gitignored by long-standing convention — see §3
below).

`channels/HANDOFF.md` contains the previous, narrower handoff and is **now
superseded by this file**. It is kept for history; §7 here is the current
version.

Local diagnostic scripts committed this session and referenced by BUG-2:
`scripts/measure-boundary.mjs`, `scripts/probe-arrival.mjs`.

---

## 9. What the next push should be

**Second overnight, 2026-10-08 — read first:**
1. Make live act (7.33): a partial plan patch for the named fields of the named beats, and a decision
   on whether the loop may re-render and replace the video it judged.
2. The SIGTERMs in asset resolution (7.37): log `free -m` / process RSS in that step.
3. Decide 7.34: should Layer 3 judge against the style spec (the planner's reference) or channels.json?
4. Planner layout vertical intent (7.31) and grids (7.32): give the planner each element's measured size.


**Overnight 2026-10-08 — read first:**
1. Fix the Layer 3 beat-index resolver — now observed in three runs (6a). Live cannot act until it does.
2. Decide 7.27 (dark ground + late photo): theme track colour on dark grounds, or the word-sync rule.
3. Decide 7.28: is the spec's background a rule (then the planner should get it as one) or reference
   (then the judge should not score against it)?
4. Planner layout legality (7.25) and copying (7.26): consider giving the planner each element's
   measured size, so its slots can respect the 60% span; keep enforcement out.
5. The SIGTERMs (7.29).


1. **Decide what a declared dark ground may do to Layer 1 (§7.20).** Either make
   `zones-no-overlap` (and `pop-transitions`) measure ink against the beat's own
   `ground_color` — byte-identical on white — or constrain the planner's grounds. This is
   the only thing between ch-05 and a Layer-1-passing render in the runs so far.
2. **Re-dispatch ch-05 once a render clears Layer 1** and read the `eval-audit-*`
   artifact. Then `live`, only if Layer 3 names beats; this run's `weak_beats: []` means
   live has nothing to act on. Layer 3's accept line (7.0) vs the observed 6.5-6.9 is
   the next real question: is 7.0 reachable, or mis-set?
3. **Look at `zones-no-overlap` on PORTRAIT beats** (`37687564970`, beat 2, `#F0F0F0`) —
   a different failure from the dark-ground one, still unexplained.
4. **Fix the Layer 3 beat-index resolver** only after a live run shows the gap.
5. **OAuth for ch-05/06/08/10/49** (names in §11) — the owner's task.
6. **Read ch-2's log after `[translate] beat 3` in `37540546857`** (BUG-3), and why
   `Ensure ffmpeg/ffprobe` stalled 2h40m in `37681011877`.

Do not run the fleet. ch-1 and ch-8 were SIGTERMed on runner capacity in
`37540546857`; single channel, or two at most.

---

## 10. Reference points

| what | where |
|---|---|
| every check ID, single source of truth | `CHECK-REGISTER.md` |
| repo design and hard rules | `CLAUDE.md` |
| channel expansion method | `channels/EXPANSION-METHOD.md` |
| channel-map research | `research/channel-map.md` |
| spec audit (disproved a theory) | `channels/SPEC-AUDIT.md` |
| first-dispatch constraints | `channels/RUN-NOTES.md` |
| prior narrower handoff, superseded | `channels/HANDOFF.md` |
| channel config, 52 rows, 9 dup `channel_id` | `config/channels.json` |
| which channels may publish | `config/priority-channels.json` |
| built-channel visual identity | `config/visual-identity.json` |
| channel resolution, **use this** | `scripts/lib/channel-lookup.cjs` |
| Layer 1 checks | `scripts/local-audit.cjs` |
| Layer 2 | `scripts/eval-layer2-style.js` |
| Layer 3 | `scripts/eval-layer3-judge.js` |
| retry loop | `scripts/eval-retry-loop.js` |
| topic fetch + niche filter | `scripts/fetch-trending.cjs` |
| discovery context (lookup bug lived here) | `scripts/build-discovery-context.js` |
| model agent wrapper | `scripts/ollama-agent.js` |
| workflow | `.github/workflows/daily-pipeline-v2.yml` |

**Gitignored state that exists locally and is not in git:**

| path | what | regenerable |
|---|---|---|
| `channels/_shared/ref-frames/` | extracted frames from the 3 Layer 2 refs | yes — ffmpeg from `research/motion-graphics-ref/` |
| `data/audit/` | all session diagnostics and probes | no — gitignored by design, contains the only record of the boundary experiments |
| `data/trending/` | ch-05 YouTube trending feed | yes, `node scripts/fetch-trending.cjs 5 --force` |
| `data/renders/` | rendered videos including `rejected/` | yes, re-dispatch the channel |
| `.cache/` | CLIP embeddings | yes |

`Research/*.mp4` is **committed as of `159ac9f`** — see the note below. Nothing irreplaceable
remains outside git.

**Reference video storage (changed in `159ac9f`).** Method A, direct commit — no LFS,
no Release assets. Measured before committing: largest file 23.0 MB, total 136.4 MB,
`.git` was 408.6 MB, no `.gitattributes` existed. No threshold was crossed.

18 MP4s now tracked under lowercase `research/`:
- `research/motion-graphics-ref/ref-01.mp4` (7,650,146 B), `ref-02.mp4` (459,033 B),
  `ref-03.mp4` (1,397,631 B) — **these three are what Layer 2 reads**, hardcoded at
  `scripts/eval-layer2-style.js:271-274`. They were untracked, so Layer 2 exited 3
  with `::error::no reference videos in research/motion-graphics-ref/` and could
  never run in CI. This set is what the `0.4570` threshold was calibrated against.
- 15 source research videos (`4_*.mp4`, `VID_*.mp4`, 127.3 MB) — what
  `research/channel-map.md` analysed. **Layer 2 does not read these.**

Case note: `Research/` and `research/` are one directory on Windows. Git stores it
lowercase, which is exactly what `eval-layer2-style.js` hardcodes, so CI resolves it
with no workflow change.

**This repo is PUBLIC** (`gh repo view` → `isPrivate=false`). Those 18 third-party
video files are permanently published and cannot be removed from history in any way
that survives a fork. The owner was informed and confirmed.

---

## 11. Credentials and secrets

Wired as secrets in `.github/workflows/daily-pipeline-v2.yml`, surfaced to jobs
as env vars: `YOUTUBE_API_KEY`, `GEMINI_API_KEY`, `GEMINI_API_KEY_1`,
`GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`, `GOOGLE_GENERATIVE_AI_API_KEY`,
`OPENCODE_API_KEY`, `OPENROUTER_API_KEY`.

Secrets check on this push: clean. No `AIza`, `sk-`, `ghp_` or `Bearer` string
appears in any tracked `.js`/`.json`/`.yml`/`.md`.

**Before running anything on a new machine:** `git config --global
--add safe.directory <path>` (the workflow does this itself), and confirm
`YOUTUBE_API_KEY` is present or the pipeline silently falls back to unseeded
discovery — a failure that looks like a topic problem and is not one.

**YouTube upload credentials (named, not fixed).** `youtube-publish` reads
`config/creds/ch-NN.json`, which the workflow's "Materialize OAuth credentials" step
builds from three secrets per channel: `CHANNEL_NN_CLIENT_ID`,
`CHANNEL_NN_CLIENT_SECRET`, `CHANNEL_NN_REFRESH_TOKEN` (zero-padded NN). Checked
with `gh secret list` on 2026-10-07:

| channel | secrets | status |
|---|---|---|
| ch-01, 02, 09, 26, 44 | `CHANNEL_{01,02,09,26,44}_{CLIENT_ID,CLIENT_SECRET,REFRESH_TOKEN}` | exist, and mapped in the workflow |
| ch-49 | `CHANNEL_49_*` | **missing**, not mapped in the workflow |
| ch-05 | `CHANNEL_05_CLIENT_ID`, `CHANNEL_05_CLIENT_SECRET`, `CHANNEL_05_REFRESH_TOKEN` | **missing**, not mapped |
| ch-06 | `CHANNEL_06_*` (same three) | **missing**, not mapped |
| ch-08 | `CHANNEL_08_*` (same three) | **missing**, not mapped |
| ch-10 | `CHANNEL_10_*` (same three) | **missing**, not mapped |

Secrets also exist for ch-03, 04, 07 and 48 (not approved to publish). Even after
the secrets are added, the two `env:` blocks of the "Materialize OAuth credentials"
steps in `daily-pipeline-v2.yml` (~lines 1077 and 1229) list only 01/02/09/26/44
and need `CH05_*`, `CH06_*`, `CH08_*`, `CH10_*`, `CH49_*` lines — a one-time
workflow edit, not done here. Publishing is also gated to `refs/heads/main`.

Keys 1 and 2 of `GEMINI_API_KEY_*`: see BUG-5. Do not report them as dead
until `gemini-client.js` has been read.

---

## 12. Session history

**Channel expansion (`7f958a8` → `23adcd1`).** Registered ch-05/06/08/10 with
style specs and added them to the approved priority list. Established that
`core_objects` under-resolution was not the render problem — ch-01 has 0/6
registered drawings and renders fine.

**Evaluation stack (`d823afd` → `11afdd0`).** Layer 1 extraction, Layer 2 CLIP
threshold calibration, Layer 3 Files API judge, retry loop and its mode-guarded
call site. Local ch-2 Layer 3 run scored 4.700. Never reached CI.

**Density advisory (`6da8809`).** Measured `middle-zone-filled` against 53
reference frames — all pass, 94.9–100%. Demoted to advisory rather than tuning
a check that cannot discriminate.

**Channel-map research (`5cce6c8`, branch `research/channel-map-2026-10-06`).**
Mapped 18 research videos to channel clusters. Branch is pushed to origin and
unmerged.

**Fleet diagnosis (`f1c1de7`, `1e5836b`).** Read run `37540546857`. Established
no shared gate. Found that the four new channels had no `CATEGORY` entry and
were falling through to unseeded discovery.

**Topic work (`07ddeb0`, `c816866`, `e7a9a6f`, `51fe1fa`, `b91c8f8`, `7f05bdf`).**
Added the four channels to `CATEGORY`, widened niches and pillars to subjects
with live trending supply, added a keyword niche filter, and shipped collision
and drift tests. Proved the filter works: 44 candidates to 4, off-niche titles
dropped. **All of this was second-order and none of it was the cause.**

**Crash repair (`7f05bdf`).** Run `37548436088` died with `dropped is not
defined` — a bug this session introduced in `07ddeb0`. Fixed, `main()` exported,
E2E harness written.

**The real cause (`bb94fcd`, `fc80532`, `f662581`).**
`build-discovery-context.js:33` filtered channels by the ambiguous numeric `id`
and `ollama-agent.js:295` took `(input.channels || [])[0]` silently. For key 5
that meant ch-05 Broadsheet was handed ch-26 Harmony's music-theory context.
Three consecutive runs produced music topics for a true-crime channel:
`google-flow-music-vibe-coding-tools`, `google-flow-music-vibe-coding-plugins`,
`moth-wing-acoustic-material`. After the fix: `doj-fraud-division-corporate-enforcement-directive-2026`.
Extracted `scripts/lib/channel-lookup.cjs`; a test asserting *what key 26
resolves to* caught a regression that would have broken ch-26, ch-44 and ch-49.

**First render (`37550901882`).** ch-05 rendered 52.93 s of video and passed
15/17 Layer 1 checks. Rejected on `canvas-accent` and `pop-transitions` (BUG-1,
BUG-2).

**Session close (`f2063e6`, this file).** Gitignored `data/trending/`, committed
the two pop-transition diagnostic scripts, wrote this document.
