"""FAST Short (no Remotion render): narration (edge-tts, with word timings) + one picture per spoken mention, cut on the word, slow push-in, caption,
assembled by ffmpeg in about a minute. Owner, 20 Nov 2026: "find a way where it doesn't need to be rendered... do it now".
Usage: python fast-short.py <spec-slug> <out.mp4>   (reads platform/shorts-sx/specs/<slug>.mjs via node; pictures from public/lf2/ai-tested)"""
import asyncio, json, os, subprocess, sys, tempfile
import edge_tts
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
slug, out = sys.argv[1], sys.argv[2]
spec = json.loads(subprocess.run(["node", "-e", f"import('./platform/shorts-sx/specs/{slug}.mjs').then(m=>console.log(JSON.stringify({{s:m.SCRIPT,shots:m.SHOTS}})))"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8").stdout)
PUB = os.path.join(ROOT, "src/skills/remotion-render/public"); att = json.load(open(os.path.join(PUB, "lf2/ai-tested/ATTRIBUTIONS.json"), encoding="utf-8"))
tmp = tempfile.mkdtemp(); W, H, FPS = 1080, 1920, 30
# 1. narration with word boundaries
async def tts():
    c = edge_tts.Communicate(spec["s"], "en-US-AndrewNeural", rate="+12%", boundary="WordBoundary"); words = []
    with open(os.path.join(tmp, "v.mp3"), "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary": words.append((ch["offset"] / 1e7, ch["text"]))
    return words
words = asyncio.run(tts())
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", os.path.join(tmp, "v.mp3")], capture_output=True, text=True, encoding="utf-8").stdout)
norm = lambda w: "".join(ch for ch in w.lower() if ch.isalnum() or ch == "$")
# 2. shot start times = time of each shot's anchor word (in order)
starts, i = [], 0
for s in spec["shots"]:
    a = norm(s["at"])
    while i < len(words) and norm(words[i][1]) != a: i += 1
    starts.append(words[i][0] if i < len(words) else (starts[-1] + 1 if starts else 0)); i += 1
starts[0] = 0.0
def F(size, bold=True):
    for n in ["C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
        try: return ImageFont.truetype(n, size)
        except OSError: pass
    return ImageFont.load_default()
def frame(s):  # one 1080x1920 picture per shot, with its caption baked in
    if s.get("photo") and s["photo"] in att:
        im = Image.open(os.path.join(PUB, "lf2/ai-tested", att[s["photo"]]["file"])).convert("RGB")
        r = max(W * 1.15 / im.width, H * 1.15 / im.height); im = im.resize((int(im.width * r), int(im.height * r)), Image.LANCZOS)
        x, y = (im.width - int(W * 1.15)) // 2, (im.height - int(H * 1.15)) // 2; im = im.crop((x, y, x + int(W * 1.15), y + int(H * 1.15)))
        text, big = s.get("cap", ""), False
    elif s.get("asset") and s["asset"] in att:
        im = Image.new("RGB", (int(W * 1.15), int(H * 1.15)), "#ECECEC"); a = Image.open(os.path.join(PUB, "lf2/ai-tested", att[s["asset"]]["file"])).convert("RGBA"); a.thumbnail((900, 900)); im.paste(a, ((im.width - a.width) // 2, 900), a)
        text, big = s.get("value", ""), True
    else:
        im = Image.new("RGB", (int(W * 1.15), int(H * 1.15)), "#F4F1EA"); text, big = s.get("value") or s.get("page") or s.get("year") or "", True
    d = ImageDraw.Draw(im); f = F(150 if big and len(text) < 8 else 84 if big else 64); lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if d.textbbox((0, 0), t, font=f)[2] < im.width - 160: cur = t
        else: lines.append(cur); cur = w
    lines.append(cur); lh = f.size + 18; y0 = (im.height // 2 - len(lines) * lh // 2) if big else int(im.height * 0.66)
    for k, l in enumerate(lines):
        if not l: continue
        tw = d.textbbox((0, 0), l, font=f)[2]; x = (im.width - tw) // 2; y = y0 + k * lh
        if not big:
            d.rounded_rectangle((x - 30, y - 12, x + tw + 30, y + lh), radius=22, fill=(0, 0, 0))
        d.text((x, y), l, font=f, fill="#111111" if big and not s.get("photo") else "#FFFFFF")
    p = os.path.join(tmp, f"s{len(os.listdir(tmp)):03d}.png"); im.save(p); return p
# 3. one segment per shot: slow 1.00->1.08 push-in, cut exactly on the anchor word
segs = []
for k, s in enumerate(spec["shots"]):
    t0 = starts[k]; t1 = starts[k + 1] if k + 1 < len(starts) else dur + 0.4; n = max(1, round((t1 - t0) * FPS)); img = frame(s); seg = os.path.join(tmp, f"seg{k:03d}.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", img, "-vf", f"scale={int(W*1.15)}:{int(H*1.15)},zoompan=z='1+0.08*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s={W}x{H}:fps={FPS},format=yuv420p", "-frames:v", str(n), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", seg], check=True)
    segs.append(seg)
lst = os.path.join(tmp, "l.txt"); open(lst, "w").write("".join(f"file '{p}'\n" for p in segs))
# SFX on every cut (owner rule: a sound with every visual change): impact on the hook, a soft pop on the rest
SFX = os.path.join(PUB, "sfx"); fx = [os.path.join(SFX, "impact.mp3")] + [os.path.join(SFX, "pop.mp3")] * (len(starts) - 1)
ins = sum([["-i", f] for f in fx], []); mix = "".join(f"[{k+2}:a]volume={0.55 if k == 0 else 0.22},adelay={int(t*1000)}|{int(t*1000)}[f{k}];" for k, t in enumerate(starts))
mix += "[1:a]" + "".join(f"[f{k}]" for k in range(len(starts))) + f"amix=inputs={len(starts)+1}:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5[a]"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-i", os.path.join(tmp, "v.mp3"), *ins, "-filter_complex", mix, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], check=True)
print(out, round(dur, 1), "s,", len(segs), "shots")
