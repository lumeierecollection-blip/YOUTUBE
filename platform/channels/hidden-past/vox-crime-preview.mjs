// Hidden Past, layered Vox cut on the Avianca Flight 203 bombing (Pablo Escobar's Medellín Cartel). Facts come from one fetched Wikipedia article (each claim's text is checked against it
// before anything renders). Four real Commons photographs go through the repo's PhotoTreatment (vignette, halftone, grain), one of them is cut out
// with rembg to make the herd, and the maps are drawn from Natural Earth. 35 to 40 seconds at the voice's own measured pace, never sped up.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
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
import { ASSETS, CLAIMS, METADATA, SCENES, SLOTS, TOPIC, WIKI_ARTICLE, WIKI_TITLE } from "./vox-crime-story.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const channel = JSON.parse(readFileSync(join(here, "channel.json"), "utf8"));
const sharp = createRequire(join(ROOT, "package.json"))("sharp");
const VOX = JSON.parse(readFileSync(join(ROOT, "config/autopilot.json"), "utf8")).vox;
const py = process.platform === "win32" ? "python" : "python3";
const UA = { "User-Agent": "HiddenPastPreview/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; evidence-led history)" };
const STYLE = "Brisk, urgent and serious, like a documentary narrator who gets to the point; short sentences land hard, no long pauses";
const CALIBRATION = "The report was published in March. It listed three findings. The first concerned the cost of the programme, which rose by a fifth over two years. The second looked at who paid for it, and the third asked whether anyone had checked.";

async function getJson(url) {
  for (let i = 1; ; i++) { const r = await fetch(url, { headers: UA }); if (r.ok) return r.json(); if (i >= 4) throw new Error(`${url} -> ${r.status}`); await new Promise((res) => setTimeout(res, i * 3000)); }
}
async function coords(title) {
  const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=coordinates&redirects=1&titles=${encodeURIComponent(title)}`);
  const c = Object.values(j.query.pages)[0].coordinates?.[0];
  if (!c) throw new Error(`no coordinates for ${title}`);
  return { name: title, lat: c.lat, lon: c.lon };
}
const ringBox = (ring) => ring.reduce((b, [x, y]) => ({ w: Math.min(b.w, x), e: Math.max(b.e, x), s: Math.min(b.s, y), n: Math.max(b.n, y) }), { w: 180, e: -180, s: 90, n: -90 });

/** Western Colombia drawn from Natural Earth: the flight's route from Bogotá to Cali, and the crash site at Soacha. Coordinates are from English Wikipedia. */
async function routeMap() {
  const places = [await coords("Bogotá"), await coords("Cali")], soacha = await coords("Soacha");
  const m = frameMap(places, undefined, { zoom: 3.6 }), { box, project } = m;
  const visible = (poly) => { const b = ringBox(poly[0]); return b.w < box.e && b.e > box.w && b.s < box.n && b.n > box.s; };
  const focused = new Set(m.focusFeatures);
  const landD = pathOf(m.features.filter((f) => !focused.has(f)).flatMap((f) => polygonsOf(f).filter(visible)), project, true);
  const countryD = pathOf(m.focusFeatures.flatMap((f) => polygonsOf(f).filter(visible)), project, true);
  const inView = ([lon, lat]) => lon > box.w && lon < box.e && lat > box.s && lat < box.n;
  const labels = [];
  for (const f of m.focusFeatures) { const p = [f.properties.LABEL_X, f.properties.LABEL_Y]; if (inView(p)) { const [x, y] = project(p); labels.push({ text: f.properties.NAME.toUpperCase(), x: x + 60, y: y + 100, size: 60, color: "#1A1713" }); } }
  for (const f of m.features.filter((x) => !focused.has(x) && x.properties.LABELRANK <= 5).slice(0, 12)) { const p = [f.properties.LABEL_X, f.properties.LABEL_Y]; if (inView(p)) { const [x, y] = project(p); labels.push({ text: f.properties.NAME.toUpperCase(), x, y, size: 30 }); } }
  const pins = places.map((q, i) => { const [x, y] = project([q.lon, q.lat]); return { name: q.name, x, y, side: i === 0 ? "right" : "left" }; });
  const [sx, sy] = project([soacha.lon, soacha.lat]);
  return { rect: AREA, landD, countryD, labels: labels.slice(0, 7), pins, routeD: `M${pins[0].x} ${pins[0].y} L${pins[1].x} ${pins[1].y}`, soacha: { x: sx, y: sy }, places: [...places, soacha], map_data: "Natural Earth 1:50m (public domain); coordinates from English Wikipedia" };
}

export default async function voxBeatsPreview({ key, runId, tools }) {
  // 1. Every claim's text must be found in the fetched article, or nothing renders.
  const wiki = Object.values((await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${WIKI_TITLE}`)).query.pages)[0].extract;
  for (const c of CLAIMS) if (!wiki.includes(c.must.text)) throw new Error(`claim ${c.claim_id}: "${c.must.text}" not found in the fetched article`);
  tools.stage("research_complete", "ok", { claims: CLAIMS.length });
  const claims = CLAIMS.map(({ must, ...c }) => c);
  const sources = [{ source_id: "wiki-avianca203", url: WIKI_ARTICLE, published: "2026-11-11" }];

  // 2. Script: the wording and the optional lines that land at 35 to 40 seconds at this voice's measured pace.
  const cal = await narrate({ text: CALIBRATION, edgeVoice: channel.voice.tts, outDir: tools.outDir, name: "calibration", style: STYLE });
  const fitFor = (wpm) => { const fit = fitScript({ slots: SLOTS, wpm, targetSeconds: 36.2, minSeconds: 35.5, maxSeconds: 38.4 }); return { fit, ...compactScenes({ scenes: SCENES, sentences: fit.sentences }) }; };
  const first = fitFor(cal.wpm * 0.88);
  tools.write("script-fit.json", { measured_wpm: cal.wpm, voice: cal.engine, ...first.fit });
  console.log(`script fit: ${cal.wpm} wpm -> ${first.fit.words} words, about ${first.fit.estimated_seconds}s, ${first.sentences.length} beats`);

  const makeProps = async ({ narration }) => {
    const dir = join(tools.outDir, "assets");
    mkdirSync(dir, { recursive: true });
    const got = {}, entries = [];
    for (const a of ASSETS) { const { file, entry } = await commonsAsset({ title: a.title, dir, id: a.id, claim: a.claim, role: a.role }); got[a.key] = { file, entry }; entries.push(entry); }
    tools.write("asset-manifest.json", { note: "Every image is a real file from Wikimedia Commons with its licence recorded. Nothing is AI-generated. The aircraft cut-out is the real HK-1803 photograph with the background removed by rembg.", assets: entries });

    // The aircraft: the real HK-1803 photograph with its background removed; it flies along the route and then splits in two.
    const cutFile = join(dir, "aircraft-cutout.png");
    const r = spawnSync(py, [join(ROOT, "platform/production/cutout.py"), got.plane.file, cutFile, "--seed", "1", "--model", "isnet-general-use"], { encoding: "utf8", timeout: 600000 });
    if (r.status !== 0) throw new Error(`cut-out failed: ${String(r.stderr).split("\n").slice(-5).join(" ").slice(0, 400)}`);
    const cm = await sharp(cutFile).metadata();
    const cut = { src: `data:image/png;base64,${readFileSync(cutFile).toString("base64")}`, aspect: Math.round((cm.width / cm.height) * 1000) / 1000 };

    // The photographs: the repo's PhotoTreatment, the same recipe on all four so they read as one piece.
    const items = [];
    for (const [k, w] of [["escobar", 760], ["plane", 1300], ["gaviria", 900]]) {
      const meta = await sharp(got[k].file).metadata();
      let ww = w, hh = Math.round(w * meta.height / meta.width);
      if (hh > 1500) { hh = 1500; ww = Math.round(hh * meta.width / meta.height); }
      items.push({ key: k, input: got[k].file, w: ww - (ww % 2), h: hh - (hh % 2), saturation: VOX.base_saturation, halftone: VOX.halftone_opacity, baked: join(dir, `${k}-vox.png`) });
    }
    bakeStills(items, dir, narration.mp3);
    const images = {}, credits = {};
    for (const it of items) { images[it.key] = `data:image/jpeg;base64,${(await sharp(it.baked).jpeg({ quality: 90 }).toBuffer()).toString("base64")}`; credits[it.key] = got[it.key].entry.credit_line; }
    const map = await routeMap();
    tools.write("map-places.json", { places: map.places, source: map.map_data });
    delete map.places;
    return { images, credits, cut, map };
  };

  const result = await runFixedShort({ key, runId, tools, spec: { topic: TOPIC, claims, sources, sentences: first.sentences, scenes: first.scenes, compositionId: "HiddenPastVoxCrime", edgeVoice: channel.voice.tts, style: STYLE, metadata: METADATA, minSeconds: 35, maxSeconds: 40, refit: (wpm) => { const x = fitFor(wpm * 0.98); return { sentences: x.sentences, scenes: x.scenes }; }, makeProps } });
  tools.write("quality-report.json", { format: "hidden_past_vox_crime_layered", technical: result.qa });
}
