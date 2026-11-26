"""Narration mp3 plus a word-level WebVTT, straight from edge-tts WordBoundary events.
usage: python tts-words.py <voice> <script.txt> <out.mp3> <out.vtt>
Fails (non-zero) if the service returned no word boundaries: the renderer syncs every visual to these times."""
import asyncio, os, re, shutil, subprocess, sys, tempfile
import edge_tts

voice, script_path, out_mp3, out_vtt = sys.argv[1:5]
text = open(script_path, encoding="utf-8").read().strip()

def stamp(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d}.{ms % 1000:03d}"

async def main():
    try:
        com = edge_tts.Communicate(text, voice, boundary="WordBoundary")
    except TypeError:
        com = edge_tts.Communicate(text, voice)  # older edge-tts: WordBoundary is already the only mode
    words = []
    with open(out_mp3, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append((ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7, ch["text"]))
    if len(words) < 10:
        sys.exit(f"edge-tts returned {len(words)} word boundaries for {len(text.split())} words")
    with open(out_vtt, "w", encoding="utf-8") as f:
        f.write("WEBVTT\n\n")
        for a, b, w in words:
            f.write(f"{stamp(a)} --> {stamp(b)}\n{w}\n\n")
    print(f"{out_mp3}: {len(words)} word boundaries for {len(text.split())} words")

# TTS_RATE (e.g. "+15%") switches to tight mode: each sentence is synthesised alone, trimmed to its last word, and joined with
# TTS_SENT_GAP seconds of silence. This removes the ~0.86s pause edge-tts bakes in after every sentence; VTT times are shifted to match.
async def tight(rate, gap):
    sentences = [x.strip() for x in re.split(r"(?<=[.!?])\s+", text) if x.strip()]
    tmp = tempfile.mkdtemp()
    words, parts, clock = [], [], 0.0
    for i, sent in enumerate(sentences):
        mp3 = os.path.join(tmp, "s%d.mp3" % i)
        ws = []
        with open(mp3, "wb") as f:
            async for ch in edge_tts.Communicate(sent, voice, rate=rate, boundary="WordBoundary").stream():
                if ch["type"] == "audio":
                    f.write(ch["data"])
                elif ch["type"] == "WordBoundary":
                    ws.append((ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7, ch["text"]))
        if not ws:
            sys.exit("no word boundaries for sentence %d: %s" % (i, sent))
        lead = max(0.0, ws[0][0] - 0.05)
        length = ws[-1][1] + 0.10 - lead
        wav = os.path.join(tmp, "s%d.wav" % i)
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "%.3f" % lead, "-t", "%.3f" % length, "-i", mp3, "-ar", "24000", "-ac", "1", wav], check=True)
        parts.append(wav)
        words += [(a - lead + clock, b - lead + clock, w) for a, b, w in ws]
        clock += length
        if i < len(sentences) - 1:
            sil = os.path.join(tmp, "g%d.wav" % i)
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "%.3f" % gap, sil], check=True)
            parts.append(sil)
            clock += gap
    lst = os.path.join(tmp, "list.txt")
    with open(lst, "w") as f:
        for p in parts:
            f.write("file '" + p.replace(os.sep, "/") + "'\n")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-ar", "44100", "-b:a", "128k", out_mp3], check=True)
    with open(out_vtt, "w", encoding="utf-8") as f:
        f.write("WEBVTT\n\n")
        for a, b, w in words:
            f.write("%s --> %s\n%s\n\n" % (stamp(a), stamp(b), w))
    shutil.rmtree(tmp, ignore_errors=True)
    print("%s: tight mode, %d words, %.2fs, rate %s, gap %ss" % (out_mp3, len(words), clock, rate, gap))

if os.environ.get("TTS_RATE"):
    asyncio.run(tight(os.environ["TTS_RATE"], float(os.environ.get("TTS_SENT_GAP", "0.3"))))
else:
    asyncio.run(main())
