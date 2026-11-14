"""Fresh-cycle market research. For each eligible channel and format, search YouTube (this-week filter, sorted by views),
then read each candidate's own metadata (upload date, views, channel size) and keep only videos published on/after CUTOFF.
Nothing is invented: every row is read from YouTube's own page data via yt-dlp. Output: research/<channel>-<format>.json"""
import json, subprocess, sys, time, urllib.parse, os, datetime

CUTOFF = "20261104"  # 10 days before 2026-11-14
OUT = os.environ.get("RESEARCH_OUT", os.path.join(os.getcwd(), "output", "fresh-cycle", "research"))
os.makedirs(OUT, exist_ok=True)
SP = {"shorts": "CAMSBAgDEAEYAQ%3D%3D", "long": "CAMSBAgDEAEYAw%3D%3D"}  # sort by views, this week, under 4 min / 4-20 min
Q = {
    "hidden-past": ["forgotten history story", "untold history mystery", "history documentary hidden", "ancient history explained", "historical mystery solved"],
    "ai-tested": ["AI news explained", "ChatGPT Gemini Claude news", "AI chips data centers explained", "AI agents explained", "AI model released"],
    "court-and-spotlight": ["celebrity lawsuit explained", "celebrity court case verdict", "celebrity feud timeline", "celebrity trial explained", "famous legal battle"],
    "rival-lines": ["football tactics explained", "football rivalry history", "tactical analysis football", "world cup history explained", "football data analysis"],
}

def run(args, t=120):
    r = subprocess.run([sys.executable, "-m", "yt_dlp"] + args, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=t)
    return r.stdout

def main(only=None):
    for ch, qs in Q.items():
        if only and ch != only: continue
        for fmt in ("shorts", "long"):
            seen, cands = set(), []
            for q in qs:
                out = run(["--flat-playlist", "--playlist-end", "14", "--print", "%(id)s|%(view_count)s|%(duration)s|%(channel)s|%(title)s",
                           f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(q)}&sp={SP[fmt]}"])
                for line in out.splitlines():
                    p = line.split("|", 4)
                    if len(p) == 5 and p[0] not in seen and len(p[0]) == 11:
                        seen.add(p[0]); cands.append(p)
                time.sleep(2)
            def dur_ok(p):
                try: d = float(p[2])
                except: return False
                return d <= 185 if fmt == "shorts" else d >= 240
            cands = [c for c in cands if dur_ok(c)]
            cands.sort(key=lambda p: -(int(p[1]) if p[1].isdigit() else 0))
            rows = []
            for p in cands[:16]:
                out = run(["--skip-download", "--print", "%(upload_date)s|%(view_count)s|%(like_count)s|%(comment_count)s|%(channel_follower_count)s|%(duration)s|%(channel)s|%(title)s", f"https://www.youtube.com/watch?v={p[0]}"], 90)
                line = [l for l in out.splitlines() if l.count("|") >= 7]
                time.sleep(3)
                if not line: continue
                q = line[-1].split("|", 7)
                if q[0] >= CUTOFF:
                    rows.append({"id": p[0], "url": f"https://www.youtube.com/watch?v={p[0]}", "date": q[0], "views": q[1], "likes": q[2], "comments": q[3], "subs": q[4], "seconds": q[5], "channel": q[6], "title": q[7]})
            with open(os.path.join(OUT, f"{ch}-{fmt}.json"), "w", encoding="utf-8") as f:
                json.dump({"channel_slot": ch, "format": fmt, "window": f"{CUTOFF}..20261114", "searched_queries": qs, "candidates_checked": len(cands[:16]), "rows": rows}, f, indent=1, ensure_ascii=False)
            print(ch, fmt, "checked", len(cands[:16]), "kept", len(rows), flush=True)

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
