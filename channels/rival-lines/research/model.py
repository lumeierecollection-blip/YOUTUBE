"""When does Ronaldo reach 1,000 official goals? Scenario Monte Carlo built only from channels/.../research/wikipedia-stats.json.
Every assumption is computed from his own record and written to model.json next to the results. No injury, retirement or fixture model.
usage: python model.py <research_dir>"""
import json, os, re, sys, datetime
import numpy as np

R = sys.argv[1]
W = json.load(open(os.path.join(R, "wikipedia-stats.json"), encoding="utf8"))
birth = datetime.date.fromisoformat(json.load(open(os.path.join(R, "wikidata-birth.json"), encoding="utf8"))["birth"][1:11])
as_of = datetime.date.fromisoformat(W["fetched_at"][:10])
SEED, N_SIM, MONTHS = 20261127, 40000, 36
rng = np.random.default_rng(SEED)

# seasons: combine clubs that share a season string, skip totals
seasons = {}
for r in W["club"]:
    if not r["season"] or r["season"] in ("Total", "Career total") or r["apps"] is None or r["goals"] is None:
        continue
    s = seasons.setdefault(r["season"], {"apps": 0, "goals": 0})
    s["apps"] += r["apps"]; s["goals"] += r["goals"]
by_season = []
for s, v in seasons.items():
    y = int(s[:4])
    age = (datetime.date(y, 8, 1) - birth).days / 365.25
    by_season.append({"season": s, "apps": v["apps"], "goals": v["goals"], "per_match": round(v["goals"] / v["apps"], 3), "age_aug": round(age, 1)})
by_season.sort(key=lambda x: x["season"])

intl = {r["year"]: r for r in W["international"] if r["team"] == "Portugal" and re.fullmatch(r"\d{4}", r["year"])}

recent_seasons = ["2024–25", "2025–26"]
rs = [x for x in by_season if x["season"] in recent_seasons]
assert len(rs) == 2, [x["season"] for x in by_season]
club_apps, club_goals = sum(x["apps"] for x in rs), sum(x["goals"] for x in rs)
yrs = ["2023", "2024", "2025"]
in_apps, in_goals = sum(intl[y]["apps"] for y in yrs), sum(intl[y]["goals"] for y in yrs)
club_matches_per_month = club_apps / 2 / 10          # a club season is about ten months long (assumption, stated)
intl_matches_per_month = in_apps / 3 / 12
rate_club, rate_intl = club_goals / club_apps, in_goals / in_apps

since33 = [x for x in by_season if x["age_aug"] >= 33 and x["apps"] >= 20]
worst = min(since33, key=lambda x: x["per_match"])
al = [x for x in by_season if x["season"] in ("2023–24", "2024–25", "2025–26")]
ratios = [al[i + 1]["per_match"] / al[i]["per_match"] for i in range(len(al) - 1)]
yearly_decay = float(np.mean(ratios))

scen = {
    "hold": {"label": "Recent rate holds", "mult_start": 1.0, "yearly": 1.0},
    "decline": {"label": "Rate keeps falling at its recent pace", "mult_start": 1.0, "yearly": yearly_decay},
    "sharp": {"label": f"Rate drops to his worst season since 33 ({worst['season']})", "mult_start": worst["per_match"] / (club_goals / club_apps), "yearly": 1.0},
}


def curve(needed, sc):
    cum = np.zeros(N_SIM)
    # rate uncertainty: gamma posterior on goals per match from the observed counts
    rc = rng.gamma(club_goals, 1 / club_apps, N_SIM)
    ri = rng.gamma(in_goals, 1 / in_apps, N_SIM)
    out = [0.0]
    for m in range(1, MONTHS + 1):
        f = sc["mult_start"] * sc["yearly"] ** ((m - 0.5) / 12)
        lam = f * (rc * club_matches_per_month + ri * intl_matches_per_month)
        cum += rng.poisson(lam)
        out.append(float((cum >= needed).mean()))
    return out


def median_month(c):
    for m, p in enumerate(c):
        if p >= 0.5:
            return m
    return None


def add_months(d, m):
    y, mo = divmod(d.month - 1 + m, 12)
    return datetime.date(d.year + y, mo + 1, min(d.day, 28)).isoformat()


res = {}
for tag, needed in (("wikipedia", 1000 - W["official_goals"]), ("tracker_low", 16)):
    res[tag] = {"needed": needed, "scenarios": {}}
    for k, sc in scen.items():
        c = curve(needed, sc)
        mm = median_month(c)
        res[tag]["scenarios"][k] = {"label": sc["label"], "p_by_month": [round(p, 4) for p in c], "median_month": mm,
                                    "median_date": add_months(as_of, mm) if mm is not None else None,
                                    "p3": round(c[3], 3), "p6": round(c[6], 3), "p12": round(c[12], 3), "p24": round(c[24], 3)}

needed = 1000 - W["official_goals"]
matches_needed = round(needed / rate_club, 1)
months_at_pace = round(matches_needed / (club_matches_per_month + intl_matches_per_month * 0), 1)
per_match_needed = {str(m): round(needed / (m * (club_matches_per_month + intl_matches_per_month)), 3) for m in (3, 6, 12)}
model = {
    "as_of": as_of.isoformat(), "seed": SEED, "simulations": N_SIM, "months": MONTHS,
    "baseline": {"source": W["source"], "url": W["url"], "revision_timestamp": W["revision_timestamp"], "official_goals": W["official_goals"], "official_apps": W["official_apps"], "needed": needed},
    "birth_date": birth.isoformat(), "age_at_as_of": round((as_of - birth).days / 365.25, 2),
    "assumptions": {
        "recent_club_seasons": recent_seasons, "club_apps": club_apps, "club_goals": club_goals, "club_rate": round(rate_club, 3),
        "intl_years": yrs, "intl_apps": in_apps, "intl_goals": in_goals, "intl_rate": round(rate_intl, 3),
        "club_matches_per_month": round(club_matches_per_month, 2), "intl_matches_per_month": round(intl_matches_per_month, 2),
        "season_length_months_assumed": 10, "yearly_decay_ratio_recent": round(yearly_decay, 3), "decay_pairs": [x["season"] for x in al],
        "worst_season_since_33": worst, "not_modelled": ["injuries", "retirement or contract end", "fixture list", "penalty share", "minutes"],
    },
    "matches_needed_at_club_rate": matches_needed, "months_of_club_matches_needed": months_at_pace,
    "per_match_needed": per_match_needed, "by_season": by_season, "results": res,
}
json.dump(model, open(os.path.join(R, "model.json"), "w", encoding="utf8"), indent=1, ensure_ascii=False)
for tag in res:
    for k, v in res[tag]["scenarios"].items():
        print(tag, res[tag]["needed"], k, "median month", v["median_month"], v["median_date"], "p3/6/12", v["p3"], v["p6"], v["p12"])
print("rates", round(rate_club, 3), round(rate_intl, 3), "per month", round(club_matches_per_month, 2), round(intl_matches_per_month, 2), "decay", round(yearly_decay, 3), "worst", worst)
