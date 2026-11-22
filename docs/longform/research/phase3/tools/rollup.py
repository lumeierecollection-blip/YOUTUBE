"""Per-channel rollup from aggregate.json (generated). Prints markdown tables used by the research documents.
Pooled share = mean of the per-video shares weighted by sampled frames (so a long video counts more); the range column shows min-max across videos so one video cannot pass as a channel rule."""
import json, os, statistics as st
HERE = os.path.dirname(os.path.abspath(__file__))
A = json.load(open(os.path.join(HERE, "aggregate.json")))
CH = ["hidden-past", "ai-tested", "court-and-spotlight", "celebrity-news", "rival-lines", "red-space-facts", "psychology"]
G = list(A[0]["groups_sampled"].keys())
def w(rs, f):
    tot = sum(r["sampled_frames"] for r in rs); return sum(f(r) * r["sampled_frames"] for r in rs) / tot
out = []
out.append("| Channel | videos done / planned | analysed min | total min of those videos | sampled frames |\n|---|---|---|---|---|")
for c in CH:
    rs = [r for r in A if r["channel"] == c]
    out.append(f"| {c} | {len(rs)} / 5 | {sum(r['analysed_s'] for r in rs)//60} | {sum((r['duration_s'] or 0) for r in rs)//60} | {sum(r['sampled_frames'] for r in rs)} |")
out.append("")
out.append("| Channel | " + " | ".join(G) + " |\n|---|" + "---|" * len(G))
for c in CH:
    rs = [r for r in A if r["channel"] == c]
    if not rs: continue
    out.append(f"| {c} | " + " | ".join(f"{100*w(rs, lambda r: r['groups_sampled'][g]):.0f}% ({100*min(r['groups_sampled'][g] for r in rs):.0f}-{100*max(r['groups_sampled'][g] for r in rs):.0f})" for g in G) + " |")
out.append("")
out.append("| Channel | shots/min (range) | median shot s (range) | share of shots < 3 s | share > 10 s | LUFS (range) | LRA (range) | true peak max | pauses/min (range) | bed below speech in pauses dB (range) |\n|---|---|---|---|---|---|---|---|---|---|")
for c in CH:
    rs = [r for r in A if r["channel"] == c and r.get("shots2")]
    ra = [r for r in A if r["channel"] == c]
    if not ra: continue
    f = lambda xs, nd=1: f"{min(xs):.{nd}f} to {max(xs):.{nd}f}" if xs else "n/a"
    out.append(f"| {c} | {f([r['shots2']['per_min'] for r in rs])} | {f([r['shots2']['median_gap_s'] for r in rs if r['shots2']['median_gap_s']])} | {f([r['shots2']['share_gaps_lt_3s'] for r in rs if r['shots2']['share_gaps_lt_3s'] is not None], 2)} | {f([r['shots2']['share_gaps_gt_10s'] for r in rs if r['shots2']['share_gaps_gt_10s'] is not None], 2)} | {f([r['audio']['integrated_lufs'] for r in ra if r['audio']['integrated_lufs'] is not None])} | {f([r['audio']['lra'] for r in ra if r['audio']['lra'] is not None])} | {max((r['audio']['true_peak_dbtp'] for r in ra if r['audio']['true_peak_dbtp'] is not None), default='n/a')} | {f([r['audio']['pauses_per_min'] for r in ra])} | {f([r['audio']['bed_below_speech_db'] for r in ra])} |")
print("\n".join(out)); open(os.path.join(HERE, "rollup.md"), "w", encoding="utf8").write("\n".join(out))
