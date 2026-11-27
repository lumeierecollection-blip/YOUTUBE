---
name: rival-lines-audio
description: Choose, mix and gate the music beds and sound effects for a Rival Lines (football) episode, and re-run the reference-video audio analysis behind them. Use when adding or changing a Rival Lines soundtrack, picking a bed for a new episode, or refreshing the reference audio library. It never claims a sound was listened to.
---

# Rival Lines audio

Everything lives under `channels/rival-lines/`. It plugs into the existing episode pipeline (`build-plan.mjs` then render then `finish.mjs`) and is not a second renderer.

## What exists and what it is based on

- `data/rival-lines/audio-library/` is the catalogue built from the reference videos (playlist, track occurrences, unidentified music, sound-effect inventory, audio design analysis). It records identity and availability only. No reference audio and no transcript is stored in the repo.
- The numbers behind it (music level in speech gaps, tempo, section changes, sound-effect candidates) come from `channels/rival-lines/audio/analyze.py`, `asr.py` and `shazam_scan.py`, run locally because YouTube blocks GitHub runners. They are measurements and heuristics. No one has listened to any of it.
- Song identification comes from Shazam clips and creator credits. A single hit under narration is low confidence. A hit that contradicts a creator's own credit is flagged, not trusted. Credited tracks (for example Anno Domini Beats on Paper Pitch) are recorded as credited, not as audio-verified, and their reuse terms are not verified.

## Choosing a soundtrack for an episode

1. `node channels/rival-lines/scripts/build-plan.mjs <episode_dir>` so `out/props.json` exists.
2. `node channels/rival-lines/scripts/pick-audio.mjs <episode_dir>` writes `out/soundtrack.json`.
   - Narrative fit first. Each chapter title maps to a role (hook, evidence, model, caveat, resolve) in `audio/selection-rules.json`. Chapters group into at most three acts. Each act gets the licensed track whose measured tempo, energy, tension and arc are closest to that act's target.
   - No random choice. The same episode, library and usage log give the same answer.
   - Variety comes from `audio/usage-log.json`. A track used in the last episode, used before, or by the same creator as another bed in this episode is penalised. Add `--record` only for an episode that will publish.
   - Beds change only on chapter starts. Licences are limited to CC0, public domain and CC BY.
   - Sound effects come only from the CC0 palette in `scripts/sfx-cc0.mjs`, one per visual event (chapter start, photo placed, collage, first curve in a chapter, icon limit). Caps: 4 per minute, 6 seconds apart.
3. `node channels/rival-lines/scripts/mix-audio.mjs <episode_dir>` downloads the beds from their licensed source into the OS temp dir, mixes (voice -16 LUFS, bed attenuated and sidechain-ducked, effects by delay, final two-pass loudnorm -14 LUFS / -1.5 dBTP) and writes `out/mix.mp3` and `out/mix-report.json`.
4. `node channels/rival-lines/scripts/gate-soundtrack.mjs <episode_dir>` runs AUD-10 to AUD-16 (bed count and repeats, licence and attribution fields, coverage and chapter alignment, effect density and spacing, effect provenance, loudness). `STRICT_LICENCE=1` makes an unverified licence a failure.
5. Re-run `build-plan.mjs`. It uses `out/mix.mp3` when present, so the render carries the mix. The workflow `.github/workflows/rival-lines-episode.yml` does all of this on the `[render]` path.
6. Put every bed's `attribution` line (in `out/soundtrack.json` under `credits`) into the video description.

## Before the first public episode

- Open each chosen bed's own source page and confirm the licence. The index data is from 2022. Then set `licence_verified_at_source` to true for that track in `audio/tracks_manual.json`.
- Listen to the mix. The loudness is measured, the taste is not. Known weak spot: the library is mostly calm or cinematic, so the resolve act can only get an approximate fit.
- A bed shorter than its act loops with a plain repeat (flagged `loops` in the plan). Prefer a longer track when one fits.

## Refreshing the reference analysis

Run on a machine with `yt-dlp`, `ffmpeg`, `librosa`, `faster-whisper` and `shazamio`: `fetch.py` (audio and metadata per reference), `asr.py` (word timestamps, kept local), `analyze.py` (levels, tempo, sections, effect candidates), `shazam_scan.py` (12-second clips; run sequentially, one client per call, because concurrent calls on a shared client time out), `measure_licensed.py` (licensed candidates), then `build_library.py <work_dir> data/rival-lines/audio-library`. Commit derived data only. Never commit reference audio, full transcripts or contact sheets.

## Rules that do not bend

- No song, effect or credit that was not found in a real source. Unidentified music stays unidentified, described by genre, mood, tempo and instrumentation.
- Never redistribute a copyrighted song. Catalogue identity and availability only.
- Do not merge to `main` without explicit confirmation.
