"""Shared helpers for the doc generators: loads aggregate.json, formats timecodes, builds the evidence tables. Nothing here invents data."""
import json, os, statistics as st
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = r"C:\Users\info\YOUTUBE\.worktrees\orch"
DOCS = os.path.join(REPO, "docs", "longform")
A = json.load(open(os.path.join(HERE, "aggregate.json"), encoding="utf8"))
META = {r["id"]: json.load(open(os.path.join(HERE, "a3", r["id"], "meta.json"), encoding="utf8")) for r in A}
CH = ["hidden-past", "ai-tested", "court-and-spotlight", "celebrity-news", "rival-lines", "red-space-facts", "psychology"]
CHNAME = {"hidden-past": "Hidden Past", "ai-tested": "AI Tested", "court-and-spotlight": "Court & Spotlight", "celebrity-news": "Celebrity News", "rival-lines": "Rival Lines", "red-space-facts": "Space (Red Space Facts)", "psychology": "Psychology"}
PLANNED = {"hidden-past": 5, "ai-tested": 5, "court-and-spotlight": 5, "celebrity-news": 4, "rival-lines": 5, "red-space-facts": 6, "psychology": 5}
def by(c): return [r for r in A if r["channel"] == c]
def tc(s):
    s = int(round(s)); return f"{s//3600}:{s%3600//60:02d}:{s%60:02d}" if s >= 3600 else f"{s//60}:{s%60:02d}"
def url(i): return f"https://www.youtube.com/watch?v={i}"
def link(r): return f"[{r['title'][:60]}]({url(r['id'])})"
def ref(r, a=None, b=None):
    t = f"{r['title'][:55]} ({META[r['id']].get('channel','')[:24]}), {url(r['id'])}"
    return t + (f", {tc(a)}-{tc(b)}" if a is not None else "")
def run_at(r, key):
    """(start_s, end_s, length_s) of a run stored as [start_sample, n_samples] (15 s samples centred on 5+15*i)."""
    v = r[key]
    if not v: return None
    i0, n = v[0], v[1]; return (max(0, 5 + 15 * i0 - 7.5), 5 + 15 * (i0 + n - 1) + 7.5, 15 * n)
def rng(xs, nd=0, pct=False):
    xs = [x for x in xs if x is not None]
    if not xs: return "n/a"
    f = (lambda v: f"{100*v:.0f}%") if pct else (lambda v: f"{v:.{nd}f}")
    return f(min(xs)) if min(xs) == max(xs) else f"{f(min(xs))}-{f(max(xs))}"
def wavg(rs, f):
    tot = sum(r["sampled_frames"] for r in rs); return sum(f(r) * r["sampled_frames"] for r in rs) / tot if tot else 0
def coverage_table():
    L = ["| Channel | Videos analysed (planned) | Reference channels | Inspected min / video min | Mean coverage | Sampled frames |", "|---|---|---|---|---|---|"]
    for c in CH:
        rs = by(c)
        chs = sorted({META[r["id"]].get("channel", "")[:22] for r in rs})
        L.append(f"| {CHNAME[c]} | {len(rs)} ({PLANNED[c]}) | {', '.join(chs)} ({len(chs)} channel{'s' if len(chs)!=1 else ''}) | {sum(r['analysed_s'] for r in rs)//60} / {sum((r['duration_s'] or 0) for r in rs)//60} | {st.mean(r['coverage_pct'] for r in rs):.0f}% | {sum(r['sampled_frames'] for r in rs)} |")
    return "\n".join(L)
