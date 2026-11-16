// Hidden Past, layered Vox Short for the Kaliningrad long-form. Same engine as vox-beats-preview.mjs / vox-capone-preview.mjs (runFixedShort, fitScript,
// commonsAsset, bakeStills, Natural Earth maps), different story. Facts are re-fetched from four pages and every claim's text must be found in its page
// or nothing renders. 35 to 40 seconds at the voice's own measured pace, never sped up.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "../../preview/lib.mjs";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { commonsAsset } from "../../production/commons.mjs";
import { compactScenes, fitScript } from "../../production/fitscript.mjs";
import { narrate } from "../../production/index.mjs";
import { AREA, frameMap, pathOf, polygonsOf } from "../../../scripts/autopilot/map-vox.mjs";
import { bakeStills } from "./vox-hippos.mjs";
import { ASSETS, CLAIMS, METADATA, PINNED_COMMENT, SCENES, SLOTS, SOURCES, TOPIC } from "./vox-kg-story.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const channel = JSON.parse(readFileSync(join(here, "channel.json"), "utf8"));
const sharp = createRequire(join(ROOT, "package.json"))("sharp");
const VOX = JSON.parse(readFileSync(join(ROOT, "config/autopilot.json"), "utf8")).vox;
const UA = { "User-Agent": "HiddenPastPreview/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; evidence-led history)" };
const STYLE = "Brisk, urgent and serious, like a documentary narrator who gets to the point; short sentences land hard, no long pauses";
const CALIBRATION = "The report was published in March. It listed three findings. The first concerned the cost of the programme, which rose by a fifth over two years. The second looked at who paid for it, and the third asked whether anyone had checked.";
const squash = (s) => String(s).replace(/\s+/g, " ").trim();

async function get(url, json = true) {
  for (let i = 1; ; i++) { const r = await fetch(url, { headers: UA }); if (r.ok) return json ? r.json() : r.text(); if (i >= 4) throw new Error(`${url} -> ${r.status}`); await new Promise((res) => setTimeout(res, i * 3000)); }
}
async function pageText(src) {
  if (src.avalon) return squash((await get(src.url, false)).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " "));
  const j = await get(`https://en.wikipedia.org/w/api.php?action=query&redirects=1&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(src.api)}`);
  return squash(Object.values(j.query.pages)[0].extract);
}
const ringBox = (ring) => ring.reduce((b, [x, y]) => ({ w: Math.min(b.w, x), e: Math.max(b.e, x), s: Math.min(b.s, y), n: Math.max(b.n, y) }), { w: 180, e: -180, s: 90, n: -90 });

const KAL = { name: "Kaliningrad", lat: 54.7003, lon: 20.4531 }, VIL = { name: "Vilnius", lat: 54.6872, lon: 25.28 }, MOS = { name: "Moscow", lat: 55.7558, lon: 37.6178 };
/** Drawn from Natural Earth 1:50m. `framing` are the points that set the view, `labels` are [text, lon, lat, size]. Russia is tinted (the exclave and, on the wide map, the mainland); `nato` names are shaded. */
function drawMap({ framing, zoom, pins, labels, nato = [], route = null }) {
  const m = frameMap(framing, undefined, { zoom }), { box, project } = m;
  const visible = (poly) => { const b = ringBox(poly[0]); return b.w < box.e && b.e > box.w && b.s < box.n && b.n > box.s; };
  const russia = m.features.filter((f) => f.properties.NAME === "Russia");
  if (!russia.length) throw new Error("Natural Earth has no Russia feature");
  const tinted = new Set([...russia, ...m.features.filter((f) => nato.includes(f.properties.NAME))]);
  const landD = pathOf(m.features.filter((f) => !tinted.has(f)).flatMap((f) => polygonsOf(f).filter(visible)), project, true);
  const countryD = pathOf(russia.flatMap((f) => polygonsOf(f).filter(visible)), project, true);
  const natoD = pathOf(m.features.filter((f) => nato.includes(f.properties.NAME)).flatMap((f) => polygonsOf(f).filter(visible)), project, true);
  const inView = (lon, lat) => lon > box.w && lon < box.e && lat > box.s && lat < box.n;
  const labs = labels.filter(([, lon, lat]) => inView(lon, lat)).map(([text, lon, lat, size]) => { const [x, y] = project([lon, lat]); return { text, x, y, size }; });
  const pp = pins.map((q) => { const [x, y] = project([q.lon, q.lat]); return { name: q.name, x, y, side: q.side || "right" }; });
  const routeD = route ? "M" + route.map(([lon, lat]) => project([lon, lat]).join(" ")).join(" L") : "";
  return { rect: AREA, landD, countryD, natoD, labels: labs, pins: pp, routeD, russiaInView: m.features.length > 0, map_data: "Natural Earth 1:50m (public domain); city coordinates from English Wikipedia" };
}
const LOCAL = () => drawMap({
  framing: [KAL, VIL, { lat: 54.7, lon: 17.2 }], zoom: 3.0, pins: [{ ...KAL, side: "left" }], nato: ["Poland", "Lithuania"],
  labels: [["POLAND", 20.4, 52.6, 52], ["LITHUANIA", 24.1, 55.4, 46], ["BELARUS", 27.6, 53.7, 40], ["LATVIA", 24.9, 56.9, 36], ["BALTIC SEA", 18.5, 55.9, 34]],
});
const WIDE = () => drawMap({
  framing: [KAL, MOS, { lat: 54.7, lon: 14.0 }], zoom: 3.0, pins: [{ ...KAL, side: "left" }, { ...MOS, side: "left" }], nato: ["Poland", "Lithuania"],
  labels: [["POLAND", 19.6, 52.2, 40], ["LITHUANIA", 23.9, 55.5, 36], ["BELARUS", 28.0, 53.5, 40], ["LATVIA", 24.8, 57.0, 30], ["RUSSIA", 33.0, 58.2, 44], ["UKRAINE", 31.0, 50.6, 36]],
  route: [[KAL.lon, KAL.lat], [24.0, 54.4], [27.6, 54.0], [MOS.lon, MOS.lat]],
});

export default async function voxKgPreview({ key, runId, tools }) {
  // 1. Every claim's text must be found in its fetched page, or nothing renders.
  const pages = {};
  for (const [k, s] of Object.entries(SOURCES)) pages[k] = await pageText(s);
  const missing = [];
  for (const c of CLAIMS) for (const m of c.musts) if (!pages[m.from].includes(squash(m.text))) missing.push(`${c.claim_id} [${m.from}]: "${m.text}"`);
  tools.write("claim-check.json", { checked: CLAIMS.flatMap((c) => c.musts.map((m) => ({ claim_id: c.claim_id, page: SOURCES[m.from].url, text: m.text, found: pages[m.from].includes(squash(m.text)) }))) });
  if (missing.length) throw new Error(`claim text not found in the fetched pages: ${missing.join(" | ")}`);
  tools.stage("research_complete", "ok", { claims: CLAIMS.length });
  const claims = CLAIMS.map(({ musts, ...c }) => c);
  const sources = Object.values(SOURCES).map((s) => ({ source_id: s.id, url: s.url, published: "2026-11-16" }));

  // 2. Script: the wording and optional lines that land at 35 to 40 seconds at this voice's measured pace.
  const cal = await narrate({ text: CALIBRATION, edgeVoice: channel.voice.tts, outDir: tools.outDir, name: "calibration", style: STYLE });
  const fitFor = (wpm) => { const fit = fitScript({ slots: SLOTS, wpm, targetSeconds: 36.8, minSeconds: 35.6, maxSeconds: 38.6 }); return { fit, ...compactScenes({ scenes: SCENES, sentences: fit.sentences }) }; };
  const first = fitFor(cal.wpm * 0.88);
  tools.write("script-fit.json", { measured_wpm: cal.wpm, voice: cal.engine, ...first.fit });
  console.log(`script fit: ${cal.wpm} wpm -> ${first.fit.words} words, about ${first.fit.estimated_seconds}s, ${first.sentences.length} beats`);

  const makeProps = async ({ narration }) => {
    const dir = join(tools.outDir, "assets");
    mkdirSync(dir, { recursive: true });
    const got = {}, entries = [];
    for (const a of ASSETS) { const { file, entry } = await commonsAsset({ title: a.title, dir, id: a.id, claim: a.claim, role: a.role }); got[a.key] = { file, entry }; entries.push(entry); }
    tools.write("asset-manifest.json", { note: "Every image is a real file from Wikimedia Commons with its licence recorded. Nothing is AI-generated.", assets: entries });
    const items = [];
    for (const a of ASSETS) {
      const meta = await sharp(got[a.key].file).metadata();
      let ww = 1300, hh = Math.round(1300 * meta.height / meta.width);
      if (hh > 1500) { hh = 1500; ww = Math.round(hh * meta.width / meta.height); }
      items.push({ key: a.key, input: got[a.key].file, w: ww - (ww % 2), h: hh - (hh % 2), saturation: VOX.base_saturation, halftone: VOX.halftone_opacity, baked: join(dir, `${a.key}-vox.png`) });
    }
    bakeStills(items, dir, narration.mp3);
    const images = {}, credits = {};
    for (const it of items) { images[it.key] = `data:image/jpeg;base64,${(await sharp(it.baked).jpeg({ quality: 90 }).toBuffer()).toString("base64")}`; credits[it.key] = got[it.key].entry.credit_line; }
    spec.metadata.description = spec.metadata.description.replace("@@CREDITS@@", entries.map((e) => `${e.role}: ${e.credit_line} (${e.source_url})`).join("; "));
    tools.write("pinned-comment.txt", PINNED_COMMENT);
    return { images, credits, map: LOCAL(), wide: WIDE() };
  };

  const spec = { topic: TOPIC, claims, sources, sentences: first.sentences, scenes: first.scenes, compositionId: "HiddenPastVoxKg", edgeVoice: channel.voice.tts, style: STYLE, metadata: { ...METADATA }, minSeconds: 35, maxSeconds: 40, refit: (wpm) => { const x = fitFor(wpm * 0.98); return { sentences: x.sentences, scenes: x.scenes }; }, makeProps };
  const result = await runFixedShort({ key, runId, tools, spec });
  // The voice track is ~-19 LUFS; a Short should sit near -14. Two-pass loudnorm on the audio only, video stream copied.
  const ff = (args) => spawnSync("ffmpeg", args, { encoding: "utf8", maxBuffer: 1 << 26 });
  const m = JSON.parse(ff(["-hide_banner", "-nostats", "-i", result.video, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"]).stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
  const tmp = result.video.replace(/\.mp4$/, ".norm.mp4");
  const n = ff(["-y", "-i", result.video, "-c:v", "copy", "-af", `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", tmp]);
  if (n.status !== 0) throw new Error(`loudnorm failed: ${String(n.stderr).slice(-300)}`);
  renameSync(tmp, result.video);
  tools.write("loudness.json", { before: m, target: "I=-14 TP=-1.5" });
  tools.write("quality-report.json", { format: "hidden_past_vox_kaliningrad_short", technical: result.qa });
}
