# Four-Channel Production Standard

**Repository:** `lumeierecollection-blip/YOUTUBE`
**Benchmark:** Margaret Clitherow / Guy Fawkes Short — run `41739016672`, commit `647d5c59` (plus follow-up fixes)
**Applies to:** All four production channels (1, 2, 3, 4)

---

## 1. Purpose

This document is the permanent engineering standard for automated YouTube Short production across all four channels. It describes the **verified, working architecture** — the implementation that actually produced a green run — not an idealized design.

The Margaret Clitherow / Guy Fawkes rework (run `41739016672`) is the production-quality benchmark. Its visual storytelling, image-to-narration correlation, cinematic motion, narration synchronization, and technical quality define the standard every channel must meet.

---

## 2. Why the Benchmark Succeeded (Forensic Findings)

### 2.1 Previous failed runs

| Run ID | Result | Failure | Root Cause | Fix |
|--------|--------|---------|------------|-----|
| `41724257100` | Render failed | `editor asset photo-york missing on disk` | Entity resolver (`photo-york`) resolved to a Commons file that doesn't exist on disk; no historical images were downloaded into the render job | Curated visual pack + exact Commons titles + image download in render job |
| `41726459511` | Runner stall | `Install System Tools` hung ~4+ min | Unguarded `apt-get update` on cold GitHub-hosted runner | Guard apt-get behind `command -v ffmpeg` preinstall check |
| `41727191479` | Runner stall | Same apt-get stall | Same as above | Same as above |
| `41727760487` | Runner stall | Same apt-get stall | Same as above | Same as above |
| `41730030023` | Runner stall | Same apt-get stall | Same as above | Same as above |
| `41732263066` | QA failed | `Skipping QA - video or timeline not found` | Cross-job filesystems don't share files; QA job never downloaded rendered-video or timeline artifacts | `actions/download-artifact` for every cross-job input in QA job |
| `41734182998` | QA failed | `Cannot find package 'sharp'` | QA job never ran `npm ci`; `sharp` is a root dependency used by `video-qa.js` | `npm ci` in QA job |
| `41736159499` | QA failed | `missing timeline asset files: hist-01...hist-09` | `video-qa.js` validates all timeline asset files exist on disk; QA job never downloaded the historical-images artifact | `actions/download-artifact` for historical images in QA job |
| `41737592550` | Runner stall | Same apt-get stall | Same as above | Same as above |
| `41739016672` | **SUCCESS** | — | All fixes applied together | — |

### 2.2 What actually fixed the failures

1. **Curated, deterministic image sourcing** — exact Wikimedia Commons `File:` titles, not keyword search. No stand-ins, no invented images.
2. **Visual pack replaces entity resolver** — `applyVisualPack()` assigns each scene's image by sentence index, eliminating the broken `photo-york` / `resolveEntity()` path.
3. **Hard production gates** — image downloader exits non-zero if <9 images or <75% people-focused; TTS job exits non-zero on missing/invalid audio; visual-reports exits non-zero on repeats/unused/missing visuals.
4. **Cross-job artifact handoffs** — every downstream job downloads every artifact it needs via `actions/download-artifact`. Jobs never share runner filesystems.
5. **Guarded system-tool installation** — `apt-get` only runs when `ffmpeg` is not already on PATH, avoiding cold-runner stalls.
6. **npm ci in every job that runs Node code** — QA job needs `sharp`; render job needs remotion deps.
7. **Visual repetition + narration mapping reports** — generated in `build-timeline`, gate-fails on cross-sentence repeats, unused images, missing sentence visuals, or sub-75% people ratio.

---

## 3. Production Workflow Architecture

### 3.1 Job sequence (fixed order, no skipping)

```
setup
├── source-historical_images     (needs: setup)
├── generate-narration           (needs: setup)
build-timeline                   (needs: setup, source-historical-images, generate-narration)
render-video                     (needs: setup, build-timeline, source-historical-images, generate-narration)
run-quality-assurance            (needs: render-video, setup)
publish-preparation              (needs: render-video, run-quality-assurance, source-historical-images, build-timeline)
```

**Why this order:**
- `source-historical-images` and `generate-narration` are independent and run in parallel after setup.
- `build-timeline` needs both TTS (for word timings) and images (for the visual pack).
- `render-video` needs timeline + audio + images (assets staged on disk).
- `run-quality-assurance` needs rendered video + timeline + images (asset validation).
- `publish-preparation` collects all artifacts into the review package.

### 3.2 Per-job responsibilities

| Job | Inputs (artifacts downloaded) | Outputs (artifacts uploaded) | Gate behavior |
|-----|-------------------------------|------------------------------|---------------|
| `setup` | repo checkout | — | Fails if deps install fails |
| `source-historical-images` | — | `historical-images-<ch>` (manifest, provenance, attributions, hist-*.jpg/png) | **Hard-fails** if image count < required or people ratio < minimum |
| `generate-narration` | — | `tts-audio-<ch>` (mp3, srt, words.json, TTS_TOPIC + STEM names) | **Hard-fails** if audio missing, unparsable, or <5s |
| `build-timeline` | `tts-audio-<ch>`, `historical-images-<ch>` | `timeline-<ch>` (plan.json, timeline.json, transcript.json, visual-repetition-report*, narration-visual-mapping*, card-*.svg) | **Hard-fails** if visual-reports gate fails or timeline validation fails |
| `render-video` | `tts-audio-<ch>`, `timeline-<ch>`, `historical-images-<ch>` | `rendered-video-<ch>` (mp4) | **Hard-fails** if render throws or MP4 missing |
| `run-quality-assurance` | `tts-audio-<ch>`, `timeline-<ch>`, `rendered-video-<ch>`, `historical-images-<ch>` | `qa-and-contact-<ch>` (qa.json, contact.jpg) | **Hard-fails** if video-qa.js reports failures |
| `publish-preparation` | all above | `review-package-<ch>-<run>` (complete package) | Always runs if upstream succeeded |

### 3.3 Artifact handoffs (cross-job)

GitHub Actions jobs **do not share runner filesystems**. Every job that needs a file produced by another job must download it via `actions/download-artifact@v4`. The required handoffs are:

- `historical-images-<ch>` → needed by: build-timeline, render-video, run-quality-assurance, publish-preparation
- `tts-audio-<ch>` → needed by: build-timeline, render-video, run-quality-assurance, publish-preparation
- `timeline-<ch>` → needed by: render-video, run-quality-assurance, publish-preparation
- `rendered-video-<ch>` → needed by: run-quality-assurance, publish-preparation
- `qa-and-contact-<ch>` → needed by: publish-preparation

### 3.4 Environment variables (per channel)

| Variable | Meaning | Example (ch-1) |
|----------|---------|----------------|
| `CHANNEL_ID` | Numeric channel ID | `1` |
| `SCRIPT_PATH` | Path to the script JSON | `data/research/1/<topic>-shorts-script.json` |
| `STEM` | Render/output stem | `<topic>-shorts` |
| `TTS_TOPIC` | TTS/timeline stem | `<topic>-shorts-script` |
| `VISUAL_PACK` | Path to image pack manifest | `data/editor/assets/<ch>/asset-manifest.json` |
| `REQUIRED_IMAGES` | Minimum image count | `9` |
| `MIN_PEOPLE_RATIO` | Minimum people-focused ratio | `0.75` |
| `EDITOR_ENGINE` | Enable editor timeline | `1` |
| `EDITOR_STRICT` | Strict timeline validation | `1` |

---

## 4. Image Sourcing Standard

### 4.1 Curated pack (not keyword search)

The image downloader (`scripts/assets/download-historical-images.mjs`) uses an exact list of Wikimedia Commons `File:` titles. It does **not** search Commons by keyword. Each title is pre-verified for:
- Existence on Commons
- Explicit Public domain / CC0 / CC BY / CC BY-SA licence
- No trademark/personality/non-free restrictions
- Minimum dimensions (≥240×240)
- Valid JPEG/PNG magic bytes and content-type

### 4.2 Per-image metadata recorded

For every downloaded image the manifest records:
- Commons file title, page URL, download URL
- Creator, licence, licence URL, attribution string
- SHA-256 hash (for dedupe)
- Width, height, bytes, MIME type
- Sentence index (which narration sentence the image illustrates)
- Subject, kind (person/people/place), label, alt text
- Reason (why this image matches this sentence)
- Rights status and notes

### 4.3 Production gate

The downloader exits `1` if:
- Any title is missing from Commons
- Any licence is not explicit PD/CC
- Any download fails validation
- Fewer than `REQUIRED_IMAGES` unique images are downloaded
- Fewer than `MIN_PEOPLE_RATIO × 100%` are people-focused
- Any SHA-256 hash is duplicated (same image used twice)

### 4.4 People-centred requirement

When the subject is about people, at least 75% of images must be people-focused (kind: `person` or `people`). One place image is allowed for context-setting sentences.

---

## 5. Timeline & Visual Standard

### 5.1 Visual pack application

`scripts/editor/visual-pack.mjs` applies the curated image pack to the auto-built plan:
- Each scene's asset is replaced with the image for that scene's sentence index
- Only used images are staged in `plan.assets` (the renderer stages every asset and fails on missing files)
- People are framed with `fy=0.28` (higher, so faces survive 9:16 cover crop); places use `fy=0.5`
- Figure graphics that expected flat cards have `backdrop=false` so they don't paint over photos

### 5.2 Auto-timeline with visual pack

`scripts/editor/auto-timeline.mjs` accepts `--visual-pack <manifest>`. When a pack is present:
- The entity resolver is short-circuited (returns `ok: false`) — no more broken `photo-york` dependencies
- Concept photo finder is disabled
- Every scene gets its image from the pack by sentence index

### 5.3 Visual repetition report (`visual-repetition-report.json`)

Generated by `scripts/editor/visual-reports.mjs`. Gate-fails (exit 1) if:
- Any sentence has no visual
- Any pack image is unused
- Any image is used across multiple sentences (cross-sentence repeat)
- People-focused ratio < 75%

### 5.4 Narration-to-visual mapping (`narration-visual-mapping.json`)

Maps each sentence to: time span, image file, subject, kind, credit, licence, source URL, and rationale ("why this visual").

---

## 6. Rendering Standard

### 6.1 Remotion renderer

Called via `renderEditor({timelinePath, audioPath, outputPath, scale: 1})` from `src/skills/remotion-render/render-editor.js`. The timeline is the single source of truth: what is in it is drawn, what is not is not.

### 6.2 Output format

- 1080 × 1920 (9:16 Shorts)
- H.264 video, AAC audio
- CRF 20, concurrency 2
- Output: `data/renders/<ch>/<STEM>-rework.mp4`

### 6.3 Render gate

Fails if:
- Audio file missing
- Render throws
- MP4 not produced

---

## 7. QA Standard

### 7.1 Technical QA (`video-qa.js`)

Measures the exported MP4 against the timeline:
- Video stream present (H.264)
- Audio stream present (AAC)
- Duration drift ≤ 1.0s
- Resolution matches timeline aspect
- No missing timeline asset files on disk
- All assets have credit and source_url
- No black frames
- Mean motion > 0.05 (not static)
- Longest static run ≤ 4.0s
- ≥80% of seconds have visible image/SVG
- ≤1 second text-only
- Caption cues valid, with word timings
- Contact sheet generated

### 7.2 Visual QA (repetition + mapping reports)

Gate-fails on repeats, unused images, missing visuals, or sub-75% people ratio.

### 7.3 QA job dependencies

The QA job must download: `tts-audio`, `timeline`, `rendered-video`, `historical-images` artifacts, and run `npm ci` (for `sharp`).

---

## 8. Review Package

`publish-preparation` collects all artifacts into `review-package-<ch>-<run>`:
- MP4, thumbnail, TTS audio + word timings
- Historical images + provenance + attributions
- Timeline JSON + visual reports + narration mapping
- QA JSON + contact sheet
- `REVIEW_SUMMARY.md`

---

## 9. Failure Recovery

- No silent fallbacks. Every gate exits non-zero on failure.
- No placeholder audio, no invented images, no reused images across sentences.
- A failed job stops the pipeline; downstream jobs are skipped.
- Artifacts are uploaded with `if: always()` so failed runs still produce diagnostic artifacts.
- Concurrency group per ref prevents overlapping runs from corrupting each other.

---

## 10. Dependencies

| Dependency | Purpose | Where installed |
|------------|---------|-----------------|
| Node 24 | Runtime | All jobs (`actions/setup-node@v4`) |
| `npm ci` | JS deps (remotion, sharp, etc.) | setup, build-timeline, render-video, QA, publish-preparation |
| ffmpeg | Audio probe, image conversion, frame extraction | setup, generate-narration, build-timeline, render-video, QA (guarded) |
| Google Chrome | Remotion rendering | setup, render-video (`browser-actions/setup-chrome@v1`) |
| Python + edge-tts | TTS synthesis | setup, generate-narration (`pip3 install edge-tts`) |
| `bc` | Duration comparison in shell | generate-narration |
| `jq` | JSON display in logs | QA job |
| `poppler-utils` | PDF handling (if needed) | setup |

---

## 11. Implementation Rules

1. **No keyword image search** — exact Commons titles only.
2. **No silent fallbacks** — missing asset = hard failure.
3. **No placeholder audio** — TTS must produce real, valid MP3 >5s.
4. **No cross-sentence image repeats** — enforced by visual-repetition-report.
5. **No unused pack images** — every downloaded image must be used.
6. **≥75% people-focused** for people-centred subjects.
7. **All cross-job files via artifacts** — jobs never share filesystems.
8. **npm ci in every Node job** — ensures `sharp`, remotion, etc. are present.
9. **Guarded apt-get** — only when ffmpeg is missing.
10. **Timeline is the single source of truth** — renderer draws exactly what's in it.

---

## 12. Channel-Specific Configuration

Each channel retains its own identity via `config/channels.json`:
- `channel_id`, `channel_name`, `handle`
- `niche`, `style`, `tone`, `description`
- `tts_voice`, `font`, `colors`
- `visual_spec` (b-roll sources, camera angles, pacing, transitions)
- `script_template` (hook type, section count, reveal placement, closing type)
- `stay_private`, `skip_thumbnail_upload`
- `youtube_credentials_path`
- `editor_look` (1-5)
- `niche_rules`, `niche_blocklist`

The shared production engine reads channel config for voice, fonts, colors, and style, but the pipeline structure, gates, and QA requirements are identical across all four channels.
