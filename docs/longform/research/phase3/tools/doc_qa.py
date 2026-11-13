"""Writes docs/longform/PRODUCTION-QA-STANDARDS.md from config/longform-qa-standards.json and the QA runs (docs/longform/qa-baseline = before, docs/longform/qa-after = after)."""
import json, os
from docs_common import *
STD = json.load(open(os.path.join(REPO, "config", "longform-qa-standards.json"), encoding="utf8"))
def run(d, c): return json.load(open(os.path.join(DOCS, d, c + ".json"), encoding="utf8"))
L = ["# Production QA standards (Phase 3)", "",
     "The QA tool `platform/longform/qa/visual-audio-qa.mjs` checks an episode's plan (beats, media manifest, cue sheet) against per-channel reference bands and hard rules. Run: `node platform/longform/qa/visual-audio-qa.mjs [channel|all] [--out docs/longform/qa]`. Every flag states what was measured, the standard, why it matters and the evidence; every standard says whether it is provisional.", "",
     "**What it is not:** it does not look at rendered pixels or listen to audio. Visual checks run on the *plan* (scene types, assets, narration length); audio checks run on the cue sheet and, when a mix measurement exists, on loudness. A PASS means the plan does not trip a rule, not that the result looks good.", "",
     "## 1. Checks", "",
     "| ID | Check | Measured how | Standard | Level logic | Provisional? |", "|---|---|---|---|---|---|",
     "| V1 | AI-generated imagery | share of estimated time showing an asset whose manifest kind says generated | 0 outside AI Tested (none of the 28 non-AI-Tested reference videos shows any); AI Tested only as the subject being tested | FAIL if any outside AI Tested | no (hard rule) |",
     "| V2 | Authentic media share | share of estimated time on beats showing at least one authentic asset (**upper bound**) | channel band of real captured share, minus 12 points tolerance for sampling error | FAIL below band minus tolerance, WARN below band; INFO when the band is wider than 60 points | yes |",
     "| V3 | All-constructed stretch | longest run of beats without any authentic asset, in seconds | longest constructed run in the channel's references; FAIL above 1.5x | WARN / FAIL; INFO for wide bands | yes |",
     "| V4 | Caption / text overlay share | share of time on beats with an editorial caption or kicker (labels, badges, credits are not counted) | channel band of sampled overlay share + 12 points | WARN above | yes |",
     "| V5 | Repeated media | an asset used on more than two beats | no asset on more than 2 beats (author's rule) | WARN | yes (no reference measurement) |",
     "| V6 | Credit on every third-party picture | authentic photographs shown without a credit line (own credit or recorded credit line drawn by the generic overlay) | 100% | FAIL | no (hard rule) |",
     "| V7 | Licence recorded | assets without licence, source URL or commercial-use permission | all recorded | FAIL | no (hard rule) |",
     "| V11 | Permissions cleared | used assets whose manifest `usable` is not 'yes' (third-party page screenshots are 'owner decision') | all cleared by licence | WARN | no |",
     "| V8 | Long unchanging visual | longest single beat in seconds | above max(60 s, the channel's longest static stretch) | WARN | yes |",
     "| V9 | Scene-change rate | beats per minute vs reference shots per minute | indication only (a beat can contain several changes) | INFO / WARN below half the reference minimum | yes |",
     "| V10 | Visual matches narration | real pictures sharing no content word with their narration | a person confirms | CHECK-BY-PERSON (a word match is not proof) | n/a |",
     "| A1 | Cue purpose | cues without a written purpose | every cue has one | FAIL | no (hard rule) |",
     "| A2 | Effect density | action, transition, accent and riser cues per minute | provisional cap 4/min (no reference count exists) | WARN | yes |",
     "| A3 | Bed competes with narration | bed or ambience cues louder than 20 dB below speech | 20 dB (lowest reference value 19.7 dB) | FAIL | yes |",
     "| A4 | Assets approved | assets in the cue sheet without a recorded listening approval | all approved | WARN (no asset has been auditioned) | no |",
     "| A5 | Assets exist | cue assets missing from the library | none missing | FAIL | no |",
     "| A6 | Repeated music | one music bed on more than one channel | none shared | WARN | no (directive) |",
     "| A7 | Final loudness / true peak | measured export of the channel's mix, if one exists | -14 LUFS +-1, true peak <= -1.0 dBTP | FAIL / SKIPPED when no mix has been rendered | no |", "",
     "Not implemented (honest list): unnecessary captions on individual scenes (only the share is checked); excessive transitions (the episodes have three transitions each, below any reference rate); stock-footage repetition (no stock is used); poor-audio detection on rendered files (no mixes are rendered in this phase); visual-narration relevance beyond a word match.", "",
     "## 2. Per-channel standards (reference bands, all provisional)", "",
     "Bands are the minimum-maximum over the channel's analysed reference videos (sampled-frame shares; shot rhythm from the dissolve-aware detector; audio over the analysed span). Sampling tolerance 12 points is added before a share is flagged. Source file: `config/longform-qa-standards.json`.", "",
     "| Channel | Videos | Real captured | Longest constructed run s | Overlay text | Shots/min | Longest static s | Reference LUFS | Why provisional |", "|---|---|---|---|---|---|---|---|---|"]
for c in CH:
    v = STD["channels"][c]; b = lambda k, pct=False, nd=0: (f"{100*v[k]['min']:.0f}-{100*v[k]['max']:.0f}%" if pct else f"{v[k]['min']:.{nd}f}-{v[k]['max']:.{nd}f}") if v.get(k) else "n/a"
    L.append(f"| {CHNAME[c]} | {len(v['reference_videos'])} | {b('real_captured_share', True)} | {b('longest_constructed_run_s')} | {b('overlay_text_share', True)} | {b('shots_per_min', nd=1)} | {b('longest_static_s')} | {b('lufs', nd=1)} | {'; '.join(v['provisional_reasons'])} |")
L += ["", "Bands wider than 60 points (Court & Spotlight, Space, Psychology real-share bands) cannot constrain anything and are advisory only (INFO).", "",
      "## 3. Results on the seven sample episodes: before and after the Phase 3 changes", "",
      "Before = the committed Phase 2 episodes (tag `longform-v2-phase2-checkpoint` content, QA run from the research checkpoint with credits counted only when written in the scene). After = this branch. Both runs use the same QA tool.", "",
      "| Channel | Check | Before | After |", "|---|---|---|---|"]
for c in CH:
    b, a = run("qa-baseline", c), run("qa-after", c)
    for fb, fa in zip(b["findings"], a["findings"]):
        if fb["level"] != fa["level"] or fb["level"] in ("FAIL", "WARN", "CHECK-BY-PERSON"):
            L.append(f"| {CHNAME[c]} | {fb['id']} {fb['name']} | {fb['level']}: {fb['measured'][:110]} | {fa['level']}: {fa['measured'][:110]} |")
L += ["", "Metrics before / after:", "", "| Channel | Estimated narration min (target) | Authentic share (upper bound) | Longest constructed stretch s | Distinct authentic assets | Beats |", "|---|---|---|---|---|---|"]
for c in CH:
    b, a = run("qa-baseline", c)["metrics"], run("qa-after", c)["metrics"]
    L.append(f"| {CHNAME[c]} | {a['estimated_minutes']} ({a['target_minutes']}) | {100*b['authentic_beat_share_upper_bound']:.0f}% / {100*a['authentic_beat_share_upper_bound']:.0f}% | {b['longest_constructed_stretch_s']} / {a['longest_constructed_stretch_s']} | {b['distinct_real_assets']} / {a['distinct_real_assets']} | {b['beats']} / {a['beats']} |")
L += ["", "Reading these results:",
      "- The sample episodes' narration (4.9-7.9 estimated minutes) is shorter than the 9-10 minute targets: the sample beats cover part of the episode, which also limits what the checks can say about whole-episode rhythm.",
      "- Remaining FAIL/WARN items are listed above and in `docs/longform/qa-after/*.md`; they were not hidden by loosening a threshold. Items that need a person (V10 matches, A4 audition) stay open by design.", ""]
open(os.path.join(DOCS, "PRODUCTION-QA-STANDARDS.md"), "w", encoding="utf8").write("\n".join(L)); print("wrote PRODUCTION-QA-STANDARDS.md", len(L))
