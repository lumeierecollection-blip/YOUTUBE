"""Narration mp3 plus a word-level WebVTT, straight from edge-tts WordBoundary events.
usage: python tts-words.py <voice> <script.txt> <out.mp3> <out.vtt>
Fails (non-zero) if the service returned no word boundaries: the renderer syncs every visual to these times."""
import asyncio, sys
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

asyncio.run(main())
