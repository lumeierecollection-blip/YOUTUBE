# Cuts the player out of each photo the thumbnails use and each photo the video shows beside a stat, like the reference does.
# usage: python cutout.py <episode_dir>   (run after build-plan.mjs, which copies the photos into render/public/ep/images)
# Writes render/public/ep/images/cutout-<img>.png, cropped to the player. The photo is the real photo with its background removed
# by the open-source isnet-general-use model (rembg); nothing is generated or painted in. The photo credit is unchanged.
import json, os, sys
from PIL import Image, ImageFilter
from rembg import new_session, remove

ep = os.path.abspath(sys.argv[1])
rl = os.path.dirname(os.path.dirname(ep))
props = json.load(open(os.path.join(ep, "out", "props.json"), encoding="utf8"))
tp = os.path.join(ep, "thumbnails.json")
variants = json.load(open(tp, encoding="utf8"))["variants"] if os.path.exists(tp) else []
pub = os.path.join(rl, "render", "public")
session = new_session("isnet-general-use")
def walk(v, out):
    if isinstance(v, dict):
        for k, x in v.items():
            if k == "img" and isinstance(x, str): out.add(x)
            elif k == "imgs" and isinstance(x, list): out.update(i for i in x if isinstance(i, str))
            else: walk(x, out)
    elif isinstance(v, list):
        for x in v: walk(x, out)
    return out
keys = set()
for x in variants:
    walk(x, keys)
if props.get("format") == "realm":
    for sc in props["scenes"]: walk(sc["visual"], keys)
else:
    keys |= {sc["visual"]["img"] for sc in props["scenes"] if sc["visual"].get("type") == "photo" and sc["visual"].get("stats")}
ij = os.path.join(ep, "images", "images.json")
masks = {i["id"]: i["mask"] for i in json.load(open(ij, encoding="utf8"))["images"] if i.get("mask")} if os.path.exists(ij) else {}
faces = {i["id"]: i["face"] for i in json.load(open(ij, encoding="utf8"))["images"] if i.get("face")} if os.path.exists(ij) else {}
for img in sorted(keys):
    src = os.path.join(pub, props["images"][img]["file"])
    im = Image.open(src).convert("RGB")
    im.thumbnail((1800, 1800))
    out = remove(im, session=session)
    # Optional per-image "mask" in images.json: fractional boxes [x0,y0,x1,y1] cleared after the cut, for a second person the model kept.
    if img in masks:
        from PIL import ImageDraw
        al = out.getchannel("A"); dr = ImageDraw.Draw(al); W, H = out.size
        for x0, y0, x1, y1 in masks[img]: dr.rectangle([x0 * W, y0 * H, x1 * W, y1 * H], fill=0)
        out.putalpha(al)
    # Clean the edge: pull the matte in a few pixels so the old background colour does not show as a fringe, then soften it.
    a = out.getchannel("A").point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.MinFilter(7)).filter(ImageFilter.GaussianBlur(2.2))
    out.putalpha(a)
    # Keep only the largest connected piece, so bits of a second person or the background the model left floating are dropped.
    import numpy as np
    from scipy import ndimage
    arr = np.array(out.getchannel("A"))
    lab, n = ndimage.label(arr > 40)
    if n > 1:
        sizes = ndimage.sum(arr > 40, lab, range(1, n + 1))
        arr = np.where(lab == 1 + int(np.argmax(sizes)), arr, 0).astype(np.uint8)
        out.putalpha(Image.fromarray(arr))
    box = out.getchannel("A").point(lambda a: 255 if a > 40 else 0).getbbox()
    out = out.crop(box)
    dst = os.path.join(pub, "ep", "images", f"cutout-{img}.png")
    out.save(dst)
    print("cutout", img, out.size, "->", dst)
    # Head-and-shoulders crop for the close-up thumbnails: optional "face" {"bottom","cx","w"} per image in images.json, as fractions of the cut-out.
    fc = faces.get(img, {})
    W, H = out.size
    fw = fc.get("w", 0.9) * W
    x0 = max(0, min(W - fw, fc.get("cx", 0.5) * W - fw / 2))
    out.crop((int(x0), 0, int(x0 + fw), int(fc.get("bottom", 0.32) * H))).save(os.path.join(pub, "ep", "images", f"face-{img}.png"))
