"""Comparison boards, one per channel: reference frame (competitor video, 360p source frame) | our existing frame (Phase 2) | proposed frame (Phase 3, or 'retained').
Reference frames are extracted from the cached analysis copies for INTERNAL comparison only; they are not committed to the repository and not for publication.
Writes output/longform-approval-p3/boards/<channel>.jpg and a combined overview."""
import glob, json, os, subprocess
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = r"C:\Users\info\YOUTUBE\.worktrees\orch"
BEF = os.path.join(REPO, "output", "longform-approval-before-p3"); AFT = os.path.join(REPO, "output", "longform-approval-p3"); OUT = os.path.join(AFT, "boards"); os.makedirs(OUT, exist_ok=True)
FONT = lambda s: ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", s)
# channel: (reference video id, time s, reference note, our beat id, retained?, what the change is)
SPEC = {
    "hidden-past": ("WiRLNEl-4bk", 12, "RealLifeLore, Nepal flood, 0:12: borrowed news clip with a source credit and quoted caption", "H04", False, "credit line from the attribution record on every real picture"),
    "ai-tested": ("1Aqhg0FVm-w", 65, "AI Search, Deepseek video, 1:05: a real benchmark page shown with the discussed figure highlighted", "A09b", False, "before = the summary graphic that carried this narration in Phase 2 (now beat A09c); proposed = the cited paper as a real arXiv capture with the discussed sentence highlighted (new beat A09b)"),
    "court-and-spotlight": ("mxCZUz2F24E", 65, "SunnyV2, Corden, 1:05: real article with the claim highlighted and a source line", "C05", True, "retained: real court document page with the passage highlighted; amounts/timelines unchanged"),
    "celebrity-news": ("8r3RQD8rE9E", 1034, "Carrey commentary, 17:14: evidence page with the discussed row highlighted", "N07", False, "licensed portrait replaces a repeated photo; credit line added"),
    "rival-lines": ("Nx8h403Sj_s", 233, "Football Made Simple, 3:53: annotated match footage with a perspective caption", "R03", True, "retained: StatsBomb event and 360 animation (licensed match footage not available)"),
    "red-space-facts": ("pZh5BWCNmmE", 1034, "Astrum, Uranus, 17:14: real spacecraft image with label and credit", "S14b", False, "Miranda shown with the real Voyager 2 image, label and credit, instead of a 3D sphere"),
    "psychology": ("IqXpzcfdtn4", 915, "Aperture, 15:15: 1-4 word emphasis caption on live-action B-roll", "P02", True, "retained: illustrated concept card, consistent with 4 of 5 references; no change"),
}
def ref_frame(vid, t):
    p = os.path.join(OUT, f"_ref_{vid}_{t}.png"); src = os.path.join(HERE, "a3", "_video", vid + ".mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(t), "-i", src, "-frames:v", "1", p], check=True); return p
def our(dirn, ch, beat):
    fs = sorted(glob.glob(os.path.join(dirn, ch, "raw", f"*-{beat}-f*.png")))
    return fs[0] if fs else None
W, H = 640, 360
tiles = []
for ch, (vid, t, note, beat, retained, change) in SPEC.items():
    b = our(BEF, ch, beat) or (our(AFT, ch, "A09c") if ch == "ai-tested" else None); a = our(AFT, ch, beat) or (b if retained else None)
    if not b: print("missing before frame", ch, beat); continue
    if not a: print("missing after frame", ch, beat, "(render not finished?)"); continue
    r = ref_frame(vid, t)
    board = Image.new("RGB", (W * 3 + 40, H + 190), (14, 17, 22)); d = ImageDraw.Draw(board)
    d.text((14, 8), f"{ch}  -  beat {beat}", font=FONT(24), fill=(255, 211, 77))
    for i, (p, head, sub) in enumerate([(r, "REFERENCE (competitor, internal comparison)", note), (b, "OUR FRAME BEFORE (Phase 2)", f"beat {beat}"), (a, "PROPOSED (Phase 3)" + ("  [unchanged]" if retained else ""), change)]):
        im = Image.open(p).convert("RGB").resize((W, H)); x = 10 + i * (W + 10); board.paste(im, (x, 46))
        d.text((x, 46 + H + 6), head, font=FONT(17), fill=(255, 255, 255))
        words, line, y = sub.split(), "", 46 + H + 30
        for w in words:
            if d.textlength(line + " " + w, font=FONT(15)) > W: d.text((x, y), line, font=FONT(15), fill=(190, 198, 208)); y += 19; line = w
            else: line = (line + " " + w).strip()
        d.text((x, y), line, font=FONT(15), fill=(190, 198, 208))
    p = os.path.join(OUT, ch + ".jpg"); board.save(p, quality=88); tiles.append(p); print("board", ch)
    os.remove(r)
if tiles:
    ims = [Image.open(p) for p in tiles]; Wd = ims[0].width; ov = Image.new("RGB", (Wd, sum(i.height for i in ims)))
    y = 0
    for im in ims: ov.paste(im, (0, y)); y += im.height
    ov.save(os.path.join(OUT, "overview.jpg"), quality=80); print("overview", ov.size)
