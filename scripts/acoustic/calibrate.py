#!/usr/bin/env python3
"""
Calibrate the acoustic narration gate against labelled files (scripts/voice-lab.mjs set=calibrate).

  calibrate.py <out_dir>        # out_dir/<variant>/vo.mp3 + vo.srt, labels from the directory names' prefix good-/bad-

For each file: per-sentence features (narration-acoustics.py), then the FILE-level value of each feature = the median over its sentences.
Reports, per feature, the good cluster range, the bad cluster range, the GAP between them (min good - max bad when the good cluster is higher,
else the reverse), and the threshold at the middle of the gap. Also checks determinism: the extractor is run twice per file and the two
output hashes must match. Prints a table and writes calibration.json.
"""
import glob, json, os, subprocess, sys, statistics, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
EXTRACT = os.path.join(HERE, "narration-acoustics.py")

def run(mp3, srt):
    p = subprocess.run([sys.executable, EXTRACT, mp3, srt], capture_output=True, text=True, check=True)
    body = p.stdout
    digest = hashlib.sha256(body.encode()).hexdigest()
    return json.loads(body), digest, p.stderr.strip()

FEATURES = ["f0_std_st", "f0_range_st", "f0_slope_st"]

def file_level(doc):
    ss = doc["sentences"]
    out = {}
    for k in FEATURES:
        vals = [s[k] for s in ss if s.get(k) is not None]
        out[k] = round(statistics.median(vals), 4) if vals else None
        out[k + "_min"] = round(min(vals), 4) if vals else None
    out["sentences"] = len(ss)
    return out

def main():
    root = sys.argv[1]
    rows = []
    for d in sorted(glob.glob(os.path.join(root, "*"))):
        mp3, srt = os.path.join(d, "vo.mp3"), os.path.join(d, "vo.srt")
        name = os.path.basename(d)
        if not (os.path.exists(mp3) and os.path.exists(srt)):
            print(f"skip {name}: no mp3/srt")
            continue
        label = "good" if name.startswith("good") else "bad" if name.startswith("bad") else None
        doc, h1, _ = run(mp3, srt)
        _, h2, _ = run(mp3, srt)
        rows.append({"name": name, "label": label, "file": file_level(doc), "hash1": h1, "hash2": h2, "same": h1 == h2})
    good = [r for r in rows if r["label"] == "good"]
    bad = [r for r in rows if r["label"] == "bad"]
    print(f"{'variant':32} {'label':5} {'f0_std_st':>10} {'f0_range_st':>12} {'f0_slope_st':>12} {'sentences':>9} deterministic")
    for r in rows:
        f = r["file"]
        print(f"{r['name']:32} {str(r['label']):5} {f['f0_std_st']!s:>10} {f['f0_range_st']!s:>12} {f['f0_slope_st']!s:>12} {f['sentences']:>9} {'yes' if r['same'] else 'NO'}")
    summary = {}
    for k in FEATURES:
        g = [r["file"][k] for r in good if r["file"][k] is not None]
        b = [r["file"][k] for r in bad if r["file"][k] is not None]
        if not g or not b:
            summary[k] = {"error": "missing a cluster"}
            continue
        higher_is_good = statistics.median(g) > statistics.median(b)
        if higher_is_good:
            gap = min(g) - max(b)
            thr = (min(g) + max(b)) / 2
        else:
            gap = min(b) - max(g)
            thr = (min(b) + max(g)) / 2
        summary[k] = {"good": [min(g), max(g)], "bad": [min(b), max(b)], "good_above_bad": higher_is_good,
                      "gap": round(gap, 4), "separates": gap > 0, "threshold": round(thr, 4)}
        print(f"\n{k}: good {min(g):.4f}..{max(g):.4f}  bad {min(b):.4f}..{max(b):.4f}  gap {gap:+.4f}  threshold {thr:.4f}  {'SEPARATES' if gap > 0 else 'OVERLAPS'}")
    json.dump({"rows": rows, "summary": summary}, open(os.path.join(root, "calibration.json"), "w"), indent=1)
    print(f"\ndeterministic on all files: {all(r['same'] for r in rows)}")

if __name__ == "__main__":
    main()
