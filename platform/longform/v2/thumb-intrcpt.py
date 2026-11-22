"""intrcpt thumbnail formula, measured 20 Nov 2026 from their 12 best (channel-reverse/spec/thumbs/rival-vs-intrcpt.jpg) and re-checked side by side
(haaland-vs-ref.jpg): one star player cut out as a head-and-shoulders close-up, face centred under the word, crisp and punchy; a horizontal motion
smear beside him; one or two lowercase serif words (slim bold, ~35% of the frame wide, no shadow) at the top ending in "." or "?"; a SHORT red
hand-drawn curl from just right of the word down to the head; white centre fading to light grey edges; a small channel mark top-left.
Usage: python thumb-intrcpt.py <cutout.png> "<word.>" <out.jpg> [--crop 0.55] [--small "(literally)"] [--x 0.5] [--zoom 1.0]
PIL only: safe on the owner's low-memory PC."""
import argparse, math, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

ap = argparse.ArgumentParser()
ap.add_argument("cutout"); ap.add_argument("word"); ap.add_argument("out")
ap.add_argument("--crop", type=float, default=0.6, help="keep this top fraction of the subject (head and shoulders)")
ap.add_argument("--small", default=""); ap.add_argument("--x", type=float, default=0.5); ap.add_argument("--zoom", type=float, default=1.0)
ap.add_argument("--mark", default="r")
ap.add_argument("--box", default="", help="manual subject crop as fractions l,t,r,b of the cut-out bbox (face framing)")
a = ap.parse_args()
W, H = 1280, 720
HERE = os.path.dirname(os.path.abspath(__file__)); FONTS = os.path.join(HERE, "../../../src/skills/remotion-render/public/fonts")
def font(name, size, fallback):
    for c in (os.path.join(FONTS, name), fallback):
        try: return ImageFont.truetype(c, size)
        except OSError: continue
    return ImageFont.load_default()

bg = Image.new("RGB", (W, H), "#d6d6d6")
glow = Image.new("L", (W, H), 0); ImageDraw.Draw(glow).ellipse((-150, -220, W + 150, H + 220), fill=255)
bg = Image.composite(Image.new("RGB", (W, H), "#ffffff"), bg, glow.filter(ImageFilter.GaussianBlur(170)))

p = Image.open(a.cutout).convert("RGBA"); p = p.crop(p.getchannel("A").getbbox())
if a.box:
    l, t, r, b = [float(v) for v in a.box.split(",")]; p = p.crop((int(p.width * l), int(p.height * t), int(p.width * r), int(p.height * b)))
    # fade any edge the manual crop cut through, so no straight line shows
    from PIL import ImageChops
    m = Image.new("L", p.size, 255); md = ImageDraw.Draw(m); fw = max(20, p.width // 9)
    for i in range(fw):
        v = int(255 * i / fw)
        if r < 1: md.line([(p.width - 1 - i, 0), (p.width - 1 - i, p.height)], fill=v)
        if l > 0: md.line([(i, 0), (i, p.height)], fill=v)
    p.putalpha(ImageChops.multiply(p.getchannel("A"), m))
else:
    p = p.crop((0, 0, p.width, int(p.height * a.crop)))                    # head and shoulders
al = p.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))   # shave the dark halo the cut-out left
rgb = p.convert("RGB")
rgb = ImageEnhance.Contrast(rgb).enhance(1.18); rgb = ImageEnhance.Color(rgb).enhance(1.12)
rgb = rgb.filter(ImageFilter.UnsharpMask(radius=2.2, percent=170, threshold=2))   # their crisp, punchy look
p = rgb.convert("RGBA"); p.putalpha(al)
h = int(H * 0.80 * a.zoom); w = int(p.width * h / p.height)
if w > W * 0.75: w = int(W * 0.75); h = int(p.height * w / p.width)
p = p.resize((w, h), Image.LANCZOS)
px = int(W * a.x - w / 2); py = H - h                                    # bottom edge cut by the frame, face high in the frame
# horizontal motion smear to the left of the subject (their speed trail)
sm = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sm.paste(p, (px, py), p)
trail = sm.copy(); ta = trail.getchannel("A").point(lambda v: int(v * 0.45)); trail.putalpha(ta)
trail = trail.transform(trail.size, Image.AFFINE, (1, 0, 26, 0, 1, 0)).filter(ImageFilter.BoxBlur(0))
streak = Image.new("RGBA", (W, H), (0, 0, 0, 0))
for dx in range(20, 160, 10):
    streak = Image.alpha_composite(streak, trail.transform(trail.size, Image.AFFINE, (1, 0, dx, 0, 1, 0)))
streak = streak.resize((W // 4, H)).resize((W, H), Image.BILINEAR)   # horizontal-only blur
sa = streak.getchannel("A").point(lambda v: int(v * 0.2)); streak.putalpha(sa)
bg = Image.alpha_composite(bg.convert("RGBA"), streak); bg = Image.alpha_composite(bg, sm).convert("RGB")

d = ImageDraw.Draw(bg)
size = 104
while True:
    f = font("PlayfairDisplay-700.woff2", size, "C:/Windows/Fonts/georgiab.ttf"); bb = d.textbbox((0, 0), a.word, font=f)
    if bb[2] - bb[0] <= W * 0.40 or size < 64: break
    size -= 4
tw = bb[2] - bb[0]; tx = int(W * a.x - tw / 2); tx = max(60, min(W - tw - 60, tx)); ty = 26 - bb[1]
d.text((tx, ty), a.word, font=f, fill="#151515")
if a.small:
    fs = font("PlayfairDisplay-400.woff2", 26, "C:/Windows/Fonts/georgia.ttf"); sw = d.textbbox((0, 0), a.small, font=fs)[2]
    d.text((tx + (tw - sw) // 2, ty + bb[3] + 2), a.small, font=fs, fill="#333333")
# short red curl: from just below-right of the word's end, bending down to the head (their arrow is ~70-90 px long)
sx, sy = tx + tw - 10, ty + bb[3] + 24
ex, ey = sx - 22, sy + 78
pts = [(sx + 18 * math.sin(math.pi * t) + (ex - sx) * t, sy + (ey - sy) * t) for t in [i / 16 for i in range(17)]]
d.line(pts, fill="#cf1a1f", width=7, joint="curve")
ang = math.atan2(pts[-1][1] - pts[-4][1], pts[-1][0] - pts[-4][0])
for s in (-1, 1):
    d.line([pts[-1], (pts[-1][0] - 24 * math.cos(ang + s * 0.6), pts[-1][1] - 24 * math.sin(ang + s * 0.6))], fill="#cf1a1f", width=7)
d.text((24, 16), a.mark, font=font("PlayfairDisplay-700.woff2", 40, "C:/Windows/Fonts/georgiab.ttf"), fill="#151515")
bg.save(a.out, quality=92); print(a.out)
