"""usage: python capwin.py <id> <window index 0-2> -> val/cap_<id>_w<k>.png : the 60 s OCR window at 2 s step (30 tiles, 6x5, 320x180) for manual caption review."""
import json, subprocess, sys
vid, k = sys.argv[1], int(sys.argv[2])
w = json.load(open(f"a3/{vid}/ocr.json"))["windows"][k]
subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(w[0]), "-t", "60", "-i", f"a3/_video/{vid}.mp4", "-vf", "fps=1/2,scale=320:180,tile=6x5", "-frames:v", "1", f"val/cap_{vid}_w{k}.png"])
print(vid, "window", w, "-> val/cap_%s_w%d.png (tile n = %d s + 2n, row-major from 0)" % (vid, k, w[0]))
