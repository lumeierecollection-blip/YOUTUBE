"""Writes docs/longform/SOUND-DESIGN-RESEARCH.md from measured data and the observations in notes_p3b.md. No listening claims."""
import json
from docs_common import *
qa = json.load(open(os.path.join(REPO, "config", "longform-audio-qa.json"), encoding="utf8"))["assets"]
lib = json.load(open(os.path.join(REPO, "config", "longform-audio-library.json"), encoding="utf8"))["assets"]
nflag = lambda k: sum(1 for v in qa.values() if not v.get("error") and any(k in f for f in v["machine_flags"]))
imp = {}
for r in A:
    a = json.load(open(os.path.join(HERE, "a3", r["id"], "audio.json"), encoding="utf8")); imp[r["id"]] = len(a.get("impact_candidates_s") or []) / (r["analysed_s"] / 60)
L = ["# Sound design research (Phase 3)", "",
     "## 0. Status, stated plainly", "",
     "- **No one has listened to anything in this research.** The model that did the analysis cannot hear. Everything below is measurement (loudness, spectrum, timing), pictures of the audio (spectrograms) and licence checking. Where the directive asks for a listening review, the review is **not done**: it has been prepared for a person (`output/longform-audio-demo/audition-reel.mp3`, `audition-index.json`, and the listening record table in `SOUND-LIBRARY-REGISTER.md`).",
     "- A waveform or spectrogram cannot tell which sound it shows. Observations are of shape (sustained low band, narrow tone, gaps near silence); they are not identifications.",
     "- Reference audio was measured for **how** videos are mixed (level, loudness range, pauses, bed level, event timing). Nothing from the reference videos is reused.", "",
     "## 1. Tools and skills: what was verified and how", "",
     "| Item | Claim | Verified how | Used? |", "|---|---|---|---|",
     "| FFmpeg (Gyan full build 9.0.2 on this PC) | loudness meter, two-pass `loudnorm`, `sidechaincompress` ducking, `adelay`/`amix` placement, `alimiter`, `afade`, `showspectrumpic` | **Run in this session** (script `platform/longform/v2/audio/mix-demo.sh`, `machine_qa.py`, spectrograms); outputs measured with `ebur128` | yes |",
     "| `claude-video-audio` skill (AgriciDaniel/claude-video, MIT, 34 stars, last push 2026-04-06) | FFmpeg audio recipes | Instruction file read; the loudnorm/sidechain recipes followed by hand and run. It is a recipe collection, not software; not installed as a skill and not invoked through the Skill tool | recipes only |",
     "| `mix-master` skill (gooseworks-ai/goose-skills, MIT) | mixing guidance | Instruction file read; partly overlaps the above; not run | read only |",
     "| pyloudnorm (MIT, last push 2026-01-04), librosa (ISC), pydub (MIT) | Python loudness/analysis helpers | Licence and activity from the GitHub API; **not installed or run** (ffmpeg `ebur128` used instead) | no |",
     "| Pedalboard (spotify, GPL-3.0) | effects library | Licence from GitHub API; GPL-3.0 copyleft; not used | no |",
     "| Audacity, Ardour | desktop editors / DAW | GitHub API shows no single SPDX licence (multi-licence); human tools, not scriptable pipeline components here | no |",
     "| SoX | CLI audio tool | **Not installed** on this PC | no |",
     "| Demucs | source separation | facebookresearch repo is **archived** (2024-04-24); adefossez fork MIT, pushed 2026-10-26. Not needed (we do not reuse reference audio) | no |",
     "| Freesound | CC0 / CC BY / CC BY-NC per sound | Per-sound licensing confirmed by secondary sources; API-key rules **not verified**; items reached through Openverse only | via Openverse |",
     "| Openverse API (anonymous) | licence + provider + source URL per audio item | Run in this session (about 60 queries); every pick re-checked at the source page by `library.mjs` | yes |",
     "| BBC Sound Effects (RemArc) | free download | Secondary sources: personal / educational / research only; monetised YouTube needs a commercial licence (Pro Sound Effects) | **excluded** |",
     "| Sonniss GDC bundles | royalty-free commercial, no attribution | Secondary sources only; licence is per bundle year; 2023 text read via an unofficial mirror; 2024 added a no-AI-training clause; **primary licence not read** | not downloaded |",
     "| Pixabay audio | commercial use, no attribution | Secondary sources only; Content ID claims can still occur; **primary terms not read** | not downloaded |",
     "| Reaper | scriptable DAW, commercial licence | not checked in this pass | no |", "",
     "A repository that contains audio utilities is not treated as a mixing solution: the only automated mixing path actually run here is FFmpeg.", "",
     "## 2. Reference audio, measured (35 planned, " + str(len(A)) + " measured)", "",
     "Method: whole analysed span of each video (up to 2100 s): `ebur128` (integrated loudness, loudness range, true peak); 50 ms RMS windows; speech level = 80th percentile; a pause = a window at least 18 dB below the speech level; 'bed in pauses' = median level of those windows relative to speech; 'impact candidates' = 50 ms windows 12 dB louder than the previous with more than 35% of energy below about 150 Hz (a candidate is **not** an identified sound: it can be a bass note, a beat or a plosive). Limits: the span includes sponsor reads and music-only sections; true peaks above 0 dBTP are decoder-level (the references are lossy 360p-source audio).", "",
     "| Channel | Video | LUFS | LRA LU | True peak dBTP | Pauses/min | Bed below speech in pauses dB | Impact candidates/min |", "|---|---|---|---|---|---|---|---|"]
for c in CH:
    for r in by(c):
        a = r["audio"]; L.append(f"| {CHNAME[c]} | {link(r)} | {a['integrated_lufs']} | {a['lra']} | {a['true_peak_dbtp']} | {a['pauses_per_min']} | {a['bed_below_speech_db']} | {imp[r['id']]:.1f} |")
L += ["", "Per channel (ranges over videos):", "", "| Channel | LUFS | LRA | Pauses/min | Bed below speech dB | Impact candidates/min |", "|---|---|---|---|---|---|"]
for c in CH:
    rs = by(c); L.append(f"| {CHNAME[c]} | {rng([r['audio']['integrated_lufs'] for r in rs], 1)} | {rng([r['audio']['lra'] for r in rs], 1)} | {rng([r['audio']['pauses_per_min'] for r in rs], 1)} | {rng([r['audio']['bed_below_speech_db'] for r in rs], 1)} | {rng([imp[r['id']] for r in rs], 1)} |")
L += ["", "What the numbers say (confidence Medium; they describe mixes, not taste):",
      "- Loudness of the references spans -23.4 to -11.7 LUFS. There is **no common loudness**. Our -14 LUFS target is YouTube's playback reference, not something the references cluster on (the RealLifeLore videos sit at -17 to -16; SunnyV2 at -17.7 to -13.9 (the Spanish Diddy documentary at -12.3); FRONTLINE at -23).",
      "- Loudness range is small (1.5-2.3 LU) for RealLifeLore and larger (up to 16.8 LU) where music-only or sponsor passages exist (Football Made Simple *How Chelsea's Tactics Beat United*, Mars 4K).",
      "- Pauses: RealLifeLore has 7-10 per minute with near-silent gaps; SunnyV2 commentary has about 0 pauses per minute (voice-over wall to wall) and the lowest bed gap (about 20 dB): a continuous bed or effect layer under the voice.",
      "- Impact candidates: four of the five Football Made Simple tactics videos show 7-10 per minute against 0-6 in the rest of the set; consistent with a beat or low pulse under the tactical sections (see the spectrogram observation below).", "",
      "## 3. Spectrogram observations (60 s windows; observation only)", "",
      "| Video and window | Observed (shape) | Interpretation (labelled) | Confidence |", "|---|---|---|---|",
      "| RealLifeLore Nepal flood, 14:35-15:35 (https://www.youtube.com/watch?v=WiRLNEl-4bk) | Voice only; between sentences the spectrogram is near black (about -100 dB) at all frequencies | no bed and no ambience in this window | Medium (one window) |",
      "| Aperture Every Level of Consciousness, 15:05-16:05 (https://www.youtube.com/watch?v=IqXpzcfdtn4) | Voice plus a continuous low band (about 20-100 Hz) that persists between phrases; broadband verticals | a sustained bed with sub-bass; transients not identified | Medium |",
      "| FRONTLINE Weinstein, 17:00-18:00 (https://www.youtube.com/watch?v=OJ8fsE_GOlg) | Continuous low band through pauses; at about 49-52 s two short narrow tonal pulses near 1 kHz with the low band dropping out around them | a room-tone or drone under interviews; one short tonal event with the bed gated; not identified | Medium-Low |",
      "| Football Made Simple Elite Tactical Problem Solving, 3:39-4:39 (https://www.youtube.com/watch?v=Nx8h403Sj_s) | Strong continuous low band under speech; from about 17 s to 31 s of the window the speech pattern is absent and evenly spaced vertical pulses (about 2 per second) appear while the low band continues | a rhythmic element (music beat or effect) carrying a speech-free stretch | Medium-Low |",
      "| Astrum Uranus, 17:00-18:00 (https://www.youtube.com/watch?v=pZh5BWCNmmE) | Continuous red-orange fill 20-400 Hz through speech and pauses | a sustained pad/drone-like bed | Medium-Low |", "",
      "## 4. Library: licence and machine QA (35 assets)", "",
      f"- 35 assets (CC0 or CC BY only) downloaded, measured and licence-checked at the source page (all 35 pages confirmed the licence URL). `docs/longform/SOUND-LIBRARY-REGISTER.md` lists each asset, licence, attribution and flags.",
      f"- Machine QA flags (measurable defects only): {nflag('true peak')} assets at or above 0 dBTP (must be attenuated before any mix), {nflag('full scale')} with samples at full scale (possible hard clipping or a very hot master: needs an ear check), {nflag('loop seam')} with a loop seam (needs a crossfade if looped), {nflag('ends without')+nflag('tail cut')} that end without a decay, {nflag('silence')} with silence to trim.",
      "- Every asset's approval status is **pending human audition** (or 'needs correction before audition' where the flags show clipping). None is approved or rejected.",
      "- All eight music beds are CC BY 3.0 and mastered hot (-17 to -8 LUFS, six of eight at or above 0 dBTP): at the mix stage they need roughly 10-17 dB of attenuation. Alternatives per channel are still to be sourced; one bed must not serve all channels.", "",
      "## 5. Mix chain test (technical, not auditioned)", "",
      "Script `platform/longform/v2/audio/mix-demo.sh` (25.5 s of AI Tested pipeline-repair narration, MUSIC_TECH, keyboard/click/whoosh effects):", "",
      "| Stage | Setting | Result |", "|---|---|---|",
      "| Narration | two-pass `loudnorm` to -16 LUFS, linear | stem level about -15.8 dB RMS |",
      "| Music | -17 dB, `sidechaincompress` threshold 0.05, ratio 2.5, attack 30 ms, release 500 ms | under speech -46.4 dB, in pauses -42.0 dB: duck depth 8.3 dB; pause bed 26.2 dB below speech (reference mixes: about 20-36 dB) |",
      "| Final | two-pass `loudnorm` I=-14, TP=-1.5, LRA=9, linear, then `alimiter` | **WAV -13.9 LUFS, LRA 2.4, true peak -1.8 dBTP; MP3 192 kbit/s -14.2 LUFS, true peak -2.0 dBTP** (the earlier single-pass attempt measured -13.4 LUFS) |", "",
      "Open: whether the music is audible and pleasant under speech (31 dB below the narration at the stem level in variant A, 30 dB in variant B) cannot be judged without listening; a person needs to play `output/longform-audio-demo/mix-test-aitested.mp3`. The effects' timing (keyboard at 3.0 s, click at 9.0 s, whoosh at 14.6 s) is mechanically exact; whether they serve the story is a listening decision. Listening conditions tested: **none**.", ""]
open(os.path.join(HERE, "_sound_head.md"), "w", encoding="utf8").write("\n".join(L)); print(len(L), "lines")
