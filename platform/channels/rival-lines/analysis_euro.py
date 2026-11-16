"""
Spain v England, UEFA Euro 2024 final (StatsBomb match 3943043): the substitutes who scored, from event data only.
Usage: analysis_euro.py OUT_DIR [CACHE_DIR]
Writes: euro-data.json, sb-logo.png
Every figure the narration quotes is asserted below; the run stops if the data ever differs. Event locations are where events were recorded.
"""
import json
import os
import sys

import sbdata

MATCH_ID = 3943043
SPA, ENG = "Spain", "England"


def clock(e):
    """Seconds on the match clock (StatsBomb minute and second; the second half carries on from 45:00)."""
    return e["minute"] * 60 + e["second"]


def main(out_dir, cache):
    os.makedirs(out_dir, exist_ok=True)
    ev = sbdata.get(f"events/{MATCH_ID}.json", cache)
    byid = {e["id"]: e for e in ev}
    m = next(x for x in sbdata.get("matches/55/282.json", cache) if x["match_id"] == MATCH_ID)
    score = {m["home_team"]["home_team_name"]: m["home_score"], m["away_team"]["away_team_name"]: m["away_score"]}
    subs = [{"team": e["team"]["name"], "off": e["player"]["name"], "on": e["substitution"]["replacement"]["name"], "t": clock(e)} for e in ev if e["type"]["name"] == "Substitution"]
    goals = []
    for e in ev:
        if e["type"]["name"] == "Shot" and e["shot"]["outcome"]["name"] == "Goal" and e["period"] != 5:
            kp = byid[e["shot"]["key_pass_id"]]
            goals.append({"team": e["team"]["name"], "player": e["player"]["name"], "t": clock(e), "minute": e["minute"] + 1, "xy": e["location"], "end": e["shot"]["end_location"][:2], "xg": round(float(e["shot"]["statsbomb_xg"]), 2), "foot": e["shot"]["body_part"]["name"],
                          "pass_by": kp["player"]["name"], "pass_t": clock(kp), "pass_from": kp["location"], "pass_to": kp["pass"]["end_location"], "pass_height": kp["pass"]["height"]["name"]})
    assert score == {SPA: 2, ENG: 1}, score
    assert len(goals) == 3 and [g["team"] for g in goals] == [SPA, ENG, SPA], goals
    williams, palmer_g, oya_g = goals
    sub_of = lambda name: next(s for s in subs if name in s["on"])
    palmer_s, oya_s = sub_of("Cole Palmer"), sub_of("Oyarzabal")
    assert "Oyarzabal" in oya_g["player"] and "Palmer" in palmer_g["player"] and "Cucurella" in oya_g["pass_by"] and "Bellingham" in palmer_g["pass_by"]
    assert not any("Williams" in x["on"] for x in subs), "Nico Williams must be a starter"  # so two of three goals came from substitutes
    assert "Morata" in oya_s["off"] and "Mainoo" in palmer_s["off"]
    palmer_gap, oya_gap = palmer_g["t"] - palmer_s["t"], oya_g["t"] - oya_s["t"]
    # The figures the narration quotes.
    assert (williams["minute"], palmer_g["minute"], oya_g["minute"]) == (47, 73, 86), goals
    assert (palmer_s["t"], palmer_g["t"], palmer_gap) == (69 * 60 + 53, 72 * 60 + 8, 135), (palmer_s, palmer_g)
    assert (oya_s["t"], oya_g["t"], oya_gap) == (67 * 60 + 19, 85 * 60 + 56, 1117), (oya_s, oya_g)  # 18 min 37 s
    assert oya_g["xg"] == 0.28 and oya_g["pass_height"] == "Ground Pass" and oya_g["t"] - oya_g["pass_t"] == 1, oya_g
    data = {"match_id": MATCH_ID, "competition": "UEFA Euro 2024", "stage": "Final", "date": m["match_date"], "score": score,
            "goals": goals, "subs": subs, "palmer": {"on_t": palmer_s["t"], "goal_t": palmer_g["t"], "gap_s": palmer_gap, "off": palmer_s["off"]},
            "oyarzabal": {"on_t": oya_s["t"], "goal_t": oya_g["t"], "gap_s": oya_gap, "off": oya_s["off"]},
            "data_note": "StatsBomb Open Data event data. Locations are where events were recorded, not continuous tracking. xG is StatsBomb's modelled value."}
    json.dump(data, open(f"{out_dir}/euro-data.json", "w", encoding="utf8"), indent=1, ensure_ascii=False)
    sbdata.download(sbdata.LOGO, f"{out_dir}/sb-logo.png")
    print("euro analysis ok", json.dumps({"palmer_gap_s": palmer_gap, "oyarzabal_gap_s": oya_gap, "score": score}))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
