# The Blender edit for one of our episodes, generated from beats.json (platform/blender/build_project.py). Copied into the project as spec.py.
# Every face shows only what the episode itself shows (its sourced figures, quotes, places, credited pictures). One shot per sentence, and a second
# camera shot inside any sentence longer than 4.5 s, so a new shot comes every 2 to 4 s (the repo's rule). Shots are cued by WORD INDEX: the first
# transcribed word (timing.json, faster-whisper) at or after the sentence's estimated start.
import json, pathlib, textwrap
from facekit import *

HERE = pathlib.Path(__file__).resolve().parent
B = json.load(open(HERE / "beats.json", encoding="utf-8"))
WORDS = json.load(open(HERE / "timing.json")) if (HERE / "timing.json").exists() else [{"w": "x", "t0": 0, "t1": 1}]
C = {"VIOLET": VIOLET, "BLUE": BLUE, "MUTED": MUTED, "GREEN": GREEN, "RED": RED, "ORANGE": ORANGE, "WHITE": WHITE}
MOVES = ["arcL", "push", "arcR", "slideL", "low", "high"]

def wrap(s, n): return textwrap.wrap(str(s or ""), n) or [""]
def asset(name): return str(HERE / "assets" / name) if name else None

def main_face(b):
    k, d = b["kind"], b["data"]
    if k == "stat":
        lab = wrap(d["label"], 44)[:2]
        return screen("", "", bigstat(d["value"], "", color=VIOLET, top=230, size=300) + textblock(lab, top=640, size=50, color="#8a93a3", left=0).replace("left:0px", "left:0px;text-align:center"))
    if k in ("bars", "rows"):
        items = [(C.get(it.get("color"), BLUE), it["label"][:42], it["shown"]) for it in d["items"]] if k == "bars" else [(C.get(r[0], BLUE), str(r[1])[:40], str(r[2])[:40]) for r in d["rows"]]
        n = min(len(items), 8); gap, hgt, size = (150, 124, 44) if n <= 5 else (128, 108, 40) if n <= 6 else (102, 88, 34)
        return screen(str(d["title"])[:44], "", rows(items[:8], top=240, gap=gap, hgt=hgt, size=size))
    if k == "text":
        lines = [ln for part in d["lines"] for ln in (wrap(part, 60) if part else [""])]
        size = 44 if len(lines) <= 12 else 36 if len(lines) <= 16 else 30
        return screen(str(d["title"])[:44], "", textblock(lines[:22], top=220, size=size, lh=1.38))
    if k == "image" and d.get("image"):
        return image(asset(d["image"]), 1600, 1100, fit="cover", pos="center")
    if k == "flow":
        steps = d.get("steps") or [b["part"]]
        return screen(b["part"][:44].capitalize(), "outlines and routes: schematic", flowline(steps[:4], top=420, size=40))
    if k == "sketch":
        svg = sk_line([(150, 360), (500, 300), (1100, 300), (1450, 360)], seed=4) + sk_text(800, 270, "the ridge", 48, anchor="middle")
        svg += "".join(sk_rect(560 + i * 170, 330, 130, 60, color=RED, seed=10 + i) for i in range(3))
        svg += "".join(sk_rect(330 + i * 380, 800, 200, 70, color=BLUE, seed=20 + i) for i in range(3))
        svg += "".join(sk_line([(430 + i * 380, 790), (520 + i * 220, 600), (640 + i * 170, 420)], color=GREEN, seed=30 + i) for i in range(min(3, max(1, d.get("arrows", 1)))))
        svg += sk_text(800, 1010, "schematic: the sources disagree on the exact positions", 34, anchor="middle")
        return sketch(svg, title=(d.get("title") or "the battle")[:40])
    title = d.get("title") or b["part"]; sub = d.get("sub") or ""
    lines = wrap(title, 26)[:3]
    body = textblock(lines, top=330, size=96, lh=1.2, color="#ecf2fa") + (textblock(wrap(sub, 60)[:3], top=330 + len(lines) * 116 + 40, size=40, color="#8a93a3") if sub else "")
    return screen("", "", body)

def lift_face(b):
    d = b["data"]
    if b["kind"] == "stat" and d.get("chip"): return chip(d["chip"][:26], BLUE, w=760)
    if b["kind"] == "image" and d.get("title"): return chip(d["title"][:28], WHITE, w=900)
    if b["kind"] == "flow" and (d.get("plate") or {}).get("name"): return chip(d["plate"]["name"][:28], WHITE, w=900)
    return None

def at(t):
    for i, w in enumerate(WORDS):
        if w["t0"] >= t - 0.05: return i
    return len(WORDS) - 1

FACES, SHOTS, last, m = {}, [], -1, 0
for b in B["beats"]:
    FACES[b["id"]] = main_face(b); lf = lift_face(b)
    if lf: FACES[b["id"] + "_lift"] = lf
    if b.get("kind") == "image" and b["data"].get("image") is None and not b.get("cta"):
        pass
    ends = b["sent_starts"][1:] + [b["start"] + b["len"]]
    for si, (t0, t1) in enumerate(zip(b["sent_starts"], ends)):
        cuts = [t0] + ([t0 + (t1 - t0) / 2] if t1 - t0 > 4.5 else [])
        for ci, tc in enumerate(cuts):
            c = 0 if not SHOTS else at(tc)
            if c <= last: continue
            sh = {"t": "screen", "cue": c, "face": b["id"], "move": MOVES[m % len(MOVES)], "lens": 85}; m += 1
            if lf and si == 1 and ci == 0: sh["lifts"] = [{"face": b["id"] + "_lift", "at": min(c + 2, len(WORDS) - 1), "x": 0.12, "z": -0.42, "w": 0.42, "rz": -3}]
            SHOTS.append(sh); last = c
# the last line is a call to action (the repo's cta shot)
FACES["cta_pill"] = pill("Tell us in the comments")
cta_t = B["beats"][-1]["sent_starts"][-1]
c = at(cta_t)
if c > last: SHOTS.append({"t": "cta", "cue": c, "face": "cta_pill", "pill_at": min(c + 2, len(WORDS) - 1)})
else: SHOTS[-1] = {"t": "cta", "cue": SHOTS[-1]["cue"], "face": "cta_pill", "pill_at": min(SHOTS[-1]["cue"] + 2, len(WORDS) - 1)}   # a sentence shot already starts there
