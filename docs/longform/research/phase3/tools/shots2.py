"""Dissolve-aware shot-boundary detector (second method, complements analyze.py's cuts.json).
Decodes the cached clip at 4 fps, 64x36 RGB. d(i) = mean |frame[i+3] - frame[i]| (0.75 s apart, so a 0.5-1 s crossfade and a hard cut both register as one hump).
A boundary = local maximum of d above THRESH (default set from validation, see notes) with at least 1.5 s between boundaries.
Writes a3/<id>/shots2.json. Method limits: a very slow camera move or a fast pan can exceed THRESH (over-count); a cut between two near-identical shots
(same scene, similar colours) can fall below it (under-count). Validated by manual count on one window per video type: see notes_p3b.md."""
import json, subprocess, sys, os
import numpy as np
vid = sys.argv[1]; THRESH = float(sys.argv[2]) if len(sys.argv) > 2 else 0.12
mp4 = os.path.join("a3", "_video", vid + ".mp4")
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vf", "fps=4,scale=64:36", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
x = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 36, 64, 3).astype(np.float32) / 255.0
d = np.abs(x[3:] - x[:-3]).mean(axis=(1, 2, 3))
b = []
for i in range(1, len(d) - 1):
    if d[i] >= THRESH and d[i] >= d[i - 1] and d[i] > d[i + 1]:
        t = (i + 1.5) / 4.0  # centre of the 0.75 s span
        if not b or t - b[-1] >= 1.5: b.append(round(t, 2))
        elif d[i] > d[int(b[-1] * 4 - 1.5)] if int(b[-1] * 4 - 1.5) < len(d) else False: b[-1] = round(t, 2)
json.dump({"thresh": THRESH, "n": len(b), "boundaries": b, "duration_s": len(x) / 4.0, "d": [round(float(v), 3) for v in d]}, open(os.path.join("a3", vid, "shots2.json"), "w"))
print(vid, len(b), "boundaries in", round(len(x) / 4.0), "s ->", round(len(b) / (len(x) / 240.0), 1), "per min")
