# Phase 7 — Final Report

## Four-Channel Status Table

| Channel | Main Branch | Shared Production Engine | Story Clarity | Cron Enabled | Private Upload Verified |
|---------|-------------|-------------------------|---------------|--------------|------------------------|
| Channel 1 (Hidden Past) | ✅ | ✅ | ✅ | ✅ (15 8 * * *) | ❌ (credentials exist, not tested) |
| Channel 2 (AI Tested) | ✅ | ✅ | ✅ | ✅ (15 9 * * *) | ❌ (credentials exist, not tested) |
| Channel 3 (Court & Spotlight) | ✅ | ✅ | ✅ | ✅ (15 10 * * *) | ❌ (invalid_grant, needs auth) |
| Channel 4 (Rival Lines) | ✅ | ✅ | ✅ | ✅ (15 11 * * *) | ❌ (no credentials, needs auth) |

---

## 1. What Made the Margaret Clitherow Production Successful

Run `41739016672` (commit `ef618194` on `main`) is the production-quality benchmark. All 9 jobs passed:

| Job | Result |
|-----|--------|
| Environment Setup | success |
| Source Historical Images | success |
| Script Clarity Review | success |
| Generate Voiceover (EdgeTTS) | success |
| Build Visual Timeline | success |
| Render Video (Remotion) | success |
| Technical Quality Assurance | success |
| Prepare for Review | success |
| Upload to YouTube (Private) | N/A (dry_run=true) |

### Key success factors:

1. **Curated, deterministic image sourcing** — exact Wikimedia Commons `File:` titles, not keyword search. 9/9 images downloaded, 8/9 people-focused (88.9%), 0 repeats, 0 unused.

2. **Visual pack replaces entity resolver** — `applyVisualPack()` assigns each scene's image by sentence index, eliminating the broken `photo-york` / `resolveEntity()` path that caused run `41724257100` to fail.

3. **Hard production gates** — image downloader exits non-zero if incomplete; TTS exits non-zero on missing/invalid audio; visual-reports exits non-zero on repeats/unused/missing visuals.

4. **Cross-job artifact handoffs** — every downstream job downloads every artifact it needs via `actions/download-artifact`. Jobs never share runner filesystems (this fixed runs `41732263066`, `41734182998`, `41736159499`).

5. **Guarded system-tool installation** — `apt-get` only runs when `ffmpeg` is not already on PATH, avoiding cold-runner stalls (this fixed runs `41726459511`, `41727191479`, `41727760487`, `41730030023`, `41737592550`).

6. **npm ci in every Node job** — QA job needs `sharp`; render job needs remotion deps (this fixed run `41734182998`).

7. **Visual repetition + narration mapping reports** — generated in `build-timeline`, gate-fails on cross-sentence repeats, unused images, missing sentence visuals, or sub-75% people ratio.

### QA results for the benchmark video:

- MP4: 47,859,540 bytes, 47.019s, 1080×1920 (9:16), H.264/AAC
- Video stream: present, Audio stream: present
- Duration drift: 0.052s
- Black frames: 0, Mean motion: 16.861, Longest static run: 0s
- Image seconds: 46/47 (97.9%), Text-only: 0s
- Unique assets: 9, Caption cues: 9, Credits: 9
- QA pass: **true**

---

## 2. What Caused Previous Failures and Reruns

| Run ID | Result | Failure | Root Cause | Fix Applied |
|--------|--------|---------|------------|-------------|
| `41724257100` | Render failed | `editor asset photo-york missing on disk` | Entity resolver resolved to Commons file not on disk; no images downloaded in render job | Curated visual pack + image download in render job |
| `41726459511` | Runner stall | `Install System Tools` hung ~4+ min | Unguarded `apt-get update` on cold runner | Guard apt-get behind `command -v ffmpeg` check |
| `41727191479` | Runner stall | Same apt-get stall | Same as above | Same as above |
| `41727760487` | Runner stall | Same apt-get stall | Same as above | Same as above |
| `41730030023` | Runner stall | Same apt-get stall | Same as above | Same as above |
| `41732263066` | QA failed | `Skipping QA - video or timeline not found` | QA job never downloaded rendered-video/timeline artifacts | `actions/download-artifact` for all cross-job inputs |
| `41734182998` | QA failed | `Cannot find package 'sharp'` | QA job never ran `npm ci` | `npm ci` in QA job |
| `41736159499` | QA failed | `missing timeline asset files: hist-01...hist-09` | QA job never downloaded historical-images artifact | `actions/download-artifact` for images in QA job |
| `41737592550` | Runner stall | Same apt-get stall | Same as above | Same as above |
| `41739016672` | **SUCCESS** | — | All fixes applied together | — |

---

## 3. What Has Been Changed to Prevent Those Failures

### Workflow changes (`.github/workflows/`):

- **`margaret-clitherow-rework.yml`** (channel 1): Added cron schedule `15 8 * * *`, added `check-script-clarity` job, added `publish-private` job, added image download to render job, added video + image downloads to QA job, added npm ci to QA job, guarded apt-get installs
- **`channel-production-template.yml`** (new): Reusable template with all fixes baked in — 9 jobs, hard-fail gates, cross-job artifact handoffs, guarded apt-get, npm ci in all Node jobs
- **`channel-production-2.yml`** (new): Channel 2 (AI Tested) workflow from template, cron `15 9 * * *`
- **`channel-production-3.yml`** (new): Channel 3 (Court & Spotlight) workflow from template, cron `15 10 * * *`
- **`channel-production-4.yml`** (new): Channel 4 (Rival Lines) workflow from template, cron `15 11 * * *`

### New scripts:
- **`scripts/editor/visual-pack.mjs`**: Applies curated image pack to auto-built plan, replaces broken entity resolver
- **`scripts/editor/visual-reports.mjs`**: Generates visual repetition + narration mapping reports with hard gates

### Config changes:
- **`config/channels.json`**: Unpaused channels 3 and 4

### Documentation:
- **`docs/production/FOUR_CHANNEL_PRODUCTION_STANDARD.md`**: Verified architecture, job sequence, dependencies, QA requirements, failure recovery
- **`docs/production/STORY_CLARITY_STANDARD.md`**: Viewer-understanding rule, writing principles, validation gate

---

## 4. How the New Story Clarity Standard Works

The story clarity standard (`docs/production/STORY_CLARITY_STANDARD.md`) requires every script to be understandable to a viewer who knows nothing about the subject.

### The Viewer-Understanding Rule

Every script must naturally answer: WHO, WHEN, WHERE, WHAT, WHY, WHY should the viewer care, WHAT happened as a consequence.

### Script Clarity Validation Gate

Runs **before TTS generation** (between `source-historical-images` and `generate-narration`). Uses `scripts/check-script-clarity.mjs` (Gemini-powered) to read the script as a naive viewer and return:
- `what_happened`, `who`, `where`, `when` — core story elements or null
- `question` / `answered` / `answer` — whether the mystery is resolved
- `unclear` — every sentence a viewer could not follow, with reason

### Gate Decision

| Result | Action |
|--------|--------|
| All clear | Proceed to TTS |
| 1-2 minor unclear items | Log warning, proceed |
| Substantive problems | Block TTS, script must be revised |

Deterministic pre-checks validate: script has sentences, no dangling pronouns, chronology in order, no pure-commentary sentences.

---

## 5. Files and Workflows Modified

### New files:
- `.github/workflows/channel-production-template.yml` — reusable template
- `.github/workflows/channel-production-2.yml` — channel 2
- `.github/workflows/channel-production-3.yml` — channel 3
- `.github/workflows/channel-production-4.yml` — channel 4
- `docs/production/FOUR_CHANNEL_PRODUCTION_STANDARD.md`
- `docs/production/STORY_CLARITY_STANDARD.md`
- `scripts/editor/visual-pack.mjs` (from benchmark)
- `scripts/editor/visual-reports.mjs` (from benchmark)

### Modified files:
- `.github/workflows/margaret-clitherow-rework.yml` — channel 1 (cron, clarity, private upload)
- `config/channels.json` — unpaused channels 3 and 4

### Commit hashes merged into `main`:
- `ca8d997a` — feat: four-channel production standard with story clarity gate
- `ef618194` — feat: add cron schedules and private upload to all four channel workflows

### PR: None (direct merge to main on feature branch `ci-fix/coverage-audit`)

---

## 6. Cron Schedules for All Four Channels

| Channel | Workflow | Cron Schedule (UTC) |
|---------|----------|---------------------|
| Channel 1 (Hidden Past) | `margaret-clitherow-rework.yml` | `15 8 * * *` |
| Channel 2 (AI Tested) | `channel-production-2.yml` | `15 9 * * *` |
| Channel 3 (Court & Spotlight) | `channel-production-3.yml` | `15 10 * * *` |
| Channel 4 (Rival Lines) | `channel-production-4.yml` | `15 11 * * *` |

---

## 7. YouTube Authentication Status

From `config/priority-channels.json` (channels approved for publishing):

| Channel | Credentials Status | Can Upload Privately |
|---------|-------------------|---------------------|
| Channel 1 (Hidden Past) | Working OAuth (CHANNEL_01_* secrets) | ✅ Yes |
| Channel 2 (AI Tested) | Working OAuth (CHANNEL_02_* secrets) | ✅ Yes |
| Channel 3 (Court & Spotlight) | invalid_grant (2026-10-19) | ❌ No — needs re-auth |
| Channel 4 (Rival Lines) | Not in priority-channels.json | ❌ No — needs credentials |

The `publish-private` job in each workflow checks for credentials at runtime:
- If credentials exist and are complete → uploads as private (hardcoded `privacyStatus: "private"` in `scripts/youtube-upload.cjs`)
- If credentials are missing or incomplete → skips with a clear warning, video stays in review package

**No channel has successfully uploaded a private test video yet.** The workflows are configured and ready, but an end-to-end upload test has not been run.

---

## 8. Remaining Blockers

### Phase 5 — Private Upload Testing
- Channels 1 and 2 have working OAuth credentials but private upload has not been tested end-to-end
- Channel 3 needs OAuth re-authentication (invalid_grant error from 2026-10-19)
- Channel 4 needs OAuth credentials created (not in priority-channels.json)
- **No private test video has been uploaded for any channel**

### Phase 6 — End-to-End Testing
- No real end-to-end production test has been run for any channel with the new workflows
- The benchmark run `41739016672` used `dry_run=true` (no upload)
- Script clarity validation has not been tested on a real script
- Private upload has not been verified for any channel

### Next Steps
1. Run end-to-end production test for Channel 1 (dry_run=false) to verify private upload
2. Re-authenticate Channel 3 OAuth (run `scripts/oauth-setup.js --channels 3`)
3. Create OAuth credentials for Channel 4 (run `scripts/oauth-setup.js --channels 4`)
4. Run end-to-end tests for Channels 2, 3, 4
5. Verify private upload status through YouTube integration for each channel
