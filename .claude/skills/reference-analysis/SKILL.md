---
name: reference-analysis
description: Analyze a reference video (research/*.mp4, data/reference/style.mp4) into measured cuts/cadence/audio, timestamped contact sheets and a creative-direction doc. Use before stating anything about how a reference looks, paces or sounds.
---

# Reference analysis

Run:

```
node scripts/reference/analyze-reference.mjs <video> [--mode standard|dense] [--dense a-b] [--no-vision] [--force]
```

Output goes to `data/reference/analysis/<basename>/` (details: `docs/REFERENCE-ANALYSIS.md`). Disk is slow here: a
79 s video takes about 3 minutes; cached stages are skipped on re-run.

Rules:

1. Open the `contact-*.jpg` sheets it produced (Read tool) before saying anything about the reference. Tiles are
   labelled `<frame id> mm:ss.ss`; cite those ids.
2. Cuts, cadence, loudness and cue times in `scenes.json` / `audio.json` are measurements; quote them, do not re-estimate.
3. `direction.json` qualitative fields exist only if `direction.status` is `complete` (vision runs in CI:
   workflow `reference-analysis`). If it is `measured-only`, say so; do not fill the gap from memory.
4. Every observation must cite frame ids that were sent (`frames_sent`); rejected ones are in `rejected_observations`.
5. Colour in the doc is observation only; colour lives in `config/channels.json`.
6. For a closer look at a moment, rerun with `--mode dense --dense 12.5-18`.
