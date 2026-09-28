#!/usr/bin/env python3
"""
isolate-cutout.py - segment the object out of a fetched photo with rembg,
make it grayscale (+15% contrast), and save it as a PNG with alpha.

    python scripts/isolate-cutout.py <in.jpg> <out.png>

Prints one JSON line: {"ok": bool, "coverage": float, "rect_fill": float, "why": str}
and exits 0 whether or not the isolation is usable - the caller decides
(scripts/render-and-qa.js discards and fetches the next result).

A result is NOT usable when:
  - the alpha mask covers less than 15% of the image (nothing isolated), or
  - it covers more than 90% (nothing was removed - the photo is still a
    rectangle), or
  - the mask fills more than 92% of its own bounding box (a rectangle was
    isolated: a phone screen, a monitor, a framed print, a book cover).
Where this stops: these are geometric tests on the mask. A rectangular
object that is genuinely the subject (a banknote seen flat) is rejected
too; an irregular object that is the wrong subject is not caught here - the
fetcher's source-text verification is what ties the picture to the words.
"""
import json
import sys


def main():
    if len(sys.argv) != 3:
        print(json.dumps({"ok": False, "why": "usage: isolate-cutout.py <in> <out>"}))
        return 2
    src, out = sys.argv[1], sys.argv[2]
    try:
        from rembg import remove
        from PIL import Image, ImageEnhance
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"ok": False, "why": f"rembg unavailable: {e}"}))
        return 3
    try:
        img = Image.open(src).convert("RGB")
        img.thumbnail((1200, 1200))
        rgba = remove(img)
        if rgba.mode != "RGBA":
            rgba = rgba.convert("RGBA")
        alpha = rgba.getchannel("A")
        w, h = alpha.size
        hist = alpha.histogram()
        solid = sum(hist[128:])
        coverage = solid / float(w * h)
        bbox = alpha.point(lambda v: 255 if v >= 128 else 0).getbbox()
        rect_fill = 0.0
        if bbox:
            bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
            rect_fill = solid / float(max(1, bw * bh))
        res = {"ok": True, "coverage": round(coverage, 4), "rect_fill": round(rect_fill, 4), "why": ""}
        if coverage < 0.15:
            res.update(ok=False, why=f"alpha covers {coverage:.1%} (< 15%)")
        elif coverage > 0.90:
            res.update(ok=False, why=f"alpha covers {coverage:.1%} (> 90%): background not removed")
        elif rect_fill > 0.92:
            res.update(ok=False, why=f"isolated shape fills {rect_fill:.1%} of its box: a rectangle (screen/print), not an object")
        if res["ok"]:
            grey = ImageEnhance.Contrast(rgba.convert("L")).enhance(1.15)
            cut = Image.merge("LA", (grey, alpha))
            cut = cut.crop(bbox)
            cut.save(out, "PNG")
        print(json.dumps(res))
        return 0
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"ok": False, "why": f"isolation error: {str(e)[:160]}"}))
        return 0


if __name__ == "__main__":
    sys.exit(main())
