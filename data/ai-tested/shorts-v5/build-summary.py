import json, os, sys

base = sys.argv[1] if len(sys.argv) > 1 else "."
manifest_path = os.path.join(base, "manifest.json")
with open(manifest_path, encoding="utf-8-sig") as mf:
    manifest = json.load(mf)
items = manifest.get("stories") or manifest.get("videos") or []

acceptance = None
acc_path = os.path.join(base, "production-records", "acceptance.json")
if os.path.exists(acc_path):
    try:
        with open(acc_path, encoding="utf-8-sig") as f: acceptance = json.load(f)
    except Exception: acceptance = None

lines = ["AI Tested Shorts V5 - Production Summary", "=======================================", ""]
if acceptance:
    lines.append(f"ALL_FINAL_APPROVED={acceptance.get('allApproved')}")
    lines.append("")
for s in items:
    sid = s["id"]; slug = s["slug"]
    lines.append(f"{sid} - {s['title']}")
    lines.append("Sources:")
    for src in s.get("sources", []):
        lines.append(f"  - {src}")
    mp4 = os.path.join(base, "out", f"{sid}-{slug}.mp4")
    lines.append(f"File: {os.path.basename(mp4)} exists={os.path.exists(mp4)}")
    st = None
    if acceptance:
        for x in acceptance.get("statuses", []):
            if str(x.get("id")) == str(sid): st = x; break
    if st:
        lines.append(f"RENDERED={st.get('RENDERED')} TECHNICAL_QA_PASSED={st.get('TECHNICAL_QA_PASSED')} GEMINI_REVIEW_PASSED={st.get('GEMINI_REVIEW_PASSED')} DIRECTOR_APPROVED={st.get('DIRECTOR_APPROVED')} FINAL_APPROVED={st.get('FINAL_APPROVED')}")
        if st.get("reviewSummary"): lines.append(f"Review: {st.get('reviewSummary')}")
    lines.append("")

out = os.path.join(base, "production-summary.txt")
with open(out, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print(open(out, encoding="utf-8").read())
