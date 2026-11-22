"""
Argentina v France, 2022 FIFA World Cup final: data-derived tactical graphics with mplsoccer, from StatsBomb Open Data event data.
Usage: analysis_final.py OUT_DIR [CACHE_DIR]
Writes: match-data.json, formation_arg.png, formation_fra.png, network_arg.png, network_fra.png, shotmap.png, sb-logo.png
Event locations only: no continuous movement is drawn, and no position is estimated.
"""
import json
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.patheffects as pe
from mplsoccer import Pitch

import sbdata

MATCH_ID = 3869685
ARG, FRA = "Argentina", "France"
COL = {ARG: "#75AADB", FRA: "#D7263D"}
TEXT = {ARG: "#0B1B33", FRA: "#FFFFFF"}
PITCH = dict(pitch_type="statsbomb", pitch_color="#1F5B3F", line_color="#E9F1EC", stripe=True, stripe_color="#1B5239", linewidth=2, line_zorder=2, pad_left=2, pad_right=2, pad_top=2, pad_bottom=2)
SHADOW = [pe.withStroke(linewidth=3, foreground="#0B1B33")]


NAMES = {}


def last(name):
    return NAMES.get(name) or sbdata.short_name(name)


def pitch_fig():
    p = Pitch(**PITCH)
    fig, ax = p.draw(figsize=(10.8, 7.2))
    fig.patch.set_facecolor(PITCH["pitch_color"])
    return p, fig, ax


def save(fig, path):
    fig.savefig(path, dpi=100, bbox_inches="tight", pad_inches=0, facecolor=fig.get_facecolor())


SHIRT_PTS = [(0.30, 0.04), (0.425, 0.04), (0.5, 0.15), (0.575, 0.04), (0.70, 0.04), (0.96, 0.20), (0.83, 0.39), (0.73, 0.33), (0.73, 0.92), (0.27, 0.92), (0.27, 0.33), (0.17, 0.39), (0.04, 0.20)]
KIT = {ARG: {"base": "#75AADB", "stripe": "#FFFFFF", "num": "#0B1B33"}, FRA: {"base": "#1D3F8F", "stripe": None, "num": "#FFFFFF"}}


def draw_shirt(ax, x, y, team, number, w=9.2, h=9.8):
    """A shirt-shaped marker in the team's real colours (Argentina sky and white stripes, France blue). No crest or sponsor."""
    from matplotlib.patches import Polygon, Rectangle
    pts = [(x + (px - 0.5) * w, y + (py - 0.5) * h) for px, py in SHIRT_PTS]
    poly = Polygon(pts, closed=True, facecolor=KIT[team]["base"], edgecolor="white", linewidth=2.2, zorder=3)
    ax.add_patch(poly)
    if KIT[team]["stripe"]:
        for i in range(1, 9, 2):
            r = Rectangle((x - w / 2 + i * w / 9, y - h / 2), w / 9, h, facecolor=KIT[team]["stripe"], edgecolor="none", zorder=3.2)
            ax.add_patch(r)
            r.set_clip_path(poly)
    else:
        for sx in (-1, 1):  # red cuffs, for the tricolour
            cuff = Polygon([(x + sx * 0.46 * w, y - 0.30 * h), (x + sx * 0.33 * w, y - 0.11 * h), (x + sx * 0.40 * w, y - 0.06 * h), (x + sx * 0.52 * w, y - 0.26 * h)], closed=True, facecolor="#D7263D", edgecolor="none", zorder=3.3)
            ax.add_patch(cuff)
    ax.text(x, y + 0.1 * h, number, ha="center", va="center", fontsize=15, fontweight="bold", color=KIT[team]["num"], zorder=4)


def formation(events, team, out):
    xi = sbdata.starting_xi(events, team)
    p, fig, ax = pitch_fig()
    for pl in xi["players"]:
        x, y = pl["xy"]
        draw_shirt(ax, x, y, team, str(pl["number"] or ""))
        ax.text(x, y + 8.6, last(pl["name"]), ha="center", va="center", fontsize=13, fontweight="bold", color="white", zorder=5, path_effects=SHADOW)
    save(fig, out)
    return xi


def network(events, team, out):
    net = sbdata.passing_network(events, team, period=1, until_minute=40, min_pair=3)
    p, fig, ax = pitch_fig()
    for e in net["edges"]:
        a, b = net["nodes"][e["a"]], net["nodes"][e["b"]]
        p.lines(a["x"], a["y"], b["x"], b["y"], lw=1.2 + e["count"] * 0.55, color="white", alpha=0.55, zorder=2, ax=ax)
    for name, n in net["nodes"].items():
        p.scatter(n["x"], n["y"], s=260 + n["count"] * 34, color=COL[team], edgecolors="white", linewidth=2.5, zorder=3, ax=ax)
        ax.text(n["x"], n["y"] + 7.6, last(name), ha="center", va="center", fontsize=12, fontweight="bold", color="white", zorder=4, path_effects=SHADOW)
    save(fig, out)
    return net


def shotmap(shot_list, out):
    p, fig, ax = pitch_fig()
    for s in shot_list:
        x, y = (s["x"], s["y"]) if s["team"] == ARG else (120 - s["x"], 80 - s["y"])  # France is drawn attacking the left goal
        goal = s["outcome"] == "Goal"
        p.scatter(x, y, s=140 + s["xg"] * 2600, marker="*" if goal else "o", color=COL[s["team"]] if goal else "none", edgecolors="white" if goal else COL[s["team"]], linewidth=3 if not goal else 1.6, alpha=1, zorder=3, ax=ax)
    save(fig, out)


def main(out_dir, cache):
    os.makedirs(out_dir, exist_ok=True)
    events = sbdata.get(f"events/{MATCH_ID}.json", cache)
    NAMES.update(sbdata.display_names(sbdata.get(f"lineups/{MATCH_ID}.json", cache)))
    matches = sbdata.get("matches/43/106.json", cache)
    m = next(x for x in matches if x["match_id"] == MATCH_ID)
    xi = {ARG: formation(events, ARG, f"{out_dir}/formation_arg.png"), FRA: formation(events, FRA, f"{out_dir}/formation_fra.png")}
    net = {ARG: network(events, ARG, f"{out_dir}/network_arg.png"), FRA: network(events, FRA, f"{out_dir}/network_fra.png")}
    reg = sbdata.shots(events)
    early = sbdata.shots(events, until_minute=79)
    shotmap(early, f"{out_dir}/shotmap.png")
    so = [e for e in events if e["period"] == 5 and e["type"]["name"] == "Shot"]
    pens = {t: sum(1 for e in so if e["team"]["name"] == t and e["shot"]["outcome"]["name"] == "Goal") for t in (ARG, FRA)}
    stats = {}
    for t in (ARG, FRA):
        s_all = [s for s in reg if s["team"] == t]
        s_early = [s for s in early if s["team"] == t]
        stats[t] = {
            "shots": len(s_all), "xg": round(sum(s["xg"] for s in s_all), 2), "goals": sum(1 for s in s_all if s["outcome"] == "Goal"),
            "shots_before_79": len(s_early), "xg_before_79": round(sum(s["xg"] for s in s_early), 2),
            "first_shot_minute": min(s["minute"] for s in s_all), "first_40_completed_passes": net[t]["completed"],
            "xg_series": sbdata.cumulative_xg(reg, t), "goal_minutes": sorted(s["minute"] for s in s_all if s["outcome"] == "Goal"),
        }
    data = {"match_id": MATCH_ID, "competition": "FIFA World Cup 2022", "stage": "Final", "date": m["match_date"], "score": {ARG: m["home_score"] if m["home_team"]["home_team_name"] == ARG else m["away_score"], FRA: m["home_score"] if m["home_team"]["home_team_name"] == FRA else m["away_score"]}, "penalties": pens,
            "formation": {t: xi[t]["formation"] for t in xi}, "lineup": {t: [{"name": p["name"], "short": last(p["name"]), "number": p["number"], "position": p["position"]} for p in xi[t]["players"]] for t in xi}, "stats": stats,
            "network_window": "first 40 minutes of the first half (before any substitution)", "shot_map_window": "regulation and extra time up to the 78th minute; penalty shootout excluded",
            "data_note": "StatsBomb Open Data event data. Locations are where events were recorded, not continuous tracking."}
    # Guards: the narration quotes these numbers, so the run stops if the data ever differs.
    assert data["score"] == {ARG: 3, FRA: 3} and pens == {ARG: 4, FRA: 2}, (data["score"], pens)
    assert (stats[ARG]["shots_before_79"], stats[FRA]["shots_before_79"], stats[FRA]["first_shot_minute"]) == (10, 2, 67), stats
    assert (stats[ARG]["first_40_completed_passes"], stats[FRA]["first_40_completed_passes"]) == (230, 116), stats
    assert (stats[ARG]["xg"], stats[FRA]["xg"]) == (2.76, 2.27), stats
    assert stats[FRA]["goal_minutes"] == [79, 80, 117], stats
    assert (data["formation"][ARG], data["formation"][FRA]) == ("433", "4231"), data["formation"]
    json.dump(data, open(f"{out_dir}/match-data.json", "w", encoding="utf8"), indent=1, ensure_ascii=False)
    sbdata.download(sbdata.LOGO, f"{out_dir}/sb-logo.png")
    print("final analysis ok", json.dumps({t: {k: stats[t][k] for k in ("shots", "xg", "shots_before_79", "first_shot_minute")} for t in stats}))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
