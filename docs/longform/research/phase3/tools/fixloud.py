"""Fills null loudness fields in a3/<id>/audio.json by re-measuring the cached clip (same ebur128=peak=true as analyze.py, with -nostats)."""
import glob, json, os, re, subprocess
for ap in glob.glob("a3/*/audio.json"):
    a = json.load(open(ap)); vid = ap.split(os.sep)[-2].split("/")[-1]
    if a.get("integrated_lufs") is not None: continue
    mp4 = f"a3/_video/{os.path.basename(os.path.dirname(ap))}.mp4"
    if not os.path.exists(mp4): print("no clip", mp4); continue
    e = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", mp4, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True, errors="replace").stderr
    s = e[e.rfind("Summary:"):]; g = lambda p: float(re.findall(p, s)[-1])
    a["integrated_lufs"], a["lra"], a["true_peak_dbtp"] = g(r"I:\s+(-?[\d.]+) LUFS"), g(r"LRA:\s+(-?[\d.]+) LU"), g(r"Peak:\s+(-?[\d.]+) dBFS")
    json.dump(a, open(ap, "w")); print(ap, a["integrated_lufs"], a["lra"], a["true_peak_dbtp"])
