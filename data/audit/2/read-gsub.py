# AUDIT-TYPE — Stage 2 GSUB feature reader.
# Reads the GSUB table of every vendored .woff2 and reports which OpenType
# layout features are actually compiled into the installed binaries.
# Source 1 of the tnum audit: the binary itself (first-party, ground truth).
import os, sys, json
from fontTools.ttLib import TTFont

FONTS_DIR = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Chile\YOUTUBE\src\skills\remotion-render\public\fonts"
WANT = {"tnum", "pnum", "lnum", "onum", "zero", "frac", "numr", "dnom", "ordn", "sups", "subs"}
FEAT_TAG_NAMES = {
    "tnum": "tabular figures", "pnum": "proportional figures",
    "lnum": "lining figures", "onum": "oldstyle figures",
    "zero": "slashed zero", "frac": "fractions", "ordn": "ordinals",
    "sups": "superscripts", "subs": "subscripts",
}

def read_features(path):
    try:
        f = TTFont(path, lazy=True, fontNumber=0)
    except Exception as e:
        return {"error": str(e)}
    out = {"family_name": None, "subfamily": None, "features": {}, "has_gsub": False, "scripts": [],
           "usWeightClass": None, "unitsPerEm": None, "xAvgCharWidth": None, "isVariable": False, "hasSTAT": False}
    try:
        name = f["name"]
        for rec in name.names:
            if rec.nameID == 1 and rec.platformID in (1, 3) and rec.isUnicode():
                out["family_name"] = str(rec.toUnicode()); break
        for rec in name.names:
            if rec.nameID == 2 and rec.platformID in (1, 3) and rec.isUnicode():
                out["subfamily"] = str(rec.toUnicode()); break
    except Exception:
        pass
    if "OS/2" in f:
        out["usWeightClass"] = f["OS/2"].usWeightClass
        out["xAvgCharWidth"] = f["OS/2"].xAvgCharWidth
    if "head" in f:
        out["unitsPerEm"] = f["head"].unitsPerEm
    out["isVariable"] = "fvar" in f
    out["hasSTAT"] = "STAT" in f
    # fvar axes: tag, min, default, max
    if out["isVariable"]:
        try:
            axes = []
            for a in f["fvar"].axes:
                axes.append(f"{a.axisTag}:{a.minValue}/{a.defaultValue}/{a.maxValue}")
            out["fvar_axes"] = axes
        except Exception as e:
            out["fvar_axes_error"] = str(e)
    if "GSUB" in f:
        out["has_gsub"] = True
        gsub = f["GSUB"].table
        try:
            scripts = []
            for rec in gsub.ScriptList.ScriptRecord:
                scripts.append(rec.ScriptTag)
            out["scripts"] = scripts
        except Exception:
            pass
        # feature records registered in the feature list
        try:
            for rec in gsub.FeatureList.FeatureRecord:
                tag = rec.FeatureTag
                if tag in WANT:
                    # count lookup indices
                    n = len(rec.Feature.LookupListIndex) if rec.Feature else 0
                    out["features"][tag] = n
        except Exception as e:
            out["features"]["_error"] = str(e)
    else:
        out["has_gsub"] = False
    f.close()
    return out

rows = []
for fn in sorted(os.listdir(FONTS_DIR)):
    if not fn.lower().endswith(".woff2"):
        continue
    info = read_features(os.path.join(FONTS_DIR, fn))
    rows.append({"file": fn, **info})

print(json.dumps(rows, indent=2))
