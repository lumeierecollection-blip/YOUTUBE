# Cuts the player out of each photo named in thumbnails.json so the thumbnail can use a cutout like the reference.
# usage: python cutout.py <episode_dir>   (run after build-plan.mjs, which copies the photos into render/public/ep/images)
# Writes render/public/ep/images/cutout-<img>.png, cropped to the player. The photo is the real photo with its background removed
# by the open-source isnet-general-use model (rembg); nothing is generated or painted in. The photo credit is unchanged.
import json, os, sys
from PIL import Image, ImageFilter
from rembg import new_session, remove

ep = os.path.abspath(sys.argv[1])
rl = os.path.dirname(os.path.dirname(ep))
props = json.load(open(os.path.join(ep, "out", "props.json"), encoding="utf8"))
variants = json.load(open(os.path.join(ep, "thumbnails.json"), encoding="utf8"))["variants"]
pub = os.path.join(rl, "render", "public")
session = new_session("isnet-general-use")
for v in dict((x["img"], x) for x in variants).values():
    src = os.path.join(pub, props["images"][v["img"]]["file"])
    im = Image.open(src).convert("RGB")
    im.thumbnail((1800, 1800))
    out = remove(im, session=session)
    # Clean the edge: pull the matte in a few pixels so the old background colour does not show as a fringe, then soften it.
    a = out.getchannel("A").point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.MinFilter(7)).filter(ImageFilter.GaussianBlur(2.2))
    out.putalpha(a)
    box = out.getchannel("A").point(lambda a: 255 if a > 40 else 0).getbbox()
    out = out.crop(box)
    dst = os.path.join(pub, "ep", "images", f"cutout-{v['img']}.png")
    out.save(dst)
    print("cutout", v["img"], out.size, "->", dst)
