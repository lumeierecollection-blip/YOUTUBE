"""Okeanos History thumbnail formula, measured 20 Nov 2026 from their top 8 and flops (faceless-breakout-experiment/research/okeanos-history/thumbs/sheet.jpg):
relief map filling the frame (warm land, deep blue sea), the target highlighted in red with red arrows, serif-caps place labels with a dark edge;
a black-and-white cut-out of the key leader on the right inside a red circular halo; two lines of huge white condensed caps on red boxes bottom-left
(3-5 words); dark grunge vignette at the edges. PIL only.
Usage: python thumb-okeanos.py <relief.png> <bbox "lo0,la0,lo1,la1"> <portrait-cutout.png> "<LINE 1>" "<LINE 2>" <out.jpg>
       --target lon,lat --tlabel GIBRALTAR --labels "SPAIN@-4.2,38.4;MOROCCO@-5.4,35.2" --arrows "-4.6,37.4>-5.3,36.3;..." [--view lo0,la0,lo1,la1]"""
import argparse, math
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance, ImageOps

ap = argparse.ArgumentParser()
ap.add_argument("relief"); ap.add_argument("bbox"); ap.add_argument("portrait"); ap.add_argument("l1"); ap.add_argument("l2"); ap.add_argument("out")
ap.add_argument("--target", default=""); ap.add_argument("--tlabel", default=""); ap.add_argument("--labels", default=""); ap.add_argument("--arrows", default="")
ap.add_argument("--view", default=""); ap.add_argument("--px", type=float, default=0.78)
a = ap.parse_args()
W, H = 1280, 720
lo0, la0, lo1, la1 = map(float, a.bbox.split(","))
merc = lambda lat: math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
rel = Image.open(a.relief).convert("RGB")
def to_px(lon, lat, im):
    return ((lon - lo0) / (lo1 - lo0) * im.width, (merc(la1) - merc(lat)) / (merc(la1) - merc(la0)) * im.height)
# crop the relief to the view (the target sits left of centre, under the portrait's left edge)
if a.view:
    v = list(map(float, a.view.split(","))); x0, y0 = to_px(v[0], v[3], rel); x1, y1 = to_px(v[2], v[1], rel)
else:
    x0, y0, x1, y1 = 0, 0, rel.width, rel.height
crop = rel.crop((int(x0), int(y0), int(x1), int(y1))).resize((W, H), Image.LANCZOS)
sx, sy = W / (x1 - x0), H / (y1 - y0)
P = lambda lon, lat: ((to_px(lon, lat, rel)[0] - x0) * sx, (to_px(lon, lat, rel)[1] - y0) * sy)
img = ImageEnhance.Contrast(crop).enhance(1.08)
d = ImageDraw.Draw(img, "RGBA")
def F(names, size):
    for n in names:
        try: return ImageFont.truetype(n, size)
        except OSError: pass
    return ImageFont.load_default()
SERIF = ["C:/Windows/Fonts/georgiab.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"]
CAPS = ["C:/Windows/Fonts/impact.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
def label(x, y, text, size=30, fill="#f3ead8"):
    f = F(SERIF, size); bw = d.textbbox((0, 0), text, font=f)
    tx, ty = x - (bw[2] - bw[0]) / 2, y - (bw[3] - bw[1]) / 2
    for ox, oy in ((-2, 0), (2, 0), (0, -2), (0, 2), (2, 2)): d.text((tx + ox, ty + oy), text, font=f, fill="#1b130b")
    d.text((tx, ty), text, font=f, fill=fill)
# red arrows (thick, with a dark edge), drawn before labels
for seg in filter(None, a.arrows.split(";")):
    s, e = seg.split(">"); (ax, ay), (bx, by) = P(*map(float, s.split(","))), P(*map(float, e.split(",")))
    ang = math.atan2(by - ay, bx - ax); ex, ey = bx - 26 * math.cos(ang), by - 26 * math.sin(ang)
    for wdt, colr in ((20, "#3a0705"), (13, "#e2261c")):
        d.line([(ax, ay), (ex, ey)], fill=colr, width=wdt)
    head = [(bx, by), (bx - 44 * math.cos(ang - 0.5), by - 44 * math.sin(ang - 0.5)), (bx - 44 * math.cos(ang + 0.5), by - 44 * math.sin(ang + 0.5))]
    d.polygon(head, fill="#e2261c", outline="#3a0705")
if a.target:
    tx, ty = P(*map(float, a.target.split(",")))
    glow = Image.new("L", (W, H), 0); ImageDraw.Draw(glow).ellipse((tx - 46, ty - 46, tx + 46, ty + 46), fill=220)
    img.paste(Image.new("RGB", (W, H), "#ff2a1a"), (0, 0), glow.filter(ImageFilter.GaussianBlur(18)))
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse((tx - 13, ty - 13, tx + 13, ty + 13), fill="#ffffff", outline="#e2261c", width=6)
    if a.tlabel: label(tx + 10, ty - 44, a.tlabel, 28, "#ffffff")
for item in filter(None, a.labels.split(";")):
    t, ll = item.split("@"); x, y = P(*map(float, ll.split(","))); label(x, y, t, 34)
# portrait: B&W cut-out inside a red halo on the right
por = Image.open(a.portrait).convert("RGBA"); por = por.crop(por.getchannel("A").getbbox())
por = por.crop((0, 0, por.width, int(min(por.height, por.width * 1.25))))
g = ImageOps.grayscale(por.convert("RGB")); g = ImageEnhance.Contrast(g).enhance(1.35).filter(ImageFilter.UnsharpMask(2, 120, 2))
pg = Image.merge("RGBA", (g, g, g, por.getchannel("A")))
ph = int(H * 0.98); pw = int(pg.width * ph / pg.height); pg = pg.resize((pw, ph), Image.LANCZOS)
pcx = int(W * a.px); r = int(H * 0.36); hcy = int(H * 0.38)
halo = Image.new("L", (W, H), 0); ImageDraw.Draw(halo).ellipse((pcx - r, hcy - r, pcx + r, hcy + r), fill=255)
img.paste(Image.new("RGB", (W, H), "#a3120c"), (0, 0), halo)
ring = Image.new("L", (W, H), 0); ImageDraw.Draw(ring).ellipse((pcx - r - 16, hcy - r - 16, pcx + r + 16, hcy + r + 16), outline=255, width=14)
img.paste(Image.new("RGB", (W, H), "#d01e14"), (0, 0), ring.filter(ImageFilter.GaussianBlur(3)))
img.paste(pg, (pcx - pw // 2, H - ph + 12), pg)
# grunge vignette
vig = Image.new("L", (W, H), 0); ImageDraw.Draw(vig).rectangle((0, 0, W, H), fill=255); ImageDraw.Draw(vig).ellipse((-200, -150, W + 200, H + 150), fill=0)
img.paste(Image.new("RGB", (W, H), "#0d0805"), (0, 0), vig.filter(ImageFilter.GaussianBlur(90)).point(lambda v: int(v * 0.85)))
# caption: two lines of huge white condensed caps, each on its own red box, bottom-left
d = ImageDraw.Draw(img)
y = H - 20
for line in (a.l2, a.l1):
    size = 112
    while True:
        f = F(CAPS, size); bw = d.textbbox((0, 0), line, font=f)
        if bw[2] - bw[0] <= W * 0.62 or size < 60: break
        size -= 4
    th = bw[3] - bw[1]; y -= th + 22
    d.rectangle((22, y - 6, 22 + bw[2] - bw[0] + 34, y + th + 14), fill="#b3140d")
    d.text((38 - bw[0] + 3, y - bw[1] + 4 + 3), line, font=f, fill="#2a0503")
    d.text((38 - bw[0], y - bw[1] + 4), line, font=f, fill="#ffffff")
img.save(a.out, quality=92); print(a.out)
