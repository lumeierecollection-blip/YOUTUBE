import json, os, sys
base = sys.argv[1] if len(sys.argv) > 1 else "."
manifest = json.load(open(os.path.join(base, "manifest.json"), encoding="utf-8"))
lines = ["AI Tested Shorts - Production Summary", "=================================", ""]
for s in manifest["stories"]:
    lines.append(f"{s['id']} - {s['title']}")
    lines.append("Sources:")
    for src in s["sources"]:
        lines.append(f"  - {src}")
    mp4 = os.path.join(base, "out", f"{s['id']}-{s['slug']}.mp4")
    lines.append(f"File: {os.path.basename(mp4)} exists={os.path.exists(mp4)}")
    lines.append("")
out = os.path.join(base, "production-summary.txt")
with open(out, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print(open(out, encoding="utf-8").read())
