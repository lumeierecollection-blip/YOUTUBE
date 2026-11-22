#!/usr/bin/env python3
"""Builds a Blender Edit Machine project (github.com/brodyautomates/blender-edit-machine, MIT, pinned in .github/workflows/blender-render.yml)
from one of our long-form episodes, so the SAME sourced narration and facts are re-edited in its Glass Studio style.

  python3 platform/blender/build_project.py <slug> <voice_dir> <out_project_dir>

voice_dir: the episode's narration, one <beat>.mp3 per beat (the voice-<slug> artifact of a longform-render run).
Writes: vo.wav (the beats joined in order), beats.json (data/blender/<slug>/beats.json plus each beat's start/length and each sentence's estimated
start, by word share), assets/ (the credited pictures the faces show), spec.py (platform/blender/spec_template.py). timing.json then comes from the
repo's own transcribe.py (faster-whisper word timings); spec.py cues every shot to the first transcribed word at or after its start time.
"""
import json, os, shutil, subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
slug, voice, out = sys.argv[1], pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True); (out / "assets").mkdir(exist_ok=True)
B = json.load(open(ROOT / "data/blender" / slug / "beats.json", encoding="utf-8"))
dur = lambda f: float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)], capture_output=True, text=True).stdout)

lst, t = [], 0.0
for b in B["beats"]:
    mp3 = voice / f"{b['id']}.mp3"
    if not mp3.exists(): sys.exit(f"missing narration {mp3}")
    d = dur(mp3); b["start"], b["len"] = round(t, 3), round(d, 3)
    words = [len(s.split()) for s in b["sentences"]]; tot = max(1, sum(words)); acc = 0
    b["sent_starts"] = []
    for n in words: b["sent_starts"].append(round(t + d * acc / tot, 3)); acc += n
    lst.append(f"file '{mp3.resolve().as_posix()}'"); t += d
    for k in ("image",):
        img = b["data"].get(k)
        if img:
            src = ROOT / "src/skills/remotion-render/public" / img
            if src.exists(): shutil.copy(src, out / "assets" / src.name); b["data"][k] = src.name
            else: b["data"][k] = None
(out / "concat.txt").write_text("\n".join(lst))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(out / "concat.txt"), "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", str(out / "vo.wav")], check=True)
(out / "concat.txt").unlink()
json.dump(B, open(out / "beats.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
shutil.copy(ROOT / "platform/blender/spec_template.py", out / "spec.py")
(out / "script.txt").write_text(" ".join(b["vo"] for b in B["beats"]), encoding="utf-8")
print(f"{slug}: {len(B['beats'])} beats, {t:.1f} s of narration -> {out}")
