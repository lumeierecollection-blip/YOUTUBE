"""
Messi's Barcelona La Liga seasons from the career-statistics table on his Wikipedia article (verified career statistics, not event data).
Each row: season, league apps, league goals, all-competition apps, all-competition goals. The parse is checked against the article's own
lead totals (672 goals for Barcelona, 474 in La Liga), so a changed table stops the run instead of drawing a wrong chart.
"""
import html
import json
import re
import urllib.parse
import urllib.request

UA = {"User-Agent": "RivalLines/1.0 (football analysis)"}


def api(**kw):
    q = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in kw.items())
    return json.load(urllib.request.urlopen(urllib.request.Request("https://en.wikipedia.org/w/api.php?format=json&" + q, headers=UA), timeout=60))


def club_section_index(title="Lionel_Messi"):
    """The "Club" subsection that follows "Career statistics" (found by name, so a renumbered article still works)."""
    secs = api(action="parse", page=title, prop="sections")["parse"]["sections"]
    for k, s in enumerate(secs):
        if s["line"] == "Career statistics" and k + 1 < len(secs) and secs[k + 1]["line"] == "Club":
            return secs[k + 1]["index"]
    raise RuntimeError("club statistics section not found")


def parse_seasons(table_html):
    """Barcelona La Liga rows from the club-statistics table HTML."""
    out = []
    for r in re.findall(r"<tr[^>]*>(.*?)</tr>", table_html, re.S):
        c = [html.unescape(re.sub(r"<[^>]+>", "", x)).strip() for x in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S)]
        if c and c[0] == "Barcelona":
            c = c[1:]
        if len(c) >= 6 and re.match(r"^20\d\d.\d\d", c[0]) and c[1] == "La Liga":
            season = re.sub(r"\[.*?\]", "", c[0])
            season = re.sub(r"[^0-9]+", "-", season, count=1)  # "2011-12": the article uses an en dash
            out.append({"season": season, "league_apps": int(c[2]), "league_goals": int(c[3]), "apps": int(c[-2]), "goals": int(c[-1])})
    return out


def barcelona_la_liga_seasons():
    seasons = parse_seasons(api(action="parse", page="Lionel_Messi", prop="text", section=club_section_index())["parse"]["text"]["*"])
    # Guard: the article lead says 672 goals for Barcelona and 474 in La Liga.
    assert sum(s["goals"] for s in seasons) == 672 and sum(s["league_goals"] for s in seasons) == 474, (sum(s["goals"] for s in seasons), sum(s["league_goals"] for s in seasons))
    return seasons
