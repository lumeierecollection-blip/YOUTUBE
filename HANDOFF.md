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
Advisory only. Blank frames pass. **Has never run in CI** — until `159ac9f`, which
committed the three reference videos it requires. No CI dispatch has exercised it
yet, so "would now resolve its refs" is verified only by clean-worktree checkout,
not by a run.

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

## 6. Known issues, unproven

- Layer 2 and Layer 3 have **never run in CI**. Both are locally tested only.
  Nothing in this handoff about them is production evidence. `159ac9f` removed
  Layer 2's *file* blocker; its first real CI execution has still not happened.
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
ever reached a publish.

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

1. **Trace `canvas_accent` from `config/channels.json` into the render
   manifest.** BUG-1. It is a config/propagation bug, not a check-tuning
   question, and it is the nearest thing to Layer 3 for ch-05.
2. **Decide whether `#2B2B2B` is the right accent for a white-collage
   channel.** Independent of BUG-1; clearing the check with a wrong value
   produces a video with no visible accent.
3. **Run `scripts/measure-boundary.mjs` and `scripts/probe-arrival.mjs` against
   ch-05's rejected frames, and compare with ch-02's `37380168306`.** BUG-2.
   Do not assume it is the `f766ae5` class; the 5-frame span argues against it.
4. **Read ch-2's log after `[translate] beat 3` in `37540546857`.** BUG-3. Two
   built channels are losing videos to a summary line that contradicts its own
   evidence.
5. **Delete the duplicated guard in `fetch-trending.cjs` now that
   `channel-lookup.cjs` exists.** §7.1.

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
