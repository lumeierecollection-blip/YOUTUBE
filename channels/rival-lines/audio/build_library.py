"""Build data/rival-lines/audio-library/ from the local work dir. usage: python build_library.py <work_dir> <out_dir>
Reads per reference: meta.json, analysis.json, shazam.json (work dir, never committed) plus refs.json and tracks_manual.json
(committed). Writes only derived data: timestamps, levels, tags, track identity, 5-word phrase hints. No audio, no transcript."""
import csv, json, os, sys, collections, statistics

work, out = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
refs = json.load(open(os.path.join(here, "refs.json"), encoding="utf8"))["refs"]
manual = json.load(open(os.path.join(here, "tracks_manual.json"), encoding="utf8"))
os.makedirs(out, exist_ok=True)

def rj(p):
    try: return json.load(open(p, encoding="utf8"))
    except Exception: return None

def hint(s, n=5):
    return " ".join((s or "").split()[:n])

def mmss(t):
    return f"{int(t // 60)}:{t % 60:04.1f}"

# ---------- reference inventory ----------
inv = []
for r in refs:
    d = os.path.join(work, r["id"])
    meta, ana, shz = rj(d + "/meta.json"), rj(d + "/analysis.json"), rj(d + "/shazam.json")
    rec = {"id": r["id"], "group": r["group"], "title": (meta or {}).get("title") or r["title"], "channel": (meta or {}).get("channel"),
           "url": f"https://www.youtube.com/watch?v={r['id']}", "duration_s": (meta or {}).get("duration"),
           "upload_date": (meta or {}).get("upload_date"), "views_at_fetch": (meta or {}).get("view_count"),
           "availability": (meta or {}).get("availability"),
           "audio_downloaded": os.path.exists(d + "/audio.wav"), "transcribed": os.path.exists(d + "/speech.json"),
           "analysed": ana is not None, "shazam_clips": len(shz) if shz else 0,
           "status": "analysed" if ana else "inaccessible_or_not_analysed"}
    inv.append(rec)
json.dump(inv, open(out + "/reference-inventory.json", "w", encoding="utf8"), indent=1, ensure_ascii=False)

# ---------- track identification ----------
# Evidence kinds, strongest first: creator credit in the description, then Shazam hits. One Shazam clip (12 s, under narration)
# is "single-clip"; two or more clips with the same Shazam key in one video is "repeated". A Shazam hit that contradicts a
# creator credit for the same video is kept but marked "contradicts_credit".
occ = []
tracks = {}
def track_for(key, title, artist, album=None, **kw):
    t = tracks.setdefault(key, {"track_key": key, "title": title, "artist": artist, "album": album, "reusable": False,
                                "reuse_note": "catalogue only; not downloaded or redistributed", "methods": set(), "videos": set()})
    t.update({k: v for k, v in kw.items() if v is not None})
    return t

for c in manual["credited"]:
    for vid in c["videos"]:
        for name in c["tracks"]:
            key = f"credit:{c['artist']}:{name}".lower()
            t = track_for(key, name, c["artist"], source_library=c["library"], licence_note=c["licence_note"])
            t["methods"].add("creator_credit"); t["videos"].add(vid)
            occ.append({"video": vid, "track_key": key, "title": name, "artist": c["artist"], "method": "creator_credit_in_description",
                        "confidence": "credited_not_audio_verified", "start_s": None, "end_s": None, "complete_or_excerpt": "unknown",
                        "uncertainty": "The creator lists the tracks but not where they play or whether in full. Track order is not given."})

credited_videos = {v for c in manual["credited"] for v in c["videos"]}
shazam_rows = []
for r in inv:
    shz = rj(os.path.join(work, r["id"], "shazam.json")) or []
    by = collections.defaultdict(list)
    for s in shz:
        if s["status"] == "match" and s["match"]:
            by[(s["match"]["title"] or "").strip().lower() + "|" + (s["match"]["artist"] or "").strip().lower()].append(s)
    for key, hits in by.items():
        m = hits[0]["match"]
        conf = "repeated_clips" if len(hits) >= 2 else "single_clip"
        contra = r["id"] in credited_videos
        k = f"shazam:{key}"
        t = track_for(k, m["title"], m["artist"], m.get("album"), shazam_url=m.get("url"), genre=m.get("genre"))
        t["methods"].add("shazam"); t["videos"].add(r["id"])
        ts = sorted(h["t"] for h in hits)
        clip = hits[0]["clip"]
        occ.append({"video": r["id"], "track_key": k, "title": m["title"], "artist": m["artist"], "album": m.get("album"),
                    "method": "shazam_12s_clip", "confidence": conf + ("_contradicts_credit" if contra else ""),
                    "clip_start_s": ts, "start_s": ts[0], "end_s": ts[-1] + clip, "complete_or_excerpt": "excerpt",
                    "shazam_url": m.get("url"),
                    "uncertainty": ("Matched on short clips under narration; a hit can be a stock or similar track. "
                                    + ("This video credits other tracks in its description, so this hit is unreliable. " if contra else "")
                                    + "Start/end are the matched clip window, not the track's true extent.")})
        shazam_rows.append((r["id"], key))

for t in tracks.values():
    t["methods"] = sorted(t["methods"]); t["videos"] = sorted(t["videos"])
tracks_list = sorted(tracks.values(), key=lambda t: (t["artist"] or "", t["title"] or ""))
json.dump(occ, open(out + "/reference-track-occurrences.json", "w", encoding="utf8"), indent=1, ensure_ascii=False)

# ---------- per-video analysis ----------
ana_all = {}
for r in inv:
    a = rj(os.path.join(work, r["id"], "analysis.json"))
    if a: ana_all[r["id"]] = a

def mood(sec):
    tempo, cen, rel = sec.get("tempo_bpm_approx"), sec.get("centroid") or 0, sec.get("bed_vs_voice_db")
    pace = "slow" if tempo and tempo < 90 else "mid-tempo" if tempo and tempo < 125 else "upbeat" if tempo else "tempo unclear"
    tone = "dark/warm" if cen < 1000 else "neutral" if cen < 1800 else "bright"
    level = "prominent" if rel is not None and rel > -12 else "moderate" if rel is not None and rel > -20 else "very low under voice"
    return pace, tone, level

sfx = []
for vid, a in ana_all.items():
    for e in a["events"]:
        k = e["kind"]
        purpose = {"whoosh": "transition or motion accent", "impact": "emphasis hit on a number, claim or cut",
                   "whistle_like_tone": "sustained tonal sound (whistle, riser or synth tone); needs audition",
                   "click_like": "tick or UI-click candidate; may also be an edit or mouth artefact",
                   "silence": "dramatic pause or music drop-out", "abrupt_cut": "hard audio edit point",
                   "reentry_after_silence": "sound or music returning after a pause"}[k]
        sfx.append({"video": vid, "t_s": e["t"], "dur_s": e["dur"], "kind": k, "intensity": e["intensity"], "purpose_guess": purpose,
                    "overlaps_narration": e["in_speech"] > 0.5, "narration_overlap_frac": e["in_speech"],
                    "over_baseline_db": e["over_baseline_db"], "inside_music_section": e["music_section"],
                    "phrase_hint": hint(e.get("phrase")), "confidence": "heuristic_candidate",
                    **{x: e[x] for x in ("rise_s", "tone_hz", "enters", "exits", "isolated") if x in e}})
json.dump(sfx, open(out + "/sound-effects-inventory.json", "w", encoding="utf8"), indent=0, ensure_ascii=False)

def per_min(n, dur): return round(n / (dur / 60), 1)

# sound-effects-inventory.md
L = ["# Sound-effect inventory (candidates)", "",
     "Every row is a heuristic detection from the audio, not a confirmed sound effect. Detection kinds: `impact` (low-frequency isolated hit), `whoosh` (rising broadband swell), `whistle_like_tone` (narrow sustained tone), `click_like` (very short bright transient), `silence` (a drop below the music floor), `abrupt_cut`, `reentry_after_silence`.",
     "Nothing here was heard by a person. Spectrograms of selected windows were inspected; a human audition is still required before any cue is copied. `click_like` is by far the noisiest kind (many are speech consonants or edit artefacts); `impact`, `whoosh` and `whistle_like_tone` are the more reliable ones. The accompanying visual is not recorded per event (only the nearest narration words); see `audio-design-analysis.md` for the visual pairing observed in the Paper Pitch videos.", "",
     "## Counts per video", "", "| Video | impact | whoosh | tone | click | silence | abrupt_cut | reentry | impacts/min | whooshes/min |", "|---|---|---|---|---|---|---|---|---|---|"]
tot = collections.Counter()
for r in inv:
    a = ana_all.get(r["id"])
    if not a: continue
    c = collections.Counter(e["kind"] for e in a["events"]); tot.update(c)
    L.append(f"| {r['id']} {r['title'][:38]} | {c['impact']} | {c['whoosh']} | {c['whistle_like_tone']} | {c['click_like']} | {c['silence']} | {c['abrupt_cut']} | {c['reentry_after_silence']} | {per_min(c['impact'], a['duration'])} | {per_min(c['whoosh'], a['duration'])} |")
L += ["", f"Total candidates: {sum(tot.values())} ({', '.join(f'{k} {v}' for k, v in tot.most_common())}).", "",
      "## Detailed list: high-intensity impacts, whooshes and tones", "",
      "| Video | Time | Dur s | Kind | Intensity | Over narration | In music section | Words nearby |", "|---|---|---|---|---|---|---|---|"]
for s in sorted((x for x in sfx if x["kind"] in ("impact", "whoosh", "whistle_like_tone") and x["intensity"] == "high"), key=lambda x: (x["video"], x["t_s"])):
    L.append(f"| {s['video']} | {mmss(s['t_s'])} | {s['dur_s']} | {s['kind']} | {s['intensity']} | {'yes' if s['overlaps_narration'] else 'no'} | {'yes' if s['inside_music_section'] else 'no'} | {s['phrase_hint']} |")
L += ["", "All remaining detections, including every medium and low event, are in `sound-effects-inventory.json`."]
open(out + "/sound-effects-inventory.md", "w", encoding="utf8").write("\n".join(L) + "\n")

# unidentified-music.md
U = ["# Music in the references that is not identified", "",
     "Sections are stretches where a bed is estimated to sit under the narration, measured only in the pauses between words. Genre, mood, tempo and instrumentation below are estimates from level, spectral brightness and beat tracking; instrumentation cannot be determined by this method and needs a human listen. A section listed here may be a sound-effects layer or room tone rather than music (`music_likely` says which).", "",
     "| Video | Start | End | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Why unidentified |", "|---|---|---|---|---|---|---|---|"]
n_un = 0
for r in inv:
    a = ana_all.get(r["id"])
    if not a: continue
    why = "credited tracks, order unknown" if r["id"] in credited_videos else "no recognition hit, or only a single low-confidence hit"
    matched_t = [o["start_s"] for o in occ if o["video"] == r["id"] and o["method"].startswith("shazam") and "contradicts" not in o["confidence"]]
    for s in a["music_sections"]:
        if not s["music_likely"]: continue
        if any(s["start"] <= (m or -1) <= s["end"] for m in matched_t): continue
        p, tn, lv = mood(s); n_un += 1
        U.append(f"| {r['id']} | {mmss(s['start'])} | {mmss(s['end'])} | yes | {s['bed_vs_voice_db']} | {s.get('tempo_bpm_approx') or 'n/a'} | {p}, {tn}, {lv} | {why} |")
U += ["", f"{n_un} music-likely sections have no identification."]
open(out + "/unidentified-music.md", "w", encoding="utf8").write("\n".join(U) + "\n")

# audio-design-analysis.md
D = ["# Audio design analysis of the reference videos", "",
     "Method and limits: speech is located with word timestamps; the bed under it is measured in the gaps; events are heuristic detections (see `sound-effects-inventory.md`). Nobody listened to these videos for this report. Statements about mood and instrumentation are estimates. Timestamps are m:ss.",
     "", "## Cross-video summary", "",
     "| Video | Length | Speech share | Voice level dB | Bed vs voice dB (median) | Music-likely sections | Impacts/min | Whooshes/min | Ticks/min |", "|---|---|---|---|---|---|---|---|---|"]
rows = []
for r in inv:
    a = ana_all.get(r["id"])
    if not a: continue
    ms = [s for s in a["music_sections"] if s["music_likely"]]
    rel = [s["bed_vs_voice_db"] for s in ms if s["bed_vs_voice_db"] is not None]
    c = collections.Counter(e["kind"] for e in a["events"])
    rows.append((r, a, ms, c, statistics.median(rel) if rel else None))
    D.append(f"| {r['group']}: {r['title'][:36]} | {mmss(a['duration'])} | {a['speech_fraction']} | {a['speech_level_db']} | {statistics.median(rel) if rel else 'n/a'} | {len(ms)} of {len(a['music_sections'])} | {per_min(c['impact'], a['duration'])} | {per_min(c['whoosh'], a['duration'])} | {per_min(c['click_like'], a['duration'])} |")
by_group = collections.defaultdict(list)
for r, a, ms, c, rel in rows: by_group[r["group"]].append((a, ms, c, rel))
D += ["", "## Patterns by channel", ""]
for g, items in by_group.items():
    rels = [x[3] for x in items if x[3] is not None]
    D.append(f"- **{g}** ({len(items)} videos): speech covers {statistics.mean(i[0]['speech_fraction'] for i in items):.0%} of runtime on average; "
             f"median bed level {statistics.median(rels) if rels else 'n/a'} dB against the voice; "
             f"{statistics.mean(i[2]['impact'] / (i[0]['duration'] / 60) for i in items):.1f} impact candidates and {statistics.mean(i[2]['whoosh'] / (i[0]['duration'] / 60) for i in items):.1f} whoosh candidates per minute.")
D += ["", "## Per-video timeline", ""]
for r, a, ms, c, rel in rows:
    D += [f"### {r['title']} ({r['id']}, {r['group']})", "",
          f"Length {mmss(a['duration'])}; first word at {mmss(a['first_speech_s'])}; speech {a['speech_fraction']:.0%} of runtime; music floor {a['music_floor_db']} dB over a room floor of {a['floor_db']} dB.", ""]
    cred = [o for o in occ if o["video"] == r["id"] and o["method"].startswith("creator")]
    if cred: D += ["Credited music: " + ", ".join(f"\"{o['title']}\"" for o in cred) + f" by {cred[0]['artist']} ({manual['credited'][0]['library']}). Placement unknown.", ""]
    hits = [o for o in occ if o["video"] == r["id"] and o["method"].startswith("shazam")]
    if hits: D += ["Recognition hits: " + "; ".join(f"{mmss(o['start_s'])} \"{o['title']}\" by {o['artist']} ({o['confidence']})" for o in hits), ""]
    D += ["| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |", "|---|---|---|---|---|---|---|"]
    for s in a["music_sections"]:
        p, tn, lv = mood(s)
        inside = [e for e in a["events"] if s["start"] <= e["t"] <= s["end"]]
        D.append(f"| {mmss(s['start'])} to {mmss(s['end'])} | {'yes' if s['music_likely'] else 'no'} | {s['bed_vs_voice_db']} | {s.get('tempo_bpm_approx') or 'n/a'} | {p}, {tn}, {lv} | {sum(e['kind'] == 'impact' for e in inside)} | {sum(e['kind'] == 'whoosh' for e in inside)} |")
    D.append("")
open(out + "/audio-design-analysis.md", "w", encoding="utf8").write("\n".join(D) + "\n")

# ---------- licensed catalogue (reusable) ----------
lic = manual["licensed_candidates"]
meas = {m["id"]: m for m in manual.get("licensed_measurements", [])}
for l in lic: l["measured"] = meas.get(l["id"])

# playlist
json.dump({"generated_from": "reference analysis 2026-11-27", "reference_tracks": tracks_list, "licensed_candidates": lic}, open(out + "/playlist.json", "w", encoding="utf8"), indent=1, ensure_ascii=False)
P = ["# Rival Lines soundtrack playlist", "",
     "Two parts. Part 1 is music identified in the reference videos: identity and availability only, never downloaded or redistributed, and not reusable here. Part 2 is licensed alternatives that the channel may reuse with attribution.", "",
     "## Part 1: reference tracks", "", "| Track | Artist | Album | Method | Confidence | Videos | Note |", "|---|---|---|---|---|---|---|"]
for t in tracks_list:
    conf = sorted({o["confidence"] for o in occ if o["track_key"] == t["track_key"]})
    P.append(f"| {t['title']} | {t['artist']} | {t.get('album') or ''} | {', '.join(t['methods'])} | {', '.join(conf)} | {', '.join(t['videos'])} | {t.get('licence_note') or t.get('shazam_url') or ''} |")
P += ["", "## Part 2: licensed candidates (Creative Commons, attribution required)", "",
      "Source is the Openverse catalogue index, which reflects the licence at index time (2022 for the Jamendo entries). Re-check the licence at the landing page before use. Audio is not stored in this repo.", "",
      "| Title | Creator | Licence | Tempo bpm | Mean dB | Arc | Length s | Tags | Landing page |", "|---|---|---|---|---|---|---|---|---|"]
for l in lic:
    m = l.get("measured") or {}
    P.append(f"| {l['title']} | {l['creator']} | CC {l['license'].upper()} {l.get('license_version') or ''} | {m.get('tempo_bpm_est', '')} | {m.get('mean_db', '')} | {m.get('arc', '')} | {m.get('duration_s', '')} | {', '.join(l.get('tags', [])[:5])} | {l['landing_url']} |")
open(out + "/playlist.md", "w", encoding="utf8").write("\n".join(P) + "\n")

with open(out + "/track-index.csv", "w", newline="", encoding="utf8") as f:
    w = csv.writer(f)
    w.writerow(["kind", "title", "artist", "album", "method", "confidence", "videos", "licence", "reusable", "link"])
    for t in tracks_list:
        conf = ";".join(sorted({o["confidence"] for o in occ if o["track_key"] == t["track_key"]}))
        w.writerow(["reference", t["title"], t["artist"], t.get("album") or "", ";".join(t["methods"]), conf, ";".join(t["videos"]), t.get("licence_note") or "", "no", t.get("shazam_url") or ""])
    for l in lic:
        w.writerow(["licensed", l["title"], l["creator"], "", "openverse_search", "licence_from_index", "", f"CC {l['license'].upper()} {l.get('license_version') or ''}", "yes_with_attribution", l["landing_url"]])

print("references", len(inv), "analysed", len(ana_all), "tracks", len(tracks_list), "occurrences", len(occ), "sfx", len(sfx), "unidentified sections", n_un)
