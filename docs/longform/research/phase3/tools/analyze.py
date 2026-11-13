"""Full-length measurement of one reference video (capped at CAP seconds, stated in the output).
usage: python analyze.py <youtube id> <channel key> [cap_seconds=2100]
Writes a3/<id>/ : meta.json, cuts.json (hard cuts + gradual transitions), audio.json (LUFS, LRA, true peak, short-term timeline, pauses, bed level),
sheets/sNN.jpg (one frame per 15 s, 8x6 tiles, each tile labelled with its time), ocr.json (caption/text measurements in three 60 s windows).
Nothing here classifies content: classification is done by looking at the sheets and is stored separately (labels/<id>.txt)."""
import json, os, re, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
vid, channel = sys.argv[1], sys.argv[2]
CAP = int(sys.argv[3]) if len(sys.argv) > 3 else 2100
OUT = os.path.join(HERE, "a3", vid); os.makedirs(os.path.join(OUT, "sheets"), exist_ok=True)
VID = os.path.join(HERE, "a3", "_video"); os.makedirs(VID, exist_ok=True)
mp4 = os.path.join(VID, vid + ".mp4")

def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf8", errors="replace", **kw)

# 1. metadata + download (360p video, original-language audio)
mp = os.path.join(OUT, "meta.json")
if not os.path.exists(mp):
    _o = run([sys.executable, "-m", "yt_dlp", "--no-warnings", "-q", "-J", "--", f"https://www.youtube.com/watch?v={vid}"]).stdout
    j = json.loads(_o) if _o.strip() else None
    if not j:  # YouTube bot-check: fall back to the metadata saved by the earlier study, and to its 300 s clip (coverage is then limited and recorded in cap_seconds)
        import glob
        sm = glob.glob(os.path.join(HERE, "study", "*", vid, "meta.json"))
        if sm: j = json.load(open(sm[0], encoding="utf8")); print(vid, "metadata from earlier study (YouTube blocked live fetch)", flush=True)
    json.dump({k: j.get(k) for k in ["id", "title", "channel", "channel_follower_count", "view_count", "like_count", "duration", "upload_date"]} | {"channel_key": channel, "cap_seconds": CAP, "collected": "2026-11-13"}, open(mp, "w"), indent=1)
meta = json.load(open(mp))
_clip = os.path.join(HERE, "clips", vid + ".mp4")
if (not os.path.exists(mp4) or os.path.getsize(mp4) < 100000) and os.path.exists(_clip):
    import shutil; shutil.copy(_clip, mp4); print(vid, "using the saved 300 s clip", flush=True)
if not os.path.exists(mp4) or os.path.getsize(mp4) < 100000:
    full = os.path.join(VID, vid + "_full.mp4")
    run([sys.executable, "-m", "yt_dlp", "--no-warnings", "-q", "-f", "bv*[height<=360]+ba[format_note*=original]/bv*[height<=360]+ba/b[height<=360]/b", "--merge-output-format", "mp4", "-o", full, "--", f"https://www.youtube.com/watch?v={vid}"])
    if os.path.exists(full):
        run(["ffmpeg", "-y", "-v", "error", "-i", full, "-t", str(CAP), "-c", "copy", mp4]); os.remove(full)
if not os.path.exists(mp4): print(vid, "DOWNLOAD FAILED"); sys.exit(1)
D = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).stdout.strip())
print(vid, "analysing", round(D), "s of", meta["duration"], "s", flush=True)

# 2. cuts: per-frame scene score
cp = os.path.join(OUT, "cuts.json")
if not os.path.exists(cp):
    sc = run(["ffmpeg", "-v", "error", "-i", mp4, "-vf", "scale=320:-2,select='gte(scene,0)',metadata=print:file=-", "-an", "-f", "null", "-"]).stdout
    t = np.array([float(x) for x in re.findall(r"pts_time:([\d.]+)", sc)]); s = np.array([float(x) for x in re.findall(r"scene_score=([\d.]+)", sc)])
    m = min(len(t), len(s)); t, s = t[:m], s[:m]
    hard, grad, i = [], [], 1
    while i < m - 1:
        if s[i] > 0.3 and s[i - 1] < 0.15 and s[i + 1] < 0.15: hard.append(round(float(t[i]), 2)); i += 2; continue
        if 0.02 < s[i] < 0.3:
            j = i
            while j < m and 0.02 < s[j] < 0.3: j += 1
            if j - i >= 6 and s[i:j].sum() > 0.35: grad.append([round(float(t[i]), 2), round(float(t[j - 1] - t[i]), 2)])
            i = j; continue
        i += 1
    bd = run(["ffmpeg", "-v", "info", "-i", mp4, "-vf", "blackdetect=d=0.1:pix_th=0.08", "-an", "-f", "null", "-"]).stderr
    black = [[float(a), float(b)] for a, b in re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", bd)]
    json.dump({"duration_analysed": D, "hard_cuts": hard, "gradual": grad, "black": black, "method": "scene score per frame at 320 px; hard = isolated >0.3; gradual = 6+ frames in 0.02-0.3 with summed score >0.35 (misses slow camera moves)"}, open(cp, "w"))

# 3. audio: full-length loudness and timeline
ap = os.path.join(OUT, "audio.json")
if not os.path.exists(ap):
    wav = os.path.join(VID, vid + ".wav"); run(["ffmpeg", "-y", "-v", "error", "-i", mp4, "-ac", "1", "-ar", "16000", wav])
    eb = run(["ffmpeg", "-v", "info", "-i", mp4, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
    summ = eb[eb.rfind("Summary:"):]
    g = lambda pat: (re.findall(pat, summ) or [None])[-1]
    w = wave.open(wav); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0; w.close(); os.remove(wav)
    hop = 800; n = len(x) // hop; fr = x[: n * hop].reshape(n, hop); db = 20 * np.log10(np.sqrt((fr ** 2).mean(axis=1)) + 1e-7)
    speech = float(np.percentile(db, 80)); gap = db < speech - 18
    runs, st = [], None
    for i, v in enumerate(list(gap) + [False]):
        if v and st is None: st = i
        if not v and st is not None: runs.append((st * 0.05, (i - st) * 0.05)); st = None
    pauses = [r for r in runs if r[1] >= 0.3]
    spec = np.abs(np.fft.rfft(fr * np.hanning(hop), axis=1)) ** 2; fq = np.fft.rfftfreq(hop, 1 / 16000)
    low = spec[:, fq < 150].sum(1) / (spec.sum(1) + 1e-9); cen = (spec * fq).sum(1) / (spec.sum(1) + 1e-9)
    tl = [round(float(db[i:i + 200].mean()), 1) for i in range(0, n, 200)]  # 10 s windows
    json.dump({"integrated_lufs": float(g(r"I:\s+(-?[\d.]+) LUFS")) if g(r"I:\s+(-?[\d.]+) LUFS") else None, "lra": float(g(r"LRA:\s+(-?[\d.]+) LU")) if g(r"LRA:\s+(-?[\d.]+) LU") else None, "true_peak_dbtp": float(g(r"Peak:\s+(-?[\d.]+) dBFS")) if g(r"Peak:\s+(-?[\d.]+) dBFS") else None,
               "speech_level_db": round(speech, 1), "bed_in_pauses_db": round(float(np.median(db[gap])), 1) if gap.any() else None, "bed_below_speech_db": round(speech - float(np.median(db[gap])), 1) if gap.any() else None,
               "pause_count_ge_0.3s": len(pauses), "pause_share": round(float(gap.mean()), 3), "pauses_per_min": round(len(pauses) / (n * 0.05 / 60), 1), "median_pause_s": round(float(np.median([p[1] for p in pauses])), 2) if pauses else 0, "longest_pause_s": round(max([p[1] for p in pauses], default=0), 2),
               "silence_share_lt_-55db": round(float((db < -55).mean()), 4), "median_centroid_hz": round(float(np.median(cen)), 0), "level_per_10s_db": tl,
               "impact_candidates_s": [round(i * 0.05, 2) for i in range(6, n) if db[i] - db[i - 6:i].mean() > 12 and db[i] > speech - 6 and low[i] > 0.35][:80]}, open(ap, "w"))

# 4. frames every 15 s -> labelled sheets (8 x 6)
step = 15; times = list(range(5, int(D) - 1, step)); sheets = []
if not os.path.exists(os.path.join(OUT, "sheets", "s01.jpg")):
    from PIL import Image, ImageDraw
    tiles = []
    for ti in times:
        f = os.path.join(VID, f"{vid}_{ti}.jpg"); run(["ffmpeg", "-y", "-v", "error", "-ss", str(ti), "-i", mp4, "-frames:v", "1", "-vf", "scale=240:135", "-q:v", "4", f])
        if os.path.exists(f): tiles.append((ti, f))
    for k in range(0, len(tiles), 48):
        im = Image.new("RGB", (8 * 244, 6 * 139), (40, 0, 40)); d = ImageDraw.Draw(im)
        for q, (ti, f) in enumerate(tiles[k:k + 48]):
            x, y = (q % 8) * 244, (q // 8) * 139; im.paste(Image.open(f), (x, y)); d.rectangle([x, y, x + 74, y + 15], fill=(0, 0, 0)); d.text((x + 3, y + 2), f"{k + q + 1:03d} {ti // 60}:{ti % 60:02d}", fill=(255, 220, 80))
        im.save(os.path.join(OUT, "sheets", f"s{k // 48 + 1:02d}.jpg"), quality=78)
    for ti, f in tiles: os.remove(f)
    json.dump({"step_s": step, "times": [t for t, _ in tiles]}, open(os.path.join(OUT, "sheets", "index.json"), "w"))

# 5. OCR windows: 1 frame per second in three 60 s windows (start, middle, end of the analysed span)
op = os.path.join(OUT, "ocr.json")
if not os.path.exists(op):
    from rapidocr_onnxruntime import RapidOCR
    ocr = RapidOCR(); wins = [(3, 63)] + ([(int(D / 2) - 30, int(D / 2) + 30)] if D > 240 else []) + ([(int(D) - 70, int(D) - 10)] if D > 400 else [])
    rec = []
    for (a, b) in wins:
        d = os.path.join(VID, f"{vid}_ocr"); os.makedirs(d, exist_ok=True)
        run(["ffmpeg", "-y", "-v", "error", "-ss", str(a), "-t", str(b - a), "-i", mp4, "-vf", "fps=1,scale=1280:720", "-q:v", "3", os.path.join(d, "f%03d.jpg")])
        for q, fn in enumerate(sorted(os.listdir(d))):
            res, _ = ocr(os.path.join(d, fn))
            items = []
            for box, text, conf in (res or []):
                if float(conf) < 0.6 or len(text.strip()) < 2: continue
                ys = [p[1] for p in box]; xs = [p[0] for p in box]
                items.append({"text": text.strip(), "h": round((max(ys) - min(ys)) / 720, 4), "cx": round((min(xs) + max(xs)) / 2 / 1280, 3), "cy": round((min(ys) + max(ys)) / 2 / 720, 3), "w": round((max(xs) - min(xs)) / 1280, 3)})
            rec.append({"t": a + q, "items": items}); os.remove(os.path.join(d, fn))
    json.dump({"windows": wins, "frames": rec, "method": "RapidOCR on 1280x720 frames, 1 fps, confidence >= 0.6; h = text box height / frame height"}, open(op, "w"))
print(vid, "done", flush=True)
