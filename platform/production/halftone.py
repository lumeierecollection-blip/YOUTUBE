#!/usr/bin/env python3
"""
Halftone ink bake for a photographic cut-out (RGBA PNG from cutout.py): per-cell luminance -> ink dot radius, trimmed transparent PNG.

Adapted from skills/vox-style-animation/scripts/halftone_objects.py in https://github.com/Cele-san/vox-style-animation (MIT licence,
Copyright the Cele-san authors). Changes: the mask comes from the cut-out's alpha channel instead of a white-background threshold, the
aspect ratio is kept, and the ink colour is a parameter. Every dot is computed from the real photograph; nothing is generated.

  halftone.py IN.png OUT.png [--size 900] [--cell 11] [--ink 22,21,19]
"""
import argparse
from PIL import Image, ImageDraw


def bake(src, dst, size, cell, ink):
    im = Image.open(src).convert("RGBA")
    ss = 2
    w, h = im.size
    k = size * ss / max(w, h)
    im = im.resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)
    big_w, big_h = im.size
    alpha = im.getchannel("A")
    g = Image.new("RGB", im.size, (255, 255, 255))
    g.paste(im.convert("RGB"), mask=alpha)
    g = g.convert("L")
    lo, hi = g.getextrema()
    if hi > lo:
        g = g.point(lambda v: max(0, min(255, int((v - lo) * 255 / (hi - lo)))))
    canvas = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    gp, mp = g.load(), alpha.load()
    c = cell * ss
    rmax = c * 0.62
    for cy in range(0, big_h, c):
        for cx in range(0, big_w, c):
            tot = n = mtot = 0
            for y in range(cy, min(cy + c, big_h), 3):
                for x in range(cx, min(cx + c, big_w), 3):
                    tot += gp[x, y]
                    mtot += mp[x, y]
                    n += 1
            if n == 0 or mtot / n < 128:
                continue
            r = rmax * (1 - (tot / n) / 255) ** 0.75
            if r < 0.8:
                continue
            cx0, cy0 = cx + c / 2, cy + c / 2
            d.ellipse([cx0 - r, cy0 - r, cx0 + r, cy0 + r], fill=tuple(ink) + (255,))
    small = canvas.resize((big_w // ss, big_h // ss), Image.LANCZOS)
    box = small.getbbox()
    if box:
        small = small.crop(box)
    small.save(dst)
    print(f"halftone: {dst} {small.size}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--size", type=int, default=900)
    ap.add_argument("--cell", type=int, default=11)
    ap.add_argument("--ink", default="22,21,19")
    a = ap.parse_args()
    bake(a.src, a.dst, a.size, a.cell, [int(x) for x in a.ink.split(",")])
