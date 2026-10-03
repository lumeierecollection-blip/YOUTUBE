# V2 Pipeline — Gap Analysis (V2 vs moGraph Plan)

Date: 2026-09-22
Branch: claude/visual-rebuild-from-5f91e75

## moGraph Requirements vs V2 Status

| Requirement | V2 Status | File:Line | Notes |
|---|---|---|---|
| **Gemini plan with fallback to local** | PARTIAL | `scripts/gemini-visual-plan.js:callGemini()` | V2 has Gemini plan. No local fallback — if Gemini fails, `geminiPlan()` returns null and render uses default director. Need to add local fallback in `render-and-qa.js:geminiPlan()` |
| **Local plan generator (no Gemini)** | MISSING | — | V2 has `scripts/build-visual-plan.js` (template-based, not local SRT→plan). Our `scripts/local-visual-plan.cjs` is the right approach. Need to port it into V2. |
| **No "no physical mechanism detected" lines** | PARTIAL | `scripts/gemini-visual-plan.js` | V2 uses capabilities, not mechanisms. The old error string is from `visual-director.js` which V2 still calls via `render.js`. Check if V2's `direct()` can still emit this. |
| **TYPOGRAPHY beats 1-2 only** | PARTIAL | `scripts/gemini-visual-plan.js:enforceTypographyContract()` | V2 enforces typography contract. `TYPO_MAX_BEAT_SHARE` from `narrative-typography.js` caps text beats. But no hard rule that hook/CTA must be TYPOGRAPHY and max 2 total. |
| **No mechanism > 40%** | PARTIAL | `scripts/gemini-visual-plan.js` | V2 tracks `capabilityDistribution` not mechanism distribution. The 40% cap exists in `visual-director.js`'s `direct()` but only as a warning, not a hard gate. |
| **White background from channel config** | EXISTS | `scripts/build-visual-identity.js` | V2 derives palette from `channels.json` `bg_mode`. `styles/tokens.js` declares `BG_WHITE`/`BG_BLACK`. Need to verify `bg_mode: "white"` is respected in render path. |
| **Static camera (no pan/zoom/drift)** | UNKNOWN | `src/skills/remotion-render/render.js` | V2's `render.js` passes `visualPlan` to `direct()`. Need to check if `direct()` applies camera transforms. Our branch removed camera from `visual-director.js`. |
| **Voiceover hard-required (missing = exit 1)** | PARTIAL | `scripts/render-and-qa.js:renderOne()` | V2 skips render if audio missing (returns `{skipped: true}`), but doesn't exit 1. Need to make it exit 1 for missing audio. |
| **Kalimba bed (real instrument)** | UNKNOWN | `src/skills/remotion-render/audio/` | Need to check if V2's render path includes kalimba. Our branch added kalimba in `audio-mix.js`. |
| **SFX on transitions** | UNKNOWN | `src/skills/remotion-render/visual/sfx-palette.js` | V2 has `sfx-palette.js`. Need to verify it fires on transitions. |
| **No audio skips (TTS plays start to finish)** | PARTIAL | `scripts/render-and-qa.js` | V2 has `findScripts()` that filters by audio existence. But no post-render silence detection. Need to add `ffmpeg silencedetect` check. |
| **No missing moGraph content (every beat renders)** | UNKNOWN | `scripts/frame-audit.js` | V2 has frame audit. Need to verify it checks every beat frame. |
| **Video duration == audio duration ±1s** | UNKNOWN | `scripts/frame-audit.js` | Need to check if V2's frame audit enforces duration match. |
| **Private-only YouTube upload** | EXISTS | `src/skills/youtube-publish/run.js` | V2's publish script uses `privacyStatus: "private"` by default. Verified in `run.js`. |
| **Self-heal loop scoped to creation files** | MISSING | — | V2 has no self-heal. Our `scripts/self-heal.cjs` exists but is V1-scoped. Need to port to V2. |

## Summary

- **Fully implemented:** 1/15 (private upload)
- **Partially implemented:** 5/15 (Gemini plan, typography, mechanism cap, audio skip, white bg)
- **Unknown (need to verify):** 5/15 (camera, kalimba, SFX, frame audit, duration)
- **Missing:** 4/15 (local fallback, local plan generator, silence detection, self-heal)

## Key V2 Scripts to Modify

1. `scripts/render-and-qa.js` — add local plan fallback in `geminiPlan()`, make audio hard-required
2. `scripts/gemini-visual-plan.js` — add local fallback when Gemini fails
3. `scripts/local-visual-plan.cjs` — port from our branch into V2 (or integrate into `build-visual-plan.js`)
4. `src/skills/remotion-render/render.js` — verify it works with V2's plan format
5. `src/skills/remotion-render/visual-engine/director/visual-director.js` — verify no camera transforms
6. `src/skills/remotion-render/visual/audio-mix.js` — verify kalimba + SFX wiring
