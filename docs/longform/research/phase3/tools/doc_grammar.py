"""Writes docs/longform/CHANNEL-VISUAL-GRAMMAR.md: per-channel grammar derived from the reference study, with what the current system does (QA baseline) and what was changed or kept."""
import json, os
from docs_common import *
def qa(d, c): return json.load(open(os.path.join(DOCS, d, c + ".json"), encoding="utf8"))
def S(c, key, pct=True, nd=0):
    rs = by(c); return rng([r["groups_sampled"][key] for r in rs], pct=True)
def band(c, k, nd=0, pct=False): return rng([r[k] for r in by(c)], nd, pct)
G = {c: {"n": len(by(c)), "real": band(c, "real_media_share_sampled", pct=True), "constr": band(c, "constructed_share_sampled", pct=True), "run": band(c, "longest_constructed_run_s"), "ov": band(c, "overlay_share_sampled", pct=True),
         "shots": rng([r["shots2"]["per_min"] for r in by(c) if r.get("shots2")], 1), "med": rng([r["shots2"]["median_gap_s"] for r in by(c) if r.get("shots2") and r["shots2"]["median_gap_s"]], 1)} for c in CH}
L = ["# Channel visual grammar (Phase 3)", "",
     "Seven grammars, one per channel, **derived from the reference study** (`VISUAL-EDITING-RESEARCH.md`, `CAPTION-RESEARCH.md`, `SOUND-DESIGN-RESEARCH.md`) and checked against the current samples with the QA tool (`PRODUCTION-QA-STANDARDS.md`). Each channel states: what the references do (observed/measured), the rule adopted (recommendation), confidence, what the current system did before Phase 3, and what was changed or deliberately kept. No number below is meant to be copied across channels: the bands differ because the references differ.", "",
     "How to read the references' numbers: real captured = footage, photographs, archive, genuine screen recordings and documents; constructed = maps, charts, tactical diagrams, illustration, whiteboard, motion graphics, text cards, decorative or AI-generated imagery. Shares are of sampled frames (+-5 to +-12 points).", ""]
def sec(c, title, basis, rules, captions, sound, before, change, keep, conf):
    g = G[c]; b = qa("qa-baseline", c)["metrics"]; a = qa("qa-after", c)["metrics"]
    L.extend([f"## {title}", "",
              f"**Reference basis:** {g['n']} videos ({basis}). Real captured {g['real']}; constructed {g['constr']}; longest all-constructed stretch {g['run']} s; overlay text on {g['ov']} of sampled frames; {g['shots']} shots/min, median shot {g['med']} s. **Confidence: {conf}.**", "",
              "**Visual grammar (rule adopted):**", ""] + [f"- {r}" for r in rules] + ["", f"**Captions:** {captions}", "", f"**Sound:** {sound}", "",
              f"**Current system before Phase 3 (QA baseline):** {before} Estimated authentic share (upper bound) {100*b['authentic_beat_share_upper_bound']:.0f}%, longest constructed stretch {b['longest_constructed_stretch_s']} s, {b['distinct_real_assets']} distinct authentic assets.", "",
              f"**Changed in Phase 3:** {change} After: authentic share {100*a['authentic_beat_share_upper_bound']:.0f}%, longest constructed stretch {a['longest_constructed_stretch_s']} s, {a['distinct_real_assets']} distinct authentic assets.", "",
              f"**Kept on purpose:** {keep}", ""])
sec("hidden-past", "Hidden Past (geography, history, geopolitics)", "5 from RealLifeLore only",
    ["A map explains, a photograph, clip or archive item proves: alternate them. No map sequence longer than about two minutes (references: 60-135 s) without real material.", "History topics bring in period prints, engravings and archival film with a visible credit; contemporary topics use news and public-appearance footage.", "Map camera moves or an overlay change at least every 10 s; no 30-second hold on one framing.", "No AI-generated imagery; no host on camera."],
    "No narration captions. Place labels live in the map. A credit line on every real clip or photograph; quoted news text only in a boxed, attributed quote caption.",
    "Voice first, silence kept between sentences; optional single ambience under long aerial/place shots; one impact for the one reveal; no music under narration (cue sheet `hidden-past.md`). Evidence for the ambience and impact is *not* from the references.",
    "Pass on authentic share, constructed stretches and overlay; **fail on credits** (6 pictures shown without a credit line); warn on one NASA orbital photograph reused on 4 beats.",
    "Every authentic picture now carries its recorded credit line (generic overlay from the attribution record).",
    "Map engine (MapLibre scenes), real Commons photographs, the dated-footage scene with its source-worded caption box. The reused NASA backdrop on 4 beats **remains** (two further licensed period photographs could not be found in this pass).", "Medium")
sec("ai-tested", "AI Tested (software and model tests)", "5 from AI Search only",
    ["The picture is the software: real screen recordings, real pages, real papers, real terminals; generated outputs are shown as outputs inside the tool, never as decoration.", "A page or paper is brought in with the discussed line highlighted; long holds are accepted while the page is being read (static stretches up to about 2 minutes in the references).", "No host on camera; narration over the screen."],
    "No captions over screens. Section cards between chapters; highlight boxes and cursor emphasis inside the capture instead.",
    "Only sounds that belong to the shown action (typing, clicks) at natural level; no whooshes on screen cuts; a light bed is optional.",
    "The weakest authentic share of any channel (screens and documents are 57% of the references; ours rendered replies in a drawn chat/terminal UI): FAIL on authentic share; a 193 s constructed stretch.",
    "The paper the narration cites (Faith and Fate, arXiv) is now shown as a **real browser capture** with the discussed sentence highlighted (beat A09b), and its summary graphic follows as A09c; two unrelated leftover capture files were removed from the episode's media.",
    "Our own test data and the rendered chat and grid scenes: they show our real model replies (the evidence of the episode) and have no equivalent real capture; the repository's test runs are not publicly capturable. The channel stays below its reference band on authentic share: a limitation, not a pass.", "Medium")
sec("court-and-spotlight", "Court & Spotlight (legal cases, public records)", "FRONTLINE, SunnyV2 x3, a Spanish documentary compilation; two videos at 47% and 7% coverage",
    ["No single editing model exists in the references; the transferable devices are: real documents with the quoted passage highlighted, lower-thirds for each new person, a credit line on every borrowed clip, and interview-led takes of 6-12 s.", "Constructed graphics (amounts, timelines, ledgers) are the exception, not the structure, in the references (0-15% except the transcript-card video)."],
    "Lower-third for each new person, highlight on the document, credit on borrowed clips; no narration subtitles.",
    "Restrained: very low room tone under document scenes; gavel only where a sentence is read; at most one riser and impact before the verdict count; deliberate silence before the verdict (cue sheet `court-and-spotlight.md`).",
    "Authentic share 27% (the references run 35-99%; the band is too wide to constrain); constructed stretch up to 130 s.",
    "Cue sheet with the gavel, riser and impact placed on the beats that state the sentence and the verdict count.",
    "The scene set (real court-document pages, real web captures with highlight, Commons portraits, constructed amount/timeline cards). Converting the amount and timeline cards into more real document pages would need more official documents than the sample has; **not done** in this pass.", "Low-Medium")
sec("celebrity-news", "Celebrity News (entertainment business and public statements)", "2 analysed (Carrey commentary, Nicki Swift anchors) plus the SunnyV2 Corden video; 2 planned videos could not be fetched",
    ["Almost no constructed graphics (0-4%): archival clips, news clips, stills and real pages with the discussed row or line highlighted.", "A credit or source line on every clip; broadcaster lower-thirds are the original's own.", "Whether a host appears is a channel decision (33% in one reference, 2% in the other)."],
    "No narration captions; credit lines; evidence pages with the relevant passage highlighted.",
    "Light: shutter on a photo cut-in, vinyl under archive music material; applause, record scratch and clock ticks were removed from the cue sheet because the beats they fired on did not match their purpose.",
    "Authentic share 65% against a 96-100% reference band; a 54 s constructed stretch; the Swift portrait on 5 beats and the Braun photo on 3; credits missing on 11 pictures.",
    "Three new licensed portraits (Braun at TechCrunch 2010 and in a 2020 interview, Swift at the 2023 MTV VMAs) replace repeats; credit lines added.",
    "The magazine-style cover and record cards. **Not fixed:** the explainer beats (copyright, the re-recording mechanism) have no real picture, so authentic share and the constructed stretch still fail against the (2-video, provisional) band.", "Low")
sec("rival-lines", "Rival Lines (football analysis)", "5 from Football Made Simple only; one at 42% coverage",
    ["The tactical diagram is the main picture (42-69% of frames); annotated match footage punctuates it (runs of 15-22 s every 40-75 s in the references); stat tables 3-14%.", "Captions only on footage moments (2-4 words, set in the pitch's perspective); none on the diagram.", "Every tactical run longer than about a minute should be followed by real or annotated footage where it can be licensed."],
    "Footage labels in perspective; name tags on the pitch; nothing on the diagrams.",
    "A rhythmic low bed under tactical sections (reference spectrogram shows one); event effects only at the moment shown; deliberate silence before a key reveal (cue sheet `rival-lines.md`).",
    "Passes the authentic-share band (16% against 14-40%); the licensed match footage the references use is not available to us (7 footage gaps recorded).",
    "Cue sheet only.",
    "StatsBomb event and 360 animations, the shot map and scorecards: the right primary visual by the evidence. Footage remains a recorded gap until a licence exists.", "Medium")
sec("red-space-facts", "Space (planets, missions, science)", "6 videos from 6 channels",
    ["Real imagery versus reconstruction is an editorial choice per episode; pooled figures are not a target (real share 2-93%).", "Real images carry a one-line label and a credit line; reconstructions are recognisably illustrative or labelled as reconstruction.", "Use the best available real image for the thing named: a moon's geology is shown with the spacecraft image of that moon, not a sphere."],
    "Label and credit under real images; no caption on CG reconstructions.",
    "A sustained drone under image plates; launch and radio texture only on the beats that name them; silence for the scale reveal.",
    "Credits missing on 4 pictures; the Voyager 2 image repeated on 4 beats; Miranda told over a 3D sphere.",
    "Miranda's beat now shows the real Voyager 2 image (processed by Ted Stryk, NASA public domain); the timeline thumbnails use the Voyager montage and the two-colour image instead of repeating one picture; credit lines added.",
    "The 3D planet and seasons scenes (they show geometry that no photograph can).", "Low-Medium")
sec("psychology", "Psychology (studies and effects)", "5 from 5 channels; 4 illustrated/whiteboard, 1 live-action",
    ["Four of five references are drawn explainers; the one live-action reference uses 1-4 word emphasis captions and real lab footage. Our illustrated cards match the majority format.", "Real experiment or lab footage appears in one reference only; our system should source real papers and records rather than imitate stock 'thinking' footage."],
    "Illustrated: text drawn into the art, no overlay captions. Live-action: 1-4 word emphasis captions on key terms.",
    "Quiet piano bed, pencil when something is drawn, classroom ambience for the classroom scenario only.",
    "5% authentic share (INFO: the band 0-76% constrains nothing).",
    "Cue sheet only.",
    "The scenario, cycle and study cards: consistent with the drawn explainers. No real experiment footage exists for the Rosenthal study in our sources.", "Low-Medium")
L += ["## Implementation map", "",
      "| Research conclusion | Where it lives in the system |", "|---|---|",
      "| credit on every borrowed picture | `platform/longform/v2/credits.mjs` (records), `platform/longform/stills/specs.mjs` (adds `autoCredit` to scene props), `src/skills/remotion-render/channels/lf2/compositions.jsx` (generic overlay), QA check V6 |",
      "| per-channel bands | `config/longform-qa-standards.json` (derived, never hand-typed) |",
      "| plan-level visual and audio QA | `platform/longform/qa/visual-audio-qa.mjs`; reports in `docs/longform/qa-baseline` and `docs/longform/qa-after` |",
      "| sound grammar and cue sheets | `config/longform-cue-rules.json`, `platform/longform/v2/audio/cue-sheets.mjs`, `docs/longform/cue-sheets/` |",
      "| real media acquisition | `platform/longform/v2/commons-search.mjs` (lists candidates with licence), `platform/longform/v2/assets.mjs` (licence-enforced download), `platform/longform/v2/capture.mjs` (real browser capture) |", ""]
open(os.path.join(DOCS, "CHANNEL-VISUAL-GRAMMAR.md"), "w", encoding="utf8").write("\n".join(L)); print("wrote CHANNEL-VISUAL-GRAMMAR.md")
