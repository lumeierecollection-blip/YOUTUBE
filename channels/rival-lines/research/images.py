"""Find real photos of Cristiano Ronaldo on Wikimedia Commons, keep only licences we may use with credit, download them, and write
images.json with author, licence, source page and the Commons category each file came from. No file is kept without a licence line.
usage: python images.py <out_dir> [max_files]"""
import json, os, re, sys, urllib.request, urllib.parse, datetime, html

OUT = sys.argv[1]; MAXF = int(sys.argv[2]) if len(sys.argv) > 2 else 40
os.makedirs(os.path.join(OUT, "files"), exist_ok=True)
UA = {"User-Agent": "RivalLines/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; football analysis)"}
API = "https://commons.wikimedia.org/w/api.php"
OK = re.compile(r"^(CC BY(-SA)? [\d.]+|CC0.*|Public domain.*|PD.*)", re.I)
BAD = re.compile(r"\bNC\b|\bND\b|fair use|non-?commercial", re.I)


def api(**p):
    url = API + "?" + urllib.parse.urlencode({**p, "format": "json", "formatversion": 2})
    for _ in range(4):
        try:
            return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read())
        except Exception as e:
            err = e
    raise RuntimeError(err)


def members(cat, kind):
    r = api(action="query", list="categorymembers", cmtitle=cat, cmtype=kind, cmlimit=100)
    return [m["title"] for m in r["query"]["categorymembers"]]


root = "Category:Cristiano Ronaldo"
subs = [c for c in members(root, "subcat") if re.search(r"playing for|in 20(1[8-9]|2\d)|Al[- ]Nassr|Portugal|Euro 20|World Cup", c)]
cats = [root] + subs[:14] + [f"Category:Cristiano Ronaldo in {y}" for y in range(2016, 2027)]
found = []
for c in cats:
    try:
        fs = members(c, "file")
    except Exception:
        continue
    for f in fs:
        if re.search(r"\.(jpe?g|png)$", f, re.I) and not any(f == x[0] for x in found):
            found.append((f, c))
for q in ("Cristiano Ronaldo", "Cristiano Ronaldo Al Nassr", "Cristiano Ronaldo Portugal"):
    r = api(action="query", list="search", srsearch=q, srnamespace=6, srlimit=50)
    for m in r["query"]["search"]:
        f = m["title"]
        if re.search(r"cristiano|ronaldo|CR7", f, re.I) and re.search(r"\.(jpe?g|png)$", f, re.I) and not any(f == x[0] for x in found):
            found.append((f, "search: " + q))
print("candidate files", len(found), "from", len(cats), "categories")

kept = []
for i in range(0, len(found), 40):
    chunk = found[i:i + 40]
    r = api(action="query", prop="imageinfo", iiprop="url|extmetadata|size", iiurlwidth=1400, titles="|".join(f for f, _ in chunk))
    cat_of = dict(chunk)
    for pg in r["query"]["pages"]:
        ii = (pg.get("imageinfo") or [None])[0]
        if not ii:
            continue
        md = ii["extmetadata"]; lic = md.get("LicenseShortName", {}).get("value", "")
        if not OK.match(lic) or BAD.search(lic):
            continue
        if ii["width"] < 900 or ii["height"] < 900:
            continue
        artist = re.sub(r"<[^>]+>", "", html.unescape(md.get("Artist", {}).get("value", ""))).strip()
        if not artist:
            continue
        kept.append({"title": pg["title"], "category": cat_of.get(pg["title"], ""), "license": lic, "license_url": md.get("LicenseUrl", {}).get("value", ""),
                     "author": artist, "date": re.sub(r"<[^>]+>", "", md.get("DateTimeOriginal", {}).get("value", "")),
                     "description": re.sub(r"<[^>]+>", "", html.unescape(md.get("ImageDescription", {}).get("value", "")))[:240],
                     "page": ii["descriptionurl"], "thumb": ii["thumburl"], "w": ii["width"], "h": ii["height"]})
kept.sort(key=lambda k: k["date"], reverse=True)
kept = kept[:MAXF]
for n, k in enumerate(kept):
    ext = os.path.splitext(urllib.parse.urlparse(k["thumb"]).path)[1].lower() or ".jpg"
    k["file"] = f"files/c{n:02d}{ext}"
    open(os.path.join(OUT, k["file"]), "wb").write(urllib.request.urlopen(urllib.request.Request(k["thumb"], headers=UA), timeout=120).read())
json.dump({"fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"), "images": kept},
          open(os.path.join(OUT, "images.json"), "w", encoding="utf8"), indent=1, ensure_ascii=False)
print("kept", len(kept), "licences", sorted({k["license"] for k in kept}))

try:
    from PIL import Image, ImageDraw
    cols, cw, ch = 6, 300, 300
    rows = (len(kept) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw, rows * (ch + 24)), "white")
    d = ImageDraw.Draw(sheet)
    for n, k in enumerate(kept):
        im = Image.open(os.path.join(OUT, k["file"])).convert("RGB"); im.thumbnail((cw - 8, ch - 8))
        x, y = (n % cols) * cw, (n // cols) * (ch + 24)
        sheet.paste(im, (x + 4, y + 4)); d.text((x + 6, y + ch + 4), f"c{n:02d} {k['date'][:10]} {k['license']}", fill="black")
    sheet.save(os.path.join(OUT, "contact.jpg"), quality=82)
except Exception as e:
    print("contact sheet skipped", e)
