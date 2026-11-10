"""
Lionel Messi at Barcelona, StatsBomb Open Data La Liga event data: a LIMITED SAMPLE, labelled as one everywhere it is shown.
For each of two seasons the sample is the first 12 league matches (by date) that Messi started. Numbers are per 90 minutes played in
those matches. Usage: analysis_messi.py OUT_DIR [CACHE_DIR]
Writes: messi-data.json (barcelona_la_liga = verified season table; seasons = limited event-data sample)
Pass-origin heatmaps show where passes were recorded as starting. They are not tracking data and say nothing about off-ball movement.
"""
import json
import os
import sys

import matplotlib
matplotlib.use("Agg")
import numpy as np
from matplotlib.colors import LinearSegmentedColormap
from mplsoccer import Pitch

import sbdata
import wikistats

SEASONS = [(21, "2009/10", "heat_2009.png"), (4, "2018/19", "heat_2018.png")]
N = 12


def is_messi(p):
    return bool(p) and "Messi" in p.get("name", "")


def season_sample(sid, cache):
    ms = [m for m in sbdata.get(f"matches/11/{sid}.json", cache) if "Barcelona" in (m["home_team"]["home_team_name"], m["away_team"]["away_team_name"])]
    ms.sort(key=lambda m: m["match_date"])
    rows, pass_xy = [], []
    for m in ms:
        if len(rows) >= N:
            break
        ev = sbdata.get(f"events/{m['match_id']}.json", cache)
        xi = [e for e in ev if e["type"]["name"] == "Starting XI" and "Barcelona" in e["team"]["name"]]
        if not any(is_messi(p["player"]) for e in xi for p in e["tactics"]["lineup"]):
            continue
        end = max(e["minute"] for e in ev)
        for e in ev:
            if e["type"]["name"] == "Substitution" and is_messi(e.get("player")):
                end = e["minute"]
        mine = [e for e in ev if is_messi(e.get("player")) and e.get("location")]
        passes = [e for e in mine if e["type"]["name"] == "Pass"]
        shot_ev = [e for e in mine if e["type"]["name"] == "Shot"]
        pass_xy += [e["location"] for e in passes]
        rows.append({"match_id": m["match_id"], "date": m["match_date"], "minutes": end, "passes": len(passes), "shots": len(shot_ev),
                     "goals": sum(1 for s in shot_ev if s["shot"]["outcome"]["name"] == "Goal"), "xg": sum(s["shot"].get("statsbomb_xg", 0) for s in shot_ev),
                     "key_passes": sum(1 for p in passes if p["pass"].get("shot_assist") or p["pass"].get("goal_assist")), "assists": sum(1 for p in passes if p["pass"].get("goal_assist"))})
    mins = sum(r["minutes"] for r in rows)
    per90 = lambda k: round(sum(r[k] for r in rows) / mins * 90, 2)
    return {"matches": len(rows), "minutes": mins, "first": rows[0]["date"], "last": rows[-1]["date"], "shots_per90": per90("shots"), "key_passes_per90": per90("key_passes"), "passes_per90": per90("passes"), "xg_per90": per90("xg"),
            "goals": sum(r["goals"] for r in rows), "assists": sum(r["assists"] for r in rows)}, pass_xy


def heat(xy, out):
    pitch = Pitch(pitch_type="statsbomb", pitch_color="#FFFFFF", line_color="#0B1220", linewidth=2, line_zorder=3, pad_left=1, pad_right=1, pad_top=1, pad_bottom=1)
    fig, ax = pitch.draw(figsize=(9.6, 6.4))
    xs, ys = np.array([p[0] for p in xy]), np.array([p[1] for p in xy])
    st = pitch.bin_statistic(xs, ys, statistic="count", bins=(24, 16))
    st["statistic"] = st["statistic"].astype(float)
    cmap = LinearSegmentedColormap.from_list("rl", ["#FFFFFF", "#F2C6D6", "#D8527F", "#A50044"])
    pitch.heatmap(st, ax=ax, cmap=cmap, edgecolors="none", zorder=1)
    fig.savefig(out, dpi=100, bbox_inches="tight", pad_inches=0, facecolor="white")


def main(out_dir, cache):
    os.makedirs(out_dir, exist_ok=True)
    data = {"sample_note": f"first {N} Barcelona league matches that Messi started in each season in StatsBomb Open Data; per 90 minutes played in those matches", "seasons": {}}
    for sid, name, png in SEASONS:
        agg, xy = season_sample(sid, cache)
        data["seasons"][name] = agg
    data["barcelona_la_liga"] = wikistats.barcelona_la_liga_seasons()  # verified career statistics (Wikipedia table), checked against 672 and 474
    best = max(data["barcelona_la_liga"], key=lambda x: x["goals"])
    assert (best["season"], best["goals"], best["league_goals"]) == ("2011-12", 73, 50), best
    a, b = data["seasons"]["2009/10"], data["seasons"]["2018/19"]
    # Guards: the narration quotes these, so the run stops if the data ever differs.
    assert (a["matches"], b["matches"]) == (12, 12), (a, b)
    assert (round(a["shots_per90"], 1), round(b["shots_per90"], 1)) == (4.7, 4.8), (a, b)
    assert (round(a["key_passes_per90"], 1), round(b["key_passes_per90"], 1)) == (1.4, 3.5), (a, b)
    json.dump(data, open(f"{out_dir}/messi-data.json", "w", encoding="utf8"), indent=1)
    sbdata.download(sbdata.LOGO, f"{out_dir}/sb-logo.png")
    print("messi analysis ok", json.dumps({k: {kk: v[kk] for kk in ("matches", "minutes", "shots_per90", "key_passes_per90", "passes_per90")} for k, v in data["seasons"].items()}))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
