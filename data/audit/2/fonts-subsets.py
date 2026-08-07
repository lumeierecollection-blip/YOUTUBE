import os, sys
from fontTools.ttLib import TTFont

BLOCKS = {
    (0x0000,0x007F): 'BasicLatin', (0x0080,0x00FF): 'Latin1Supp', (0x0100,0x017F): 'LatinExtA',
    (0x0180,0x024F): 'LatinExtB', (0x0250,0x02AF): 'IPA', (0x0300,0x036F): 'CombDiacr',
    (0x0370,0x03FF): 'Greek', (0x0400,0x04FF): 'Cyrillic', (0x0500,0x052F): 'CyrillicSupp',
    (0x1E00,0x1EFF): 'LatinExtAdd', (0x2000,0x206F): 'Punct', (0x20A0,0x20CF): 'Currency',
    (0x2190,0x21FF): 'Arrows', (0x25A0,0x25FF): 'GeomShapes', (0x1F00,0x1FFF): 'GreekExt',
    (0x2DE0,0x2DFF): 'CyrillicExtA', (0xA640,0xA69F): 'CyrillicExtB', (0xFE00,0xFE0F): 'VarSel',
    (0xE000,0xF8FF): 'Private', (0x2C60,0x2C7F): 'LatinExtC',
}

def block_of(cp):
    for (lo, hi), name in BLOCKS.items():
        if lo <= cp <= hi:
            return name
    return f'Other(0x{cp:04X})'

def subset_summary(path):
    f = TTFont(path, lazy=True)
    c = f.getBestCmap()
    counts = {}
    for cp in c:
        b = block_of(cp)
        counts[b] = counts.get(b, 0) + 1
    digits = sum(1 for cp in c if 48 <= cp <= 57)
    latin_letters = sum(1 for cp in c if 65 <= cp <= 90 or 97 <= cp <= 122)
    fam = f['name'].getDebugName(1)
    print(f"{os.path.basename(path):30s} digits={digits:2d} latin={latin_letters:3d} n={len(c):3d} top={sorted(counts.items(), key=lambda kv:-kv[1])[:3]}")
    f.close()

d = sys.argv[1] if len(sys.argv) > 1 else "src/skills/remotion-render/public/fonts"
for fn in sorted(os.listdir(d)):
    if fn.endswith(".woff2"):
        try:
            subset_summary(os.path.join(d, fn))
        except Exception as e:
            print(f"{fn}: ERROR {e}")
