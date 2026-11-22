"""Okeanos-style relief map (measured from their thumbnails, 20 Nov 2026): warm ochre/olive land with strong hillshade, deep blue sea darker
offshore, grungy dark edge. Elevation: AWS Terrain Tiles (Terrarium PNG, open data). PIL + numpy only (light on memory).
Usage: python relief-map.py <lon_min> <lat_min> <lon_max> <lat_max> <zoom> <out.png> [--w 1600]"""
import io, math, sys, urllib.request
import numpy as np
from PIL import Image, ImageFilter
lo0, la0, lo1, la1, z = map(float, sys.argv[1:6]); z = int(z); out = sys.argv[6]
def tile(lon, lat):
    n = 2 ** z; x = (lon + 180) / 360 * n; y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y
x0, y1 = tile(lo0, la0); x1, y0 = tile(lo1, la1)
tx0, tx1, ty0, ty1 = int(x0), int(x1), int(y0), int(y1)
mos = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256), np.float32)
for tx in range(tx0, tx1 + 1):
    for ty in range(ty0, ty1 + 1):
        b = urllib.request.urlopen(urllib.request.Request(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{tx}/{ty}.png", headers={"User-Agent": "research-client/1.0"}), timeout=40).read()
        a = np.asarray(Image.open(io.BytesIO(b)).convert("RGB")).astype(np.float32)
        mos[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
cx0, cx1 = int((x0 - tx0) * 256), int((x1 - tx0) * 256); cy0, cy1 = int((y0 - ty0) * 256), int((y1 - ty0) * 256)
e = mos[cy0:cy1, cx0:cx1]
gy, gx = np.gradient(e); az, alt = math.radians(315), math.radians(40)
slope = np.pi / 2 - np.arctan(np.hypot(gx, gy) / 25); aspect = np.arctan2(-gx, gy)
hs = np.sin(alt) * np.sin(slope) + np.cos(alt) * np.cos(slope) * np.cos(az - aspect); hs = np.clip(hs, 0, 1)
land = e > 0
# land colour: olive lowlands to ochre and pale stone highs (their palette), multiplied by the hillshade
t = np.clip(e / 1800, 0, 1)[..., None]
low, mid, high = np.array([118, 112, 62.]), np.array([186, 150, 88.]), np.array([226, 206, 160.])
col = np.where(t < 0.5, low + (mid - low) * (t / 0.5), mid + (high - mid) * ((t - 0.5) / 0.5))
col = col * (0.45 + 0.75 * hs[..., None])
# sea: blue, darker with depth, plus a pale coastal shelf
d = np.clip(-e / 2500, 0, 1)[..., None]
sea = np.array([38, 92, 140.]) * (1 - d) + np.array([10, 32, 64.]) * d
img = np.where(land[..., None], col, sea).clip(0, 255).astype(np.uint8)
im = Image.fromarray(img)
W = int(sys.argv[sys.argv.index("--w") + 1]) if "--w" in sys.argv else 1600
im = im.resize((W, int(W * im.height / im.width)), Image.LANCZOS).filter(ImageFilter.UnsharpMask(2, 60, 2))
im.save(out); print(out, im.size)
