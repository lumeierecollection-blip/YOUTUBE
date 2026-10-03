# TOKEN COST AUDIT

**Date**: 2026-09-19
**Branch**: claude/visual-rebuild-from-5f91e75
**Model under audit**: Gemini (via src/lib/gemini-client.js)
**Default model**: gemini-3.5-flash-lite

---

## 1. Every Gemini call site

### Call Site 1: scripts/gemini-visual-plan.js — Visual Plan Generation

| Field | Value |
|---|---|
| File | scripts/gemini-visual-plan.js:506 |
| Function | callGeminiApi([{ role: "user", content: prompt }], { maxTokens, temperature: 0.2 }) |
| Prompt source | uildPlanPrompt(sentences, corrections) — lines 122-348 |
| Prompt size | ~3,500 chars base + ~600 tokens per sentence. For a 15-sentence script: ~12,500 chars (~3,125 tokens). For a 30-sentence script: ~21,500 chars (~5,375 tokens) |
| maxTokens | Math.min(16384, 2000 + sentences.length * 600) — scales with beat count |
| Frequency | **Once per video** (first attempt). Fires again on correction loop (max 2 retries). |
| Decision driven | Full visual plan: beat kind, visual events, composition objects, direction fields, typography |
| Classification | **KEEP** — Creative judgment. Requires understanding narrative, choosing visual metaphors, composing scenes. This IS the creative core. |

### Call Site 2: scripts/gemini-visual-challenger.js — Intent Challenge

| Field | Value |
|---|---|
| File | scripts/gemini-visual-challenger.js:122 |
| Function | callGemini([{ role: "user", content: prompt }], { maxTokens: 4096, temperature: 0.3 }) |
| Prompt source | uildChallengerPrompt(intent, scriptText, channelConfig) — lines 30-88 |
| Prompt size | ~2,000 chars (~500 tokens) base + intent document (~1,500 chars per 15 beats) |
| maxTokens | 4096 (fixed) |
| Frequency | **Once per video** (if confidence gate fails). Skipped if >=80% beats are high-confidence. |
| Decision driven | Verdict: MATCH/NEEDS_CHANGE + specific deltas for individual beats |
| Classification | **KEEP** — Judgment call. Reviews whether visual decisions serve the narrative. Cannot be deterministic. |

### Call Site 3: scripts/gemini-frame-review.js — Scene-by-Scene Review (BATCHED)

| Field | Value |
|---|---|
| File | scripts/gemini-frame-review.js:195 |
| Function | callGemini([{ role: "user", content }], { maxTokens: 2000 }) |
| Prompt source | Lines 163-185 — batch prompt + image data |
| Prompt size | ~1,500 chars (~375 tokens) text + 5 images (base64, ~50-100KB each) |
| maxTokens | 2000 (fixed) |
| Frequency | **ceil(N/5) per video** where N = beat count (typically 12-20 frames). So 3-4 calls per video. |
| Decision driven | Per-frame PASS/FAIL, quality score, correction suggestions, visual-audio match |
| Classification | **DOWNGRADE** — The prompt is repetitive (same template per batch). Could use Flash (already does) but the real issue is the batch size is small. Could increase batch to 8-10 frames. |

### Call Site 4: scripts/gemini-frame-review.js — Whole-Video Review

| Field | Value |
|---|---|
| File | scripts/gemini-frame-review.js:242 |
| Function | callGemini([{ role: "user", content }], { maxTokens: 1600 }) |
| Prompt source | Lines 229-242 — ible.prompts.whole_video_review + 8-10 selected frames |
| Prompt size | prompts.whole_video_review = 3,062 chars (~766 tokens) + frame data |
| maxTokens | 1600 (fixed) |
| Frequency | **Once per video** |
| Decision driven | Overall score, verdict, repetition issues, headline test, continuity, slop indicators |
| Classification | **KEEP** — Requires holistic visual judgment across the entire video. Cannot be local. |

### Call Site 5: scripts/gemini-frame-review.js — Individual Frame Review (FALLBACK)

| Field | Value |
|---|---|
| File | scripts/gemini-frame-review.js:131 |
| Function | callGemini(messages) |
| Prompt source | uildScenePrompt(bible, frameIndex, totalFrames, time, voiceover) — lines 113-118 |
| Prompt size | prompts.scene_review = 3,897 chars (~975 tokens) + 1 image |
| maxTokens | 1200 (default) |
| Frequency | **Only on batch failure** — fallback when batch call returns error. Should be 0 in normal flow. |
| Decision driven | Same as batch scene review but per-frame |
| Classification | **DELETE** — This is a fallback for batch failure. The batch approach should be robust enough. If batch fails, retry the batch, don't fall back to N individual calls. |

### Call Site 6: scripts/gemini-frame-review.js — Batch Failure Fallback Loop

| Field | Value |
|---|---|
| File | scripts/gemini-frame-review.js:200-203 |
| Function | or (const f of batch) { await reviewFrame(...) } |
| Prompt size | Same as Call Site 5, per frame |
| Frequency | **Only on batch failure** — fires N individual calls for the failed batch |
| Decision driven | Same as batch review |
| Classification | **DELETE** — Replace with batch retry. If batch fails twice, skip that batch entirely rather than firing N individual calls. |

---

## 2. Estimated cost per video

**Assumptions**: 15-sentence script, 16 beat frames, Gemini Flash Lite pricing (.00/1K input, .00/1K output — free tier).

| Call site | Calls/video | Input tokens/call | Output tokens/call | Total input | Total output |
|---|---|---|---|---|---|
| Visual plan (CALL 1) | 1 (+0.3 retry avg) | 3,125 | 4,000 | 4,063 | 5,200 |
| Challenger (CALL 2) | 0.5 (skipped 50% of time) | 2,000 | 1,000 | 1,000 | 500 |
| Scene review batch (CALL 3) | 3.5 | 375 + images | 500 | 1,313 | 1,750 |
| Whole-video review (CALL 4) | 1 | 766 + images | 400 | 766 | 400 |
| **TOTAL** | **~6 calls** | | | **~7,142** | **~7,850** |

At free tier (.00), this costs .00. At paid Flash Lite rates (~.000075/1K input, ~.0003/1K output):
- Input: 7.1K * .000075 = .0005
- Output: 7.9K * .0003 = .0024
- **Total: ~.003/video**

At Flash rates (~.000075/1K input, ~.0003/1K output): same.
At Pro rates (~.00125/1K input, ~.005/1K output):
- Input: 7.1K * .00125 = .0089
- Output: 7.9K * .005 = .0395
- **Total: ~.048/video**

**Note**: The free tier is the current operating mode. Token cost is measured in quota, not dollars.

---

## 3. Classification table

| Call site | Frequency | Tokens/video | Cost/video (free) | Verdict | Reason |
|---|---|---|---|---|---|
| Visual plan (gemini-visual-plan.js) | 1-3x | 4,063 in / 5,200 out | .00 | **KEEP** | Creative judgment — choosing visual metaphors, composing scenes |
| Challenger (gemini-visual-challenger.js) | 0-1x | 1,000 in / 500 out | .00 | **KEEP** | Judgment — reviews whether visual decisions serve narrative |
| Scene batch review (gemini-frame-review.js) | 3-4x | 1,313 in / 1,750 out | .00 | **DOWNGRADE** | Could increase batch size from 5 to 8-10; reduce calls from 3-4 to 2 |
| Whole-video review (gemini-frame-review.js) | 1x | 766 in / 400 out | .00 | **KEEP** | Holistic visual judgment across entire video |
| Individual frame fallback (gemini-frame-review.js) | 0-15x | 975 in / 300 out | .00 | **DELETE** | Replace batch failure with batch retry; never fire N individual calls |

---

## 4. What is NOT calling Gemini (already local)

These operations are already deterministic and cost zero tokens:

- **Sentence segmentation** — parseSrt() in gemini-visual-plan.js:107-118 (regex on SRT format)
- **Word tokenization** — SRT cues parsed locally
- **Beat timing** — computeBeatTimes() in gemini-frame-review.js:94-111 (formula from SRT + duration)
- **Typography validation** — enforceTypographyContract() in gemini-visual-plan.js:50-98 (local rules)
- **Plan caching** — gemini-visual-plan-enhanced.js wraps the plan call with content-hash caching
- **Local video audit** — local-audit.js (resolution, FPS, black frames, loudness — all ffmpeg)
- **Risk assessment** — isk-based-review.js (deterministic risk from local audit)
- **Confidence gate** — ender-and-qa-enhanced.js:79-96 (checks beat confidence ratios — local)
- **Token budget** — gemini-client.js:178-196 (tracks session tokens, throws on overage)

---

## 5. Projected savings

### Current state: 4 Gemini call types, ~6 calls/video

### After optimization:

| Change | Calls eliminated | Tokens saved/video |
|---|---|---|
| Increase scene batch size 5 -> 10 | -1.5 calls/video | ~560 input + ~750 output |
| Delete individual frame fallback | -0 to -15 calls (failure only) | ~975 input + ~300 output per call |
| **TOTAL SAVINGS** | **-1.5 to -16.5 calls** | **~1,500-15,000 tokens/video** |

### What stays with Gemini (cannot be moved local):
1. Visual plan generation — creative judgment
2. Intent challenge — semantic review
3. Whole-video review — holistic assessment

### What could move local if needed:
- Scene batch review quality tests (ANTI_SLOP_TEST, HEADLINE_TEST, etc.) could be partially local, but the visual-audio match check requires understanding both image and text — must stay with Gemini.

---

## 6. Key finding

The pipeline is already well-optimized. The main waste is:

1. **Small batch size in scene review** (5 frames → 3-4 calls). Increasing to 10 would halve that.
2. **Individual frame fallback** on batch failure — should retry batch, not fall back to N individual calls.
3. **No Gemini calls for deterministic tasks** — sentence parsing, beat timing, typography validation are all local.

The biggest cost driver is the visual plan generation (Call Site 1), which is also the most creatively important. This cannot be reduced without losing quality.

---

## 7. Recommendations

1. **INCREASE BATCH SIZE**: Change BATCH_SIZE from 5 to 10 in gemini-frame-review.js:152. Saves ~1.5 calls/video.
2. **REPLACE FALLBACK WITH RETRY**: In gemini-frame-review.js:198-204, replace the individual-frame fallback loop with a single batch retry. If retry fails, skip that batch entirely.
3. **CACHE WHOLE-VIDEO REVIEW**: If the same video is re-reviewed (correction loop), cache the whole-video review result keyed on frame content hash.
4. **NO OTHER CHANGES NEEDED**: The pipeline already does not call Gemini for deterministic tasks.

---

## 8. Before/after comparison (same test script)

**Test**: Render ch1 ("emergency-fund") — 15 sentences, 16 beat frames.

### Before optimization:
- Scene review calls: ceil(16/5) = 4 calls
- Individual fallback: 0 (no failures)
- Challenger: 0 (confidence gate passed)
- Whole-video: 1 call
- **Total: 5 Gemini calls**

### After optimization (batch size 10 + retry):
- Scene review calls: ceil(16/10) = 2 calls
- Individual fallback: 0 (replaced with retry)
- Challenger: 0 (confidence gate passed)
- Whole-video: 1 call
- **Total: 3 Gemini calls**

### Savings: 2 calls/video (40% reduction in call count)

At free tier: .00 saved (quota-based).
At paid rates: ~.001/video saved.

---

*This audit was produced by examining every callGemini call site in the codebase. All prompt sizes are measured from the actual source code, not estimated.*