"""Stage B for the Ronaldo 1,000 goals episode: fetch every number the video may use, with source URL, revision and fetch time.
Nothing here is typed in by hand. Output: channels/rival-lines/episodes/ronaldo-1000/research/*.json
usage: python fetch.py <out_dir>"""
import io, json, os, re, sys, datetime, urllib.request, urllib.parse
import pandas as pd

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
UA = {"User-Agent": "RivalLines/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; football analysis)"}
NOW = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
WIKI = "https://en.wikipedia.org/w/api.php"


def get(url, tries=4):
    last = None
    for _ in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        except Exception as e:
            last = e
    raise RuntimeError(f"fetch failed {url}: {last}")


def api(params):
    return json.loads(get(WIKI + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": 2})))


def num(x):
    m = re.match(r"\s*(\d+)", str(x))
    return int(m.group(1)) if m else None


toc = api({"action": "parse", "page": "Cristiano_Ronaldo", "prop": "tocdata"})["parse"]["tocdata"]["sections"]
idx = {}
in_stats = False
for s in toc:
    if s["line"] == "Career statistics":
        in_stats = True
    elif in_stats and s["line"] in ("Club", "International"):
        idx[s["line"]] = s["index"]
rev = api({"action": "query", "titles": "Cristiano_Ronaldo", "prop": "revisions", "rvprop": "timestamp|ids"})["query"]["pages"][0]["revisions"][0]
page_url = f"https://en.wikipedia.org/w/index.php?title=Cristiano_Ronaldo&oldid={rev['revid']}"


def table(section):
    html = api({"action": "parse", "page": "Cristiano_Ronaldo", "section": section, "prop": "text"})["parse"]["text"]
    return pd.read_html(io.StringIO(html))[0]


club = table(idx["Club"])
club.columns = ["club", "season", "division", "lg_apps", "lg_goals", "nc_apps", "nc_goals", "lc_apps", "lc_goals", "co_apps", "co_goals", "ot_apps", "ot_goals", "apps", "goals"]
club_rows = []
for _, r in club.iterrows():
    club_rows.append({k: (None if str(r[k]) in ("nan", "–", "—") else str(r[k])) for k in ["club", "season", "division"]} | {
        "apps": num(r["apps"]), "goals": num(r["goals"]), "lg_apps": num(r["lg_apps"]), "lg_goals": num(r["lg_goals"]),
        "co_apps": num(r["co_apps"]), "co_goals": num(r["co_goals"])})
intl = table(idx["International"])
intl.columns = ["team", "year", "c_apps", "c_goals", "f_apps", "f_goals", "apps", "goals"]
intl_rows = [{"team": str(r["team"]), "year": str(r["year"]), "apps": num(r["apps"]), "goals": num(r["goals"])} for _, r in intl.iterrows()]

club_total = next(r for r in club_rows if r["club"] == "Career total")
portugal_total = next(r for r in intl_rows if r["team"] == "Portugal" and r["year"] == "Total")
wiki = {
    "source": "Wikipedia, Cristiano Ronaldo, Career statistics (CC BY-SA 4.0)", "url": page_url,
    "revision_id": rev["revid"], "revision_timestamp": rev["timestamp"], "fetched_at": NOW,
    "club": club_rows, "international": intl_rows,
    "club_total": {"apps": club_total["apps"], "goals": club_total["goals"]},
    "portugal_total": {"apps": portugal_total["apps"], "goals": portugal_total["goals"]},
}
wiki["official_goals"] = wiki["club_total"]["goals"] + wiki["portugal_total"]["goals"]
wiki["official_apps"] = wiki["club_total"]["apps"] + wiki["portugal_total"]["apps"]
json.dump(wiki, open(os.path.join(OUT, "wikipedia-stats.json"), "w", encoding="utf8"), indent=1, ensure_ascii=False)
print("wikipedia official goals", wiki["official_goals"], "apps", wiki["official_apps"], "rev", rev["timestamp"])

# birth date from Wikidata (Q11571)
wd = json.loads(get("https://www.wikidata.org/wiki/Special:EntityData/Q11571.json"))
ent = wd["entities"]["Q11571"]
birth = ent["claims"]["P569"][0]["mainsnak"]["datavalue"]["value"]["time"]
json.dump({"source": "Wikidata Q11571 (CC0)", "url": "https://www.wikidata.org/wiki/Q11571", "birth": birth, "fetched_at": NOW},
          open(os.path.join(OUT, "wikidata-birth.json"), "w", encoding="utf8"), indent=1)
print("birth", birth)

# second opinion: public goal trackers (best effort, recorded as found; the script decides which, if any, to cite)
trackers = []
for url in ["https://www.ronaldogoalscore.com/en/", "https://messixronaldo.com/cristiano-ronaldo-total-career-goals/"]:
    try:
        raw = get(url).decode("utf8", "replace")
        text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"(?s)<(script|style).*?</\1>", " ", raw)))
        hits = [text[max(0, m.start() - 90): m.end() + 90] for m in re.finditer(r"\b9\d\d\b[^.]{0,40}goals|goals[^.]{0,40}\b9\d\d\b", text)][:6]
        trackers.append({"url": url, "fetched_at": NOW, "ok": True, "snippets": hits})
    except Exception as e:
        trackers.append({"url": url, "fetched_at": NOW, "ok": False, "error": str(e)})
json.dump(trackers, open(os.path.join(OUT, "trackers.json"), "w", encoding="utf8"), indent=1, ensure_ascii=False)
print("trackers", [(t["url"], t["ok"], len(t.get("snippets", []))) for t in trackers])
