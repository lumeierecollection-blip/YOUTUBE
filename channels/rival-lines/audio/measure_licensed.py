"""Measure licensed candidate tracks. usage: python measure_licensed.py <dir with *.mp3 and sel.json> <out.json>
Per track: duration, tempo, loudness, brightness, onset density, dynamic range, thirds-energy arc, and the quietest/loudest 10 s windows.
Audio stays in the work dir; only these numbers go in the repo."""
import json, os, sys, glob
import numpy as np, librosa

d, out = sys.argv[1], sys.argv[2]
meta = {r["id"][:8]: r for r in json.load(open(os.path.join(d, "sel.json"), encoding="utf8"))}
res = {}
for f in sorted(glob.glob(os.path.join(d, "*.mp3"))):
    k = os.path.basename(f)[:8]
    y, sr = librosa.load(f, sr=22050, mono=True)
    dur = len(y) / sr
    rms = librosa.feature.rms(y=y, hop_length=512)[0]
    db = 20 * np.log10(rms + 1e-6)
    tempo = float(np.atleast_1d(librosa.beat.tempo(y=y, sr=sr))[0])
    onset = librosa.onset.onset_strength(y=y, sr=sr)
    peaks = librosa.onset.onset_detect(onset_envelope=onset, sr=sr)
    cent = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    fps = sr / 512
    w = int(10 * fps)
    win = [float(db[i:i + w].mean()) for i in range(0, max(1, len(db) - w), w // 2)]
    thirds = [float(db[int(len(db) * a):int(len(db) * (a + 1 / 3))].mean()) for a in (0, 1 / 3, 2 / 3)]
    m = meta.get(k, {})
    res[k] = {
        "id": m.get("id"), "title": m.get("title"), "creator": m.get("creator"), "duration_s": round(dur, 1),
        "tempo_bpm_est": round(tempo, 1), "mean_db": round(float(db.mean()), 1), "p10_db": round(float(np.percentile(db, 10)), 1),
        "p90_db": round(float(np.percentile(db, 90)), 1), "dynamic_range_db": round(float(np.percentile(db, 90) - np.percentile(db, 10)), 1),
        "centroid_hz": round(cent), "onsets_per_s": round(len(peaks) / dur, 2), "onset_strength_mean": round(float(onset.mean()), 2),
        "thirds_db": [round(t, 1) for t in thirds],
        "arc": "builds" if thirds[2] - thirds[0] > 2 else "fades" if thirds[0] - thirds[2] > 2 else "steady",
        "quietest_10s_at": round(int(np.argmin(win)) * 5, 0), "loudest_10s_at": round(int(np.argmax(win)) * 5, 0),
    }
    print(k, res[k]["title"][:28], res[k]["tempo_bpm_est"], res[k]["mean_db"], res[k]["onsets_per_s"], res[k]["arc"], flush=True)
json.dump(res, open(out, "w", encoding="utf8"), ensure_ascii=False, indent=1)
