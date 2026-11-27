"""Visual study of a reference video. usage: python ref_frames.py <video.mp4> <speech.json> <out_dir> [--step 4] [--per-sheet 24]
Writes <out_dir>/cuts.json (scene-cut times + shot-length stats) and <out_dir>/sheet-NN.jpg contact sheets, one frame
every <step> s, each captioned with its timestamp and the words spoken at that moment (for the viewer only: the sheets
and the transcript stay in the work dir, never the repo)."""
import json, os, re, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

video, speech, out = sys.argv[1], sys.argv[2], sys.argv[3]
step, per = 4.0, 24
a = sys.argv[4:]
for i, x in enumerate(a):
    if x == "--step": step = float(a[i + 1])
    if x == "--per-sheet": per = int(a[i + 1])
os.makedirs(out, exist_ok=True)

r = subprocess.run(["ffmpeg", "-hide_banner", "-i", video, "-vf", "select='gt(scene,0.25)',showinfo", "-an", "-f", "null", "-"], capture_output=True, text=True)
cuts = [float(m) for m in re.findall(r"pts_time:([0-9.]+)", r.stderr)]
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video], capture_output=True, text=True).stdout)
gaps = np.diff([0] + cuts + [dur])
json.dump({"duration": dur, "cuts": cuts, "n_cuts": len(cuts), "cuts_per_min": round(len(cuts) / dur * 60, 1),
           "shot_s": {"median": round(float(np.median(gaps)), 2), "mean": round(float(gaps.mean()), 2), "p10": round(float(np.percentile(gaps, 10)), 2), "p90": round(float(np.percentile(gaps, 90)), 2)}},
          open(os.path.join(out, "cuts.json"), "w"), indent=1)

words = [(w0, w1, w) for s in json.load(open(speech, encoding="utf8"))["segments"] for w0, w1, w in s["words"]]
def said(t):
    return " ".join(w for w0, w1, w in words if t - 1.2 <= w0 <= t + 2.2)[:70]

ts = np.arange(1.0, dur - 0.5, step)
tmp = os.path.join(out, "_f"); os.makedirs(tmp, exist_ok=True)
try: font = ImageFont.truetype("arial.ttf", 15)
except Exception: font = ImageFont.load_default()
frames = []
for t in ts:
    p = os.path.join(tmp, f"{t:07.1f}.jpg")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1", "-vf", "scale=320:-1", p], check=True)
    frames.append((t, p))
cols = 4
for n in range(0, len(frames), per):
    chunk = frames[n:n + per]
    rows = (len(chunk) + cols - 1) // cols
    cw, ch = 320, 180 + 34
    sheet = Image.new("RGB", (cols * cw, rows * ch), "white")
    d = ImageDraw.Draw(sheet)
    for k, (t, p) in enumerate(chunk):
        x, y = (k % cols) * cw, (k // cols) * ch
        sheet.paste(Image.open(p).resize((320, 180)), (x, y))
        d.text((x + 3, y + 182), f"{int(t // 60)}:{t % 60:04.1f}  {said(t)[:36]}", fill="black", font=font)
        d.text((x + 3, y + 198), said(t)[36:72], fill="black", font=font)
    sheet.save(os.path.join(out, f"sheet-{n // per + 1:02d}.jpg"), quality=80)
print(os.path.basename(video), "cuts", len(cuts), "sheets", (len(frames) + per - 1) // per)
