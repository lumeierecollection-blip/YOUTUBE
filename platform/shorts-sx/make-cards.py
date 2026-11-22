"""Illustration cards the system draws itself when no honest photograph of the thing exists (owner, 20 Nov 2026: pictures must make sense).
A phone chat screen (question / answer bubbles, typing indicator) and a REFUSED stamp over a form. Everything shown is the wording of the source
(Moffatt v. Air Canada: the chatbot told him to buy at full price and claim the bereavement discount within 90 days), labelled "Illustration".
Usage: python make-cards.py <out-dir>  -> chat-ask.png chat-bot.png chat-intro.png stamp-refused.png (1080x1920). PIL only."""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
W, H = 1080, 1920
def F(size, bold=False):
    for n in (["C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf"] if bold else ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"]) + ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
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
def screen(title):
    im = Image.new("RGB", (W, H), "#E9EDF2"); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 250), fill="#D5001F"); d.ellipse((60, 100, 160, 200), fill="#FFFFFF")
    d.text((110, 150), "AI", font=F(52, True), fill="#D5001F", anchor="mm"); d.text((190, 118), title, font=F(54, True), fill="#FFFFFF"); d.text((190, 182), "online now", font=F(34), fill="#FFD9DE")
    d.text((W // 2, H - 60), "Illustration: recreated from the tribunal's account", font=F(30), fill="#6C7683", anchor="mm")
    return im, d
def bubble(d, y, text, mine, w=760, size=50):
    f = F(size); lines = wrap(d, text, f, w - 80); h = len(lines) * (size + 14) + 56
    x0 = W - 70 - w if mine else 70
    d.rounded_rectangle((x0, y, x0 + w, y + h), radius=44, fill="#D5001F" if mine else "#FFFFFF")
    for i, l in enumerate(lines): d.text((x0 + 40, y + 28 + i * (size + 14)), l, font=f, fill="#FFFFFF" if mine else "#1B2430")
    return y + h + 36
# 1: the question
im, d = screen("Airline chatbot"); y = bubble(d, 340, "Hi, how can I help?", False, 600)
y = bubble(d, y + 20, "What is your bereavement fare policy?", True); im.save(os.path.join(out, "chat-ask.png"))
# 2: the wrong answer
im, d = screen("Airline chatbot"); y = bubble(d, 340, "What is your bereavement fare policy?", True)
y = bubble(d, y + 20, "Book now at full price, then apply for the bereavement discount within 90 days of your ticket date.", False, 820); im.save(os.path.join(out, "chat-bot.png"))
# 3: the chatbot (greeting + typing)
im, d = screen("Airline chatbot"); y = bubble(d, 340, "Hi, I am the airline virtual assistant.", False, 760)
d.rounded_rectangle((70, y + 20, 330, y + 130), radius=44, fill="#FFFFFF")
for i in range(3): d.ellipse((120 + i * 70, y + 62, 156 + i * 70, y + 98), fill="#9AA5B1")
im.save(os.path.join(out, "chat-intro.png"))
# 4: REFUSED stamp over a form
im = Image.new("RGB", (W, H), "#F3F1EA"); d = ImageDraw.Draw(im)
d.text((90, 140), "REFUND REQUEST", font=F(70, True), fill="#2B2F36")
for k, t in enumerate(["Passenger: ____________", "Flight: Vancouver to Toronto", "Bereavement fare difference: ________", "Status:"]): d.text((90, 300 + k * 130), t, font=F(48), fill="#4A515C")
st = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(st)
sd.rounded_rectangle((120, 900, 960, 1180), radius=28, outline="#C4161C", width=22); sd.text((540, 1040), "REFUSED", font=F(170, True), fill="#C4161C", anchor="mm")
st = st.rotate(-12, resample=Image.BICUBIC, center=(540, 1040)).filter(ImageFilter.GaussianBlur(1.2)); im.paste(st, (0, 0), st)
d = ImageDraw.Draw(im); d.text((W // 2, H - 60), "Illustration", font=F(30), fill="#8A8F98", anchor="mm"); im.save(os.path.join(out, "stamp-refused.png"))
print("ok")
