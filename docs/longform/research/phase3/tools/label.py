"""usage: python label.py <id> <sheet number> "<tokens>"   (tokens space-separated, one per tile in sheet order; checks the count)
Codes (one capital letter, optional '+' = on-screen text/caption/credit/lower-third visible in that frame):
 V real video footage (event, B-roll, drone, game/match capture)   N news/broadcast footage (anchor, channel bug, broadcast clip)
 I interview / talking head / public appearance                      H host on camera
 P real photograph (still)                                            A archival photograph or archival film (period material)
 S screen recording / software demo (real interface)                  M map / satellite / terrain imagery (incl. 3D earth with overlays)
 D animated diagram / illustration / whiteboard / cartoon             G data visualisation (chart, table, stat graphic)
 T text-only or caption-only scene (title card, quote card on plain background)   X document / screenshot / article / social post
 Z AI-generated imagery or render (diffusion output, 3D game-engine render shown as generated)   O original motion graphics (cards, scoreboards, tactical animation, 3D model renders)
 B black/blank/transition frame                                       ? unclassifiable
 Added in the finer scheme: Q tactical diagram/animation (football pitch graphics)   W whiteboard animation   R historical photograph (period still)   F decorative/abstract graphic (no information)   K stock footage (only when a watermark or obvious library clip shows; provenance is otherwise unknowable from frames)
 A stays archival FILM/footage; R is an old still; P is a contemporary photograph.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
def expand(t):
    return [t.split("*")[0]] * int(t.split("*")[1]) if "*" in t else [t]
vid, n = sys.argv[1], int(sys.argv[2])
rows = [r.split() for r in sys.argv[3].split("/")]
for ri, r in enumerate(rows):  # rows of 8 (the sheet's rows) make miscounts visible
    r2 = [e for t in r for e in expand(t)]
    if len(r2) != 8 and not (ri == len(rows) - 1 and len(r2) <= 8): print(f"ERROR {vid} sheet {n}: row {ri + 1} has {len(r2)} tokens"); sys.exit(1)
    rows[ri] = r2
toks = [t for r in rows for t in r]
idx = json.load(open(os.path.join(HERE, "a3", vid, "sheets", "index.json")))["times"]
want = min(48, len(idx) - (n - 1) * 48)
ok = set("VNIHPASMDGTXZOB?QWRFK")
bad = [t for t in toks if t[0] not in ok or (len(t) > 1 and t[1:] != "+")]
if len(toks) != want or bad:
    print(f"ERROR {vid} sheet {n}: got {len(toks)} tokens, expected {want}; bad {bad}"); sys.exit(1)
os.makedirs(os.path.join(HERE, "labels"), exist_ok=True)
f = os.path.join(HERE, "labels", vid + ".json")
d = json.load(open(f)) if os.path.exists(f) else {"id": vid, "step_s": 15, "sheets": {}}
d["sheets"][str(n)] = toks
json.dump(d, open(f, "w"))
print(vid, "sheet", n, "labelled", len(toks), "of", len(idx), "frames total;", len(d["sheets"]), "sheets done")
