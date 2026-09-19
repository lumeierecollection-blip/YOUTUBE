# Token Cost Audit

**Date**: 2026-09-19
**Branch**: `claude/visual-rebuild-from-5f91e75`
**Audited by**: OpenCode (rat.txt prompt)

---

## 1.1 Every Gemini Call Site

### Call Site 1: `scripts/gemini-frame-review.js:131` — `reviewFrame()`

- **File**: `scripts/gemini-frame-review.js`
- **Line**: 131
- **Prompt**: Visual Bible `scene_review` prompt (~3885 chars) + base64 image
- **Estimated tokens**: ~1000 text + ~500 image = ~1500 input tokens per call
- **Frequency**: Per frame, up to 20 frames per video = **20 calls/video**
- **Decision driven**: Visual quality assessment per frame (composition, typography, assets)
- **Classification**: **KEEP** — requires visual judgment, cannot be deterministic

### Call Site 2: `scripts/gemini-frame-review.js:161` — `reviewWholeVideo()`

- **File**: `scripts/gemini-frame-review.js`
- **Line**: 161
- **Prompt**: Visual Bible `whole_video_review` prompt (~3040 chars) + up to 10 base64 images
- **Estimated tokens**: ~800 text + ~5000 images = ~5800 input tokens per call
- **Frequency**: **1 call/video**
- **Decision driven**: Whole-video coherence, template monoculture detection
- **Classification**: **KEEP** — requires holistic visual judgment

### Call Site 3: `scripts/gate-visual-qa.js:189` — `visionCheck()`

- **File**: `scripts/gate-visual-qa.js`
- **Line**: 189
- **Prompt**: ~500 chars (environment/object identification) + up to 6 base64 images
- **Estimated tokens**: ~150 text + ~3000 images = ~3150 input tokens per call
- **Frequency**: **1 call/video**
- **Decision driven**: Environment match + core object identification
- **Classification**: **DOWNGRADE** — simple structured output, could use Flash-Lite

### Call Site 4: `scripts/opencode-agent.js:326` — Key lookup

- **File**: `scripts/opencode-agent.js`
- **Line**: 326
- **Nature**: Key lookup for OpenCode CLI (not a direct API call)
- **Classification**: **N/A** — not a Gemini API call

### Call Site 5: `scripts/render-and-qa.js:118,194` — Key lookup

- **File**: `scripts/render-and-qa.js`
- **Lines**: 118, 194
- **Nature**: Key lookup to pass to child processes (not a direct API call)
- **Classification**: **N/A** — not a Gemini API call

### Call Site 6: `scripts/gemini-visual-plan.js` — MISSING

- **File**: `scripts/gemini-visual-plan.js`
- **Nature**: Referenced by `render-and-qa.js:32` but **does not exist** on this branch
- **Classification**: **MISSING** — pipeline will fail at visual planning step

---

## 1.2 Cost Per Video Estimate

Using **Gemini 3.5 Flash** pricing: $1.50/M input, $9.00/M output

| Call Site | Input Tokens | Output Tokens | Calls/Video | Total Input | Total Output | Cost/Input | Cost/Output | Total Cost |
|-----------|-------------|---------------|-------------|-------------|--------------|------------|-------------|------------|
| reviewFrame() | 1,500 | 200 | 20 | 30,000 | 4,000 | $0.045 | $0.036 | $0.081 |
| reviewWholeVideo() | 5,800 | 500 | 1 | 5,800 | 500 | $0.009 | $0.005 | $0.014 |
| visionCheck() | 3,150 | 150 | 1 | 3,150 | 150 | $0.005 | $0.001 | $0.006 |
| **TOTAL** | | | **22** | **38,950** | **4,650** | **$0.059** | **$0.042** | **$0.101** |

**Current cost per video: ~$0.10**

---

## 1.3 Classification Table

| Call Site | Frequency | Tokens/Video | Cost/Video | Verdict | Reason |
|-----------|-----------|--------------|------------|---------|--------|
| reviewFrame() | 20/video | 34,000 | $0.081 | **KEEP** | Visual judgment per frame — cannot be deterministic |
| reviewWholeVideo() | 1/video | 6,300 | $0.014 | **KEEP** | Holistic coherence check — requires full context |
| visionCheck() | 1/video | 3,300 | $0.006 | **DOWNGRADE** | Simple structured output (environment/objects) — Flash-Lite sufficient |
| gemini-visual-plan.js | MISSING | N/A | N/A | **MISSING** | Referenced by pipeline but file doesn't exist |

---

## 1.4 Projected Savings

### Current State
- **Cost per video**: ~$0.10
- **Calls per video**: 22 (20 frame reviews + 1 whole-video + 1 vision check)
- **Model**: Gemini 3.5 Flash ($1.50/M input, $9.00/M output)

### Optimized State (after recommendations)

| Optimization | Change | Savings |
|-------------|--------|---------|
| Downgrade visionCheck to Flash-Lite | $0.006 → $0.001 | $0.005/video |
| Batch frame reviews (20 → 4 batches of 5) | 20 calls → 4 calls | ~$0.050/video |
| Add disk cache (re-renders free) | $0.10 → $0.00 on cache hit | $0.10/video on re-render |
| **Total per video (first render)** | | **~$0.046** |
| **Total per video (re-render, cached)** | | **~$0.00** |

### Projected Monthly Savings (17 channels × 1 video/day)

| Metric | Current | Optimized | Savings |
|--------|---------|-----------|---------|
| Videos/month | 510 | 510 | — |
| Cost/video | $0.101 | $0.046 | $0.055 |
| Monthly cost | $51.51 | $23.46 | **$28.05 (54%)** |
| Re-render cost | $51.51 | $0.00 | **$51.51 (100%)** |

---

## Notes

1. **Missing file**: `scripts/gemini-visual-plan.js` is referenced by `render-and-qa.js` but doesn't exist on this branch. The visual planning step will fail. This needs to be created or the reference removed.

2. **Image tokens are the dominant cost**: The frame reviews send base64 images, which consume ~500 tokens each. Batching 5 frames per call reduces overhead but doesn't reduce image token count.

3. **Free tier**: All three Gemini keys are on the free tier (rate-limited). The actual cost is $0 until the free tier is exhausted. However, the free tier has daily limits that may cause failures on high-volume days.

4. **Opencode-agent.js**: The pipeline's script/research/discover stages run through OpenCode CLI with Cerebras models, not Gemini. These are not audited here.
