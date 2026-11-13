"""Per-video and per-channel rollup of the phase-3 measurements. Nothing here is invented: inputs are a3/<id>/{meta,cuts,audio,ocr}.json,
labels/<id>.json (frame labels made by looking at 240 px tiles), a3list.txt.
Two different visual measures, never to be mixed up:
  SAMPLED-FRAME SHARE  = labelled frames (1 per 15 s) of that category / all labelled frames. Exact only for the sampled instants.
  SEGMENT-WEIGHTED ESTIMATE = the video is split at detected hard cuts; each segment splits its time between the samples inside it (by their half-way-to-neighbour influence), or, if no sample
     falls inside (short segment), the label of the nearest sample ("inherited", unverified). Segment length is the weight. An ESTIMATE of screen time,
     limited by (a) cuts the detector missed (slow dissolves, camera moves), (b) inherited labels. The inherited share is reported beside it.
Caption measure: OCR frames (1 fps in three 60 s windows) with any text = RAW. FILTERED = only OCR frames whose nearest sampled label is not M/Q/G/S/X
  (map/diagram/data/screen/document frames carry in-content text, not editorial captions). Both are automated approximations: a window of 180 s per video."""
import csv, json, os, statistics as st
HERE = os.path.dirname(os.path.abspath(__file__))
ALL = "VNIHKPRASMQGDWOTFZXB?"
GROUPS = {
    "real footage V,N,I,H,K": "VNIHK", "photos+archive P,R,A": "PRA", "screen+docs S,X": "SX", "maps+data M,G": "MG", "tactical Q": "Q",
    "whiteboard W": "W", "motion gfx/illus/text/decor D,O,T,F": "DOTF", "AI-gen Z": "Z", "other B,?": "B?",
}
IN_CONTENT_TEXT = set("MQGSX")
rows = [l.split() for l in open(os.path.join(HERE, "a3list.txt")) if l.strip()]
out, per_ch, seg_rows = [], {}, []
for vid, ch in rows:
    d = os.path.join(HERE, "a3", vid); lf = os.path.join(HERE, "labels", vid + ".json")
    if not (os.path.exists(os.path.join(d, "ocr.json")) and os.path.exists(lf)): continue
    idx = json.load(open(os.path.join(d, "sheets", "index.json")))["times"]; lab = json.load(open(lf))["sheets"]
    toks = [t for n in sorted(lab, key=int) for t in lab[n]]
    if len(toks) != len(idx): continue
    meta, cuts, audio, ocr = (json.load(open(os.path.join(d, f + ".json"))) for f in ("meta", "cuts", "audio", "ocr"))
    n = len(toks); dur = cuts["duration_analysed"]; times = [float(t) for t in idx]
    codes = {c: sum(t[0] == c for t in toks) / n for c in ALL}
    grp = {g: sum(codes[c] for c in cs) for g, cs in GROUPS.items()}
    _p = os.path.join(d, "shots2.json"); s2 = json.load(open(_p)) if os.path.exists(_p) else None
    g2 = [b - a for a, b in zip(s2["boundaries"], s2["boundaries"][1:])] if s2 else []
    motion = None
    if s2:
        import numpy as _np
        _d = _np.array(s2["d"]); _n = len(_d) // 4; _m = _np.median(_d[:_n * 4].reshape(_n, 4), axis=1); _st = _m < 0.01; _best = _cur = 0
        for _s in _st: _cur = _cur + 1 if _s else 0; _best = max(_best, _cur)
        motion = {"median_change": round(float(_np.median(_m)), 3), "static_share": round(float(_st.mean()), 2), "longest_static_s": int(_best), "method": "per second: median over 4 fps samples of the mean absolute difference between frames 0.75 s apart (64x36 RGB, 0-1); static = below 0.01"}
    hc = sorted(cuts["hard_cuts"]); gaps = [b - a for a, b in zip(hc, hc[1:])]
    bounds = [0.0] + hc + [dur]; w, inherited, segs = {g: 0.0 for g in GROUPS}, 0.0, []
    infl = [((times[i - 1] + times[i]) / 2 if i else 0.0, (times[i] + times[i + 1]) / 2 if i < n - 1 else dur) for i in range(n)]
    for a, b in zip(bounds, bounds[1:]):
        inside = [i for i, t in enumerate(times) if a <= t < b]
        if inside:
            ov = {i: max(0.0, min(b, infl[i][1]) - max(a, infl[i][0])) for i in inside}; tot = sum(ov.values()) or 1.0
            for i, o in ov.items():
                c = toks[i][0]; g = next(g for g, cs in GROUPS.items() if c in cs); w[g] += (b - a) * o / tot
            lbl, basis = "+".join(sorted({toks[i][0] for i in inside})), "samples inside segment"
        else:
            mid = (a + b) / 2; i = min(range(n), key=lambda k: abs(times[k] - mid)); c = toks[i][0]
            g = next(g for g, cs in GROUPS.items() if c in cs); w[g] += b - a; inherited += b - a; lbl, basis = toks[i], "inherited from nearest sample"
        segs.append((vid, ch, round(a, 1), round(b, 1), round(b - a, 1), lbl, basis))
    seg_rows += segs
    fr = ocr["frames"]; wins = len(ocr["windows"]) * 60
    def nearest_label(t): return toks[min(range(n), key=lambda k: abs(times[k] - t))][0]
    with_text = [f for f in fr if f["items"]]; filt = [f for f in with_text if nearest_label(f["t"]) not in IN_CONTENT_TEXT]
    words = [sum(len(i["text"].split()) for i in f["items"]) for f in filt]; hts = [max(i["h"] for i in f["items"]) for f in filt]
    cy = [st.mean(i["cy"] for i in f["items"]) for f in filt]
    rec = {
        "id": vid, "channel": ch, "title": meta["title"], "views": meta.get("view_count"), "duration_s": meta.get("duration"), "analysed_s": round(dur), "sampled_frames": n,
        "coverage_pct": round(100 * dur / meta["duration"]) if meta.get("duration") else None,
        "codes_sampled": {c: round(v, 3) for c, v in codes.items() if v}, "groups_sampled": {g: round(v, 3) for g, v in grp.items()},
        "groups_segment_weighted": {g: round(v / dur, 3) for g, v in w.items()}, "inherited_label_share": round(inherited / dur, 3),
        "real_media_share_sampled": round(sum(t[0] in "VNIHKPRASX" for t in toks) / n, 3),
        "constructed_share_sampled": round(sum(t[0] in "MGQDWOTFZ" for t in toks) / n, 3),
        "longest_constructed_run_s": 15 * max((len(list(g)) for k, g in __import__("itertools").groupby(toks, key=lambda t: t[0] in "MGQDWOTFZ") if k), default=0),
        "longest_same_category_run_s": 15 * max(len(list(g)) for k, g in __import__("itertools").groupby(toks, key=lambda t: t[0])),
        "longest_constructed_run_at": (lambda runs: max(runs, key=lambda x: x[1]) if runs else None)([(i0, n0) for (i0, n0) in (lambda L: [(sum(L_[1] for L_ in L[:j]), L[j][1]) for j in range(len(L)) if L[j][0]])([(k, len(list(g))) for k, g in __import__("itertools").groupby(toks, key=lambda t: t[0] in "MGQDWOTFZ")])]),
        "longest_same_run": (lambda L: max(((sum(x[2] for x in L[:j]), L[j][2], L[j][0]) for j in range(len(L))), key=lambda x: x[1]))([(k, None, len(list(g))) for k, g in __import__("itertools").groupby(toks, key=lambda t: t[0])]),
        "motion": motion,
        "human_subject_share_sampled": round(sum(t[0] in "HI" for t in toks) / n, 3),
        "overlay_share_sampled": round(sum("+" in t for t in toks) / n, 3),
        "shots2": ({"n": s2["n"], "per_min": round(s2["n"] / (s2["duration_s"] / 60), 1), "median_gap_s": round(st.median(g2), 1) if g2 else None, "p10_gap_s": round(float(sorted(g2)[len(g2)//10]), 1) if g2 else None, "p90_gap_s": round(float(sorted(g2)[(len(g2)*9)//10]), 1) if g2 else None, "share_gaps_lt_3s": round(sum(x < 3 for x in g2) / len(g2), 2) if g2 else None, "share_gaps_gt_10s": round(sum(x > 10 for x in g2) / len(g2), 2) if g2 else None} if s2 else None),
        "hard_cuts": len(hc), "cuts_per_min": round(len(hc) / (dur / 60), 1), "median_gap_s": round(st.median(gaps), 1) if gaps else None, "gradual": len(cuts["gradual"]),
        "ocr_raw_text_share": round(len(with_text) / max(1, wins), 3), "ocr_filtered_caption_share": round(len(filt) / max(1, wins), 3),
        "caption_words_median": round(st.median(words), 1) if words else 0, "caption_text_height_pct_median": round(100 * st.median(hts), 1) if hts else 0,
        "caption_vertical_pos_median": round(st.median(cy), 2) if cy else None,
        "audio": {k: audio[k] for k in ("integrated_lufs", "lra", "true_peak_dbtp", "bed_below_speech_db", "pauses_per_min", "pause_share", "median_pause_s", "silence_share_lt_-55db")},
    }
    out.append(rec); per_ch.setdefault(ch, []).append(rec)
json.dump(out, open(os.path.join(HERE, "aggregate.json"), "w"), indent=1)
with open(os.path.join(HERE, "segments.csv"), "w", newline="") as fh:
    cw = csv.writer(fh); cw.writerow(["video", "channel", "start_s", "end_s", "duration_s", "label", "label_basis"]); cw.writerows(seg_rows)
G = [g for g in GROUPS if not g.startswith("other")]
L = ["# Phase-3 rollup (generated by aggregate.py)", "", "S = sampled-frame share (1 frame / 15 s). W = segment-weighted screen-time ESTIMATE (cut-based; see aggregate.py header). Not exact durations.", ""]
for ch, rs in per_ch.items():
    L += [f"## {ch} ({len(rs)} video(s) fully labelled)", "", "| video | analysed/total min | cuts/min | median gap s | inherited | " + " | ".join(f"{g} S/W" for g in G) + " | text raw/filtered | cap words | cap h% | LUFS | LRA | TP |", "|" + "---|" * (5 + len(G) + 6)]
    for r in rs:
        s, wv, a = r["groups_sampled"], r["groups_segment_weighted"], r["audio"]
        cells = [f"{100*s[g]:.0f}/{100*wv[g]:.0f}%" for g in G]
        L.append(f"| {r['title'][:40]} ({r['id']}) | {r['analysed_s']//60}/{(r['duration_s'] or 0)//60} | {r['cuts_per_min']} | {r['median_gap_s']} | {100*r['inherited_label_share']:.0f}% | " + " | ".join(cells) + f" | {100*r['ocr_raw_text_share']:.0f}/{100*r['ocr_filtered_caption_share']:.0f}% | {r['caption_words_median']} | {r['caption_text_height_pct_median']} | {a['integrated_lufs']} | {a['lra']} | {a['true_peak_dbtp']} |")
    L.append("")
open(os.path.join(HERE, "aggregate.md"), "w", encoding="utf8").write("\n".join(L))
print(len(out), "videos aggregated,", len(seg_rows), "segments"); print("\n".join(L))
