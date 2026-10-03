# SFX palette — credits

The DirectedShorts palette: the four files at the top of this directory,
fired only by the trigger table in `visual/sound-design.js`
(`semanticSfxEvents`). All CC0. Built 2026-09-27; the only edits are an
MP3 conversion (44.1 kHz stereo, 160 kbps) and, for impact.mp3, a trim.
(MP3 encoding adds about 50 ms of padding to each file's reported duration.)

| File | Length (source) | Source file | Pack / author | Source URL | License |
|---|---|---|---|---|---|
| impact.mp3 | 0.32 s (trimmed from 0.51 s, 80 ms fade-out) | impactSoft_heavy_000.ogg | Kenney — Impact Sounds 1.0 | https://www.kenney.nl (pack in repo: src/audio/kenney_impact/, License.txt) | CC0 1.0 |
| reveal.mp3 | 0.54 s | confirmation_002.ogg | Kenney — Interface Sounds | https://www.kenney.nl (pack in repo: src/audio/kenney_interface/, License.txt) | CC0 1.0 |
| number-count.mp3 | 0.05 s | tick_004.ogg | Kenney — Interface Sounds | https://www.kenney.nl (src/audio/kenney_interface/) | CC0 1.0 |
| whoosh.mp3 | 0.20 s | swish-9.wav | "Swishes Sound Pack" by artisticdude | https://opengameart.org/content/swishes-sound-pack (downloaded 2026-09-27) | CC0 1.0 |
| sub-drop.mp3 | — | **not included** | — | — | — |

Why these files, measured with ffmpeg instead of picked by name:
- impact: almost all its energy is below 200 Hz (mean −17.6 dB low-passed
  vs −17.4 dB full band) — a soft low thud, not a boom.
- reveal: one tone, 0.54 s, no low end (−45 dB below 200 Hz) — a soft
  chime, not a bell (the `impactBell_*` files were not used).
- number-count: 0.05 s — a tick, not a typewriter.
- whoosh: 0.20 s, the shortest light swish in the pack. Kenney has no
  whoosh; `maximize_*` is a UI sweep and was not used.

**sub-drop.mp3 is missing.** No CC0 sub-drop / low sine sweep was found
(OpenGameArt searched; Pixabay and Mixkit are not CC0, and a synthesised
sweep would break CLAUDE.md's "no sound effect that didn't come from an
actual source" rule). Nothing references it, since the trigger table has no
sub-drop row. See data/ci-runs/blocked-fix5-sub-drop.txt.

**Deviation from the brief:** it named Pixabay or Mixkit, CC0 only.
Neither license is CC0, so the CC0 requirement won; Kenney and OpenGameArt
supplied the files.

The rest of this directory (ambient/, cinematic/, emphasis/,
interface-kenney/, transitions/ …) is the OLDER library used by the
legacy MotionGraphics path (still the longform fallback). It was kept, not
deleted, because that path still references it. Note that `ambient/` holds
two `mixkit-*` files; Mixkit's license is not CC0.

## Part-D palette (2026-10-03)

The full-canvas renderer's six roles (`visual/canvas-sfx.js`), reusing the files above
where one already existed (no duplicates downloaded):

| Role | File | Level | Source |
|---|---|---|---|
| pop | pop.mp3 (NEW) | -18 dB | `drop_001.ogg`, Kenney — Interface Sounds (src/audio/kenney_interface/, CC0 1.0). MP3 conversion only; 0.13 s. |
| number-roll | number-roll.mp3 (NEW) | -16 dB | `tick_002.ogg`, Kenney — Interface Sounds (CC0 1.0), sequenced: 8 copies 50 ms apart, gain 1.0 -> 0.51, trimmed to 0.37 s. An edit of a sourced file (like impact.mp3's trim), not a synthesised sound. |
| whoosh-soft | whoosh.mp3 | -22 dB | above (OpenGameArt swish-9, CC0) |
| tick | number-count.mp3 | -20 dB | above (Kenney tick_004, CC0) |
| chime | reveal.mp3 | -14 dB | above (Kenney confirmation_002, CC0) |
| impact-low | impact.mp3 | -12 dB | above (Kenney impactSoft_heavy_000, CC0) |

The brief named Kenney or Mixkit: Kenney (CC0) was used; Mixkit's licence is not CC0.
