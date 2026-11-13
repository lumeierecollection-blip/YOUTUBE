"""Derives config/longform-qa-standards.json (per-channel reference bands) from aggregate.json. Never hand-typed. Every band records the videos it came from, the method, and whether it is provisional.
A band is the observed min-max over the reference videos of that channel. With 2-6 videos per channel, from one to six reference channels, every band is provisional except where stated.
The QA tool applies a tolerance for sampling error (+-12 points on shares, from the dense-window checks) before it flags a share."""
import json, os
from docs_common import *
def band(xs, nd=3):
    xs = [x for x in xs if x is not None]
    return {"min": round(min(xs), nd), "max": round(max(xs), nd), "n": len(xs)} if xs else None
std = {"generated_from": "docs/longform/research/phase3/aggregate.json", "method": "bands = min-max over reference videos per channel (sampled-frame shares, 1 frame / 15 s); shot rhythm from the dissolve-aware detector (+-15%); static share from the 0.75 s frame-difference score; audio from ebur128 and 50 ms RMS windows over the analysed span",
       "tolerances": {"share_points": 0.12, "note": "dense 3 s re-labelling of 3 windows found the 15 s sampled share off by 5-20 points for the largest class; 12 points is the middle of that range"},
       "global_hard_rules": {"attribution_required_on_every_third_party_asset": True, "licence_recorded_for_every_asset": True, "ai_generated_imagery_outside_ai_tested": 0.0, "final_loudness_lufs": {"target": -14, "tolerance": 1.0, "source": "YouTube playback reference; the references themselves range -23.4 to -11.7 LUFS"}, "true_peak_dbtp_max": -1.0, "music_bed_min_db_below_speech": {"value": 20, "source": "lowest reference value 19.7 dB (SunnyV2 Rogan/Stern)"}},
       "channels": {}}
for c in CH:
    rs = by(c); chs = sorted({META[r["id"]].get("channel", "") for r in rs})
    prov = []
    if len(rs) < 5: prov.append(f"only {len(rs)} videos analysed of {PLANNED[c]} planned")
    if len(chs) < 2: prov.append("all references from a single channel")
    if any(r["coverage_pct"] < 60 for r in rs): prov.append("includes videos with <60% coverage")
    S = lambda k: band([r["groups_sampled"][k] for r in rs])
    std["channels"][c] = {
        "name": CHNAME[c], "reference_videos": [r["id"] for r in rs], "reference_channels": chs, "provisional": True, "provisional_reasons": prov or ["small sample (<=6 videos); bands are observed ranges, not tolerances"],
        "real_captured_share": band([r["real_media_share_sampled"] for r in rs]), "constructed_share": band([r["constructed_share_sampled"] for r in rs]),
        "ai_generated_share": band([r["groups_sampled"]["AI-gen Z"] for r in rs]), "overlay_text_share": band([r["overlay_share_sampled"] for r in rs]),
        "human_subject_share": band([r["human_subject_share_sampled"] for r in rs]),
        "longest_constructed_run_s": band([r["longest_constructed_run_s"] for r in rs], 0),
        "shots_per_min": band([r["shots2"]["per_min"] for r in rs if r.get("shots2")], 1), "median_shot_s": band([r["shots2"]["median_gap_s"] for r in rs if r.get("shots2") and r["shots2"]["median_gap_s"]], 1),
        "static_share": band([r["motion"]["static_share"] for r in rs if r.get("motion")], 2), "longest_static_s": band([r["motion"]["longest_static_s"] for r in rs if r.get("motion")], 0),
        "lufs": band([r["audio"]["integrated_lufs"] for r in rs], 1), "lra": band([r["audio"]["lra"] for r in rs], 1), "bed_below_speech_db": band([r["audio"]["bed_below_speech_db"] for r in rs], 1), "pauses_per_min": band([r["audio"]["pauses_per_min"] for r in rs], 1),
        "category_groups_sampled": {g: band([r["groups_sampled"][g] for r in rs], 3) for g in rs[0]["groups_sampled"]},
    }
out = os.path.join(REPO, "config", "longform-qa-standards.json"); json.dump(std, open(out, "w", encoding="utf8"), indent=1)
print("wrote", out)
