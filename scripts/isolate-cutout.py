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
    isolated: a phone screen, a monitor, a framed print, a book cover), or
  - the mask runs along the photo's own border for more than 20% of any
    side: the object is cut off by the photo's frame, or the background was
    only partly removed. Run 36397373831 ch-44 drew both - a padlock
    collage kept as a whole rectangular photo (rect_fill under 0.92 because
    of a few holes) and a magnifier with two straight photo-edge sides, or
  - more than 25% of what is visible in the result is NOT the one object:
    everything outside the largest solid connected region (a second
    object, a scene, a leftover patch of background) plus faint haze the
    mask kept (alpha 26-127) - "one object, not a scene", or
  - the final PNG (cropped to the object) has under 15% transparent pixels:
    no real alpha mask, the rectangle is still (nearly) all opaque.
Where this stops: these are geometric tests on the mask. A rectangular
object that is genuinely the subject (a banknote seen flat) is rejected
too; an irregular object that is the wrong subject is not caught here - the
fetcher's source-text verification is what ties the picture to the words.
"""
import json
import sys


def largest_component(alpha_small):
    """Size of the largest 8-connected solid (alpha >= 128) region, and the
    count of visible (alpha > 25) pixels, on a small copy of the mask."""
    w, h = alpha_small.size
    a = list(alpha_small.getdata())
    solid = [v >= 128 for v in a]
    visible = sum(1 for v in a if v > 25)
    seen = [False] * (w * h)
    best = 0
    for i in range(w * h):
        if not solid[i] or seen[i]:
            continue
        seen[i] = True
        stack, n = [i], 0
        while stack:
            j = stack.pop()
            n += 1
            x, y = j % w, j // w
            for dy in (-1, 0, 1):
                yy = y + dy
                if yy < 0 or yy >= h:
                    continue
                for dx in (-1, 0, 1):
                    xx = x + dx
                    if xx < 0 or xx >= w:
                        continue
                    k = yy * w + xx
                    if solid[k] and not seen[k]:
                        seen[k] = True
                        stack.append(k)
        best = max(best, n)
    return best, visible


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
        # Opaque share of each image border (top, bottom, left, right).
        px = alpha.load()
        def edge(points):
            pts = list(points)
            return sum(1 for (x, y) in pts if px[x, y] >= 128) / float(max(1, len(pts)))
        edges = {
            "top": edge((x, 0) for x in range(w)), "bottom": edge((x, h - 1) for x in range(w)),
            "left": edge((0, y) for y in range(h)), "right": edge((w - 1, y) for y in range(h)),
        }
        worst = max(edges, key=edges.get)
        # One object? Measured on a copy at most 256 px on its long side.
        k = min(1.0, 256.0 / max(w, h))
        small = alpha.resize((max(1, int(w * k)), max(1, int(h * k))), Image.BILINEAR)
        main_px, visible_px = largest_component(small)
        not_object = (visible_px - main_px) / float(max(1, visible_px))
        res = {"ok": True, "coverage": round(coverage, 4), "rect_fill": round(rect_fill, 4),
               "edge_touch": round(edges[worst], 4), "not_object": round(not_object, 4), "why": ""}
        if coverage < 0.15:
            res.update(ok=False, why=f"alpha covers {coverage:.1%} (< 15%)")
        elif coverage > 0.90:
            res.update(ok=False, why=f"alpha covers {coverage:.1%} (> 90%): background not removed")
        elif rect_fill > 0.92:
            res.update(ok=False, why=f"isolated shape fills {rect_fill:.1%} of its box: a rectangle (screen/print), not an object")
        elif edges[worst] > 0.20:
            res.update(ok=False, why=f"mask runs along {edges[worst]:.0%} of the photo's {worst} edge: object cut off by the frame / background not removed")
        elif not_object > 0.25:
            res.update(ok=False, why=f"{not_object:.0%} of the isolated image is not the main object (a scene, a second object or leftover background; limit 25%)")
        if res["ok"]:
            grey = ImageEnhance.Contrast(rgba.convert("L")).enhance(1.15)
            cut = Image.merge("LA", (grey, alpha))
            cut = cut.crop(bbox)
            ca = cut.getchannel("A").histogram()
            transparent = sum(ca[:128]) / float(max(1, cut.size[0] * cut.size[1]))
            res["transparent"] = round(transparent, 4)
            if transparent < 0.15:
                res.update(ok=False, why=f"[cutout] isolation failed, no alpha mask: only {transparent:.0%} of the cut-out is transparent (a rectangle, limit 15%)")
            else:
                cut.save(out, "PNG")
        print(json.dumps(res))
        return 0
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"ok": False, "why": f"isolation error: {str(e)[:160]}"}))
        return 0


if __name__ == "__main__":
    sys.exit(main())
