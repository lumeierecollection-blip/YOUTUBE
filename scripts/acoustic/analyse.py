#!/usr/bin/env python3
"""
Offline analysis of calibration audio (out of CI): for every good-*/bad-* mp3+srt in a directory, the file-level features of
narration-acoustics.py, then, for every single feature and every pair, whether the labelled clusters separate, with the gap.
With 5 good and 3 bad files the result is a measurement of THIS set, not a proof; the report says so.
"""
import glob, json, os, sys, itertools, statistics
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location("na", os.path.join(os.path.dirname(os.path.abspath(__file__)), "narration-acoustics.py"))
na = importlib.util.module_from_spec(spec); spec.loader.exec_module(na)
import numpy as np

def feats(mp3, srt):
    x = na.decode(mp3); cues = na.cues_of(srt)
    f0, energy = na.f0_track(x)
    voiced = f0 > 0
    st = np.where(voiced, na.semis(np.maximum(f0, 1e-9)), np.nan)
    med = np.nanmedian(st); rel = st - med
    silent = energy <= energy.max() + na.SILENCE_DB
    # file-level pitch: spread of voiced pitch (relative), contour movement, plus rhythm
    v = rel[~np.isnan(rel)]
    d = np.abs(np.diff(v))
    F = {"f0_std": float(np.std(v)), "f0_iqr": float(np.percentile(v, 75) - np.percentile(v, 25)),
         "f0_move": float(np.mean(d)), "f0_move_p90": float(np.percentile(d, 90))}
    # sentence-level pitch std: median over sentences (what the gate would use)
    sf = []
    for c in cues:
        lo, hi = int(c["start"] * na.SR / na.HOP), int(c["end"] * na.SR / na.HOP)
        w = rel[max(0, lo):min(len(rel), hi)]; w = w[~np.isnan(w)]
        if len(w) > 2: sf.append(float(np.std(w)))
    F["sent_f0_std_med"] = float(np.median(sf)) if sf else None
    wps = np.array([len(c["text"].split()) / max(1e-6, c["end"] - c["start"]) for c in cues])
    F["wps_cv"] = float(np.std(wps) / np.mean(wps))
    # pauses: runs of silence >= MIN_PAUSE_S inside the speech span
    sp = np.where(~silent)[0]
    durs = []
    if len(sp) > 1:
        run = 0
        for val in silent[sp[0]:sp[-1] + 1]:
            if val: run += 1
            else:
                if run * na.HOP / na.SR >= na.MIN_PAUSE_S: durs.append(run * na.HOP / na.SR)
                run = 0
    durs = np.array(durs) if durs else np.array([0.0])
    F["pause_mean"] = float(np.mean(durs)); F["pause_cv"] = float(np.std(durs) / max(1e-9, np.mean(durs)))
    F["pause_per_cue"] = float(len(durs) / max(1, len(cues)))
    return F

def main():
    root = sys.argv[1]
    rows = []
    for mp3 in sorted(glob.glob(os.path.join(root, "*.mp3"))):
        name = os.path.basename(mp3)[:-4]
        srt = mp3[:-4] + ".srt"
        if not os.path.exists(srt): continue
        lab = "good" if name.startswith("good") else "bad" if name.startswith("bad") else None
        if lab is None: continue
        rows.append({"name": name, "label": lab, "f": feats(mp3, srt)})
    keys = [k for k in rows[0]["f"] if all(r["f"].get(k) is not None for r in rows)]
    print(f"{len(rows)} files: {sum(r['label']=='good' for r in rows)} good, {sum(r['label']=='bad' for r in rows)} bad")
    print("\n" + f"{'file':28}{'label':6}" + "".join(f"{k:>16}" for k in keys))
    for r in rows:
        print(f"{r['name']:28}{r['label']:6}" + "".join(f"{r['f'][k]:>16.4f}" for k in keys))
    def sep(ks):
        g = [[r["f"][k] for k in ks] for r in rows if r["label"] == "good"]
        b = [[r["f"][k] for k in ks] for r in rows if r["label"] == "bad"]
        # a single axis: the sign of the difference of the cluster medians; the gap is the margin on that side
        gm, bm = np.median(g, axis=0), np.median(b, axis=0)
        w = (gm - bm)
        if np.linalg.norm(w) == 0: return None
        w = w / np.linalg.norm(w)
        gs = np.array(g) @ w; bs = np.array(b) @ w
        gap = gs.min() - bs.max()
        return {"gap": float(gap), "separates": bool(gap > 0), "w": dict(zip(ks, [round(float(x), 4) for x in w]))}
    singles = sorted(((k, sep([k])) for k in keys), key=lambda t: -(t[1]["gap"] if t[1] else -9))
    print("\nsingle features (gap > 0 means the labelled clusters separate, margin in feature units):")
    for k, s in singles:
        print(f"  {k:18} gap {s['gap']:+.4f}  {'SEPARATES' if s['separates'] else 'overlaps'}")
    pairs = []
    for a, b in itertools.combinations(keys, 2):
        s = sep([a, b])
        if s: pairs.append(((a, b), s))
    pairs.sort(key=lambda t: -t[1]["gap"])
    print("\npairs (best five):")
    for (a, b), s in pairs[:5]:
        print(f"  {a} + {b}: gap {s['gap']:+.4f} {'SEPARATES' if s['separates'] else 'overlaps'}  weights {s['w']}")
    json.dump({"rows": rows, "singles": {k: v for k, v in singles}, "pairs_top5": [[list(p), s] for p, s in pairs[:5]]}, open(os.path.join(root, "analysis.json"), "w"), indent=1, default=str)

if __name__ == "__main__":
    main()
