// Shot definitions for the long-form v2 approval stills, built from each channel's sample-episode storyboard
// (platform/longform/v2/episodes/<channel>.mjs). Nothing is described here twice: the storyboard says what each beat shows, this file only
// decides which frames of it become stills. Per channel: >= 5 opening frames, >= 10 main-scene frames (one per later beat), 3 transitions
// x 3 keyframes (start / middle / end), 3 thumbnails, plus a storyboard sheet in beat order.
// The rejected v1 specs are archived: git show archive/longform-v1-rejected:platform/longform/stills/specs.mjs (reference only, not used).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
import { autoCredit } from "../v2/credits.mjs";

const THEMES = JSON.parse(readFileSync(join(ROOT, "config/longform-v2.json"), "utf8"));
const FILE = { "rival-lines": "rival", "hidden-past": "hidden", "ai-tested": "aitest", "court-and-spotlight": "court", "red-space-facts": "space", psychology: "psych", "celebrity-news": "celebnews" };
const COMPONENT = {
  "hidden-past": { map: "MapScene + GeoMap (MapLibre, Sentinel-2/NASA imagery, terrain)", footage: "Footage", inset: "Inset", figures: "Figures", chart: "ChartOver", roster: "Roster", scale: "Scale", thumb: "HiddenThumb" },
  "court-and-spotlight": { source: "Source (real capture, camera + highlight on real words)", quote: "Quote", photo: "Photo", transcript: "Transcript", timeline: "CaseTimeline", ledger: "Ledger", amount: "Amount", relations: "Relations", collage: "Collage", date: "DateCard", thumb: "CourtThumb" },
  "rival-lines": { photo: "Photo (licensed still + credit)", number: "NumberOpen", scorecard: "ScoreCard", formation: "Formation (3D pitch plane)", sequence: "Sequence360 (event + 360 data animation)", network: "PassNetwork", press: "PressMap", shots: "ShotMap", bars: "StatBars", timeline: "MatchTimeline", sub: "SubCard", thumb: "RivalThumb" },
  "red-space-facts": { planet: "Planet3D (three.js sphere, real texture, tilt)", tilt: "Tilt (measured obliquities)", seasons: "Seasons (orbit model)", image: "ImagePlate (real image + provenance badge)", pair: "ImagePair", scale: "ScaleBodies (true relative radii)", timeline: "SpaceTimeline", facts: "FactBars (fact-sheet data)", thumb: "SpaceThumb" },
  psychology: { cycle: "Cycle", experiment: "Experiment (study reconstruction)", study: "StudyCard", effect: "EffectPlot (real meta-analysis data)", claims: "ClaimVsEvidence", stat: "Stat", scenario: "Scenario", thumb: "PsychThumb" },
  "celebrity-news": { cover: "Cover (magazine)", record: "Record (magazine)", flow: "Flow (VOX ownership/money)", explainer: "Explainer (VOX)", compare: "Compare", bars: "Bars", post: "Post (recreated public statement)", source: "Source (investigation)", quote: "Quote", thumb: "CelebThumb" },
  "ai-tested": { browser: "Browser (Playwright capture, camera, highlight box, cursor)", terminal: "Terminal", chat: "Chat", accuracy: "Accuracy", grid: "Grid", miss: "Miss", flow: "Flow", compare: "Compare", verdict: "Verdict", thumb: "AiThumb" },
};

/** Adds the theme and channel to a storyboard scene, in the shape LF2Scene expects. */
function sceneProps(ch, scene) {
  const t = THEMES[ch], p = { ch, t, ...scene };
  const ac = autoCredit(ch, scene); if (ac.length) p.autoCredit = ac; // authentic picture without its own credit: draw the recorded credit line (platform/longform/v2/credits.mjs)
  if (ch === "hidden-past") {
    if (scene.type === "map") p.theme = t.map;
    if (scene.type === "roster") p.groups = t.countries;
    if (scene.type === "chart") p.accent = t.accent;
    if (scene.type === "thumb" && scene.map) p.map = { ...scene.map, theme: t.map };
  }
  return p;
}

async function build(ch) {
  const { EPISODE: ep, SOURCES } = await import(`../v2/episodes/${ch}.mjs`);
  const shots = [], comp = (type) => `channels/lf2/${FILE[ch]}.jsx · ${COMPONENT[ch][type] || type}`, srcLine = (b) => `sources: ${b.src.map((s) => SOURCES[s]?.title?.slice(0, 60) || s).join("; ")}`;
  const storyboard = [];
  let opening = 0;
  for (const b of ep.beats) {
    const frames = opening < 5 ? b.frames : [b.frames[b.frames.length > 1 ? 1 : 0]];
    for (const fr of frames) {
      const group = opening < 5 ? "opening" : "scenes";
      const name = `${group === "opening" ? "o" : "s"}${String(shots.length + 1).padStart(2, "0")}-${b.id}-f${fr}`;
      shots.push({ name, group, id: "LF2Scene", frame: fr, props: sceneProps(ch, b.scene), label: { scene: `${b.id} · ${b.part} · ${b.scene.type} · frame ${fr} (${(fr / 30).toFixed(1)} s into the beat)`, component: comp(b.scene.type), technique: `ref ${b.ref}`.slice(0, 150), mode: "single frame of the real component with real data", note: srcLine(b).slice(0, 110) } });
      storyboard.push({ name, beat: b.id, vo: b.vo });
      if (group === "opening") opening++;
    }
  }
  const byId = Object.fromEntries(ep.beats.map((b) => [b.id, b]));
  for (const tx of ep.transitions) for (const [k, fr] of [["start", 0], ["middle", Math.round(tx.dur / 2)], ["end", tx.dur]]) {
    shots.push({ name: `${tx.name}-${k}`, group: "transitions", id: "LF2Tx", frame: fr, props: { kind: tx.kind, dur: tx.dur, aAt: tx.aAt, dir: tx.dir, accent: THEMES[ch].accent || "#fff", a: sceneProps(ch, byId[tx.a].scene), b: sceneProps(ch, byId[tx.b].scene) }, label: { scene: `${tx.name} · ${k} (frame ${fr} of ${tx.dur})`, component: `channels/lf2/kit.jsx · Transition "${tx.kind}" (both scenes render live)`, technique: tx.note, mode: `${tx.a} → ${tx.b}` } });
  }
  for (const th of ep.thumbs) shots.push({ name: th.name, group: "thumbs", id: "LF2Scene", frame: 0, props: sceneProps(ch, { type: "thumb", ...th }), label: { scene: `thumbnail · ${th.name}`, component: comp("thumb"), technique: "built from the episode's real assets and data", mode: "1920x1080 (YouTube shows it at 1280x720)" } });
  return { assets: SOURCES, shots, storyboard, title: ep.title };
}

export const SPECS = Object.fromEntries(Object.keys(FILE).map((ch) => [ch, () => build(ch)]));
