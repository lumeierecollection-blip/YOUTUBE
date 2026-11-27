"""Fetch metadata (always) and audio (best effort) for every reference. usage: python fetch.py <work_dir> [id ...]
Writes <work_dir>/<id>/meta.json and <work_dir>/<id>/audio.wav (mono 22.05 kHz) when the download works.
Raw audio stays in the runner's work dir; it is never committed or uploaded (the repo is public)."""
import json, os, shutil, subprocess, sys
YTDLP = ["yt-dlp"] if shutil.which("yt-dlp") else [sys.executable, "-m", "yt_dlp"]
here = os.path.dirname(os.path.abspath(__file__))
refs = json.load(open(os.path.join(here, "refs.json"), encoding="utf8"))["refs"]
work = sys.argv[1]
only = set(sys.argv[2:])
KEEP = ["id", "title", "channel", "uploader", "duration", "upload_date", "view_count", "description", "tags", "categories", "chapters", "track", "artist", "album", "release_year", "creator", "availability", "webpage_url"]
for r in refs:
    if only and r["id"] not in only:
        continue
    d = os.path.join(work, r["id"]); os.makedirs(d, exist_ok=True)
    url = f"https://www.youtube.com/watch?v={r['id']}"
    status = {"id": r["id"], "meta": False, "audio": False, "error": None}
    p = subprocess.run(YTDLP + ["--no-playlist", "--skip-download", "--dump-single-json", url], capture_output=True, text=True)
    if p.returncode == 0:
        j = json.loads(p.stdout)
        json.dump({k: j.get(k) for k in KEEP}, open(os.path.join(d, "meta.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
        status["meta"] = True
    else:
        status["error"] = (p.stderr.strip().splitlines() or ["yt-dlp failed"])[-1][:300]
    if status["meta"]:
        raw = os.path.join(d, "raw")
        p = subprocess.run(YTDLP + ["--no-playlist", "-f", "bestaudio", "-o", raw + ".%(ext)s", url], capture_output=True, text=True)
        files = [f for f in os.listdir(d) if f.startswith("raw.")]
        if p.returncode == 0 and files:
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", os.path.join(d, files[0]), "-ac", "1", "-ar", "22050", os.path.join(d, "audio.wav")], check=True)
            os.remove(os.path.join(d, files[0]))
            status["audio"] = True
        else:
            status["error"] = (p.stderr.strip().splitlines() or ["audio download failed"])[-1][:300]
    json.dump(status, open(os.path.join(d, "status.json"), "w"))
    print(json.dumps(status))
