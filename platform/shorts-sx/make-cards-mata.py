"""Two illustration cards for the Mata v. Avianca Short (21 Nov 2026), drawn by the system and labelled Illustration: a chat asking for a legal motion, and
the chat answering 'Are these cases real?' with the assurance quoted in the source (cases 'indeed exist', 'can be found in reputable legal databases such as LexisNexis and Westlaw').
Usage: python make-cards-mata.py <public/lf2/ai-tested dir>   -> mt-chatgpt.jpg, mt-said.jpg + ATTRIBUTIONS.json entries."""
import os, sys, json
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]; W, H = 1080, 1920
def F(size, bold=False):
    for n in (["C:/Windows/Fonts/segoeuib.ttf"] if bold else ["C:/Windows/Fonts/segoeui.ttf"]) + ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        try: return ImageFont.truetype(n, size)
        except OSError: pass
    return ImageFont.load_default()
def wrap(d, text, font, maxw):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if d.textbbox((0, 0), t, font=font)[2] <= maxw: cur = t
        else: lines.append(cur); cur = w
    return lines + [cur]
def screen():
    im = Image.new("RGB", (W, H), "#F4F5F7"); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 230), fill="#10A37F"); d.text((W // 2, 130), "ChatGPT", font=F(70, True), fill="#FFFFFF", anchor="mm")
    d.text((W // 2, H - 60), "Illustration: recreated from the case record", font=F(30), fill="#6C7683", anchor="mm"); return im, d
def bubble(d, y, text, mine, w=820, size=54):
    f = F(size); lines = wrap(d, text, f, w - 80); h = len(lines) * (size + 14) + 56; x0 = W - 60 - w if mine else 60
    d.rounded_rectangle((x0, y, x0 + w, y + h), radius=44, fill="#10A37F" if mine else "#FFFFFF")
    for i, l in enumerate(lines): d.text((x0 + 40, y + 28 + i * (size + 14)), l, font=f, fill="#FFFFFF" if mine else "#1B2430")
    return y + h + 40
cards = {}
im, d = screen(); y = bubble(d, 330, "Write a legal motion and cite court cases.", True); bubble(d, y, "Here is your motion, with case citations.", False); cards["mt-chatgpt"] = (im, "a chat screen: a request for a legal motion with court cases")
im, d = screen(); y = bubble(d, 330, "Are these cases real?", True, 640); bubble(d, y, "Yes, they exist. They can be found in legal databases such as LexisNexis and Westlaw.", False); cards["mt-said"] = (im, "a chat screen answering that the cases exist")
ap = os.path.join(out, "ATTRIBUTIONS.json"); att = json.load(open(ap, encoding="utf-8"))
for k, (im, desc) in cards.items():
    im.save(os.path.join(out, k + ".jpg"), quality=92)
    att[k] = {"id": k, "file": k + ".jpg", "description": desc, "depicts": desc, "score": 10, "source": "drawn by the system", "source_url": "", "licence": "own work (illustration)", "author": "Illustration", "credit_line": "Illustration drawn for this video, recreated from the case record", "authenticity": "illustration"}
json.dump(att, open(ap, "w", encoding="utf-8"), indent=1); print("ok", list(cards))
