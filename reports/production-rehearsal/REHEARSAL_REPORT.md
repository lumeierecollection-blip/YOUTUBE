# Production Rehearsal Report

**Date:** Fri Nov 06 2026  
**Branch:** `feat/unique-visual-sourcing-and-variety`  
**Base commit:** `45ed8b7b`  
**Verdict:** **NOT READY FOR HUMAN REVIEW**

---

## 1. Executive Summary

The production rehearsal was executed end-to-end. Four fresh videos were rendered across all four channels using the real production pipeline (research → source → plan → treat → render → QA). All four renders completed successfully as MP4s under 35 seconds with AAC audio. However, all four videos exhibit WCAG AA contrast violations (text below 4.5:1 against background) on multiple frames. The GitHub Actions workflow was triggered and executed but failed at the image-download step, blocking downstream render and QA jobs.

**Contrast gate:** The frame-audit script was changed from warn-only to hard-fail (exit code 1 on any contrast violation). All four fresh videos currently **fail** the contrast gate.

---

## 2. Freshly Executed Tests

### 2.1 Channel 1 — Hidden Past

| Attribute | Value |
|---|---|
| Topic | Ancient Egypt's first female ruler (Meretneith / royal seals) |
| Script | `data/research/1/ancient-egypts-first-female-king-royal-seals-shorts-script.json` |
| Render path | `data/renders/1/ancient-egypts-first-female-king-royal-seals-shorts-shorts-2026-11-05.mp4` |
| Duration | 34.53s (clamped from 37.3s) |
| Resolution | 1080x1920 @ 30fps |
| Audio | AAC, 48kHz stereo |
| SHA-256 | Not computed (file present) |
| Contact sheet | `data/renders/1/review/aberfan-60-years-guy-fawkes-review-package/contact-sheet.png` |
| QA result | **10/12 frames pass** — 2 contrast violations |
| Contrast violations | Frame 03: caption 1.09:1, headline 1.84:1; Frame 04: caption 1.09:1, headline 1.75:1 |

### 2.2 Channel 2 — AI Tested

| Attribute | Value |
|---|---|
| Topic | Amazon MWAA AI skills for Apache Airflow |
| Script | `data/research/2/amazon-mwaa-ai-agent-skills-apache-airflow-shorts-script.json` |
| Render path | `data/renders/2/amazon-mwaa-ai-agent-skills-apache-airflow-shorts-shorts-2026-11-05.mp4` |
| Duration | 34.57s (clamped from 37.9s) |
| Resolution | 1080x1920 @ 30fps |
| Audio | AAC, 48kHz stereo |
| Contact sheet | `data/renders/2/review/amazon-mwaa-ai-agent-review-package/contact-sheet.png` |
| QA result | **11/12 frames pass** — 1 contrast violation |
| Contrast violation | Frame 02: headline 2.52:1 |

### 2.3 Channel 3 — Court & Spotlight

| Attribute | Value |
|---|---|
| Topic | Nicki Minaj $275K lawsuit / attorney withdrawal |
| Script | `data/research/3/nicki-minaj-275k-lawsuit-paused-attorney-withdrawal-shorts-script.json` |
| Render path | `data/renders/3/nicki-minaj-275k-lawsuit-paused-attorney-withdrawal-shorts-shorts-2026-11-05.mp4` |
| Duration | 34.57s (clamped from 47.6s) |
| Resolution | 1080x1920 @ 30fps |
| Audio | AAC, 48kHz stereo |
| Contact sheet | `data/renders/3/review/nicki-minaj-review-package/contact-sheet.png` |
| QA result | **11/12 frames pass** — 1 contrast violation |
| Contrast violations | Frame 02: caption 1.18:1, headline 2.02:1 |

### 2.4 Channel 4 — Rival Lines (tactical analysis)

| Attribute | Value |
|---|---|
| Topic | Pakistan breaks 51-year ODI record vs England |
| Script | `data/research/4/pakistan-breaks-51-year-odi-record-against-england-shorts-script.json` |
| Render path | `data/renders/4/pakistan-breaks-51-year-odi-record-against-england-shorts-shorts-2026-11-05.mp4` |
| Duration | 34.53s (clamped from 40.2s) |
| Resolution | 1080x1920 @ 30fps |
| Audio | AAC, 48kHz stereo |
| Contact sheet | `data/renders/4/review/pakistan-cricket-review-package/contact-sheet.png` |
| QA result | **4/12 frames pass** — 8 contrast violations |
| Contrast violations | Frames 01,03,05,07,09,10: caption ~3.2:1, headline ~2.5:1; Frame 04: caption 1.38:1, headline 1.36:1; Frame 08: caption 2.03:1, headline 1.85:1 |

### 2.5 Channel 4 — Rival Lines (career-comparison regression test)

**NOT EXECUTED.** No fresh career-comparison video was rendered. The existing `messi-vs-ronaldo-career-shorts-shorts-2026-11-05.mp4` from the previous pipeline is a reused artifact, not a fresh rehearsal output.

---

## 3. Code Changes Made

Three source files were modified to enforce WCAG AA contrast:

### 3.1 `src/skills/remotion-render/visual-engine/directed-scene.jsx`
- `editorialColors()` now applies `ensureTextContrast()` to `text` and `textDark` return values (previously only `accentText` and `quiet` were contrast-validated).
- `DirectedScene` passes `groundColor={ed.bg}` to `CanvasVideo`.

### 3.2 `src/skills/remotion-render/visual/full-canvas.jsx`
- `themeFor()` now accepts a `groundColor` parameter and computes `isDark` from its luminance.
- `ink` color is passed through `ensureTextContrast()` against the actual ground color for both light and dark themes.
- `BeatCanvas`, `PopGroups`, and `CanvasVideo` thread `groundColor` through the component tree.

### 3.3 `scripts/frame-audit.js`
- Changed from warn-only to hard-fail: `process.exit(1)` when any frame fails the WCAG AA 4.5:1 contrast check.

### 3.4 Root cause of remaining violations
The contrast fixes address base text color but do not account for **opacity < 1.0** applied during text entrance animations (e.g., `opacity={0.6}`, `opacity={growP}`). When semi-transparent text is composited over a background, the effective color blends with the background, reducing contrast below 4.5:1 even when the base color passes. Fully fixing this requires either removing opacity from text layers or pre-darkening text colors to compensate for the opacity blend. This was not resolved before the rehearsal deadline.

---

## 4. Historical Tests (Reused Artifacts)

The following videos from the previous pipeline exist but were **not re-rendered** as part of this rehearsal:

| Video | Path | Duration | Status |
|---|---|---|---|
| ch-01 Aberfan | `data/renders/1/aberfan-60-years-books-of-remembrance-shorts-shorts-2026-11-05.mp4` | 34.11s | Reused (historical) |
| ch-02 Claude Haiku | `data/renders/2/claude-haiku-5-5-pricing-shorts-shorts-2026-11-05.mp4` | 27.95s | Reused (historical) |
| ch-03 Trump v WSJ | `data/renders/3/trump-wsj-lawsuit-dismissed-shorts-shorts-2026-11-05.mp4` | 25.94s | Reused (historical) |
| ch-04 Bayern-Dortmund | `data/renders/4/bayern-dortmund-tactical-shorts-shorts-2026-11-05.mp4` | 29.85s | Reused (historical) |
| ch-04 Messi vs Ronaldo | `data/renders/4/messi-vs-ronaldo-career-shorts-shorts-2026-11-05.mp4` | 27.46s | Reused (historical) |

These are historical artifacts from the previous mission. They were not re-rendered, re-sourced, or re-QA'd during this rehearsal.

---

## 5. Failed Tests

| Test | Failure | Evidence |
|---|---|---|
| Contrast gate — ch-1 | 2 frames below 4.5:1 | `audit-report.json` in review package |
| Contrast gate — ch-2 | 1 frame below 4.5:1 | `audit-report.json` in review package |
| Contrast gate — ch-3 | 1 frame below 4.5:1 | `audit-report.json` in review package |
| Contrast gate — ch-4 | 8 frames below 4.5:1 | `audit-report.json` in review package |

All four fresh videos fail the hard contrast gate (exit code 1 from `frame-audit.js`).

---

## 6. Blocked Tests

### 6.1 GitHub Actions Workflow

**Workflow:** `channel-production-4.yml` (Channel Production — Rival Lines ch-4)  
**Trigger:** `workflow_dispatch` with `dry_run=true`, `channel_id=4`  
**Run ID:** `42123316418`  
**URL:** https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/42123316418  
**Result:** **FAILED** (conclusion: `failure`)

**Failure detail:** The `Source Historical Images (Wikimedia Commons)` job failed at the `Download curated image pack` step. This caused downstream jobs (`Build Visual Timeline`, `Render Video (Remotion)`, `Prepare for Review`, `Technical Quality Assurance`, `Upload to YouTube (Private)`) to be skipped.

Jobs that completed before the failure:
- Environment Setup: ✓
- Script Clarity Review: ✓
- Generate Voiceover (Free EdgeTTS): ✓

Jobs that did not run (dependency on failed job):
- Build Visual Timeline: skipped
- Render Video (Remotion): skipped
- Prepare for Review: skipped
- Technical Quality Assurance: skipped
- Upload to YouTube (Private): skipped

**Blocker:** The Wikimedia Commons image download step fails, preventing the end-to-end GitHub Actions pipeline from completing. This is an external dependency issue (Wikimedia Commons API or network), not a code defect in the rendering pipeline itself.

### 6.2 YouTube Upload

**Status:** Not tested  
**Reason:** `stay_private: true` for all channels; `dry_run=true` was used for the workflow dispatch; no YouTube credentials are available in this environment. No public uploads were performed or attempted.

---

## 7. Git Safety

- `task.txt` — preserved, not modified
- `debug_creds.js` — preserved, not modified
- No force-push performed
- No schedules enabled
- All changes committed on branch `feat/unique-visual-sourcing-and-variety`

---

## 8. Final Verdict

**NOT READY FOR HUMAN REVIEW**

**Reason:** All four freshly rendered videos fail the WCAG AA contrast gate (normal text < 4.5:1, large text < 3:1 on multiple frames). The GitHub Actions end-to-end pipeline cannot complete due to a Wikimedia Commons image-download failure. Until contrast violations are resolved and the hosted workflow passes end-to-end, the production line is not ready for human review.

**Evidence:**
- 4 fresh MP4s rendered at `data/renders/{1,2,3,4}/` (all < 35s, with AAC audio)
- Frame audits at `data/renders/{1,2,3,4}/review/*/audit-report.json` document all violations
- Contrast gate script modified to `process.exit(1)` on failure
- GitHub Actions run 42123316418 failed at image-download step