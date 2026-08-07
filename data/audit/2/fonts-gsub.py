import sys, os
from fontTools.ttLib import TTFont

def inspect(path):
    f = TTFont(path, lazy=True)
    name = f["name"].getDebugName(1) or os.path.basename(path)
    cmap = f.getBestCmap()
    digits = all(cmap.get(ord(c)) for c in "0123456789")
    punct = {c: bool(cmap.get(ord(c))) for c in ",.%+,kMB€$"}
    gsub = f.get("GSUB")
    gpos = f.get("GPOS")
    gsub_feats = []
    gpos_feats = []
    if gsub and gsub.table.FeatureList:
        for feat in gsub.table.FeatureList.FeatureRecord:
            gsub_feats.append(feat.FeatureTag)
    if gpos and gpos.table.FeatureList:
        for feat in gpos.table.FeatureList.FeatureRecord:
            gpos_feats.append(feat.FeatureTag)
    fam = f["name"].getDebugName(16) or f["name"].getDebugName(1)
    ver = f["name"].getDebugName(5)
    print(f"{os.path.basename(path):32s} fam={fam!r} digits={digits} punct={punct}")
    print(f"    GSUB: {','.join(gsub_feats) if gsub_feats else '-'}")
    print(f"    GPOS: {','.join(gpos_feats) if gpos_feats else '-'}")
    print(f"    name1={name!r} ver={ver!r}")
    f.close()

if __name__ == "__main__":
    d = sys.argv[1] if len(sys.argv) > 1 else "src/skills/remotion-render/public/fonts"
    for fn in sorted(os.listdir(d)):
        if fn.endswith(".woff2"):
            try:
                inspect(os.path.join(d, fn))
            except Exception as e:
                print(f"{fn}: ERROR {e}")
