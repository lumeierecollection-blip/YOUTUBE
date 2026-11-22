"""
StatsBomb Open Data helpers for Rival Lines. Event data only: every number computed here comes from recorded events.
Nothing here interpolates player movement, and nothing estimates a position that was not recorded.
Data: https://github.com/statsbomb/open-data (credit StatsBomb and show their logo wherever the analysis is published).
"""
import json
import os
import urllib.request

BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data/"
LOGO = "https://raw.githubusercontent.com/statsbomb/open-data/master/img/SB%20-%20Icon%20Lockup%20-%20Colour%20positive.png"
UA = {"User-Agent": "RivalLines/1.0 (football analysis; StatsBomb open data)"}


def get(path, cache_dir=None):
    """Fetches one open-data JSON file, caching it so a resumed production does not download it twice."""
    if cache_dir:
        os.makedirs(cache_dir, exist_ok=True)
        f = os.path.join(cache_dir, path.replace("/", "_"))
        if os.path.exists(f):
            return json.load(open(f, encoding="utf8"))
    last = None
    for _ in range(4):
        try:
            data = json.load(urllib.request.urlopen(urllib.request.Request(BASE + path, headers=UA), timeout=180))
            if cache_dir:
                json.dump(data, open(f, "w", encoding="utf8"))
            return data
        except Exception as e:  # network hiccup: retry, then fail loudly
            last = e
    raise RuntimeError(f"could not fetch {path}: {last}")


def download(url, dst):
    open(dst, "wb").write(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read())


# StatsBomb position id -> (x, y) on the 120 x 80 pitch for a team attacking left to right. y is large on the team's right.
POSITION_XY = {
    1: (6, 40), 2: (30, 68), 3: (26, 56), 4: (26, 40), 5: (26, 24), 6: (30, 12), 7: (46, 70), 8: (46, 10),
    9: (44, 54), 10: (44, 40), 11: (44, 26), 12: (62, 68), 13: (60, 54), 14: (60, 40), 15: (60, 26), 16: (62, 12),
    17: (88, 68), 18: (78, 56), 19: (78, 40), 20: (78, 24), 21: (88, 12), 22: (100, 50), 23: (102, 40), 24: (100, 30), 25: (92, 40),
}


def starting_xi(events, team):
    """The recorded Starting XI for a team: formation and each player's position id, name and shirt number."""
    for e in events:
        if e["type"]["name"] == "Starting XI" and e["team"]["name"] == team:
            return {
                "formation": str(e["tactics"]["formation"]),
                "players": [{"name": p["player"]["name"], "id": p["player"]["id"], "number": p.get("jersey_number"), "position_id": p["position"]["id"], "position": p["position"]["name"], "xy": POSITION_XY[p["position"]["id"]]} for p in e["tactics"]["lineup"]],
            }
    raise ValueError(f"no Starting XI for {team}")


PARTICLES = {"de", "di", "da", "dos", "mac", "mc", "van", "von", "le", "la", "el", "al"}


def compress_name(nickname):
    """Display name from StatsBomb's own nickname: drop the first name, keep a surname particle ("Di Maria", "Mac Allister")."""
    parts = nickname.replace(" ", " ").split()
    if len(parts) <= 1:
        return nickname
    rest = parts[1:]
    if len(rest) == 1:
        return rest[0]
    return " ".join(rest) if rest[0].lower() in PARTICLES else rest[-1]


def display_names(lineups):
    """Map of full recorded player name -> short display name, from the lineup file's nicknames."""
    out = {}
    for team in lineups:
        for p in team["lineup"]:
            out[p["player_name"]] = compress_name(p.get("player_nickname") or p["player_name"])
    return out


def short_name(full):
    """Display name: the last word of a name, except for known compound forms, which come from the recorded name only."""
    parts = full.replace(" ", " ").split()
    return parts[-1] if parts else full


def passing_network(events, team, period=1, until_minute=40, min_pair=3):
    """
    Completed-pass network among a team's players in a window (before any substitution when the window is chosen that way).
    A node is a player at the average START location of their completed passes in the window; an edge is the number of completed
    passes between two players (either direction) when at least `min_pair`. This describes passing structure, not movement.
    """
    nodes, pairs = {}, {}
    for e in events:
        if e["type"]["name"] != "Pass" or e["team"]["name"] != team or e["period"] != period or e["minute"] >= until_minute:
            continue
        p = e["pass"]
        if "outcome" in p or "recipient" not in p or not e.get("location"):
            continue
        name = e["player"]["name"]
        n = nodes.setdefault(name, {"x": 0.0, "y": 0.0, "count": 0})
        n["x"] += e["location"][0]
        n["y"] += e["location"][1]
        n["count"] += 1
        key = tuple(sorted((name, p["recipient"]["name"])))
        pairs[key] = pairs.get(key, 0) + 1
    out_nodes = {k: {"x": v["x"] / v["count"], "y": v["y"] / v["count"], "count": v["count"]} for k, v in nodes.items()}
    edges = [{"a": a, "b": b, "count": c} for (a, b), c in pairs.items() if c >= min_pair and a in out_nodes and b in out_nodes]
    return {"nodes": out_nodes, "edges": edges, "completed": sum(v["count"] for v in nodes.values())}


def shots(events, team=None, until_minute=None, include_shootout=False):
    """Shots from recorded events (open play and set pieces). The penalty shootout (period 5) is excluded unless asked for."""
    out = []
    for e in events:
        if e["type"]["name"] != "Shot":
            continue
        if team and e["team"]["name"] != team:
            continue
        if e["period"] == 5 and not include_shootout:
            continue
        if until_minute is not None and e["minute"] >= until_minute:
            continue
        s = e["shot"]
        out.append({"team": e["team"]["name"], "player": e["player"]["name"], "minute": e["minute"], "second": e["second"], "period": e["period"], "x": e["location"][0], "y": e["location"][1], "xg": float(s.get("statsbomb_xg", 0.0)), "outcome": s["outcome"]["name"]})
    return out


def cumulative_xg(shot_list, team, last_minute=122):
    """Step series of cumulative xG by minute for one team (for a chart drawn in the video)."""
    pts, total = [(0, 0.0)], 0.0
    for s in sorted((x for x in shot_list if x["team"] == team), key=lambda x: (x["minute"], x["second"])):
        pts.append((s["minute"], round(total, 3)))
        total += s["xg"]
        pts.append((s["minute"], round(total, 3)))
    pts.append((last_minute, round(total, 3)))
    return pts
