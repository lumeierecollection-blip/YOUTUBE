"""Deterministic TECHNICAL_QA gate for the AI Tested Shorts.
Writes qa/<file>.txt (any line starting with 'BAD' fails acceptance) and qa/<base>.metrics.json.
Checks: container/codec, 1080x1920, fps, audio present, duration, loudness/peak (from out/<base>.audio.json),
and frame metrics: content coverage in the central band, top-heaviness, empty frames, static runs."""
import glob, json, os, subprocess, sys
import numpy as np
from PIL import Image

out_dir = sys.argv[1] if len(sys.argv) > 1 else "out"
qa_dir = sys.argv[2] if len(sys.argv) > 2 else "qa"
os.makedirs(qa_dir, exist_ok=True)
FPS_Q = 4  # sampled frames per second
LIMITS = dict(min_dur=12, max_dur=60, lufs=(-16.0, -12.0), tp_max=-1.0, min_busy_mean=0.30, min_busy_frame=0.10, max_empty_s=0.5,
              max_top_share=0.52, min_lower_share=0.20, max_static_s=1.6, min_change_mean=2.0)
ok_all = True

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

def probe(f, args):
    return run(["ffprobe", "-v", "error", *args, "-of", "csv=p=0", f]).stdout.strip()

def frames(f, tmp):
    os.makedirs(tmp, exist_ok=True)
    for old in glob.glob(os.path.join(tmp, "*.png")): os.remove(old)
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", f, "-vf", f"fps={FPS_Q},scale=216:384", os.path.join(tmp, "%04d.png")])
    return sorted(glob.glob(os.path.join(tmp, "*.png")))

def block_std(g, b=12):
    h, w = g.shape
    g = g[: h // b * b, : w // b * b].reshape(h // b, b, w // b, b)
    return g.std(axis=(1, 3))

for f in sorted(glob.glob(os.path.join(out_dir, "*.mp4"))):
    base = os.path.basename(f)[:-4]
    lines, bad = [], []
    def vfield(k):
        return probe(f, ["-select_streams", "v:0", "-show_entries", f"stream={k}", "-of", "default=noprint_wrappers=1:nokey=1"])
    def afield(k):
        return probe(f, ["-select_streams", "a:0", "-show_entries", f"stream={k}", "-of", "default=noprint_wrappers=1:nokey=1"])
    vinfo = [vfield("codec_name"), vfield("width"), vfield("height"), vfield("r_frame_rate"), vfield("pix_fmt")]
    ainfo = [afield("codec_name"), afield("sample_rate"), afield("channels")]
    dur = float(probe(f, ["-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1"]) or 0)
    size = os.path.getsize(f)
    lines.append(f"video={vinfo} audio={ainfo} dur={dur:.2f}s size={size}")
    if len(vinfo) < 5 or vinfo[0] != "h264": bad.append("BAD codec not h264")
    if len(vinfo) >= 3 and (vinfo[1] != "1080" or vinfo[2] != "1920"): bad.append(f"BAD size {vinfo[1:3]}")
    if len(vinfo) >= 4 and vinfo[3] not in ("30/1", "30000/1001"): bad.append(f"BAD fps {vinfo[3]}")
    if len(vinfo) >= 5 and vinfo[4] not in ("yuv420p", ""): bad.append(f"BAD pix_fmt {vinfo[4]}")
    if len(ainfo) < 2 or ainfo[0] == "": bad.append("BAD no audio stream")
    if not (LIMITS["min_dur"] <= dur <= LIMITS["max_dur"]): bad.append(f"BAD duration {dur:.2f}")
    # audio levels measured at render time on the mastered file
    ap = os.path.join(out_dir, base + ".audio.json")
    audio = json.load(open(ap)) if os.path.exists(ap) else None
    if audio:
        lufs, tp = audio.get("integrated_lufs"), audio.get("true_peak_dbtp")
        lines.append(f"loudness={lufs} LUFS true_peak={tp} dBTP lra={audio.get('lra')}")
        if lufs is None or not (LIMITS["lufs"][0] <= lufs <= LIMITS["lufs"][1]): bad.append(f"BAD loudness {lufs} LUFS")
        if tp is None or tp > LIMITS["tp_max"]: bad.append(f"BAD true peak {tp}")
    else:
        bad.append("BAD missing audio.json (no loudness measurement)")
    # visual metrics
    fr = frames(f, os.path.join(qa_dir, "_q", base))
    busy, top, low, diffs = [], [], [], []
    prev = None
    for p in fr:
        im = np.asarray(Image.open(p).convert("L"), dtype=np.float32)
        h = im.shape[0]
        band = im[int(h * 0.15): int(h * 0.80)]
        bs = block_std(band)
        busy.append(float((bs > 14).mean()))
        e = np.abs(np.diff(im, axis=0)).mean(axis=1)
        e = np.append(e, 0)
        tot = e.sum() + 1e-6
        top.append(float(e[: h // 3].sum() / tot))
        low.append(float(e[int(h * 0.5): int(h * 0.8)].sum() / tot))
        if prev is not None: diffs.append(float(np.abs(im[int(h * .15):int(h * .80)] - prev[int(h * .15):int(h * .80)]).mean()))
        prev = im
    n = len(fr)
    busy_a, diffs_a = np.array(busy), np.array(diffs)
    mid = slice(int(0.5 * FPS_Q), max(int(0.5 * FPS_Q) + 1, n - int(0.6 * FPS_Q)))
    empty_s = float((busy_a[mid] < LIMITS["min_busy_frame"]).sum() / FPS_Q)
    static, run_len, longest = 0, 0, 0
    for d in diffs_a:
        run_len = run_len + 1 if d < 0.9 else 0
        longest = max(longest, run_len)
    metrics = dict(frames=n, busy_mean=round(float(busy_a[mid].mean()), 3), busy_min=round(float(busy_a[mid].min()), 3), empty_seconds=empty_s,
                   top_share_mean=round(float(np.mean(top)), 3), lower_share_mean=round(float(np.mean(low)), 3),
                   change_mean=round(float(diffs_a.mean()), 2), longest_static_s=round(longest / FPS_Q, 2), audio=audio)
    lines.append("metrics=" + json.dumps({k: v for k, v in metrics.items() if k != "audio"}))
    if metrics["busy_mean"] < LIMITS["min_busy_mean"]: bad.append(f"BAD content coverage {metrics['busy_mean']} (empty canvas)")
    if empty_s > LIMITS["max_empty_s"]: bad.append(f"BAD empty frames for {empty_s}s")
    if metrics["top_share_mean"] > LIMITS["max_top_share"]: bad.append(f"BAD top-heavy {metrics['top_share_mean']}")
    if metrics["lower_share_mean"] < LIMITS["min_lower_share"]: bad.append(f"BAD lower canvas unused {metrics['lower_share_mean']}")
    if metrics["longest_static_s"] > LIMITS["max_static_s"]: bad.append(f"BAD static run {metrics['longest_static_s']}s")
    if metrics["change_mean"] < LIMITS["min_change_mean"]: bad.append(f"BAD too little motion {metrics['change_mean']}")
    with open(os.path.join(qa_dir, base + ".mp4.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines + bad) + "\n")
    json.dump({**metrics, "limits": LIMITS, "bad": bad}, open(os.path.join(qa_dir, base + ".metrics.json"), "w"), indent=1)
    print(base, "OK" if not bad else "FAIL", " | ".join(lines[1:]), bad)
    if bad: ok_all = False

if not glob.glob(os.path.join(out_dir, "*.mp4")):
    print("BAD no mp4 files in", out_dir); ok_all = False
if not ok_all:
    open(os.path.join(qa_dir, "TECH_QA_FAILED.txt"), "w").write("see *.mp4.txt\n")
    sys.exit(1)
print("QA passed")
