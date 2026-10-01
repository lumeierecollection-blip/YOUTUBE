#!/usr/bin/env python3
"""
cutout_lib.py - isolate a real photographed object onto a transparent PNG and
decide whether the isolation is usable (the concept-cutout library,
public/cutouts/, built by scripts/build-cutout-library.mjs).

    python3 scripts/cutout_lib.py isolate <in.jpg> <out.png> [--rect-ok] [--grounded] [--multi] [--max-side 1024]
    python3 scripts/cutout_lib.py check   <cutout.png|in.jpg-mask...>   (reads an RGBA PNG, prints the report)

Prints ONE JSON line {"ok": bool, "why": str, ...measurements} and exits 0
whether or not the result is usable: the caller decides (the builder tries the
next candidate).

Unlike scripts/isolate-cutout.py (the CUTOUT beat's grayscale object) this keeps
the photograph's own COLOUR: these are physical objects sitting on the studio.

A result is NOT usable when (alpha_report):
  1. the mask covers under 12% of the photo (nothing isolated), or over 90%
     (nothing was removed: the photo is still a rectangle);
  2. opaque pixels touch ALL FOUR edges of the photo (the object is cropped
     and is not isolated) — the brief's rule;
  3. the mask runs along any one edge for more than 40% of that side (the
     object is cut off by the photo's frame) — 90% along the BOTTOM edge for a
     `grounded` object (a building, a standing person), which legitimately
     rests on the photo's floor;
  4. more than 20% of what is visible is not the one largest solid region (a
     second object, a scene, leftover background); 40% for a `multi` object
     (a skyline, a stack of coins, a group);
  5. the mask fills more than 92% of its own bounding box — a rectangle was
     isolated (a phone screen, a framed print) — unless `rect_ok` (a banknote,
     a card, a sheet of paper is genuinely rectangular);
  6. after cropping to the object, fewer than 12% of the pixels are
     transparent — no real alpha mask (skipped for `rect_ok`).
Where this stops: these are geometric tests on the mask. They cannot tell a
dollar bill from a different rectangle, or the right person from the wrong one;
the builder's text relevance filter and a human look at the contact sheet
(scripts/cutout-contact-sheet.mjs) are what tie a picture to its name.

The output is cropped to the object (3% margin), longest side <= --max-side.
"""
import json
import sys


def _largest_component(solid, w, h):
    """Pixel count of the largest 8-connected True region (iterative flood fill on a small mask)."""
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
    return best


def alpha_report(alpha, rect_ok=False, grounded=False, multi=False):
    """alpha: a 2-D numpy uint8 array (the photo's mask BEFORE cropping). Returns a dict with ok / why / measurements."""
    import numpy as np

    h, w = alpha.shape
    opaque = alpha >= 128
    rep = {"ok": False, "why": "", "coverage": round(float(opaque.mean()), 4)}
    if not opaque.any():
        rep["why"] = "the mask is empty"
        return rep
    # 1. coverage of the photo
    if rep["coverage"] < 0.12:
        rep["why"] = f"the object covers {rep['coverage'] * 100:.1f}% of the photo (< 12%)"
        return rep
    if rep["coverage"] > 0.90:
        rep["why"] = f"the mask covers {rep['coverage'] * 100:.0f}% of the photo (> 90%): nothing was removed"
        return rep
    # 2. touches all four edges
    top, bottom, left, right = opaque[0, :].any(), opaque[-1, :].any(), opaque[:, 0].any(), opaque[:, -1].any()
    rep["touches"] = {"top": bool(top), "bottom": bool(bottom), "left": bool(left), "right": bool(right)}
    if top and bottom and left and right:
        rep["why"] = "opaque pixels touch all four edges: the object is cropped, not isolated"
        return rep
    # 3. the frame cuts the object along an edge
    run = {"top": float(opaque[0, :].mean()), "bottom": float(opaque[-1, :].mean()), "left": float(opaque[:, 0].mean()), "right": float(opaque[:, -1].mean())}
    rep["edge_run"] = {k: round(v, 3) for k, v in run.items()}
    for side, v in run.items():
        lim = 0.90 if (grounded and side == "bottom") else 0.40
        if v > lim:
            rep["why"] = f"the mask runs along the photo's {side} edge for {v * 100:.0f}% of it (> {lim * 100:.0f}%): cut by the frame"
            return rep
    # bounding box of the object
    ys, xs = np.where(opaque)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
    bw, bh = x1 - x0, y1 - y0
    rep["bbox"] = [x0, y0, bw, bh]
    # 4. one object: the largest solid region against everything visible (on a small copy)
    from PIL import Image

    s = 256.0 / max(w, h)
    small = Image.fromarray(alpha).resize((max(1, int(w * s)), max(1, int(h * s))), Image.BILINEAR)
    sa = np.asarray(small)
    sw, sh = small.size
    solid = (sa >= 128).ravel().tolist()
    visible = int((sa > 25).sum())
    best = _largest_component(solid, sw, sh)
    share = best / max(1, visible)
    rep["one_object"] = round(share, 3)
    need = 0.60 if multi else 0.80
    if share < need:
        rep["why"] = f"the largest solid region is {share * 100:.0f}% of what is visible (< {need * 100:.0f}%): more than one object / a scene"
        return rep
    # 5. a rectangle was isolated
    fill = float(opaque[y0:y1, x0:x1].mean())
    rep["rect_fill"] = round(fill, 3)
    if fill > 0.92 and not rect_ok:
        rep["why"] = f"the mask fills {fill * 100:.0f}% of its bounding box (> 92%): a rectangle, not an object"
        return rep
    # 6. real transparency after the crop
    transparent = 1.0 - fill
    rep["transparent_after_crop"] = round(transparent, 3)
    if not rect_ok and transparent < 0.12:
        rep["why"] = f"only {transparent * 100:.0f}% of the cropped result is transparent (< 12%)"
        return rep
    rep["ok"] = True
    rep["why"] = "ok"
    return rep


def isolate(src, out, rect_ok=False, grounded=False, multi=False, max_side=1024):
    import numpy as np
    from PIL import Image

    im = Image.open(src)
    im.load()
    has_alpha = im.mode in ("RGBA", "LA") or "transparency" in im.info
    rgba = None
    if has_alpha:
        a = np.asarray(im.convert("RGBA"))[:, :, 3]
        # A source that already has a real alpha (a transparent PNG) is used as is.
        if (a < 250).mean() >= 0.05:
            rgba = im.convert("RGBA")
    if rgba is None:
        from rembg import new_session, remove

        rgb = im.convert("RGB")
        rgba = remove(rgb, session=new_session("u2net")).convert("RGBA")
    alpha = np.asarray(rgba)[:, :, 3]
    rep = alpha_report(alpha, rect_ok=rect_ok, grounded=grounded, multi=multi)
    rep["source_size"] = [im.size[0], im.size[1]]
    if not rep["ok"]:
        return rep
    x0, y0, bw, bh = rep["bbox"]
    m = int(0.03 * max(bw, bh))
    box = (max(0, x0 - m), max(0, y0 - m), min(rgba.size[0], x0 + bw + m), min(rgba.size[1], y0 + bh + m))
    crop = rgba.crop(box)
    if max(crop.size) > max_side:
        k = max_side / float(max(crop.size))
        crop = crop.resize((max(1, round(crop.size[0] * k)), max(1, round(crop.size[1] * k))), Image.LANCZOS)
    # A colour-fringe guard: rembg leaves the background's colour in semi-transparent edge pixels.
    arr = np.asarray(crop).copy()
    arr[arr[:, :, 3] < 8, :3] = 0
    Image.fromarray(arr, "RGBA").save(out, optimize=True)
    rep["size"] = [crop.size[0], crop.size[1]]
    return rep


def main(argv):
    if len(argv) >= 3 and argv[0] == "isolate":
        flags = set(a for a in argv[3:] if a.startswith("--") and a != "--max-side")
        ms = 1024
        if "--max-side" in argv:
            ms = int(argv[argv.index("--max-side") + 1])
        try:
            rep = isolate(argv[1], argv[2], rect_ok="--rect-ok" in flags, grounded="--grounded" in flags, multi="--multi" in flags, max_side=ms)
        except Exception as e:  # noqa: BLE001
            rep = {"ok": False, "why": f"isolation failed: {type(e).__name__}: {e}"}
        print(json.dumps(rep))
        return 0
    if len(argv) >= 2 and argv[0] == "check":
        import numpy as np
        from PIL import Image

        a = np.asarray(Image.open(argv[1]).convert("RGBA"))[:, :, 3]
        flags = set(argv[2:])
        print(json.dumps(alpha_report(a, rect_ok="--rect-ok" in flags, grounded="--grounded" in flags, multi="--multi" in flags)))
        return 0
    print(json.dumps({"ok": False, "why": "usage: cutout_lib.py isolate <in> <out> [flags] | check <rgba.png> [flags]"}))
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
