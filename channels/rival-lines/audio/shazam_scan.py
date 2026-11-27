"""Music recognition on the windows where music is most exposed. usage: python shazam_scan.py <work_dir> [--clip 12] [--top 14] [--grid 120] [id ...]
Per reference: the first and last clip, a coarse grid, and the <top> clips with the least narration (from speech.json).
Only each short clip (mono wav) is sent to Shazam; raw audio never enters the repo.
Writes <work>/<id>/shazam.json: [{t, clip, status: match|nomatch|error, match}]. Resumable by start time."""
import asyncio, json, os, subprocess, sys, tempfile
import numpy as np
from shazamio import Shazam

args = sys.argv[1:]
clip, top, grid = 12, 14, 120
pos = []
i = 0
while i < len(args):
    if args[i] == "--clip": clip = int(args[i + 1]); i += 2
    elif args[i] == "--top": top = int(args[i + 1]); i += 2
    elif args[i] == "--grid": grid = int(args[i + 1]); i += 2
    else: pos.append(args[i]); i += 1
work, ids = pos[0], pos[1:]

def plan(d):
    sp = json.load(open(os.path.join(d, "speech.json"), encoding="utf8"))
    total = sp["duration"]
    cover = np.zeros(int(total) + 1)
    for s in sp["segments"]:
        for w0, w1, _ in s["words"]:
            cover[int(w0):int(w1) + 1] = 1
    starts = np.arange(0, max(1, int(total) - clip), 2)
    frac = np.array([cover[s:s + clip].mean() for s in starts])
    chosen = [0, max(0, int(total) - clip - 1)] + list(range(grid, int(total) - clip, grid))
    for k in np.argsort(frac):
        s = int(starts[k])
        if frac[k] > 0.7 or sum(1 for c in chosen if abs(c - s) < clip) > 0: continue
        chosen.append(s)
        if len(chosen) >= top + 2 + len(range(grid, int(total) - clip, grid)): break
    return sorted(set(chosen)), frac, starts

async def one(sh, sem, wav, vid, t, recs):
    async with sem:
        tmp = os.path.join(tempfile.gettempdir(), f"rl_clip_{vid}_{t}.wav")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(t), "-t", str(clip), "-i", wav, "-ar", "44100", tmp], check=True)
        rec = {"t": t, "clip": clip, "match": None, "status": "nomatch"}
        for attempt in range(3):
            try:
                r = await asyncio.wait_for(Shazam().recognize(tmp), 40)
                trk = r.get("track")
                if trk:
                    alb = None
                    for sec in trk.get("sections", []):
                        if sec.get("type") == "SONG":
                            for m in sec.get("metadata", []):
                                if m.get("title") == "Album": alb = m.get("text")
                    rec["match"] = {"key": trk.get("key"), "title": trk.get("title"), "artist": trk.get("subtitle"), "url": trk.get("url"),
                                    "genre": (trk.get("genres") or {}).get("primary"), "album": alb,
                                    "offset_s": (r.get("matches") or [{}])[0].get("offset")}
                    rec["status"] = "match"
                rec.pop("error", None)
                break
            except BaseException as e:
                if isinstance(e, (KeyboardInterrupt, SystemExit)): raise
                rec["status"] = "error"; rec["error"] = (str(e) or type(e).__name__)[:200]
                await asyncio.sleep(3 * (attempt + 1))
        os.remove(tmp)
        recs[t] = rec
        json.dump([recs[k] for k in sorted(recs)], open(os.path.join(work, vid, "shazam.json"), "w"), ensure_ascii=False)
        await asyncio.sleep(1.0)

async def scan(vid):
    d = os.path.join(work, vid)
    wav = os.path.join(d, "audio.wav")
    out = os.path.join(d, "shazam.json")
    if not (os.path.exists(wav) and os.path.exists(os.path.join(d, "speech.json"))): return
    recs = {r["t"]: r for r in json.load(open(out))} if os.path.exists(out) else {}
    todo = [t for t in plan(d)[0] if t not in recs or recs[t]["status"] == "error"]
    sh, sem = None, asyncio.Semaphore(1)
    await asyncio.gather(*[one(sh, sem, wav, vid, t, recs) for t in todo])
    json.dump([recs[k] for k in sorted(recs)], open(out, "w"), ensure_ascii=False)
    print(vid, sum(1 for r in recs.values() if r["status"] == "match"), "matches of", len(recs), "errors", sum(1 for r in recs.values() if r["status"] == "error"), flush=True)

async def main():
    for vid in (ids or sorted(os.listdir(work))):
        if os.path.isdir(os.path.join(work, vid)) and not vid.startswith("_"):
            await scan(vid)
asyncio.run(main())
