# Verification audit — 2026-10-07

Read-only. Nothing in code, config, specs or workflows was changed. Repo at `dc37f6c` (== `origin/main`),
fresh clone, no `node_modules`. Evidence is code at that commit and CI logs fetched with `gh run view --log`.
HANDOFF.md, RUN-NOTES.md and prior diagnoses were treated as claims.

Runs read in full or grepped: `37619905834` (scheduled, 2026-10-07T12:17Z, sha `64eeffa`, all 10 priority
channels), `37550901882` (ch-05 only), `37540546857` (fleet, 2026-10-06), plus 12 more dispatches for Layer 3
evidence (see 2c).

Verdict key: CONFIRMED / PARTLY / FALSE / UNVERIFIED.

---

## Headline

1. **A newer run exists that HANDOFF does not know about.** Scheduled run `37619905834` (12:17Z, after
   HANDOFF was written) ran all 10 channels: **1 approved video (ch-44), 0 uploaded, 9 failed.** The last
   *successful* run of this workflow in the last 200 is `36331165614` (2026-09-27).
2. **The channel-id collision bug HANDOFF says was fixed is still live in the render, script, publish and
   trending paths.** Only `build-discovery-context.js` uses `channel-lookup.cjs`. This is the root cause of
   HANDOFF BUG-1 (`canvas_accent`), and it is untraced there.
3. **Channel style specs (`channels/*/style-spec.json`) are read by no code.** The Gemini planner prompt does not
   receive the channel at all (`gemini-visual-plan.js:670` `void channelId;`).
4. **Layer 2 is a stub; Layer 3 is wired but gated off and, even on, routes nothing.**
5. **Five of the ten "approved to publish" channels are refused by the uploader** (`youtube-publish/run.js:41,263`).

---

## Claim 1 — HANDOFF.md accuracy

Verdict: **PARTLY.** Most commit hashes, line refs and counts are exact. The load-bearing "what works / what is
open" statements are stale or wrong in the ways below.

| # | HANDOFF says | Finding | Verdict | Evidence |
|---|---|---|---|---|
| 1.1 | 52 rows; 10 priority; 9 dup `channel_id` (26,30,31,35,39,44,46,47,49); dup `id` values | Exact. Dup `id`: 5,6,8,10 (x2 each) | CONFIRMED | node over `config/channels.json`; `config/priority-channels.json` = `[1,2,9,26,44,49,5,6,8,10]` |
| 1.2 | "for 4 rows [id and channel_id] disagree outright" (§7.6) | 11 rows have `id` != normalised `channel_id`: 5/ch-26, 6/ch-30, 8/ch-50, 10/ch-31, 12/ch-35, 13/ch-39, 14/ch-44, 15/ch-46, 16/ch-47, 18/ch-48, 19/ch-49 | FALSE (count) | same script |
| 1.3 | "10 channels are approved to publish" (§1) | Approved to *run* (`priority-channels.json`). The uploader hardcodes `PUBLISH_CHANNELS = [1, 2, 9, 26, 44, 48]` and throws for others: ch-05/06/08/10/49 can never upload; ch-48 can but is not dispatched | FALSE | `src/skills/youtube-publish/run.js:41`, `:263-264` |
| 1.4 | Shipping: ch-01/02/09/26/44; "Last failing run `37550901882`" (§2) | Run `37619905834` is newer and is the latest. No successful pipeline run since `36331165614` (2026-09-27). ch-44 was *approved* in `37619905834` and the upload failed: `[YOUTUBE-PUBLISH] ERROR: OAuth token exchange failed: invalid_grant — Bad Request` (log shows `Account: ? \| Channel ID: SET_ME`) | STALE / FALSE ("shipping") | `gh run list`; run log, ch-44 "Publish to YouTube (private)" |
| 1.5 | ch-06, ch-08, ch-10 "never dispatched. Never rendered." (§2, §4) | Contradicts HANDOFF's own §2 fleet table (ch-6 and ch-10 rendered and were rejected in `37540546857`). In `37619905834` ch-06 and ch-10 rendered MP4s (rejected); ch-08 planned, challenger approved, then SIGTERM 143 | FALSE | see 2a |
| 1.6 | `canvas-accent` BUG-1: propagation "not traced"; "`(none — ink)` consistent with value being wrong" (§5, §7.5) | Traced. `render.js:599` `sentencePlan.accent = channel.colors?.canvas_accent`, where `channel` = `loadChannel()` at `render.js:113-114`: `channels.find((c) => c.id === numId \|\| c.channel_id === channelId)`. Key 5 resolves to **ch-26 Harmony (id 5, no `canvas_accent`)**. Executed for all 10 keys: 5->Harmony, 6->Nash (style `minimal`), 8->Synapse (`minimal`), 10->Word Lab; all with `canvas_accent=undefined`. The `#2B2B2B` value is irrelevant. CI: ch-10 `FAIL canvas-accent — the manifest names no accent colour`; ch-26/49 PASS with their own accents | FALSE (diagnosis) — root cause found | `render.js:113-114,599`; run `37619905834` |
| 1.7 | `37550901882` "Proved topic selection, rendering, and Layer 1 all function when the channel is resolved correctly" (§2) | The channel was *not* resolved correctly at render (1.6). Same run printed `[canvas] full-canvas style, accent (none — ink)` | FALSE | log line |
| 1.8 | §7.1: `fetch-trending.cjs` keeps its own `KNOWN_COLLISIONS` (lines 74-95) | True; the constant is at `:72`, `assertNoKeyCollision` `:74`. Worse: `channel-lookup.cjs`'s header claims it is "used by fetch-trending.cjs"; it is not (sole importer: `build-discovery-context.js:20`) | CONFIRMED (+ header is false) | grep `channel-lookup` |
| 1.9 | §7.2: first-match `channel_id` normalisation is WRONG (key 26 -> Harmony) | `fetch-trending.cjs:findChannel` does exactly that. Executed: key 26 -> `5/ch-26/Harmony`, 44 -> `14/ch-44/Photosyn`, 49 -> `19/ch-49/Stellar`. Niche terms for key 26 = `music,theory,composition,harmonic,...`. CI: `[trending] no_niche_match — keeping the closest category candidate` for ch-26 and ch-6 in `37619905834` | FALSE that it is handled; bug live | `fetch-trending.cjs` `findChannel`; node run |
| 1.10 | §7.3: guards narrower than they look | Understated. Remaining first-match `id`-based lookups: `render.js:114`, `channel-style.js:25`, `build-script-context.js:30`, `gate-script.js:65`, `slop-check.js:48`, `reserve-topic-single.js:38`, `gemini-visual-challenger.js:163,268`, `opencode-visual-intent.js:236`, `visual-beat-grouper.js:156`, `src/utils/config.js:17`, `eval-layer3-judge.js:198`, `youtube-publish/run.js:48` | CONFIRMED (and larger) | grep |
| 1.11 | BUG-3: planner summary "contradicts its own log"; window after `[translate] beat 3` never read | Resolved. Gemini *answered* but its JSON was unparseable on both attempts (`JSON parse failed: Unexpected non-whitespace character after JSON at position 6518`), then **Groq** (`beat count 6 != 8` / `400 ... Failed to validate JSON`), then Ollama `error timed_out`. The summary string `(gemini, then ollama)` omits Groq. Same shape in fleet run for ch-2/ch-26 (`... groq: beat count 2 != 9 → ollama`). HANDOFF's provider chain (§3) also omits Groq | resolved; HANDOFF §3 PARTLY wrong | `37619905834` ch-1/5/9; `37540546857` ch-2/26; `gemini-visual-plan.js:788-820` |
| 1.12 | BUG-4: ch-48 unresolvable (`channel_ambiguous`) | `resolveChannel("48")` -> `channel_ambiguous: 48 has no row where id and channel_id agree. Candidates: ch-48 "Fit" (id=18)` | CONFIRMED | executed |
| 1.13 | BUG-5: keys 1 and 2 dead; "only `GEMINI_API_KEY_3` answered" | `project: unknown (...)` is the string `gemini-client.js:268` returns when no probe returns a project number; it does not mean dead. Logs say `gemini key 1/3 answered` (index = `keyIndex+1`, `gemini-client.js:390`). Key 1 answered | FALSE | `src/lib/gemini-client.js:268,390` |
| 1.14 | `render-and-qa.js:2006` stub, `:1995` gate, `eval-retry-loop.js:70-72` | Stub at 2006 exact. Gate is at **1996**, not 1995. `loopEnabled` at 70-71 | CONFIRMED (off by one) | `render-and-qa.js:1996,2006` |
| 1.15 | Layer 2/3 never ran in CI; `EVAL_LOOP_MODE=off` cron default | 0 occurrences of `eval-loop` in 15 post-`11afdd0` run logs; env `EVAL_LOOP_MODE:` empty (cron) or `off` | CONFIRMED | grep of runs 37522563162, 37522891128, 37522952235, 37523006245, 37524369669, 37525965259, 37525981760, 37528904606, 37530806653, 37532229531, 37540546857, 37548436088, 37549155059, 37550901882, 37619905834 |
| 1.16 | §12 "Channel-map research (`5cce6c8`, branch `research/channel-map-2026-10-06`) … unmerged" | `5cce6c8` is `feat: per-element remediation decisions for a challenger-rejected beat`. The branch tip is `5cce6c8` and it is an ancestor of `main` (`git log origin/main..origin/research/channel-map-2026-10-06` empty). Channel-map doc commit is `7f958a8` | FALSE | git |
| 1.17 | §7.13 no HF cache in workflow | No `huggingface`/`xenova` match in `daily-pipeline-v2.yml` | CONFIRMED | grep |
| 1.18 | §7.14 repo public; 18 MP4 tracked | `gh repo view` -> `isPrivate:false`; `git ls-files 'research/*.mp4'` = 18 | CONFIRMED | |
| 1.19 | §10 `data/audit/` "gitignored… only record of the boundary experiments… no [regenerable]"; also "Nothing irreplaceable remains outside git" | `.gitignore:85` ignores `data/audit/` but **291 files under it are tracked**. The clone has only `a1-discrimination`, `plan-vs-render`, `render-performance`, `mzf-diagnostic.mjs`; no boundary-experiment record. The two sentences contradict each other | PARTLY / contradictory; boundary experiments UNVERIFIED (not in this clone) | `git ls-files data/audit` |
| 1.20 | §8 "untracked `Research/*.mp4`… gitignored" | Stale: same doc says they are committed in `159ac9f`; "see §3 below" points nowhere | STALE | |
| 1.21 | `canvas_accent` at `channels.json:2884` for ch-05; `local-audit.cjs:408` | Both exact (row `ch-05` starts 2863) | CONFIRMED | |
| 1.22 | `ollama-agent.js:462` logs `ch-?`; `:295` takes `[0]` | Exact (`:462`, `:295`) | CONFIRMED | |
| 1.23 | Suite "230 pass / 0 fail" | No `test` script in `package.json` or workflows. `node --test scripts/__tests__/*.test.js` here: 92 tests, 85 pass, 7 fail, all `ERR_MODULE_NOT_FOUND` (`dotenv`, `sharp`) because `node_modules` is absent | UNVERIFIED (would need `npm ci`, then a runner covering `scripts/__tests__` + `scripts/test-*.mjs`) | |
| 1.24 | All other hashes (`f2063e6`, `159ac9f`, `5a7c1cf`, `64eeffa`, `6da8809`, `f766ae5`, `23adcd1`, `d823afd`, `11afdd0`, `f1c1de7`, `1e5836b`, `07ddeb0`, `c816866`, `e7a9a6f`, `51fe1fa`, `b91c8f8`, `7f05bdf`, `bb94fcd`, `fc80532`, `f662581`, `e0ab40f`) | All exist with subjects matching §12 | CONFIRMED | `git log -1` |
| 1.25 | Run IDs `37550901882`, `37540546857`, `37548436088`, `37380168306` | First three exist, conclusion failure. `37380168306` exists (2026-10-05T22:05Z, failure); its `pop-transitions` content was not read | CONFIRMED / `37380168306` content UNVERIFIED | `gh run list` |
| 1.26 | Workflow header "ONLY the channels in priority-channels.json (the six…)" and default `channels` input `1,2,9,26,44,49` | Stale: 10 channels; cron uses all 10, a manual dispatch with defaults runs only 6 | STALE | `daily-pipeline-v2.yml:2-4,31` |

Not checked: the 7.7 byte-splice history, the "nine content_pillar values rewritten by byte-splice" claim, §7.9
(a brief's wrong line number). `data/topic-log.json` moth-wing entries not looked at.
Facts that did check: 7 literal `â` sequences (`grep -c` = 7), LF in blob / CRLF in tree
(`git ls-files --eol` -> `i/lf w/crlf`).

---

## Claim 2 — all channels run end-to-end with Gemini as central decision maker

### 2a. Do all 10 render a video end-to-end? — **FALSE**

Latest run per channel, run `37619905834` unless noted. "Rendered" = an MP4 was produced. End-to-end
(through upload) is 0/10.

```
Claim 2a — channels render end-to-end
ch-01  rendered: no   last verdict: none            failure: "Visual planning failed (gemini, then ollama): timed_out"
         (gemini x2 "had no 'beats' … JSON parse failed: Unexpected non-whitespace character after JSON at position 6518";
          groq "beat count 6 != 8"; ollama "error timed_out"). Trending also "HTTP 404 notFound".
ch-02  rendered: no   last verdict: none            failure: exit 143 "The runner has received a shutdown signal" (job 4.8 min).
         Challenger had logged "plan approved (0 weak beat(s), none blocking)". Prior fleet run 37540546857: planning failed.
ch-05  rendered: no   last verdict: none            failure: "Visual planning failed (gemini, then ollama): timed_out"
         (gemini JSON unparseable x2; groq "400 openai/gpt-oss-120b: Failed to validate JSON"; ollama timed_out).
         Earlier run 37550901882: rendered, REJECTED "VERDICT: FAIL (15/17 checks)" canvas-accent, pop-transitions.
ch-06  rendered: yes  last verdict: rejected        failure: "beat check FAILED — frames do not match their sentences" — actually
         "[beat-check] Error: ENOENT: no such file or directory, open '…/data/renders/6/…-shorts-shorts-2026-10-07-manifest.json'";
         "[local-audit] cannot run — missing input: manifest=…". An exception, not a frame mismatch.
ch-08  rendered: no   last verdict: none            failure: exit 143 runner shutdown (job 6.2 min). Challenger had logged "plan approved (1 weak beat(s)…)".
ch-09  rendered: no   last verdict: none            failure: "Visual planning failed (gemini, then ollama): timed_out".
ch-10  rendered: yes  last verdict: rejected        failure: "[local-audit] VERDICT: FAIL (15/17 checks)": canvas-accent
         "the manifest names no accent colour"; zones-no-overlap "beat 2 (PORTRAIT) at 30%: ink crosses the zone edge at y 1340 in 25 columns".
ch-26  rendered: yes  last verdict: rejected        failure: "FAIL pop-transitions — beat 5: the composition is empty at boundary frame(s) 7, 8, 9, 10;
         beat 8: … 6, 7, 8, 9, 10" (16/17).
ch-44  rendered: yes  last verdict: APPROVED (attempt 2)  failure at publish: "[YOUTUBE-PUBLISH] ERROR: OAuth token exchange failed:
         invalid_grant — Bad Request". Attempt 1: "VERDICT: REJECTED — TEMPLATE_MONOCULTURE — 60% headline-dominated beats";
         then "[challenger 44] ::error::challenger rejected the plan: beat 5 MISMATCH"; attempt 2: "VERDICT: APPROVED — video meets Visual Bible standards".
ch-49  rendered: yes  last verdict: rejected        failure: "FAIL pop-transitions — beat 5: the composition is empty at boundary frame(s) 6, 7, 8, 9, 10" (16/17).
```
Totals in `37619905834`: MP4 produced 6/10; approved 1/10; uploaded 0/10. Fleet `37540546857` (2026-10-06): see
HANDOFF §2; the log lines for ch-2/26 reproduce as 1.11.

BUG-2 evidence not in HANDOFF: `pop-transitions` empty-composition runs of 4-5 consecutive frames occur on
**ch-26 (two beats) and ch-49** too, and not on ch-10 (`PASS pop-transitions`). The 5-frame-span signature is
not specific to ch-05. Root cause not investigated (read-only).

### 2b. Is Gemini the decision maker? — **PARTLY (mostly FALSE as stated)**

Gemini (`gemini-3.5-flash-lite` for discover/research/script/plan; Groq then Ollama on failure) *proposes*; code
chooses, repairs, overrides and vetoes. Gemini owns only: candidate topics, prose, the plan's
`scene_description`, headline wording, and the reviewer verdicts. It does not choose mechanism, composition,
layout, ground, colour, or transitions.

| Decision | Owner | Evidence |
|---|---|---|
| Which channels run | code/config | `priority-channels.json`; workflow `setup` job |
| Pillar focus / search queries / trending signal for discovery | code | `build-discovery-context.js`; `ollama-agent.js:295-300` `derivedQueries`; log `queries from input:` |
| Candidate topics (3) | Gemini flash-lite, within `prompts/discover-topics.md` rules | log `answer model gemini (gemini-3.5-flash-lite)` |
| Which candidate is used | code: first non-duplicate (`reserve-topic-single.js`, 60% word-overlap dedup) | workflow `Only reserving topics[0]`; prompt |
| Research, script text | Gemini flash-lite, gated by code (`gate-research.js`, `gate-script.js`, 92-107 words) | log `write-script/answer attempt 1/4`; `style-contract.md` |
| Beats | code: one beat per SRT sentence | `gemini-visual-plan.js:691-703,822` |
| What each beat shows (prose) | **Gemini** — the only free creative output | prompt `:651` |
| Mechanism / chart type / composition / zone per beat | **code**: `scene-translate.js` turns the prose into candidates, `checkVisual` gates, rotation/variety/caps override. Prompt says "Do NOT choose a mechanism, a chart type, a composition or a zone" (`:652`). `SCENE_TRANSLATE = true` hardcoded (`:831`); a `visual_type` Gemini writes is "ignored" (`:847`) | `gemini-visual-plan.js:826-850` |
| Failed visuals | Gemini asked again but only to choose from `Allowed visual_type` computed by code (`groundedOptions`); same gate judges it; falls to TYPE | `:995-1130` |
| Variety / no-repeat | code: `composition-variety.js` (<=30% TYPE, none adjacent), `composition-rotation.js`, `assignEntranceStyles`, `assignAnimationFamilies` | `:1159-1224` |
| Motion tier | Gemini proposes; code forces 2-3 "major" | `:1544-1559` |
| Headline / typography text | Gemini proposes; code repairs (`enforceTypographyContract`), sentence-cases, fits | `:913-929`; `canvas-style.js` |
| Layout geometry | code: 3x4 grid, 13 compositions, nothing centred | `canvas-layout.js:1-65` |
| Ground / accent | code + `channels.json` (uniform `#FFFFFF`, `backgrounds.js:13`; accent from config) | |
| Photos | code (`entity-assets.cjs`) + vision verification | `gemini-visual-plan.js:1035-1044` |
| Plan veto | **Gemini** (challenger): MISMATCH/CONTRADICTION blocks | `gemini-visual-challenger.js:224-238` |
| Video accept/reject | **Gemini frame review** (providers `gemini`,`groq` only) gates; deterministic Layer 1 hard gate | `gemini-frame-review.js:330`; log ch-44 attempt 1 REJECTED |
| Layer 3 full-video judge | Gemini, **advisory and off** | 2c |
| Beat transitions | not traced (render-side); `pop-transitions` is a Layer 1 check | UNVERIFIED |
| `visual-director.js` (`direct`) | imported at `render.js:44`; whether the canvas path calls it was not traced | UNVERIFIED |

Also observed: the planner is not always Gemini. In `37619905834` the plan for ch-1/5/9 died after Gemini's
output failed to parse twice; Groq and Ollama then supplied nothing usable. A plan that does succeed from
Groq/Ollama is labelled `source: "groq"|"ollama"` (`:1567`).

### 2c. Is Layer 3 running? — **Wired: yes. Gated: yes. Runs in CI: never. Routes: no.**

- `render-and-qa.js:61` imports `judge`; `:2007` `layer3: async (...) => judge(result.outputPath, …)`.
- `:1996` `if (loopEnabled())`; `eval-retry-loop.js:61-72`: unset or empty -> `"off"`; `off` -> skip. Workflow
  `:77` `EVAL_LOOP_MODE: ${{ inputs.eval_loop_mode }}` (empty on cron).
- Only `dry`/`live` enter. Even then, the block's own comment (`:1981-1994`): "It does NOT route… nothing here
  branches on it." `live` cannot act: `renderBeats` throws (`:2012-2013`), `revise` returns `{ planPatch: null }`.
- 0 `eval-loop` lines across 15 logs (1.15).
- Layer 2 slot is `advisory_score: null` stub (`:2006`).
- Judge prompt (`eval-layer3-judge.js:104-137`) has no shield and no mandate beyond "matches the channel's
  motion-graphics reference style". It passes `channels.json` fields via an id-first lookup (`:198`), so channel
  `5` would hand it Harmony's row; and for ch-05/06/08/10 `visual_spec` is absent.

---

## Claim 3 — "No doc forces Gemini to template" — **FALSE for mandates; PARTLY true for docs**

The templating pressure is mostly in **code and the inline planner prompt**, not in prompt files, and the
per-channel specs that could differentiate channels are not read.

### 3a/3b. What constrains the render, classified

| File | Reaches Gemini? | Class | Content (verbatim where short) |
|---|---|---|---|
| `scripts/gemini-visual-plan.js:637-664` (inline planner prompt; the live one) | planner | **Mandate + prohibition** | "THE GROUND IS ALWAYS WHITE. Do not describe dark, black, charcoal, or colored backgrounds" `:641`; "kind: TYPE only for beat 0 … and the last beat" `:658`; "EXACTLY 2-3 major" `:660`; "at least 5 distinct types across the video, never the same event 3 times in a row" `:660`; "at most ~1 in 3 beats text-forward" `:658`; "Do NOT choose a mechanism, a chart type, a composition or a zone" `:652`; do not describe caption/credit/counter `:643-647`. Style language: "the style of Vox, Bloomberg and NYT explainers" `:639`. **Channel-agnostic**: `void channelId;` `:670` |
| `prompts/scene-example.json` | planner (one worked example) | Mandate-by-example | every beat is "shaped like the example" `:664` |
| `prompts/visual-plan.md` | **no reader in code** | dead | duplicates the above |
| `prompts/style-contract.md`, `write-script.md` | script writer | Mandate | 5 sections `hook,setup,rehook,payoff,close`; 92-107 words; "`visual` — REQUIRED on every beat" (archetypes); keeps beat count fixed |
| `prompts/discover-topics.md`, `discover-candidates.md`, `research.md` | topic/research | Guidance + soft mandate | "when [trending] fits… pick it" |
| `config/visual-bible.json` `prompts.whole_video_review` (14 tests) | frame review | Mandate/rubric | "HEADLINE TEST (MANDATORY) … If >40%, flag TEMPLATE_MONOCULTURE"; test 7 REPETITION; test 9 VARIETY |
| `scripts/gemini-frame-review.js:276-283` `PAPER_RUBRIC` | frame review | **Shield** x3 | `:278` "That caption is not a defect, not duplication and not a fragment: never list it in slop_indicators, repetition_issues, decoration_issues or corrections"; `:280` "an early frame can show a partly-grown number: that is the animation, not a wrong statistic"; `:282` "The dark gradient … is a technique, not noise" |
| `scripts/gemini-frame-review.js:396` STYLE block | frame review | **Shield + mandate + prohibition** | Shield: "do not count it as caption duplication, subtitles, redundancy or slop, and do not lower any score for it"; "a word mid-pop may be slightly small or translucent"; "A small section folio ('03 / 08') and a hairline rule are page furniture, not defects"; "a TYPE-FULL / TYPE-SPLIT typography beat is headline-led by design". Mandate: "Two beats of the same composition kind in a row is a defect". Prohibition: "A card, a paper page or a framed panel is a HIGH defect"; "Each beat is ONE of: TYPE-FULL / TYPE-SPLIT … LIST-BUILD" (closed list of 13) |
| `scripts/gemini-frame-review.js:~547-556` beat-check | beat check | Shield-shaped exceptions | `[TYPOGRAPHY]`/`[DATA]`/`[PROCESS]` "BY DESIGN" -> do not answer NO; caption "present on every beat BY DESIGN; ignore it" |
| `scripts/gemini-visual-challenger.js:167-186` | challenger | Guidance; one scope limit | "Treat every sentence as true… never the sentence against the world". No shield |
| `scripts/eval-layer3-judge.js:104-137` | Layer 3 | Guidance | no shield, no mandate (off in CI) |
| `scripts/vision_critic.py` | vision critic | not read | UNVERIFIED |
| `config/channels.json` | colour, style | Style guidance (accent, `bg_mode`, tts) | ground uniform white regardless of `bg_mode` (ch-02 is `bg_mode: black`, renders white) |
| `config/visual-identity.json` | `render.js:563-581` | Style guidance | **no entries for ch-05/06/08/10**; render falls back to a default palette (`#0F172A…`, "DM Sans"/"Noto Serif") |
| `channels/ch-0{5,6,8,10}/style-spec.json` | **nothing** | dead | only `style_spec_path` in `channels.json` points to them; no script/src reads it (grep) |
| `config/visual-bible.md`, `BEAT-VISUAL-REASONING.md`, `DESTROY THE OLD VISUAL.txt` | nothing | dead | no readers |
| `src/…/visual/canvas-layout.js`, `backgrounds.js`, `canvas-style.js`, `full-canvas.jsx` | render | **Mandate (code)** | "uniform white on every beat of every video on every channel (owner's decision, 2026-09-30)" `backgrounds.js:1-13`; 3x4 grid, "nothing is centred", 13 closed compositions `canvas-layout.js:1-65`; `assignDark` retired |
| `scripts/composition-variety.js`, `composition-rotation.js`, `plan-caps.cjs` | post-processing | Mandate (code) | TYPE <= 30% (min 2), no two adjacent TYPE, hook and CTA TYPE (`composition-variety.js:1-12`); no same composition twice in a row; no mechanism > 40% |
| `scripts/local-audit.cjs` | gate | Hard mandates | canvas-ground (luma >= 245), canvas-type, canvas-accent, motion-tiers 2-3 major, typography-count 1-2, etc. |

Shield status: the **ground** shield (`:330` style-block mandate and test-12 exemption in the prior revision) is
**gone**: `:285-290` records its removal 2026-10-05 and `:282`, `:396` now read "NOT exempt". Line numbers
`:330`/`:270` in the brief are stale (now `VERDICT_PROVIDERS` / a comment). "Clause #3" could not be
identified (UNVERIFIED which). **Shields that remain** are the caption, page-furniture, mid-pop,
partly-grown-number, dark-gradient and "by design" ones above. The A1b test probe (`FRAME_REVIEW_NEUTRALIZE_GROUND`)
is a no-op in production.

### 3c. Templating test

- `channels/ch-05/style-spec.json` says *what the channel looks like* ("newspaper-collage", newsprint palette
  `#BABDB6 …`, `Noto Serif`/`Inter`, "column-wipe" transitions, text_placement "center-left"). It says nothing
  about variation. `ch-06` is the same shape ("archival-montage", "lower-third"). Neither is read by any code,
  and the spec contradicts the renderer on its face (newsprint grey palette vs. uniform `#FFFFFF`; "center-left"
  vs. "nothing is centred"; "dissolve-era"/"page-turn" transitions vs. pop-only text and fixed compositions).
- Built channels (ch-01 etc.) carry `visual_spec`, `concepts` and a `visual-identity.json` entry; the four new
  channels have none of the three. For rendering this changes only palette fallback and the accent; the
  planner prompt, composition vocabulary and ground are identical for all ten.
- Anti-templating mechanisms that exist and are **on** (they run in the planner and in Layer 1 on every render):
  no-repeat rotation, TYPE cap and adjacency, entrance/animation family rotation, `mechanism-share` <= 40%,
  `canvas-type` "no repeated composition", frame-review `TEMPLATE_MONOCULTURE`. Evidence they fire: ch-44
  attempt 1 rejected `TEMPLATE_MONOCULTURE — 60%`; ch-6 `[canvas] beat 6 avoided repeating beat 5 type`.
  Limits: they compare composition **names** from a closed vocabulary, not appearance; a repeat nothing can
  break is "logged and kept" (`composition-rotation.js:9-10`).
- Templating symptoms in the latest run: ch-6 `entities resolved 0, fell back 7`, and last-resort beats
  `PROCESS-FULL {"nodes":["Laboratory","pedals"],"keynouns":true}` / `["Except","tests"]` /
  `["Investigators","inconclusive"]` (the code's own "last resort"; `composition-variety.js:30-33`).
  ch-6 `5 to TYPE`. `{"nodes":["Except","tests"]}` is a fabricated relation.

Verdict: Gemini's output is bounded by mandates, almost all of them in code and in the inline planner prompt
(white ground; hook/close TYPE; 2-3 major; closed 13-composition vocabulary; fixed grid). The *docs* that
describe channel style do not constrain it because nothing loads them. "No doc forces Gemini to template" is
technically true of the docs and false of the system.

---

## Claim 4 — reference videos used as style context, not cloning

### 4a. Is Layer 2 wired? — **STUBBED**
`render-and-qa.js:2006` `layer2: async () => ({ advisory_score: null, note: "advisory not wired at this call site yet" })`.
`grep` for `eval-layer2-style|scoreStyleFile|scoreStyle|embedFiles` in `scripts/ src/ .github package.json`
(excluding tests): matches only inside `eval-layer2-style.js` itself. Imported only by
`scripts/__tests__/eval-layer2-style.test.js`. No workflow, no `package.json` script. The module also has no
loader for the stored `channels/_shared/ref-embeddings/*.bin`.

### 4b. Clone or style-match?
Style-match, and only as a number. `scoreStyle` = mean over candidate frames of max cosine similarity to the
reference-frame embeddings (`eval-layer2-style.js:236-247`), CLIP `Xenova/clip-vit-base-patch32`. Header: demoted
to "non-blocking style advisory" because a solid white frame scored 0.6783 against a floor of 0.4570 (`:200-207`).
No reference frame is ever passed into the render as an asset. Threshold file: `0.4569791218227832`, 142 frames
(CONFIRMED vs HANDOFF). The three references are one shared family (`ref-01..03`, `main()` `:271-274`), **not**
per-channel: the per-channel `reference_video` fields in `style-spec.json` (e.g. `research/4_5917850534521349135.mp4`)
are unread metadata.

### 4c. Are they in CI?
`git ls-files research/` = 18 MP4s (3 in `research/motion-graphics-ref/`, 15 source videos) plus `channel-map.md`,
`style-clusters.md`; `channels/_shared/ref-embeddings/*.bin` also tracked. Present but unread by any pipeline step.

Verdict: **"files present but nothing reads them."** Reference videos are not used as style context in any
render or any CI run today.

---

## Claim 5 — YouTube API used for trending topics per channel per video

### 5a. Source — CONFIRMED (wired)
`fetch-trending.cjs:5-14,95`: YouTube Data API v3 `videos.list chart=mostPopular&regionCode=US&videoCategoryId=<CATEGORY>`. Exa is
not called in this script; discovery/research use OpenCode-supplied websearch (workflow `OPENCODE_ENABLE_EXA: 1`).

### 5b. Per channel, per video — **PARTLY**
Workflow step `daily-pipeline-v2.yml:206` `node scripts/fetch-trending.cjs "${{ matrix.channel_id }}" || true` runs once
per matrix channel; discovery produces 3 candidates and `reserve-topic-single.js` reserves one (`topics[0]`): one
topic per channel per run, CONFIRMED. Keying: `CATEGORY[Number(ch)]` uses the bare dispatch key, and
`build-discovery-context.js` uses `channel-lookup.cjs` (fc80532 fix CONFIRMED there). But:
- **ch-49 has no `CATEGORY` entry** (`CATEGORY = {1:27,2:25,5:25,6:24,8:27,9:25,10:27,26:25,44:27,48:28}`, `:45`):
  `[trending] ch-49: no category mapping, skipped (unseeded discovery)`. Same for the fleet run.
- **Category 27 returns `HTTP 404 notFound`** for ch-1, ch-8, ch-10, ch-44 in `37619905834` (ch-1/44 in the fleet
  run too). Those four fall back to unseeded discovery.
- `fetch-trending.cjs` does not use `channel-lookup.cjs` (1.8).

### 5c. Niche filter — **PARTLY**
`rankAndFilter` `:118` + `nicheTerms/nicheMatch/applyNicheFilter` take the channel's `niche` + `content_pillars`
(terms >=4 letters, stop-words removed), keyword overlap only; if nothing survives it keeps the closest 1
candidate (`no_niche_match`). Works for ch-02/05/06/08/09/10 because their rows are unique. For keys 26, 44, 49
`findChannel` (`:94-95`) returns the wrong row (Harmony, Photosyn, Stellar). CI evidence for ch-26:
`[trending] no_niche_match — keeping the closest category candidate (filter found nothing)` -> `top 1 by velocity`.
Thresholds / counts from `37619905834` (`fetched / kept in 7 days / top`): ch-2 50/43/3, ch-5 50/43/4, ch-6 50/49/1
(`no_niche_match`), ch-9 50/43/5, ch-26 50/43/1 (`no_niche_match`). Run `37550901882` ch-5: 50/44/4. The
`niche_filter.dropped` count is written to the artifact, not logged.

### 5d. Topic produced per channel (`[research] … chose:` in `37619905834`)

```
ch-01  no trending feed (404)  chose (unseeded): Mental Accounting Theory Validated: How Your Brain Splits Cash
ch-02  trending (3)            chose: California Rewrites the Rules on Stay or Pay Employment Provisions
ch-05  trending (4)            chose: Murdaugh Retrial Discovery Dispute Intensifies Over Cellphone Data
ch-06  trending (1)            chose: Italian Prosecutors Reopen Garlasco Case to Probe Forensic Failures
ch-08  no trending feed (404)  chose (unseeded): The Collapse of Nano Banc and the 2026 U.S. Regional Banking Crisis
ch-09  trending (5)            chose: Cloud Giants Pay Premium for Land Routes Amid Red Sea Subsea Cable Crisis
ch-10  no trending feed (404)  chose (unseeded): Consciousness and Locke: The 1694 Origin of a Term
ch-26  trending (1)            chose: Former CIA Official Pleads Guilty to Stealing $40M in Gold Bars
ch-44  no trending feed (404)  chose (unseeded): Career Cushioning: Why 46% of Office Workers Are Building a Plan B in October 2026
ch-49  no trending feed (no category)  chose (unseeded): Tom Cruise's Digger Projected to Lose $150M in Box Office Disaster
```
Whether a chosen topic was drawn from a trending title was not verified (the feed files are cache artifacts, not
in git or the logs). The prompt only asks the model to prefer a trending topic when it fits.

Verdict 5: **wired: yes. Working: for 5 of 10 (2, 5, 6, 9, 26), with 26 niche-filtered against the wrong
channel. Per-channel: no** — 4 channels get a 404 and 1 has no category.

---

## Summary

### What actually works today (evidence-backed)
- Topic discovery, research and script writing run for all 10 channels with Gemini flash-lite (`37619905834`
  prep jobs all `success`; `gemini key 1/3 answered`).
- YouTube trending fetch works for category 25 and 24 channels (ch-2, 5, 6, 9, 26). The collision fix works in
  `build-discovery-context.js` (ch-5 gets a news/crime topic, not music).
- Deterministic Layer 1 checks run on every render and discriminate (they rejected 5 of 6 rendered videos for
  named reasons).
- Gemini frame review gates: ch-44 was rejected `TEMPLATE_MONOCULTURE`, re-planned, and approved on attempt 2.
- Challenger plan veto works (`challenger rejected the plan: beat 5 MISMATCH`).
- ch-44 produced an approved MP4 in `37619905834`.
- ground-shield removal in frame review is real (`:282`, `:396`).

### What is claimed but not true
- "10 channels approved to publish": the uploader refuses 5 of them (`run.js:41,263`).
- "Shipping: ch-01/02/09/26/44": no successful run since 2026-09-27; ch-44's first approved upload died on
  `invalid_grant` / `Channel ID: SET_ME`.
- BUG-1 diagnosis (propagation/`#2B2B2B`): the cause is `render.js:114` resolving key 5/6/8/10 to the wrong
  row (Harmony/Nash/Synapse/Word Lab). The same lookup still drives `style`, `bg_mode`, TTS voice and the
  uploader's channel for those keys.
- The collision fix is not repo-wide: 12 other files still do first-match `id` lookup, and `fetch-trending`
  niche-filters keys 26/44/49 against Harmony/Photosyn/Stellar.
- "Gemini is the central decision maker": it describes; code decides mechanism, composition, layout, ground, and
  most limits.
- Channel style specs shape the render: no code reads `channels/*/style-spec.json`; the planner prompt gets no
  channel input.
- "Reference videos used": Layer 2 is a stub; nothing reads them.
- HANDOFF §12 "channel-map branch unmerged" (merged); BUG-5 "only key 3 answered" (key 1 answered);
  "ch-06/08/10 never rendered/dispatched" (ch-06, ch-10 rendered; ch-08 SIGTERMed).
- Trending covers all channels: ch-49 has no category, category 27 is a 404.

### UNVERIFIED (and what would verify it)
- "230 pass / 0 fail": `npm ci`, then run `scripts/__tests__/*.test.js` plus `scripts/test-*.mjs` and
  `src/skills/remotion-render/visual/run-visual-tests.js` (no runner is defined in `package.json`).
- BUG-2 root cause (empty-composition span): run `scripts/measure-boundary.mjs` / `probe-arrival.mjs` on the
  `qa-queues-26-37619905834` / `qa-queues-49-…` artifacts. The ch-26 and ch-49 failures give a second and third
  sample beside ch-05.
- Whether ch-06's `beat-check ENOENT` is caused by the render using Nash's `minimal` style (the manifest is
  never written): compare `render.js` manifest write path for `style=minimal`. Consistent with 1.6, not proven.
- ch-02 / ch-08 renders: both plans were approved and the runner was shut down (143) mid-render; a rerun alone
  would show whether they pass. (Fleet `37540546857` also killed ch-1/ch-8.)
- Where the trending feed drives the chosen topic: download the `data/trending/<ch>.json` cache artifact.
- Boundary-experiment record (`data/audit` on the old PC): not in this clone.
- `37380168306` pop-transitions content; transitions ownership; `visual-director.js` role on the canvas path;
  `vision_critic.py` prompt; "clause #3".
- Whether the 5 of the 6 other post-fix dispatch logs show the same JSON-parse failure rate for Gemini (the
  planner's Gemini JSON failure appears in every log sampled: ch-1, 2, 5, 9, 26 in two runs; not counted
  across all runs).
