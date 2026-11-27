"""Find real photos of named people or places on Wikimedia Commons from a spec file, keep only licences we may use with credit,
download them, and write images.json (same shape as images.py) with author, licence and source page. No file is kept without a licence line.
usage: python fetch_people.py <episode_dir>
Reads <episode_dir>/image-spec.json: {"people": [{"key": "kane", "name": "Harry Kane", "category": "Category:Harry Kane", "must": "kane", "n": 3}]}
`must` is a regex that the Commons file title has to match, so a search hit about someone else is dropped."""
import json, os, re, sys, urllib.request, urllib.parse, datetime, html

EP = sys.argv[1]
spec = json.load(open(os.path.join(EP, "image-spec.json"), encoding="utf8"))
OUT = os.path.join(EP, "images")
os.makedirs(os.path.join(OUT, "files"), exist_ok=True)
UA = {"User-Agent": "RivalLines/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; football analysis)"}
API = "https://commons.wikimedia.org/w/api.php"
OK = re.compile(r"^(CC BY(-SA)? [\d.]+|CC0.*|Public domain.*|PD.*)", re.I)
BAD = re.compile(r"\bNC\b|\bND\b|fair use|non-?commercial", re.I)
IMG = re.compile(r"\.(jpe?g|png)$", re.I)


def api(**p):
    url = API + "?" + urllib.parse.urlencode({**p, "format": "json", "formatversion": 2})
    err = None
    for _ in range(4):
        try:
            return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read())
        except Exception as e:
            err = e
    raise RuntimeError(err)


def cat_files(cat, depth=1):
    r = api(action="query", list="categorymembers", cmtitle=cat, cmtype="file", cmlimit=200)
    files = [m["title"] for m in r["query"].get("categorymembers", [])]
    if depth:
        sub = api(action="query", list="categorymembers", cmtitle=cat, cmtype="subcat", cmlimit=60)
        for s in sub["query"].get("categorymembers", []):
            if re.search(r"20(1[9]|2\d)|playing for|national team|World Cup|Euro", s["title"]):
                files += cat_files(s["title"], 0)
    return files


kept, seen = [], set()
for p in spec["people"]:
    must = re.compile(p["must"], re.I)
    cand = []
    if p.get("category"):
        try:
            cand += cat_files(p["category"])
        except Exception as e:
            print("category failed", p["category"], e)
    if len(cand) < 6 or p.get("queries"):
        for q in p.get("queries") or [p["name"]]:
            r = api(action="query", list="search", srsearch=q, srnamespace=6, srlimit=50)
            cand += [m["title"] for m in r["query"]["search"]]
    cand = [c for c in dict.fromkeys(cand) if IMG.search(c) and must.search(c) and c not in seen]
    got = []
    for i in range(0, len(cand), 40):
        chunk = cand[i:i + 40]
        r = api(action="query", prop="imageinfo", iiprop="url|extmetadata|size", iiurlwidth=1400, titles="|".join(chunk))
        for pg in r["query"]["pages"]:
            ii = (pg.get("imageinfo") or [None])[0]
            if not ii:
                continue
            md = ii["extmetadata"]
            lic = md.get("LicenseShortName", {}).get("value", "")
            if not OK.match(lic) or BAD.search(lic):
                continue
            if ii["width"] < p.get("min_w", 900) or ii["height"] < p.get("min_h", 900):
                continue
            artist = re.sub(r"<[^>]+>", "", html.unescape(md.get("Artist", {}).get("value", ""))).strip()
            if not artist:
                continue
            got.append({"key": p["key"], "title": pg["title"], "license": lic, "license_url": md.get("LicenseUrl", {}).get("value", ""),
                        "author": artist, "date": re.sub(r"<[^>]+>", "", md.get("DateTimeOriginal", {}).get("value", "")),
                        "description": re.sub(r"<[^>]+>", "", html.unescape(md.get("ImageDescription", {}).get("value", "")))[:240],
                        "page": ii["descriptionurl"], "thumb": ii["thumburl"], "w": ii["width"], "h": ii["height"]})
    got.sort(key=lambda k: k["date"], reverse=True)
    got = got[: p.get("n", 3)]
    for k in got:
        seen.add(k["title"])
    print(f'{p["key"]}: {len(cand)} candidates, kept {len(got)}')
    kept += got

for n, k in enumerate(kept):
    ext = os.path.splitext(urllib.parse.urlparse(k["thumb"]).path)[1].lower() or ".jpg"
    k["id"] = f'{k["key"]}{sum(1 for x in kept[:n] if x["key"] == k["key"]) + 1}'
    k["file"] = f'files/{k["id"]}{ext}'
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
        sheet.paste(im, (x + 4, y + 4)); d.text((x + 6, y + ch + 4), f"{k['id']} {k['date'][:10]} {k['license']}", fill="black")
    sheet.save(os.path.join(OUT, "contact.jpg"), quality=82)
except Exception as e:
    print("contact sheet skipped", e)
