"""Signal analysis of each reference's audio. usage: python analyze.py <work_dir> [id ...]
Needs <work>/<id>/audio.wav and speech.json (asr.py). Writes <work>/<id>/analysis.json.
Everything here is measured from the waveform; labels are heuristic candidates with their evidence, not verdicts.
Method: music is only measurable under narration in the pauses between words, so the music bed is read from speech gaps."""
import json, os, sys
import numpy as np
import librosa

SR, NFFT, HOP = 22050, 2048, 512
FT = HOP / SR
BANDS = {"low": (30, 150), "lowmid": (150, 500), "mid": (500, 2000), "high": (2000, 6000), "air": (6000, 11000)}

def db(x): return 10 * np.log10(np.maximum(x, 1e-12))

def rolling_median(x, n):
    n = max(3, n | 1)
    pad = np.pad(x, n // 2, mode="edge")
    w = np.lib.stride_tricks.sliding_window_view(pad, n)
    return np.median(w, axis=1)

def runs(mask):
    idx = np.flatnonzero(np.diff(np.r_[0, mask.astype(int), 0]))
    return list(zip(idx[::2], idx[1::2]))

def speech_mask(speech, nfr):
    m = np.zeros(nfr, bool)
    for s in speech["segments"]:
        for w0, w1, _ in s["words"]:
            m[int(max(0, w0 - 0.06) / FT): int((w1 + 0.06) / FT) + 1] = True
    # bridge gaps under 250 ms so breaths between words do not count as music gaps
    out = m.copy()
    for a, b in runs(~m):
        if (b - a) * FT < 0.25 and a > 0: out[a:b] = True
    return out

def phrase_at(speech, t, span=1.2):
    ws = [w for s in speech["segments"] for w in s["words"] if w[1] >= t - span and w[0] <= t + span]
    return " ".join(w[2] for w in ws[:8]).strip()

def analyze(d):
    y, _ = librosa.load(os.path.join(d, "audio.wav"), sr=SR, mono=True)
    speech = json.load(open(os.path.join(d, "speech.json"), encoding="utf8"))
    S = np.abs(librosa.stft(y, n_fft=NFFT, hop_length=HOP)) ** 2
    nfr = S.shape[1]
    freqs = librosa.fft_frequencies(sr=SR, n_fft=NFFT)
    bd = {k: db(S[(freqs >= lo) & (freqs < hi)].sum(0)) for k, (lo, hi) in BANDS.items()}
    tot = db(S.sum(0))
    cen = librosa.feature.spectral_centroid(S=np.sqrt(S), sr=SR)[0]
    flat = librosa.feature.spectral_flatness(S=np.sqrt(S))[0]
    t = np.arange(nfr) * FT
    sp = speech_mask(speech, nfr)
    spl = float(np.percentile(tot[sp], 75)) if sp.any() else float(np.percentile(tot, 75))
    floor = float(np.percentile(tot, 1))

    # music bed from speech gaps
    gaps = []
    for a, b in runs(~sp):
        if (b - a) * FT < 0.3: continue
        a2, b2 = a + 3, b - 3
        if b2 <= a2: continue
        gaps.append((a2, b2))
    mf = librosa.feature.mfcc(S=librosa.power_to_db(librosa.feature.melspectrogram(S=S, sr=SR, n_mels=64)), n_mfcc=13)
    ch = librosa.feature.chroma_stft(S=S, sr=SR)
    bed = []
    for a, b in gaps:
        sl = slice(a, b)
        bed.append({"t": round(float(t[a:b].mean()), 2), "dur": round((b - a) * FT, 2), "db": round(float(np.median(tot[sl])), 1),
                    "low_db": round(float(np.median(bd["low"][sl])), 1), "centroid": int(np.median(cen[sl])), "flatness": round(float(np.median(flat[sl])), 4),
                    "mfcc": np.median(mf[1:, sl], axis=1).round(2).tolist(), "chroma": (ch[:, sl].mean(1) / (ch[:, sl].mean(1).sum() + 1e-9)).round(3).tolist()})
    music_floor = floor + 14
    for g in bed: g["music"] = g["db"] > music_floor

    # music sections: change points in the gap feature stream
    sections = []
    if len(bed) >= 8:
        F = np.array([g["mfcc"] + [x * 10 for x in g["chroma"]] + [g["db"] / 5] for g in bed])
        F = (F - F.mean(0)) / (F.std(0) + 1e-6)
        k = 4
        score = np.zeros(len(F))
        for i in range(k, len(F) - k):
            score[i] = np.linalg.norm(F[i - k:i].mean(0) - F[i:i + k].mean(0))
        thr = np.median(score[score > 0]) + 2.2 * np.median(np.abs(score[score > 0] - np.median(score[score > 0])))
        cps = [0]
        for i in np.argsort(-score):
            if score[i] > thr and all(abs(bed[i]["t"] - bed[c]["t"]) > 20 for c in cps): cps.append(int(i))
        cps = sorted(cps) + [len(bed)]
        for a, b in zip(cps[:-1], cps[1:]):
            seg = bed[a:b]
            if not seg: continue
            t0, t1 = seg[0]["t"], seg[-1]["t"] + seg[-1]["dur"]
            lvl = float(np.median([g["db"] for g in seg]))
            sections.append({"start": round(t0, 1), "end": round(t1, 1), "bed_db": round(lvl, 1), "bed_vs_voice_db": round(lvl - spl, 1),
                             "music_likely": lvl > music_floor, "gaps": len(seg), "centroid": int(np.median([g["centroid"] for g in seg]))})
    for s in sections:
        a, b = int(s["start"] / FT), min(int(s["end"] / FT), nfr)
        if b - a > 400:
            seg = y[int(s["start"] * SR):int(min(s["end"], s["start"] + 90) * SR)]
            oenv = librosa.onset.onset_strength(y=seg, sr=SR, hop_length=HOP)
            s["tempo_bpm_approx"] = int(round(float(librosa.feature.tempo(onset_envelope=oenv, sr=SR, hop_length=HOP)[0])))

    # sound-effect candidates
    base = {k: rolling_median(v, int(4 / FT)) for k, v in bd.items()}
    base_tot = rolling_median(tot, int(4 / FT))
    events = []
    def add(kind, a, b, over, **kw):
        a, b = int(a), int(b)
        events.append({"t": round(float(t[a]), 2), "dur": round(float((b - a) * FT), 2), "kind": kind, "over_baseline_db": round(float(over), 1),
                       "in_speech": round(float(sp[a:b + 1].mean()), 2), "centroid": int(np.median(cen[a:b + 1])), "flatness": round(float(np.median(flat[a:b + 1])), 4), **kw})
    # impacts: isolated low-band hits
    lo_over = bd["low"] - base["low"]
    pk = librosa.util.peak_pick(lo_over, pre_max=8, post_max=8, pre_avg=20, post_avg=20, delta=6, wait=int(0.6 / FT))
    for p in pk:
        if lo_over[p] < (16 if sp[p] else 13): continue
        neigh = [q for q in pk if q != p and abs(q - p) * FT < 1.5 and lo_over[q] > 7]
        if len(neigh) > 1: continue
        dec = np.flatnonzero(bd["low"][p:p + int(4 / FT)] < bd["low"][p] - 12)
        add("impact", p, p + (dec[0] if len(dec) else int(1 / FT)), lo_over[p], low_peak_db=round(float(bd["low"][p]), 1), isolated=True)
    # high-band swells: risers and whooshes
    hi = (bd["high"] + bd["air"]) / 2
    hb = rolling_median(hi, int(4 / FT))
    ho = hi - hb
    for a, b in runs(ho > 8):
        dur = (b - a) * FT
        if dur < 0.3 or dur > 12: continue
        seg = ho[a:b]
        peak = int(a + np.argmax(seg))
        rise = (peak - a) * FT
        if np.median(flat[a:b]) < 0.02: continue
        if sp[a:b].mean() > 0.5 and seg.max() < 18: continue
        kind = "riser" if rise >= 1.0 and rise > 0.6 * dur else "whoosh"
        add(kind, a, b, seg.max(), rise_s=round(float(rise), 2))
    # whistles: sustained narrow tonal peak 2-4.5 kHz
    band = (freqs >= 2000) & (freqs <= 4500)
    mag = np.sqrt(S[band])
    peakiness = db(mag.max(0) ** 2) - db(np.median(mag, axis=0) ** 2)
    pf = freqs[band][mag.argmax(0)]
    cand = (peakiness > 22) & (tot > floor + 15)
    for a, b in runs(cand):
        if (b - a) * FT < 0.3: continue
        if np.std(pf[a:b]) > 400: continue
        add("whistle_like_tone", a, b, float((bd["high"][a:b] - base["high"][a:b]).max()), tone_hz=int(np.median(pf[a:b])), peakiness_db=round(float(peakiness[a:b].mean()), 1))
    # silences and abrupt cuts
    for a, b in runs(tot < floor + 3):
        if (b - a) * FT < 0.25: continue
        pre = tot[max(0, a - int(1.5 / FT)):a]
        into = "start_of_file" if a < 3 else ("cut" if tot[a - 3] - tot[min(a + 3, nfr - 1)] > 25 else "fade" if len(pre) and pre.max() - tot[a] > 15 else "gradual")
        out = "end_of_file" if b >= nfr - 3 else ("snap_in" if tot[min(b + 3, nfr - 1)] - tot[b - 1] > 25 else "swell")
        add("silence", a, b, 0.0, level_db=round(float(tot[a:b].mean()), 1), enters=into, exits=out)
    drop = tot[:-3] - tot[3:]
    for p in np.flatnonzero(drop > 25):
        if sp[max(0, p - 5):p + 5].any(): continue
        add("abrupt_cut", p, p + 3, float(drop[p]), from_db=round(float(tot[p]), 1), to_db=round(float(tot[p + 3]), 1))
    # short clicks (shutter / UI / tick)
    ho_air = bd["air"] - base["air"]
    pk = librosa.util.peak_pick(ho_air, pre_max=3, post_max=3, pre_avg=10, post_avg=10, delta=10, wait=int(0.2 / FT))
    for p in pk:
        if ho_air[p] < 14 or cen[p] < 3000 or sp[max(0, p - 4):p + 6].mean() > 0.3: continue
        w = np.flatnonzero(ho_air[p:p + 8] < 5)
        if (w[0] if len(w) else 8) * FT > 0.12: continue
        add("click_like", p, p + 2, ho_air[p])

    # dedupe near-identical events and annotate
    events.sort(key=lambda e: (e["t"], e["kind"]))
    kept = []
    for e in events:
        if e["kind"] in ("impact", "whoosh", "riser", "click_like") and base_tot[min(int(e["t"] / FT), nfr - 1)] < floor + 15: continue
        if kept and kept[-1]["kind"] == e["kind"] and e["t"] - kept[-1]["t"] < 0.5: continue
        kept.append(e)
    sil = [(e["t"], e["t"] + e["dur"]) for e in kept if e["kind"] == "silence"]
    for e in kept:
        if e["kind"] in ("impact", "whoosh", "riser") and any(e["t"] - 0.4 <= s1 <= e["t"] + 0.2 for _, s1 in sil):
            e["kind"] = "reentry_after_silence"
        e["phrase"] = phrase_at(speech, e["t"])
        o = e["over_baseline_db"]
        e["intensity"] = "high" if o >= 18 else "medium" if o >= 12 else "low"
        mu = [s for s in sections if s["start"] <= e["t"] <= s["end"]]
        e["music_section"] = bool(mu and mu[0]["music_likely"])

    nsp = (~sp).mean()
    return {"duration": round(float(len(y) / SR), 1), "speech_fraction": round(float(sp.mean()), 3), "speech_level_db": round(spl, 1), "floor_db": round(floor, 1),
            "music_floor_db": round(music_floor, 1), "first_speech_s": round(float(t[np.argmax(sp)]), 2) if sp.any() else None,
            "bed": [{k: v for k, v in g.items() if k not in ("mfcc", "chroma")} for g in bed], "music_sections": sections, "events": kept}

if __name__ == "__main__":
    work = sys.argv[1]
    only = set(sys.argv[2:])
    for vid in sorted(os.listdir(work)):
        d = os.path.join(work, vid)
        if not os.path.exists(os.path.join(d, "speech.json")) or (only and vid not in only): continue
        r = analyze(d)
        json.dump(r, open(os.path.join(d, "analysis.json"), "w", encoding="utf8"), ensure_ascii=False)
        ev = {}
        for e in r["events"]: ev[e["kind"]] = ev.get(e["kind"], 0) + 1
        print(vid, r["duration"], "speech", r["speech_fraction"], "sections", len(r["music_sections"]), ev, flush=True)
