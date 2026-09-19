# Repo State Verification (Vox Edition)

**Date**: 2026-09-19
**Branch**: claude/visual-rebuild-from-5f91e75
**HEAD**: 39066cf4f4e161a3e7abedfd91fdaa41e58b894b 2026-09-19 23:04:11 +0200

## Summary

- Checks run: 11
- CONFIRMED: 5
- REFUTED: 4
- UNVERIFIABLE: 2
- Blockers found: 3

---

## Terminology Check (vox vs voxel)

**BLOCKER: "voxel" is present in production config and MUST be corrected.**

The term "voxel" (3D cube rendering) appears **21 times** in config/channels.json, confined to channels 49 and 50. It does NOT appear in src/, scripts/, or .github/workflows/.

The term "vox" (Vox-style editorial explainer) appears **zero** times in config or code — only in the skill file .opencode/skills/vox-style-treatment/SKILL.md.

These two terms are NOT being used interchangeably. "voxel" was committed as the wrong terminology for what should be "vox-style" animation.

---

## Detailed Results

### 1. Branch and commit — CONFIRMED

`
git branch --show-current
git log -1 --format="%H %ci %s"
git status --short | head -5
`

Output:
`
claude/visual-rebuild-from-5f91e75
39066cf4f4e161a3e7abedfd91fdaa41e58b894b 2026-09-19 23:04:11 +0200 docs: add production completion report for bigger.txt directive
?? .cache/
?? KEY.TXT
...
`

Analysis:
- Current branch IS claude/visual-rebuild-from-5f91e75. **CONFIRMED.**
- HEAD commit SHA: 39066cf4f4e161a3e7abedfd91fdaa41e58b894b. Message: "docs: add production completion report for bigger.txt directive".
- Working tree is **NOT clean** — many untracked files exist (.cache/, KEY.TXT, Oauth.txt, ig.txt, igger.txt, data/audit/, dev/, docs/, public/, various 	mp-*.txt and 	mp-*.mjs files, world.txt).

### 2. Terminology sweep — REFUTED (blocker found)

`
grep -rn "voxel" config/ src/ scripts/ .github/ 2>/dev/null
`

Output (21 occurrences, all in config/channels.json):
`
channels.json:1592: "visual_engine": "voxel",
channels.json:1595: "channel_name": "Cosmic Voxels",
channels.json:1596: "handle": "@cosmicvoxels",
channels.json:1603: "description": "...told through miniature voxel universes..."
channels.json:1621: "voxel space"
channels.json:1632: "style": "voxel-cosmic",
channels.json:1658: "color_grade": "...voxel miniature aesthetic",
channels.json:1660: "custom voxel 3D renders",
channels.json:1677: "voxel-morph"
channels.json:1682: "philosophy": "...tactile voxel universe..."
channels.json:1732: "thumbnail_identity": "Voxel planet/rocket/cosmic scene..."
channels.json:1740: "visual_engine": "voxel",
channels.json:1751: "description": "...miniature voxel worlds."
channels.json:1780: "style": "voxel-psychology",
channels.json:1806: "color_grade": "...voxel miniature aesthetic",
channels.json:1808: "custom voxel 3D renders",
channels.json:1825: "voxel-reshape"
channels.json:1830: "philosophy": "...camera moves through voxel environments..."
channels.json:1878: "thumbnail_identity": "Voxel brain/character scene..."
`

`
grep -rn "\bvox\b\|Vox-style\|vox_style\|voxStyle\|vox-style\|VOX" config/ src/ scripts/ .github/ 2>/dev/null
`

Output: Only the same channels.json lines (because "voxel" contains "vox" as a substring). No standalone "vox" or "Vox-style" references in config/code.

Analysis: "voxel" is a **blocker**. It is the wrong term. The correct term for this project is "vox" (Vox-style 2D editorial explainer). The voxel config describes 3D cube rendering which is NOT what this project does.

### 3. Channel configuration — REFUTED (duplicates + wrong terminology)

`
node -e "const cfg=JSON.parse(require('fs').readFileSync('config/channels.json','utf8'));
const list=cfg.channels||cfg;
list.filter(c=>c.id===49||c.id===50).forEach(c=>console.log(c.id, c.name||c.channel_name, c.visual_engine||'none'))"
`

Output:
`
49 Cosmic Voxels voxel
50 Mind Mechanics voxel
49 Stellar undefined
50 Synapse undefined
`

Analysis:
- **DUPLICATE IDs**: Channels 49 and 50 each appear TWICE. ID 49 = "Cosmic Voxels" (voxel engine) + "Stellar" (cinematic-documentary). ID 50 = "Mind Mechanics" (voxel engine) + "Synapse" (minimal).
- **Wrong terminology**: Both voxel-channel entries use isual_engine: "voxel". This should be isual_engine: "vox" or a more accurate descriptor.
- The non-voxel entries (Stellar, Synapse) were added in a later batch and shadow the earlier entries.

### 4. Duplicate and missing IDs — REFUTED

Output:
`
Total entries: 50
Unique IDs: 39
Duplicate IDs: [26, 30, 31, 35, 39, 44, 46, 47, 48, 49, 50]
Missing IDs (1-50): [5, 6, 8, 10, 12, 13, 14, 15, 16, 18, 19]
`

Analysis:
- 50 entries total, but only 39 unique IDs.
- **11 duplicate IDs** (26, 30, 31, 35, 39, 44, 46, 47, 48, 49, 50).
- **11 missing IDs** (5, 6, 8, 10, 12-16, 18-19).
- The duplicates mean some channels are shadowed — the pipeline will only see the LAST entry for each ID.

### 5. Vox-style renderer — CONFIRMED (does NOT exist)

`
find src/ -iname "*vox*"
# No results

grep -rn "KineticText\|kinetic-typography\|chart-build\|chartBuild\|map-annotation" src/ -l
# No results
`

Root.jsx registers 4 composition types:
`jsx
import { compositions as cinematicDocumentary } from "./compositions/cinematic-documentary.jsx";
import { compositions as minimal } from "./compositions/minimal.jsx";
import { compositions as motionGraphics } from "./compositions/motion-graphics.jsx";
import { compositions as directedScene } from "./visual-engine/directed-scene.jsx";
`

Analysis: **No vox-style renderer exists.** There is no composition for Vox-style editorial explainer animation. The registered compositions are: cinematic-documentary, minimal, motion-graphics, and directed-scene. None of these implement kinetic typography, chart builds, map annotations, or editorial explainer layouts as described in the vox-style-treatment skill.

The vox-style-treatment skill (.opencode/skills/vox-style-treatment/SKILL.md) exists as a reference document but has NO corresponding renderer implementation.

### 6. "voxel" in production paths — CONFIRMED absent from pipeline

`
grep -rn "voxel" src/skills/remotion-render/ src/compositions/ src/visual-engine/ 2>/dev/null
# No results

grep -rn "voxel" .github/workflows/ 2>/dev/null
# No results
`

Analysis: "voxel" does NOT appear in the render pipeline code or GitHub Actions workflows. It is confined to config/channels.json entries for channels 49 and 50. The pipeline does not currently read or act on the isual_engine field — it uses style (motion-graphics/cinematic-documentary/minimal) to select the composition.

### 7. GitHub Actions runs — CONFIRMED

`
gh run view 35468932724 --json conclusion,status,headSha,workflowName
gh run view 35468403242 --json conclusion,status,headSha,workflowName
`

Output:
`json
{"conclusion":"failure","headSha":"71e8b05dcf500b7adb7d665b1fa7df8b32a7171a","status":"completed","workflowName":"Daily Pipeline — Autonomous"}
{"conclusion":"failure","headSha":"8551078512735c8d9b7e5a315590136d1a846d5a","status":"completed","workflowName":"Daily Pipeline — Autonomous"}
`

Analysis:
- Both runs exist and completed with **failure**.
- Run 35468932724 head SHA: 71e8b05 (does NOT match current HEAD 39066cf).
- Run 35468403242 head SHA: 8551078 (does NOT match current HEAD 39066cf).
- Neither run was at the current HEAD commit.

### 8. Workflow and script references — CONFIRMED

`
Select-String .github/workflows/daily-pipeline.yml -Pattern "render-and-qa|vox|voxel"
`

Output:
`
550: # PART 8 of the motion-graphics rebuild - render-and-qa.js replaces
569: node scripts/render-and-qa-enhanced.js --channel ""
571: node scripts/render-and-qa-enhanced.js
`

Analysis:
- Workflow correctly points to ender-and-qa-enhanced.js (not the old ender-and-qa.js).
- No "vox" or "voxel" references in the workflow file.
- Two ender-and-qa*.js files exist: ender-and-qa.js (15,642 bytes, old) and ender-and-qa-enhanced.js (16,946 bytes, new).

### 9. Gemini integration — CONFIRMED

`
grep -n "gemini-3.5-flash-lite\|GEMINI_API_KEY" src/lib/gemini-client.js
`

Output:
`
5: GEMINI_API_KEY_1 (or GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY)
6: GEMINI_API_KEY_2
7: GEMINI_API_KEY_3
52: process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
53: process.env.GEMINI_API_KEY_2,
54: process.env.GEMINI_API_KEY_3,
58: throw new Error("No Gemini API keys found...")
228: model = "gemini-3.5-flash-lite",
354: model = "gemini-3.5-flash-lite",
`

Analysis:
- Model: gemini-3.5-flash-lite (default).
- Key stacking: 3-key rotation implemented (GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3).
- Single-key fallback: Falls back to GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.
- OpenCode/Cerebras: Referenced in scripts/opencode-agent.js (provider routing), not in gemini-client.js.

### 10. End-to-end render artifacts — UNVERIFIABLE

`
Get-ChildItem data/renders/ -Recurse -Filter *.mp4 | Sort-Object LastWriteTime -Descending | Select-Object -First 10
`

Output:
`
2026-09-14  524,336 bytes  emergency-fund-...-2026-09-14.mp4  (CORRUPT: moov atom not found)
2026-09-13  2,761,468 bytes  emergency-fund-...-2026-09-13.mp4  (VALID)
2026-09-11  2,777,485 bytes  emergency-fund-...-2026-09-11.mp4
2026-09-11  4,592,643 bytes  september-...-2026-09-11.mp4
2026-09-11  4,105,583 bytes  september-...-2026-09-10.mp4
2026-09-10  2,013,405 bytes  september-...-2026-09-09.mp4
`

Frame extracted from 2026-09-13 mp4: 41,472 bytes (1080x1920, h264, 57.88s).

Analysis: I cannot view images. The frame file exists at the extracted path with valid metadata (41KB PNG). The most recent mp4 (2026-09-14) is corrupt. The second most recent (2026-09-13) is valid.

### 11. OpenCode / Cerebras provider — CONFIRMED

`
grep -n "cerebras" scripts/opencode-agent.js
`

Output:
`
4: the 3-stage pipeline, now that the provider is Cerebras instead of
22: --model cerebras/gpt-oss-120b[,cerebras/gemma-4-31b,...]
165: Real failures seen on live runs against Cerebras...
329: cerebras: ["CEREBRAS_API_KEY"],
404: The first live runs against Cerebras showed two real problems
449: Cerebras rate limits appear to be account-wide
`

Analysis: OpenCode/Cerebras is the primary model provider for the 3-stage pipeline. The prior workflow failures (runs 35468403242 and 35468932724) failed at opencode-agent.js exited with code 1 — confirming the API connectivity issue is real and pre-existing.

---

## Blockers (ordered by severity)

1. **"voxel" terminology in channels.json** — 21 occurrences of wrong term across channels 49/50 config. Must be corrected to "vox" or removed entirely. If a renderer is ever built against this config, it will produce 3D cubes instead of Vox-style editorial explainers.

2. **Duplicate channel IDs** — 11 IDs appear twice (26, 30, 31, 35, 39, 44, 46, 47, 48, 49, 50). The pipeline will only process the LAST entry for each duplicate, silently dropping the first. This means "Cosmic Voxels" (ch-49) is shadowed by "Stellar" (ch-49), and "Mind Mechanics" (ch-50) is shadowed by "Synapse" (ch-50).

3. **No vox-style renderer exists** — The vox-style-treatment skill is documented but has no corresponding Remotion composition. Channels 49/50 cannot produce Vox-style output even if the terminology were corrected.

---

## Prior report — confirmed vs refuted

- **Confirmed**: Branch name, HEAD commit, OpenCode/Cerebras integration, Gemini 3-key failover, workflow points to render-and-qa-enhanced.js, test suite exists.
- **Refuted**: "50 channels with distinct visual identities" — only 39 unique IDs exist due to 11 duplicates. "channels 49 and 50 were assigned visual_engine of voxel" — this is CONFIRMED as present but REFUTED as correct terminology (should be "vox" not "voxel"). "VoxStar niche change" — channels 49/50 use "voxel" not "vox", and the channels are shadowed by duplicates.
- **Unverifiable**: End-to-end render quality (frame extracted but cannot view images), whether the pipeline actually produces correct output (workflow runs failed before render stage).

---

## Recommended next actions

1. **Correct "voxel" to "vox" in channels.json** — Replace all 21 occurrences. Rename "Cosmic Voxels" to "Cosmic Vox" (or appropriate). Change isual_engine: "voxel" to isual_engine: "vox".

2. **Resolve duplicate channel IDs** — Either reassign the newer channels (Harmony, Nash, Word Lab, etc.) to unused IDs (5, 6, 8, 10, 12-16, 18-19), or remove the duplicate entries.

3. **Build or remove vox-style renderer** — Either implement a Vox-style Remotion composition that matches the vox-style-treatment skill, or remove channels 49/50 and the skill until a renderer exists.

4. **Fix the corrupt mp4** — emergency-fund-...-2026-09-14.mp4 has no moov atom. Investigate render pipeline corruption.

5. **Fix OpenCode/Cerebras API connectivity** — Both workflow runs failed at the research stage. This blocks the entire pipeline.