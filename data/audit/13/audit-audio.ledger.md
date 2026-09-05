# AUDIT-AUDIO LEDGER — Stage 13 (Audio lane)

Lane: `audit-audio` · Stage: 13 (SFX-map / gains / LUFS / audio-sync) · Built: 2026-08-29
Owner of record: this lane owns `src/skills/remotion-render/audio.js`, `visual/sound-design.js`, `visual/sfx-library.js`, `data/audit/**`. Nothing else was edited (all changes here are probes/reports inside `data/audit/13/`).
Compliance: CROSSCHECK-PROTOCOL.md Part 2 three-phase protocol; register IDs from CHECK-REGISTER.md §0.3 only. No register row, spec doc, or spec text was treated as evidence — everything below is measured or sourced.

---

## 0. Machine state (why some checks end UNVERIFIABLE — stated plainly)

- Rendering is impossible here: `@remotion/renderer`, `@remotion/bundler` and compositor packages are not installed (only `@remotion/captions@4.0.503` + the `remotion`/`esbuild` core were `npm install --no-save --ignore-scripts`'d for import smoke tests); the vendored compositor is linux-only. No rendered MP4 exists anywhere in the repo.
- EdgeTTS needs a WebSocket the sandbox proxy does not carry → no real TTS output on this machine. `src/skills/remotion-render/vo.mp3` EXISTS on disk but only as the **silent placeholder** (1,168,865 B — byte-identical to the encoding lane's staged `debt-snowball-shorts-vo.mp3`; `audio.js` bundles it via the `./vo.mp3` static import, and `render.js` `stageAudio` overwrites it with real TTS at render time). `public/music/underscore.mp3` does not exist.
- The only `.mp3` that looks like a VO in the whole repo (`data/audit/14/measure/debt-snowball-shorts-vo.mp3` — the same bytes as repo `vo.mp3`) measured **73 s, 128 kbps, peak −1.93 dBFS from a handful of transients, RMS −58.2 dBFS, ~0.000 nonzero-sample ratio** — a near-silent placeholder, not speech. It cannot evidence real TTS peaks.
- Consequence: every verdict below that needs a rendered/audible artifact carries a named limit. **No verdict was invented to fill that gap.**

---

## PART A — Inputs read (all listed before use)

| Input | What it proves |
|---|---|
| `CHECK-REGISTER.md` rows 304–311 (AUD-01..08), 474 (VIS-16) | the claims to verify, verbatim |
| `src/skills/remotion-render/compositions/mg-package.js` (L503–553 `markReveal`/`parseRevealTarget`/`computeSilenceWindow`, L559+ `buildMgPackage`, L742–799 soundtrack/silence/return) | where the soundtrack gate lives |
| `src/skills/remotion-render/compositions/beats.js` (L1036–1102 `buildAuthoredBeats`, L985–1034 authored-beat assembly) | beat pipeline + word-count gate |
| `src/skills/remotion-render/compositions/motion-graphics.jsx` (L425–448 `SoundEvent`/`Soundtrack`, L1224–1225 underscore/VO `<Audio>` mounts) | how events play back |
| `src/skills/remotion-render/audio.js` (9 lines) | VO = static import of `./vo.mp3`, played at unity |
| `src/skills/remotion-render/render.js` (L230–231 `stageAudio`) | VO staged by copy, no gain |
| `src/skills/remotion-render/visual/sound-design.js` (L34–47 caps, L82+ `ROLE_TARGET_DB`, L117+ `STATE_SOUND_MAP`, L199+ `volumeFor`) | the SFX map (owned) |
| `src/skills/remotion-render/visual/sfx-library.js`, `src/audio/sfx-library.measured.json`, `src/audio/sfx-manifest.json` | the library + measured levels + license log |
| `src/skills/remotion-render/qa-scripts/render-visual-tests.sh`, `make-fixture-srt.mjs`, `verify-compositions.js` | the QA shell's exact call shapes |
| `data/research/2/google-location-history-chatrie-ruling-shorts-script.json`, `qa-scripts/fixtures/{finance-accumulation,tech-process}.fixture.json`, `data/scripts/ch-fixture/movile-cave-shorts-script.json`, `data/tts/ch-fixture/movile-cave-shorts-script-vo.srt` | probe inputs |
| `config/channels.json` (all 17 channels; mg channels ch-01/02/09/26/44/48 with `sfx_profile.silence_technique`, `script_template.reveal_placement`, `icon_map`) | the channel config the QA shell passes |
| `src/utils/script-narration.js` (`narrationSections`) | the hook-fold both `render.js` and `make-fixture-srt.mjs` apply |

## PART B — Probes run (runnable, kept in this directory)

| Probe | What it drives | Headline result |
|---|---|---|
| `probe-audio-schedule.mjs` | the REAL `buildMgPackage()`/`buildSoundtrack()` code over the QA shell's exact inputs (3 fixtures/real scripts with make-fixture-generated SRTs + real channel config + the movile-cave real-SRT pair) | Full JSON in `schedule-report-v3.json`; see PART C/D |
| `probe-sfx-measure.mjs` | layer-2 remeasure of every library file against the measured manifest (system ffmpeg decode, RMS/peak/duration, byte compares) | 26/26 present · 0 byte mismatches · 0 beyond tolerance |
| `probe-vo-levels.mjs` | the only VO-sized file in the repo | near-silent placeholder (see §0) |

Process notes (probe bugs found and fixed, numbers below are from the FIXED probes):
1. First probe version passed RAW `script.sections` to `buildMgPackage`; `render.js` L145 applies `narrationSections(script)` (hook folded into section 1) and `make-fixture-srt.mjs` folds identically — without the fold, the word-count gate at `beats.js` L1051 rejects the whole video and the soundtrack degrades to `[]` (this is the trap that made the schedule look silent). Fixed; re-ran.
2. First version's `channelFor` compared `"ch-01"` to `"1"` and never matched (same bug `run-visual-tests.js` L745 documents for itself) → channel/`reveal_placement`/`silence_technique`/`icon_map` were dropped. Fixed (matches `channel_id` or numeric `id`); re-ran.

## PART C — Research (Phase 1) — licenses and loudness, fetched/searched only

- **Kenney CC0**: kenney.nl/support — "all game assets on the asset pages are public domain licensed (CC0)… free to use, even in commercial projects" (fetched 2026-08-29). On-disk `public/sfx/interface-kenney/LICENSE.txt` and `src/audio/kenney_interface/License.txt` both say "free to use in personal, educational and commercial projects". Mirror `github.com/Calinou/kenney-interface-sounds` is CC0 Universal per its repo.
- **Mixkit**: mixkit.co/free-sound-effects/ FAQ — "you can use Mixkit Sound Effects for commercial and personal projects… including… YouTube" (fetched 2026-08-29); mixkit.co/license/ — the SFX licence text sits behind a "View License" toggle (named, not papered over). Mixkit is Envato-owned (footer). → the 2 transition `.mp3`s are monetisation-OK.
- **YouTube loudness** (context for AUD-07, not the claim itself): 2026 secondary sources all say YouTube normalises to **−14 LUFS integrated** (gearnews 2026-07-16; peasycss 2026-03-09; production-expert 2026-05-08; lordreverb 2026-05-13 — all found via this session's websearch). The "official" support.google.com/youtube/answer/10713725 page **404s**; an adjacent official page (answer/16619284, "Video & audio quality enhancements" — Stable volume/Voice boost) does not state the −14 figure. Official-page gap recorded honestly.

## PART D — Per-check verdicts (Phase 2 + 3)

### AUD-01 — Sound triggered by a visual event, every event explainable — RE-VERIFIED: CONFIRMED (schedule level)
- Reproduced the PASS record's own numbers on the same inputs: **ch-01 finance fixture = 9 events / 5 beats**, **ch-48 process fixture = 12 events / 5 beats**, both with `usedAuthoredBeats: true`, `synthesized: false`. (Register row 304 says "9/9 events present" and names no per-beat breakdown; the 9 and 12 counts are THIS audit's measurements of the same QA inputs, consistent with that PASS.)
- Every event carries a `reason` string describing the visual state that fired it ("the pile resolves into a total", "the search boundary grows outward"). Classification of all **36** scheduled events (9+12+15): **26 STATE_START + 10 TEXTURE_TICK, 0 OTHER** (schedule-report-v3.json `classification`/`anchorCheck`).
- AUD-01's audibility claim ("measured RMS within 0.1–2.3 dB of each event's target" in the mp4) cannot be re-measured here (no mp4). Its underlying level math IS re-verified in AUD-04 (every event's volume lands its file exactly on the role target; spot-check below). Named limit — the schedule half of AUD-01 stands on this run's own numbers; the audible-in-cut half stands on the register's artifact + this file-level re-verification.

### AUD-02 — "≤1 SFX per beat" — **FAIL as written; the live source deliberately ships up to 3/beat** → SPEC AMENDMENT SFR (register owner)
Measured (schedule-report-v3.json):
| input | beats | events | beats with >1 event | max/beat | gap floor |
|---|---|---|---|---|---|
| ch-01 finance | 5 | 9 | **4/5** | 3 | 12 f (18 f tightest) |
| ch-48 tech-process | 5 | 12 | **5/5** | 3 | 12 f (15 f tightest) |
| ch-02 chatrie (real gate-passed script) | 8 | 15 | **6/8** | 3 | 12 f (32 f tightest) |

- The cap is a named constant: `sound-design.js` L44 `MAX_EVENTS_PER_BEAT = 3`, L47 `MIN_GAP_FRAMES = 12`, and the module's own header (L34–44) says the caps exist to stop a "click click click whoosh click" texture — i.e. ≤3-with-spacing IS the design intent, not a drift.
- Nothing in the register quantifies events-per-beat on the PASS side: row 304 records "9/9 events present" with no per-beat figure and row 474 records "PASS - 0 AUD-* warnings on all 3"; the >1-event-per-beat reality is demonstrated by THIS audit's own measurements of the QA inputs (above) and by the PASS record's bare 9 events across 5 beats being incompatible with a ≤1 threshold. Row 305 "≤1 SFX per beat · status N/B" is the contradiction — it has never matched what the compiler does or what the pass evidence counted.
- Veto per protocol: live source wins → propose amendment (exact block in SFR-1). No code change requested: the implementation already enforces its own documented caps (3/frame-gap-12/no-immediate-repeat), and tightening to 1/beat would gut the texture ticks that PASS renders provably ship.

### AUD-03 — SFX fires on the visual-land frame, not the word — CONFIRMED
- `soundEventsForBeat` keys off each beat's `visualStates`; `SoundEvent` mounts `<Sequence from={event.atFrame}>` with the exact same frame number the scheduler emitted (motion-graphics.jsx L431–434).
- `anchorCheck` (schedule-report-v3.json): **26 of 36** events sit at localDelta = 0 of their state's start frame (STATE_START); the remaining **10** are TEXTURE_TICK grid ticks at 6–78 f offsets inside a single repeatable state (measured: 6, 9, 14, 15, 16, 42, 44, 47, 69, 78). Zero events on narration word timings; zero `OTHER`.

### AUD-04 — Gains match the SFX map — CONFIRMED (schedule + file level)
- Layer 1 (probe recomputes the map independently): `volViolations: 0`, `targetViolations: 0`, `missingFiles: 0` across all 36 events; max event volume **0.468** — nothing ever boosts to unity (VIS-16's "never boosted" holds).
- Level math exactness (spot-check): pluck_002 measured mean −22.2 dB · vol 0.407 → −22.2 − 7.8 = **−30.0 dB = `emphasis` target** ✓; tick_004 −15.9 dB · vol 0.079 → −15.9 − 22.05 = **−37.95 ≈ −38 = `texture` target** ✓. Every role resolves to its `ROLE_TARGET_DB` entry.
- Layer 2 (remeasure): 26/26 files exist under `public/sfx/`, **0 byte mismatches** vs `sfx-library.measured.json`, mean/peak within 0 dB, duration within 8 ms (wav) / 60 ms (ogg/mp3 — the two mp3s measured −29/−39 ms within tolerance; lossy-padding expected, not a sync defect).
- The "dB-vs-target-noise" residual lives only in an mp4 cut → named limit (with AUD-01).

### AUD-05 — Every SFX file is local, never a remote URL — CONFIRMED (blocker cleared)
- `grep https` across `audio.js`, `visual/sound-design.js`, `visual/sfx-library.js`: **0 hits**.
- `motion-graphics.jsx` `<Audio>`/`<SoundEvent>` sources are all `staticFile()` local paths (`sfx/interface-kenney/*.wav`, `sfx/transitions/*.mp3`, `sfx/emphasis/*.ogg`, `music/underscore.mp3`, `vo.mp3`).
- The 3 `https://` in `sfx-manifest.json` are provenance/attribution records (kenney.nl ×2, mixkit.co) — never loaded at render time.

### AUD-06 — Every file's licence permits monetised use — CONFIRMED (blocker cleared)
- 26/26 files carry a licence record **in `visual/sfx-library.js` + `src/audio/sfx-library.measured.json`**: 22 Kenney Interface CC0 + 2 Kenney Impact CC0 + 2 Mixkit Free. Kenney: CC0, commercial OK (PART C). Mixkit: commercial + YouTube OK per mixkit's own FAQ (PART C).
- **Manifest correction (counter-check):** `src/audio/sfx-manifest.json` is NOT the per-file licence log. It is a pack *catalog* (`total_sounds: 20`, `last_updated 2026-07-27`, per-source `files_count` 100/130/5000, category example entries such as `mixkit-fast-whoosh.mp3`) that names only 2 of the 26 library files and includes example names that are NOT library assets. It pre-dates the 26-file library; recompute/retire decision left to its owner (SFR-4).
- Minor durability gap (not a blocker): only the interface-kenney pack carries an on-disk `LICENSE.txt` next to the files; impact-sounds and mixkit licenses live only in the manifest + their sites. Optional SFR suggested (SFR-3), no code behaviour change.

### AUD-07 — Master is −14 LUFS integrated (±0.5) on a real render — UNVERIFIABLE here
- Requires `ffmpeg ebur128` on an actual render + real VO; neither exists on this machine (PART 0). Not failed — named unverifiable. Context: 2026 sources confirm YouTube's own playback normalisation to −14 LUFS (PART C) — that is YouTube's target for the FILE it serves on, not evidence about this pipeline's render.

### AUD-08 — VO peaks ≤ −3 dBFS — UNVERIFIABLE here
- The render plays VO at unity by design (`audio.js` static import → `<Audio src={currentAudio}/>`, no volume prop; `render.js` `stageAudio` copies without gain), so a render's VO peak equals the TTS file's own peak. The only VO on disk — repo `vo.mp3` / lane-14's staged copy (same bytes) — is the silent placeholder (PART 0), so no real TTS peak has ever been measurable on this machine. No source evidence either way → **UNVERIFIABLE**. If a production render's VO ever measures above −3 dBFS, the fix belongs to the render pipeline (a limiter/gain stage) — SFR-ready, not this lane's file.

## PART E — Changes & SFRs (exact diffs)

Owned-file changes: **none** (this lane's work is probes + this report, all inside `data/audit/13/`).

### SFR-1 — [register owner] amend AUD-02 (contradicts live source; pass evidence cannot satisfy ≤1)
Old row 305:
```
| AUD-02 | ≤1 SFX per beat | compiler | ≤1 | 1 | MINOR | 13 | N/B |
```
New row (exact replacement):
```
| AUD-02 | ≤3 SFX per beat, ≥12 frames apart, each explainable | compiler (`MAX_EVENTS_PER_BEAT`, `MIN_GAP_FRAMES`) | ≤3, gap≥12 | 1 | MINOR | 13 | FAIL→amended 2026-08-29 (stage 13). The ≤1 threshold never matched the compiler: `sound-design.js` ships `MAX_EVENTS_PER_BEAT=3`/`MIN_GAP_FRAMES=12` as documented design, and the PASS record is incompatible with a ≤1 cap — row 304's own "9/9 events present" counts 9 events across 5 beats. Stage-13 measurement of the QA inputs: 9 events/5 beats (ch-01), 12 events/5 beats (ch-48), 15 events/8 beats (ch-02 real script); beats with >1 event = 4/5, 5/5, 6/8; max 3; tightest actual gap 15 f. Texture ticks repeat inside one audible state by design; non-repetition events land exactly on visual-state start frames |
```

### SFR-2 — [render lane] `qa-scripts/fetch-sfx-library.mjs` L323 stale license path (the file it names does not exist; the real one does)
Old L323 (within the generated-header template):
```
 * committed at src/audio/kenney_interface_sounds_1.0/LICENSE.txt.
```
New:
```
 * committed at src/audio/kenney_interface/License.txt.
```
Verified on disk: `src/audio/kenney_interface/License.txt` exists; `src/audio/kenney_interface_sounds_1.0/LICENSE.txt` does not. Comment-only; no behaviour.

### SFR-3 — OPTIONAL (no owner required): place the impact-sounds and mixkit licence texts next to their file packs under `public/sfx/` (durability mirror of the manifest records; the manifest + websites already satisfy the monetisation rule).

### SFR-4 — [owner of `src/audio/sfx-manifest.json`] the file is a stale design catalog, not an index of the shipped library: `total_sounds: 20`, `last_updated 2026-07-27`, includes example entries that are not library assets (`mixkit-magic-whoosh.mp3`, `click_001-005.ogg`, `impactBell_*.ogg`) and names only 2 of the 26 library files. Recompute it from `visual/sfx-library.js` (its `file`/`source`/`license` fields are the real per-file log) or relabel it as a design catalog in its header so nobody treats it as the license inventory.

### Observation (no fix requested, not this lane's file): `public/music/underscore.mp3` exists nowhere in the repo, so `hasUnderscore` is false here and any current motion-graphics render plays VO+SFX only; `config/channels.json` `sfx_profile.music_style` currently has no backing asset on disk. The encoding lane's `remotion.config.js` deletion and these audio facts belong to the render/encoding lanes' own audits — listed here only so they aren't re-discovered.

## PART F — Counter-check relay (verify-independent, 2026-08-29)
Dispatched after the ledger draft with claim cards C1–C6 and artifact pointers. Verdicts received + corrections applied as a direct result:

| Claim | Verdict | Corrections this lane made (all marked in the text above) |
|---|---|---|
| C1 AUD-02 | PARTIAL | (a)/(b) confirmed (cap constants + measured 4/5, 5/5, 6/8 beats). (c) my register citation was wrong — "12 events/5 beats" is in NO register row (row 474 says "0 AUD-* warnings on all 3"; row 304 says only "9/9 events present"); rewritten to rely on measured numbers, not invented citations. |
| C2 AUD-01 counts | PARTIAL | Reproduction confirmed (9/12/15 events). Defect: total is **36**, not 35 — fixed throughout. Also "matches register's '12 events/5 beats'" removed. |
| C3 AUD-03 | CONFIRM | anchorCheck exact; scheduler keys only off visualStates (narration-word timing unreachable by construction); `<Sequence from={event.atFrame}>` same frame. |
| C4 AUD-05 | CONFIRM | 0 https hits in audio.js/sound-design.js/sfx-library.js; 3 attribution URLs in sfx-manifest.json only; runtime loads all `staticFile()`. |
| C5 AUD-06 | PARTIAL | Monetisation conclusion confirmed by first-party sources (kenney.nl/support CC0 commercial; mixkit FAQ YouTube OK). Defect: `sfx-manifest.json` is NOT the 26-entry license log — corrected (AUD-06 text + new SFR-4). |
| C6 AUD-08 | PARTIAL | Unity-playback chain confirmed; placeholder status confirmed (73.13 s corroborated by encoding lane's own manifests). Defects fixed: (a) dBFS figures now persisted as an artifact — `probe-vo-levels.mjs` writes `vo-levels-report.json`; (b) ledger's "vo.mp3 does not exist" was wrong — it exists as the placeholder (fixed in §0/AUD-08). |

Counter-check also surfaced: `src/audio/*/License.txt` + `.url` files contain `http://` provenance links (text records, not runtime loads — no AUD-05 impact; noted).

## PART G — Standing limits (not papered over)
- No rendered MP4 / compositor / EdgeTTS → AUD-07, AUD-08 and the audible half of AUD-01 remain unverifiable on this machine; the venue for those is a production render + `audio-qa.mjs`.
- Mixkit SFX licence text is only reachable via the site's toggle; recorded as fetched via FAQ + license page.