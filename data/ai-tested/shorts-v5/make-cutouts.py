"""Real background removal for portraits used by cutout_hero scenes.
rembg segmentation + alpha matting, then colour decontamination of edge pixels so no grey halo
from the original backdrop survives. Writes assets/photos/cutouts/<name>.png and <name>.qa.json.
Exits non-zero if the cutout fails its alpha checks. No fallback to an un-cut image."""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from rembg import remove, new_session

ROOT = os.path.dirname(os.path.abspath(__file__))
JOBS = [("assets/photos/rob-bonta-official.jpg", "bonta")]
outdir = os.path.join(ROOT, "assets", "photos", "cutouts")
os.makedirs(outdir, exist_ok=True)
session = new_session(os.environ.get("REMBG_MODEL", "isnet-general-use"))
bad = []

def blur(a, r):
    return np.asarray(Image.fromarray(a).filter(ImageFilter.GaussianBlur(r)), dtype=np.float32)

for src, name in JOBS:
    im = Image.open(os.path.join(ROOT, src)).convert("RGB")
    cut = remove(im, session=session, alpha_matting=True, alpha_matting_foreground_threshold=235,
                 alpha_matting_background_threshold=15, alpha_matting_erode_size=10, post_process_mask=True)
    rgba = np.asarray(cut.convert("RGBA"), dtype=np.float32)
    a = rgba[..., 3]
    # keep the largest connected body, fill pin-holes
    solid = a > 128
    lab, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        keep = lab == (1 + int(np.argmax(sizes)))
        a = np.where(keep | ((a > 0) & ndimage.binary_dilation(keep, iterations=4)), a, 0)
    filled = ndimage.binary_fill_holes(a > 128)
    a = np.where(filled & (a < 255) & ~(a > 0), 255, a)
    # decontaminate edges: replace colour of partially transparent pixels with the nearby opaque colour
    core = ndimage.binary_erosion(a > 250, iterations=3)
    rgb = rgba[..., :3]
    num = np.stack([blur(((rgb[..., c] * core)).astype(np.uint8), 5) for c in range(3)], -1)
    den = blur((core * 255).astype(np.uint8), 5)[..., None] / 255.0
    near = num / np.maximum(den, 1e-3)
    semi = ((a > 0) & (a < 250))[..., None]
    rgb = np.where(semi & (den > 0.02), near, rgb)
    # slight edge tightening to remove the last fringe pixel
    a = np.where(a < 24, 0, a)
    out = np.dstack([np.clip(rgb, 0, 255), a]).astype(np.uint8)
    img = Image.fromarray(out, "RGBA")
    bbox = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        l, t, r, b = bbox
        img = img.crop((max(0, l - 6), max(0, t - 10), min(img.width, r + 6), img.height))
    path = os.path.join(outdir, name + ".png")
    img.save(path)
    A = np.asarray(img.getchannel("A"), dtype=np.float32)
    solid = A > 128
    cover = float(solid.mean())
    lab, n = ndimage.label(solid)
    largest = float(np.max(ndimage.sum(solid, lab, range(1, n + 1))) / max(1, solid.sum())) if n else 0.0
    holes = float((ndimage.binary_fill_holes(solid) & ~solid).sum() / max(1, solid.sum()))
    edge = (A > 8) & (A < 248)
    rgbo = np.asarray(img.convert("RGB"), dtype=np.float32)
    lum = rgbo.mean(-1)
    inner = ndimage.binary_erosion(solid, iterations=6)
    halo = float(lum[edge].mean() - lum[inner].mean()) if edge.any() and inner.any() else 0.0
    qa = {"file": os.path.relpath(path, ROOT).replace("\\", "/"), "size": list(img.size), "coverage": round(cover, 3), "largest_component": round(largest, 4), "hole_ratio": round(holes, 4), "edge_pixels": int(edge.sum()), "edge_minus_interior_luma": round(halo, 1), "model": os.environ.get("REMBG_MODEL", "isnet-general-use"), "alpha_matting": True, "decontaminated": True}
    ok = 0.25 < cover < 0.95 and largest > 0.97 and holes < 0.01 and edge.sum() > 500
    qa["pass"] = bool(ok)
    json.dump(qa, open(os.path.join(outdir, name + ".qa.json"), "w"), indent=1)
    print(name, qa)
    if not ok: bad.append(name)
sys.exit(1 if bad else 0)
