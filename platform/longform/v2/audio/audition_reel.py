"""Builds ONE audition file so a person can listen to every library asset in order: output/longform-audio-demo/audition-reel.mp3 plus audition-index.json
(time in the reel -> slot, kind, excerpt rule, original loudness). Excerpt rule: music 20 s from 30% in; ambience 15 s from 20% in; effects whole (max 10 s).
Every excerpt is loudness-normalised to -23 LUFS (true peak -3 dB) so the reel is comfortable to listen to; that hides the real level differences, which are listed in the index
and in SOUND-LIBRARY-REGISTER.md. A 0.8 s gap separates excerpts. This only PREPARES the listening: it is not a listening review."""
import json, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
lib = json.load(open(os.path.join(ROOT, "config/longform-audio-library.json"), encoding="utf8"))
OUT = os.path.join(ROOT, "output/longform-audio-demo"); TMP = os.path.join(OUT, "_reel"); os.makedirs(TMP, exist_ok=True)
parts, index, t = [], [], 0.0
gap = os.path.join(TMP, "gap.wav"); subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "0.8", gap], check=True)
for a in lib["assets"]:
    src = os.path.join(ROOT, a["file"]); d = a["measured"]["duration_s"]
    ss, ln = (0.3 * d, 20) if a["kind"] == "music" else (0.2 * d, 15) if a["kind"] == "ambience" else (0, min(10, d))
    out = os.path.join(TMP, a["slot"] + ".wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(ss), "-t", str(ln), "-i", src, "-ac", "1", "-ar", "44100", "-af", "loudnorm=I=-23:TP=-3:LRA=11", out], check=True)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], capture_output=True, text=True).stdout)
    index.append({"start_s": round(t, 1), "end_s": round(t + dur, 1), "slot": a["slot"], "kind": a["kind"], "title": a["title"], "excerpt_from_s": round(ss, 1), "excerpt_len_s": round(dur, 1), "original_lufs": a["measured"]["integrated_lufs"], "original_true_peak_dbtp": a["measured"]["true_peak_dbtp"], "licence": a["license"]})
    parts += [out, gap]; t += dur + 0.8
lst = os.path.join(TMP, "list.txt"); open(lst, "w").write("".join(f"file '{p.replace(chr(92), '/')}'\n" for p in parts))
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-b:a", "128k", os.path.join(OUT, "audition-reel.mp3")], check=True)
json.dump({"note": "Audition reel index. Not a listening review.", "total_s": round(t, 1), "items": index}, open(os.path.join(OUT, "audition-index.json"), "w"), indent=1)
for p in os.listdir(TMP): os.remove(os.path.join(TMP, p))
os.rmdir(TMP); print("reel", round(t), "s,", len(index), "items")
