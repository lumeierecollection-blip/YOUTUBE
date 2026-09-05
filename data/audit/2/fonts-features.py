# Stage 2: per-file feature + digit + weight dump for the vendored font set.
# Output: data/audit/2/tnum-features.txt (human-readable evidence for the
# independent counter-check of CLAIM-assets-004).
from fontTools.ttLib import TTFont
import os

d = r"src\skills\remotion-render\public\fonts"
out = []
for fn in sorted(os.listdir(d)):
    if not fn.endswith(".woff2"):
        continue
    f = TTFont(os.path.join(d, fn))
    cmap = set(f.getBestCmap())
    digits = all(c in cmap for c in range(0x30, 0x3A))
    latin_letters = all(c in cmap for c in [0x41, 0x5A, 0x61, 0x7A])
    if "GSUB" in f:
        gsub = sorted({r.FeatureTag for r in f["GSUB"].table.FeatureList.FeatureRecord})
    else:
        gsub = ["NO GSUB"]
    w = f["OS/2"].usWeightClass
    fam = f["name"].getDebugName(1)
    out.append(
        f"{fn:26s} weightClass={w} digits={digits} latinABCz={latin_letters} "
        f"tnum={'tnum' in gsub} gsub=[{', '.join(gsub)}] name1={fam}"
    )
with open(os.path.join(os.path.dirname(__file__), "tnum-features.txt"), "w") as fh:
    fh.write("\n".join(out) + "\n")
print("\n".join(out))
