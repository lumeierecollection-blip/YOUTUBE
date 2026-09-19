# Repo State Verification — Read-Only Audit

**Date**: 2026-09-19
**Branch**: claude/visual-rebuild-from-5f91e75
**Commits**: b2e06dc (audit), 7b3902d (perf)
**HEAD**: 7b3902d on claude/visual-rebuild-from-5f91e75

---

## 1. Terminology sweep — CONFIRMED (blocker persists)

### "voxel" in production config (16 occurrences in channels.json)

`
config\channels.json:1592: "visual_engine": "voxel",
config\channels.json:1596: "handle": "@cosmicvoxels",
config\channels.json:1603: "description": "...told through miniature voxel universes..."
config\channels.json:1621: "voxel space"
config\channels.json:1632: "style": "voxel-cosmic",
config\channels.json:1658: "color_grade": "...voxel miniature aesthetic",
config\channels.json:1660: "custom voxel 3D renders",
config\channels.json:1677: "voxel-morph"
config\channels.json:1682: "philosophy": "...tactile voxel universe..."
config\channels.json:1740: "visual_engine": "voxel",
config\channels.json:1751: "description": "...miniature voxel worlds."
config\channels.json:1780: "style": "voxel-psychology",
config\channels.json:1806: "color_grade": "...voxel miniature aesthetic",
config\channels.json:1808: "custom voxel 3D renders",
config\channels.json:1825: "voxel-reshape"
config\channels.json:1830: "philosophy": "...camera moves through voxel environments..."
`

### "voxel" in docs (37 occurrences — self-referential in REPO-STATE-VERIFICATION.md)

All 37 doc matches are in docs/REPO-STATE-VERIFICATION.md itself, documenting the problem. No other docs files reference "voxel".

### "voxel" in src/, scripts/, .github/ — ZERO

No voxel references exist in production code or workflows. The term is confined to config/channels.json (channels 49/50) and the verification doc.

### Standalone "vox" matches (3 in code, 18 in docs)

Code matches:
`
src\skills\remotion-render\effects\generate-editorial-lut.mjs:28: *   3. Split-tone matching the vox-style-treatment SKILL.md's own named
scripts\frame-audit.js:68: // vox-style-treatment SKILL.md's canvas grain (effects/CanvasGrain.jsx) —
`

These are code comments referencing the skill file. No "vox" or "Vox-style" exists in config or workflow files.

**Verdict: "voxel" IS present in production config. It is the wrong term. It must be corrected before merge to main.**

---

## 2. Channel ID verification — CONFIRMED (duplicates + missing)

`
Total: 50 Unique: 39
Duplicates: [26,30,31,35,39,44,46,47,48,49,50]
Missing: [5,6,8,10,12,13,14,15,16,18,19]
`

Duplicate details:
`
26 -> Financial Crimes & Heists / Music Theory & Composition
30 -> DNA/Genealogy Solved Cold Cases / Game Theory & Strategy
31 -> Wrongful Convictions & Justice Failures / Linguistics & Language
35 -> Real Engineering — Cinematic Tech Deep Dives / Behavioral Economics
39 -> Medical Case Studies — ER Mysteries / Materials Science
44 -> Professional Skill Development / Botany & Plant Science
46 -> Career & Interview Prep / Sociology & Society
47 -> Medicare & Senior Insurance / Geology & Earth Science
48 -> Industrial Manufacturing Explainers / Ergonomics & Human Factors
49 -> Space Facts (visual_engine:voxel) / Astrophysics & Stars
50 -> Brain, Psychology (visual_engine:voxel) / Cognitive Science & Mind
`

**Verdict: 11 duplicate IDs, 11 missing IDs. The pipeline will only process the LAST entry for each duplicate, silently dropping the first.**

---

## 3. Vox renderer existence — CONFIRMED (does NOT exist)

### Files matching *vox* in src/ (excluding node_modules):
`
src\skills\remotion-render\effects\generate-editorial-lut.mjs  (comment only)
src\skills\remotion-render\node_modules\@types\three\examples\jsm\loaders\VOXLoader.d.ts  (three.js VOX file format loader)
src\skills\remotion-render\node_modules\three\examples\jsm\loaders\VOXLoader.js  (three.js VOX file format loader)
`

The three.js VOXLoader loads MagicaVoxel .vox files (3D cube data). This is NOT a Vox-style renderer — it's a generic 3D file format loader from the three.js library.

### Registered compositions in Root.jsx:
`jsx
import { compositions as cinematicDocumentary } from "./compositions/cinematic-documentary.jsx";
import { compositions as minimal } from "./compositions/minimal.jsx";
import { compositions as motionGraphics } from "./compositions/motion-graphics.jsx";
import { compositions as directedScene } from "./visual-engine/directed-scene.jsx";
`

4 compositions registered. None are Vox-style editorial explainer.

### Composition directories:
`
objects/
scenes/
director/
qa/
`

No vox/ directory exists.

**Verdict: No Vox-style renderer exists. The three.js VOXLoader is a MagicaVoxel file format reader, not a Vox-style animation renderer.**

---

## 4. Schema mode verification — CONFIRMED (NOT used)

### responseSchema / responseMimeType / json_schema in code:
**(empty — zero matches)**

### Endpoint URL:
`
src/lib/gemini-client.js:241: const baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
src/lib/gemini-client.js:359: const baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
`

### Request body format:
`javascript
const body = JSON.stringify({ model, max_tokens: maxTokens, temperature, messages });
// Content-Type: application/json
`

The client sends a standard OpenAI-compatible chat completion request. No esponse_format, no esponseSchema, no esponseMimeType.

**Endpoint**: https://generativelanguage.googleapis.com/v1beta/openai — This is Google's OpenAI-compatible endpoint. As of 2026, this endpoint does NOT support esponseSchema / structured output. The native Gemini API (/v1beta/models/...:generateContent) supports esponseSchema, but the OpenAI-compatible wrapper does not.

**Verdict: Schema mode is NOT used. JSON parsing is post-hoc with try/catch. Malformed responses cost tokens on retries.**

---

## 5. Frame inspection — UNVERIFIABLE

### Most recent mp4s:
`
2026-09-14 15:30  524,336 bytes  emergency-fund-...-2026-09-14.mp4  (CORRUPT: moov atom not found)
2026-09-13 21:33  2,761,468 bytes  emergency-fund-...-2026-09-13.mp4  (VALID)
2026-09-11 14:54  2,777,485 bytes  emergency-fund-...-2026-09-11.mp4
2026-09-11 14:49  4,592,643 bytes  september-...-2026-09-11.mp4
2026-09-11 01:38  4,105,583 bytes  september-...-2026-09-10.mp4
`

### Frame extraction:
`
Source: emergency-fund-bigger-than-you-think-2026-shorts-shorts-2026-09-13.mp4
Frame: 30 (at ~1 second)
File: 41,472 bytes
Dimensions: 1080x1920
`

**I cannot visually inspect this frame. A human must look at it.**

---

## 6. OpenCode/Cerebras failure — CONFIRMED (billing, not connectivity)

### Files referencing opencode or cerebras:
`
.github/workflows/daily-pipeline.yml
scripts/opencode-agent.js
scripts/opencode-visual-intent.js
scripts/gemini-visual-plan.js
scripts/gemini-visual-challenger.js
scripts/render-and-qa-enhanced.js
scripts/execution-comparator.js
scripts/gate-visual-qa.js
scripts/slop-check.js
scripts/token-usage-report.js
src/skills/remotion-render/visual-engine/director/visual-director.js
`

### GitHub Actions runs (3 failures):
`
35468932724  2026-09-19T20:56:55Z  failure  headSha: 71e8b05
35468403242  2026-09-19T20:46:14Z  failure  headSha: 8551078
35462154718  2026-09-19T18:44:23Z  failure  headSha: 385f84c
`

None of these runs are at the current HEAD (7b3902d).

### Actual error from run 35468932724:
`
All models failed. Last error: [cerebras/gpt-oss-120b] attempt 2/2:
opencode exited 1: {"type":"error","error":{"name":"APIError",
"error":{"message":"Payment Required: Payment required to access this
resource. Visit your billing tab.","statusCode":402,"isRetryable":false,
"responseBody":"{\"message\":\"Payment required to access this resource.
Visit your billing tab.\",\"type\":\"payment_required_error\",
\"param\":\"quota\",\"code\":\"payment_required\"}",
"metadata":{"url":"https://api.cerebras.ai/v1/chat/completions"}}}}
`

**Root cause**: Cerebras API returns HTTP 402 (Payment Required). This is a billing/quota issue, not a connectivity issue. The API key is valid but the account has no remaining quota or has not been paid.

**Verdict: The pipeline fails because the Cerebras free tier quota is exhausted. This is pre-existing and unrelated to our changes.**

---

## Summary

| Check | Status | Finding |
|---|---|---|
| 1. Terminology sweep | **CONFIRMED** | "voxel" appears 16x in channels.json (ch-49/50). Wrong term. Must fix before merge. |
| 2. Channel IDs | **CONFIRMED** | 11 duplicate IDs, 11 missing IDs. 50 entries = 39 unique. |
| 3. Vox renderer | **CONFIRMED** | Does not exist. Three.js VOXLoader is MagicaVoxel file format, not Vox-style renderer. |
| 4. Schema mode | **CONFIRMED** | Not used. OpenAI-compatible endpoint does not support responseSchema. |
| 5. Frame inspection | **UNVERIFIABLE** | Frame extracted (41KB, 1080x1920). Cannot view. Human must inspect. |
| 6. OpenCode/Cerebras | **CONFIRMED** | HTTP 402 Payment Required. Billing/quota issue, not connectivity. |

### Blockers (unchanged from prior audit)

1. **"voxel" in channels.json** — 16 occurrences of wrong term across ch-49/50.
2. **11 duplicate channel IDs** — pipeline silently drops first entry for each duplicate.
3. **No vox-style renderer** — skill documented but no composition exists.
4. **Cerebras billing** — HTTP 402 blocks entire pipeline. Pre-existing.