#!/usr/bin/env python3
"""
Photographic cut-out sticker, written for this repository (not derived from any other project's code).

  cutout.py IN.jpg OUT.png [--model u2net_human_seg] [--paper 16] [--bw] [--seed 1] [--max 1400]

1. rembg (MIT) with the U2-Net model (Apache-2.0) removes the background and writes an alpha mask.
2. --paper N adds a torn-paper border of about N px: the mask is grown, then its edge is roughened with seeded noise,
   so the outline is irregular like a torn sticker. The paper is off-white with grain.
3. --bw converts the subject to high-contrast monochrome with a light halftone-style grain (archival look).
The output is a transparent PNG cropped to the sticker. Nothing is generated: every pixel of the subject comes from the input photo.
"""
import argparse
import numpy as np
from PIL import Image, ImageFilter, ImageOps, ImageEnhance


def torn_edge(alpha: Image.Image, border: int, seed: int) -> Image.Image:
    rng = np.random.default_rng(seed)
    grown = alpha.filter(ImageFilter.GaussianBlur(border))
    g = np.asarray(grown, dtype=np.float32) / 255.0
    noise = rng.random(g.shape).astype(np.float32)
    # coarse + fine noise, so the edge wanders slowly and also frays
    coarse = np.asarray(Image.fromarray((noise * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(border * 0.9)), dtype=np.float32) / 255.0
    coarse = (coarse - coarse.mean()) / (coarse.std() + 1e-6)
    fine = (noise - 0.5) * 2.0
    edge = g + 0.10 * coarse + 0.06 * fine
    mask = (edge > 0.36).astype(np.uint8) * 255
    return Image.fromarray(mask).filter(ImageFilter.GaussianBlur(0.8))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("dst")
    ap.add_argument("--model", default="u2net_human_seg")
    ap.add_argument("--paper", type=int, default=0)
    ap.add_argument("--bw", action="store_true")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--max", type=int, default=1400)
    a = ap.parse_args()

    from rembg import new_session, remove
    img = Image.open(a.src).convert("RGB")
    img.thumbnail((a.max, a.max), Image.LANCZOS)
    cut = remove(img, session=new_session(a.model), alpha_matting=False).convert("RGBA")
    # keep the main subject: drop specks that are not part of the largest connected region
    alpha = cut.split()[-1]
    alpha = alpha.point(lambda v: 255 if v > 24 else 0)
    # keep only the largest connected region, so crowd fragments and stray objects are dropped; refuse a cut-out that is mostly fragments
    from scipy import ndimage
    arr = np.asarray(alpha) > 0
    labels, n = ndimage.label(arr)
    if n > 1:
        sizes = ndimage.sum(arr, labels, range(1, n + 1))
        keep = int(np.argmax(sizes)) + 1
        frac = float(sizes.max() / max(1.0, sizes.sum()))
        arr = labels == keep
        if frac < 0.6:
            raise SystemExit(f"cutout rejected: the largest region is only {frac:.0%} of the mask (several subjects or a crowd)")
        alpha = Image.fromarray((arr * 255).astype(np.uint8))
    cut.putalpha(alpha)

    if a.bw:
        gray = ImageOps.grayscale(cut.convert("RGB"))
        gray = ImageEnhance.Contrast(ImageOps.autocontrast(gray, cutoff=1)).enhance(1.25)
        rng = np.random.default_rng(a.seed + 7)
        arr = np.asarray(gray, dtype=np.float32) + rng.normal(0, 6, gray.size[::-1]).astype(np.float32)
        gray = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        rgb = Image.merge("RGB", (gray, gray, gray))
        cut = Image.merge("RGBA", (*rgb.split(), cut.split()[-1]))

    if a.paper > 0:
        pad = a.paper * 3
        canvas = Image.new("RGBA", (cut.width + pad * 2, cut.height + pad * 2), (0, 0, 0, 0))
        canvas.paste(cut, (pad, pad), cut)
        mask = torn_edge(canvas.split()[-1], a.paper, a.seed)
        rng = np.random.default_rng(a.seed + 3)
        base = np.full((canvas.height, canvas.width, 3), (243, 238, 226), dtype=np.float32)
        base += rng.normal(0, 3.2, base.shape).astype(np.float32)
        paper = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).convert("RGBA")
        paper.putalpha(mask)
        out = Image.alpha_composite(paper, canvas)
        bbox = out.split()[-1].getbbox()
        cut = out.crop(bbox) if bbox else out
    else:
        bbox = cut.split()[-1].getbbox()
        if bbox:
            cut = cut.crop(bbox)

    cut.save(a.dst, optimize=True)
    print(f"cutout: {a.src} -> {a.dst} {cut.size[0]}x{cut.size[1]} model={a.model} paper={a.paper} bw={a.bw}")


if __name__ == "__main__":
    main()
