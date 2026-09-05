#!/usr/bin/env python3
"""
qa_frames.py — zero-cost deterministic motion-graphics defect detector.

Extracts frames from a rendered video and reports the defects that make output
look robotic, without calling any model. Run this BEFORE spending a vision call.

Requires: ffmpeg on PATH, `pip install pillow numpy`.

Usage:
  python scripts/qa_frames.py --video out/qa.mp4 --report qa/report.json \
      --sheet qa/sheet.jpg [--fps 15] [--safe 96,200,96,380]

Exit code 1 if any hard defect is found, so CI can gate on it.
"""

import argparse, json, os, shutil, subprocess, sys, tempfile
import numpy as np
from PIL import Image

# ---- thresholds ------------------------------------------------------------
LINEARITY_FAIL = 0.80     # velocity uniformity; >= this is constant velocity (robotic)
MOTION_EPS = 0.0015       # fraction of pixels changed to count a frame as "moving"
HOLD_SECONDS = 0.5        # dead-still stretch longer than this is a defect
MAX_ALIGN_COLUMNS = 3     # distinct left edges per frame before it reads as ungridded
CONTRAST_MIN = 40         # min mean |luma difference| between content and its surround
POPCORN_MIN = 3           # this many elements appearing on one frame = no stagger


def extract(video, fps, workdir):
    out = os.path.join(workdir, "f_%05d.png")
    subprocess.run(
        ["ffmpeg", "-v", "error", "-i", video, "-vf", f"fps={fps}", out],
        check=True,
    )
    files = sorted(f for f in os.listdir(workdir) if f.startswith("f_"))
    if not files:
        sys.exit("no frames extracted — is the video valid?")
    return [os.path.join(workdir, f) for f in files]


def load(paths, max_w=640):
    arrs = []
    for p in paths:
        im = Image.open(p).convert("RGB")
        if im.width > max_w:
            im = im.resize((max_w, int(im.height * max_w / im.width)), Image.BILINEAR)
        arrs.append(np.asarray(im, dtype=np.float32))
    return np.stack(arrs)


def luma(a):
    return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722


def background_color(L):
    """Modal luminance of the first frame — assumed to be the backdrop."""
    hist, edges = np.histogram(L[0], bins=32, range=(0, 255))
    i = int(np.argmax(hist))
    return (edges[i] + edges[i + 1]) / 2


def content_mask(L, bg, tol=28):
    return np.abs(L - bg) > tol


# ---- detectors -------------------------------------------------------------

def activity_mask(L, thresh=8.0):
    """Pixels that change over the clip — isolates moving elements from static ones."""
    return L.std(axis=0) > thresh


def centroid_series(L, bg, act):
    """Centroid of moving content per frame. None where nothing is on screen."""
    out = []
    for i in range(L.shape[0]):
        m = (np.abs(L[i] - bg) > 28) & act
        if m.sum() < 40:
            out.append(None)
            continue
        ys, xs = np.nonzero(m)
        out.append((float(xs.mean()), float(ys.mean())))
    return out


def velocity_profile(cent):
    """Frame-to-frame displacement of the moving centroid."""
    d = []
    for i in range(1, len(cent)):
        a, b = cent[i - 1], cent[i]
        d.append(0.0 if (a is None or b is None)
                 else float(np.hypot(b[0] - a[0], b[1] - a[1])))
    return np.array(d)


def moving_spans(d, min_len=4):
    """Contiguous runs where the element is actually travelling."""
    if d.size == 0:
        return []
    nz = d[d > 0.3]
    if nz.size == 0:
        return []
    thr = max(0.3, 0.12 * float(np.median(nz)))
    on = d > thr
    spans, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_len:
                spans.append((start, i))
            start = None
    if start is not None and len(on) - start >= min_len:
        spans.append((start, len(on)))
    return spans


def linearity(d, a, b):
    """1.0 == perfectly constant velocity (robotic). Strong ease-out lands 0.1-0.4."""
    seg = d[a:b]
    if seg.size < 4 or seg.mean() <= 1e-6:
        return None
    cv = float(seg.std() / seg.mean())
    return round(max(0.0, min(1.0, 1.0 - cv)), 3)


def bboxes(mask, min_area=180):
    """Coarse connected-component boxes via row/column run merging (no scipy)."""
    rows = np.nonzero(mask.any(axis=1))[0]
    if rows.size == 0:
        return []
    bands, start, prev = [], rows[0], rows[0]
    for r in rows[1:]:
        if r - prev > 6:
            bands.append((start, prev))
            start = r
        prev = r
    bands.append((start, prev))
    out = []
    for y0, y1 in bands:
        sub = mask[y0:y1 + 1]
        cols = np.nonzero(sub.any(axis=0))[0]
        if cols.size == 0:
            continue
        cstart, cprev = cols[0], cols[0]
        for c in cols[1:]:
            if c - cprev > 12:
                if (cprev - cstart + 1) * (y1 - y0 + 1) >= min_area:
                    out.append((int(cstart), int(y0), int(cprev), int(y1)))
                cstart = c
            cprev = c
        if (cprev - cstart + 1) * (y1 - y0 + 1) >= min_area:
            out.append((int(cstart), int(y0), int(cprev), int(y1)))
    return out


def contact_sheet(paths, dest, cols=4, rows=3, width=1280):
    n = cols * rows
    idx = np.linspace(0, len(paths) - 1, num=min(n, len(paths))).astype(int)
    ims = [Image.open(paths[i]).convert("RGB") for i in idx]
    cw = width // cols
    ch = int(cw * ims[0].height / ims[0].width)
    sheet = Image.new("RGB", (cw * cols, ch * rows), (16, 16, 16))
    for k, im in enumerate(ims):
        sheet.paste(im.resize((cw, ch), Image.BILINEAR), ((k % cols) * cw, (k // cols) * ch))
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    sheet.save(dest, quality=82)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--report", default="qa/report.json")
    ap.add_argument("--sheet", default="qa/sheet.jpg")
    ap.add_argument("--fps", type=int, default=15)
    ap.add_argument("--safe", default="0.09,0.10,0.09,0.20",
                    help="left,top,right,bottom as fractions of canvas (resolution independent)")
    args = ap.parse_args()

    work = tempfile.mkdtemp(prefix="qa_")
    try:
        paths = extract(args.video, args.fps, work)
        A = load(paths)
        L = luma(A)
        H, W = L.shape[1], L.shape[2]
        fl, ft, fr, fb = [float(v) for v in args.safe.split(",")]
        sl, sr = fl * W, fr * W
        st, sb = ft * H, fb * H

        bg = background_color(L)
        act = activity_mask(L)
        cent = centroid_series(L, bg, act)
        d = velocity_profile(cent)
        frac = (np.abs(np.diff(L, axis=0)) > 12).mean(axis=(1, 2))

        defects, motions = [], []
        for a, b in moving_spans(d):
            r2 = linearity(d, a, b)
            if r2 is None:
                continue
            entry = {"frames": [int(a), int(b)], "velocity_linearity": r2}
            motions.append(entry)
            if r2 >= LINEARITY_FAIL:
                defects.append({
                    "type": "linear_motion", "severity": "hard",
                    "frames": [int(a), int(b)], "value": r2,
                    "fix": "replace linear interpolate() with a cubic-bezier ease-out "
                           "from a shot recipe card; add 3-8% overshoot on entrance",
                })

        # holds
        hold_len = max(1, int(HOLD_SECONDS * args.fps))
        still, run = [], 0
        for i, f in enumerate(frac):
            run = run + 1 if f <= MOTION_EPS else 0
            if run == hold_len:
                still.append(int(i - hold_len + 1))
        for s in still:
            defects.append({"type": "dead_hold", "severity": "soft", "frame": s,
                            "fix": "add a slow drift, scale breath, or grain so the frame stays alive"})

        # margins, alignment, contrast, popcorn
        prev_count, align_max, margin_hits, contrast_hits, popcorn = 0, 0, [], [], []
        for i in range(0, len(L), max(1, len(L) // 24)):
            m = content_mask(L[i], bg)
            boxes = bboxes(m)
            align_max = max(align_max, len({round(b[0] / 8) for b in boxes}))
            for x0, y0, x1, y1 in boxes:
                if x0 < sl or y0 < st or x1 > W - sr or y1 > H - sb:
                    margin_hits.append({"frame": int(i), "box": [x0, y0, x1, y1]})
                inner = L[i][y0:y1 + 1, x0:x1 + 1]
                if inner.size and abs(float(inner.mean()) - bg) < CONTRAST_MIN:
                    contrast_hits.append({"frame": int(i), "box": [x0, y0, x1, y1]})
            if len(boxes) - prev_count >= POPCORN_MIN:
                popcorn.append(int(i))
            prev_count = len(boxes)

        if align_max > MAX_ALIGN_COLUMNS:
            defects.append({"type": "no_alignment_grid", "severity": "hard",
                            "distinct_left_edges": int(align_max),
                            "fix": "snap every element to one shared column x (or centre); "
                                   "1-2 distinct left edges per frame, never more than 3"})
        for h in margin_hits[:12]:
            defects.append({"type": "margin_violation", "severity": "hard", **h,
                            "fix": "move inside the safe area; the bottom band is covered by YouTube UI"})
        for h in contrast_hits[:8]:
            defects.append({"type": "low_contrast", "severity": "soft", **h,
                            "fix": "raise luminance separation or add a scrim behind the text"})
        for f in popcorn[:8]:
            defects.append({"type": "popcorn_entrance", "severity": "hard", "frame": f,
                            "fix": "stagger entrances 2-4 frames apart in reading order"})

        contact_sheet(paths, args.sheet)

        report = {
            "video": args.video,
            "frames_analyzed": int(len(L)),
            "background_luma": round(float(bg), 1),
            "motions": motions,
            "summary": {
                "hard_defects": sum(1 for d in defects if d["severity"] == "hard"),
                "soft_defects": sum(1 for d in defects if d["severity"] == "soft"),
                "worst_linearity": max([m["velocity_linearity"] for m in motions], default=None),
                "distinct_left_edges": int(align_max),
            },
            "defects": defects,
            "contact_sheet": args.sheet,
        }
        os.makedirs(os.path.dirname(args.report) or ".", exist_ok=True)
        with open(args.report, "w") as fh:
            json.dump(report, fh, indent=2)

        s = report["summary"]
        print(json.dumps(s, indent=2))
        print(f"report: {args.report}   contact sheet: {args.sheet}")
        sys.exit(1 if s["hard_defects"] else 0)
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
