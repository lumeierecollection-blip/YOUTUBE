#!/usr/bin/env python3
"""
Deterministic acoustic features of a narration file, per sentence (owner, 2026-10-10: the Gemini listener cannot gate; see
scripts/narration-judge.mjs). Reads an mp3 + its SRT, decodes the audio with ffmpeg and measures, for every SRT cue:

  f0_std_st     std of the voiced pitch (F0) in semitones, relative to the FILE's own median pitch (speaker-normalised)
  f0_range_st   10th-90th percentile spread of the voiced pitch, in semitones
  f0_slope_st   mean absolute change of F0 between consecutive voiced frames (10 ms), in semitones: how much the contour MOVES
  voiced        share of the cue's frames that are voiced
  wps           words per second in the cue (from the SRT text)
  pauses        count of silences >= 120 ms inside the cue's audio window

F0 is a normalised-autocorrelation estimate over 25 ms frames every 10 ms (60-400 Hz). numpy only, float64, no randomness: the same
input gives byte-identical output (checked by scripts/acoustic/determinism.sh).

Usage: narration-acoustics.py <audio.mp3> <cues.srt> [--json out.json]
Exit 0 always when the file decodes; prints the JSON to stdout. Reports only.
"""
import json, re, subprocess, sys, hashlib
import numpy as np

SR = 16000
FRAME = int(0.025 * SR)      # 400 samples
HOP = int(0.010 * SR)        # 160 samples
LAG_MIN, LAG_MAX = int(SR / 400), int(SR / 60)   # 40 .. 266 samples = 400 .. 60 Hz
VOICED_NCC = 0.6             # normalised autocorrelation peak needed to call a frame voiced
SILENCE_DB = -40.0           # frame energy below (file peak - 40 dB) is silence
MIN_PAUSE_S = 0.12

def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype="<f4").astype(np.float64)

def cues_of(srt_path):
    text = open(srt_path, encoding="utf-8").read().replace("\r", "")
    out = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = block.split("\n")
        if len(lines) < 3 or "-->" not in lines[1]:
            continue
        def sec(t):
            h, m, s = t.strip().replace(",", ".").split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
        a, b = lines[1].split("-->")
        out.append({"start": sec(a), "end": sec(b), "text": " ".join(lines[2:]).strip()})
    return out

def frames_of(x):
    n = 1 + max(0, (len(x) - FRAME) // HOP)
    idx = np.arange(FRAME)[None, :] + HOP * np.arange(n)[:, None]
    return x[idx]

def f0_track(x):
    """Per frame: (f0_hz or 0 if unvoiced, energy_db)."""
    F = frames_of(x)
    energy = 10 * np.log10(np.mean(F ** 2, axis=1) + 1e-12)
    F = F - F.mean(axis=1, keepdims=True)
    win = np.hanning(FRAME)
    Fw = F * win
    e0 = np.sum(Fw * Fw, axis=1) + 1e-12
    best = np.zeros(len(F)); best_lag = np.zeros(len(F))
    for lag in range(LAG_MIN, LAG_MAX + 1):
        a, b = Fw[:, :-lag], Fw[:, lag:]
        num = np.sum(a * b, axis=1)
        den = np.sqrt(np.sum(a * a, axis=1) * np.sum(b * b, axis=1)) + 1e-12
        r = num / den
        better = r > best
        best = np.where(better, r, best); best_lag = np.where(better, lag, best_lag)
    f0 = np.where((best >= VOICED_NCC) & (energy > energy.max() + SILENCE_DB), SR / np.maximum(best_lag, 1), 0.0)
    return f0, energy

def semis(f):
    return 12 * np.log2(f / 110.0)

def main():
    audio, srt = sys.argv[1], sys.argv[2]   # any extra flags (--json <path>) are read where needed
    x = decode(audio)
    cues = cues_of(srt)
    f0, energy = f0_track(x)
    voiced = f0 > 0
    if voiced.sum() < 10:
        print(json.dumps({"error": "too few voiced frames", "voiced_frames": int(voiced.sum())}))
        return
    st = np.where(voiced, semis(np.maximum(f0, 1e-9)), np.nan)
    med = np.nanmedian(st)
    rel = st - med
    silent = energy <= energy.max() + SILENCE_DB
    sents = []
    for i, c in enumerate(cues):
        lo, hi = int(c["start"] * SR / HOP), int(c["end"] * SR / HOP)
        seg = slice(max(0, lo), min(len(f0), hi))
        v = rel[seg]; v = v[~np.isnan(v)]
        fv = f0[seg][f0[seg] > 0]
        d = np.abs(np.diff(v)) if len(v) > 1 else np.array([0.0])
        # pauses: runs of silent frames of at least MIN_PAUSE_S inside the cue
        s = silent[seg].astype(int)
        pauses, run = 0, 0
        for val in s:
            if val: run += 1
            else:
                if run * HOP / SR >= MIN_PAUSE_S: pauses += 1
                run = 0
        if run * HOP / SR >= MIN_PAUSE_S: pauses += 1
        words = len(c["text"].split())
        dur = max(1e-6, c["end"] - c["start"])
        sents.append({
            "index": i,
            "f0_std_st": round(float(np.std(v)), 4) if len(v) > 2 else None,
            "f0_range_st": round(float(np.percentile(v, 90) - np.percentile(v, 10)), 4) if len(v) > 2 else None,
            "f0_slope_st": round(float(np.mean(d)), 4),
            "voiced": round(float(len(v) / max(1, (seg.stop - seg.start))), 4),
            "wps": round(words / dur, 4),
            "pauses": pauses,
            "median_f0_hz": round(float(np.median(fv)), 2) if len(fv) else None,
        })
    # FILE-level rhythm, from the same SRT cues and the energy track: the rate varies (speaking-rate CV) and the pauses fall in places and lengths
    # a person chooses (pause length spread, share of time silent). Robotic TTS: even rate, even pauses; human: uneven on both.
    wps = np.array([x["wps"] for x in sents], dtype=float)
    durs = []   # every silence run inside the speech span, in seconds
    speech = np.where(~silent)[0]
    if len(speech) > 1:
        lo_f, hi_f = speech[0], speech[-1]
        run = 0
        for val in silent[lo_f:hi_f + 1]:
            if val: run += 1
            else:
                if run * HOP / SR >= MIN_PAUSE_S: durs.append(run * HOP / SR)
                run = 0
    durs = np.array(durs, dtype=float)
    span = (speech[-1] - speech[0]) * HOP / SR if len(speech) > 1 else 0.0
    rhythm = {
        "wps_cv": round(float(np.std(wps) / np.mean(wps)), 4) if len(wps) > 1 and np.mean(wps) > 0 else None,
        "pause_count": int(len(durs)),
        "pause_mean_s": round(float(np.mean(durs)), 4) if len(durs) else None,
        "pause_cv": round(float(np.std(durs) / np.mean(durs)), 4) if len(durs) > 1 else None,
        "silent_share": round(float(durs.sum() / span), 4) if span > 0 and len(durs) else 0.0,
    }
    out = {"file": audio.split("/")[-1], "median_f0_hz": round(float(110 * 2 ** (med / 12)), 2), "rhythm": rhythm, "sentences": sents}
    txt = json.dumps(out, indent=1, sort_keys=True)
    if "--json" in sys.argv:
        open(sys.argv[sys.argv.index("--json") + 1], "w", encoding="utf-8").write(txt + "\n")
    print(txt)
    print(f"# sha256 {hashlib.sha256(txt.encode()).hexdigest()}", file=sys.stderr)

if __name__ == "__main__":
    main()
