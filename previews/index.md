# Production preview index

Rebuilt 2026-11-09T12:40:55.922Z. Updated when a stage finishes; this is not a live stream. MP4s are in each run's GitHub Actions artifact.

| Channel | Agent | Stage | Status | Updated | Branch @ commit | MP4 | Contact sheet | Scenes | Voice | Script | Scene plan | QA | Last success | Outstanding |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| _smoke | lead-architect | finished | ok | 2026-11-09T12:20:10.397Z | preview/_smoke @ 39c0dbd7 | [run artifact](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/42615900359#artifacts) | [contact-sheet.jpg](_smoke/run-42615900359-1/contact-sheet.jpg) |  | [voice-preview.mp3](_smoke/run-42615900359-1/voice-preview.mp3) |  |  | [qa-report.json](_smoke/run-42615900359-1/qa-report.json) | 2026-11-09T12:20:10.397Z |  |
| ai-tested | agent-ai-tested | failed | failed | 2026-11-09T12:40:55.464Z | preview/ai-tested @ aa283e10 | [run artifact](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/42618793581#artifacts) |  |  |  |  |  |  | none | edge-tts --voice en-US-AndrewNeural --rate=+5% failed (exit 1) |
| gray-matter | agent-gray-matter | voice_complete | running | 2026-11-09T12:36:30.959Z | preview/gray-matter @ ab073dd5 | [run artifact](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/42618187073#artifacts) |  |  | [voice-preview.mp3](gray-matter/run-42618187073-1/voice-preview.mp3) | [script-draft.md](gray-matter/run-42618187073-1/script-draft.md) |  |  | none |  |
