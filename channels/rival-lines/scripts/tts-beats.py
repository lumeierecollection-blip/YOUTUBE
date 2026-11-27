"""Narration for a Rival Lines episode, one TTS call per beat, with word times.
usage: python tts-beats.py <episode_dir> [voice]
Reads <episode_dir>/script.json, writes <episode_dir>/audio/narration.mp3 and audio/timing.json.
Each beat is trimmed to its first and last spoken word and joined with a fixed gap, so a beat's time span is exact and no
fuzzy word matching is needed. Fails if a beat returns no word boundaries."""
import asyncio, json, os, shutil, subprocess, sys, tempfile
import edge_tts

ep = sys.argv[1]
voice = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("TTS_VOICE", "en-GB-RyanNeural")
GAP = float(os.environ.get("TTS_BEAT_GAP", "0.45"))
RATE = os.environ.get("TTS_RATE", "-4%")
script = json.load(open(os.path.join(ep, "script.json"), encoding="utf8"))
out_dir = os.path.join(ep, "audio")
os.makedirs(out_dir, exist_ok=True)


async def synth(text, mp3):
    last = None
    for attempt in range(4):
        try:
            words = []
            com = edge_tts.Communicate(text, voice, rate=RATE, boundary="WordBoundary")
            with open(mp3, "wb") as f:
                async for ch in com.stream():
                    if ch["type"] == "audio":
                        f.write(ch["data"])
                    elif ch["type"] == "WordBoundary":
                        words.append((ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7, ch["text"]))
            if words:
                return words
            last = "no word boundaries"
        except Exception as e:  # network or service error: retry
            last = repr(e)
        await asyncio.sleep(2 + attempt * 2)
    sys.exit(f"tts failed for: {text[:60]!r}: {last}")


def run(*a):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *a], check=True)


async def main():
    tmp = tempfile.mkdtemp()
    parts, timing, clock = [], [], 0.0
    for i, b in enumerate(script["beats"]):
        mp3 = os.path.join(tmp, f"b{i}.mp3")
        ws = await synth(b["text"], mp3)
        lead = max(0.0, ws[0][0] - 0.06)
        length = ws[-1][1] + 0.14 - lead
        wav = os.path.join(tmp, f"b{i}.wav")
        run("-ss", f"{lead:.3f}", "-t", f"{length:.3f}", "-i", mp3, "-ar", "24000", "-ac", "1", wav)
        parts.append(wav)
        timing.append({"id": b["id"], "t0": round(clock, 3), "t1": round(clock + length, 3),
                       "words": [{"t0": round(a - lead, 3), "t1": round(z - lead, 3), "w": w} for a, z, w in ws]})
        clock += length
        if i < len(script["beats"]) - 1:
            sil = os.path.join(tmp, f"g{i}.wav")
            run("-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", f"{GAP:.3f}", sil)
            parts.append(sil)
            clock += GAP
    lst = os.path.join(tmp, "list.txt")
    with open(lst, "w") as f:
        for p in parts:
            f.write("file '" + p.replace(os.sep, "/") + "'\n")
    run("-f", "concat", "-safe", "0", "-i", lst, "-ar", "44100", "-b:a", "160k", os.path.join(out_dir, "narration.mp3"))
    json.dump({"voice": voice, "rate": RATE, "gap": GAP, "duration": round(clock, 3), "beats": timing},
              open(os.path.join(out_dir, "timing.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"narration {clock:.1f}s, {len(timing)} beats, voice {voice}, rate {RATE}")


asyncio.run(main())
