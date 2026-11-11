// Hidden Past, layered Vox cut on the Al Capone (brought down by income tax), at about 30 seconds. Facts come from one fetched Wikipedia article (each claim's text is checked against it
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
import { ASSETS, CLAIMS, METADATA, SCENES, SLOTS, TOPIC, WIKI_ARTICLE, WIKI_TITLE } from "./vox-capone-story.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const channel = JSON.parse(readFileSync(join(here, "channel.json"), "utf8"));
const sharp = createRequire(join(ROOT, "package.json"))("sharp");
const VOX = JSON.parse(readFileSync(join(ROOT, "config/autopilot.json"), "utf8")).vox;
const py = process.platform === "win32" ? "python" : "python3";
const UA = { "User-Agent": "HiddenPastPreview/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; evidence-led history)" };
// Owner, 11 Nov: the voice was too jovial for a bombing. The repo's own grave delivery note (video-tone.js) on a deeper voice; no style override.
const VOICE = "Charon", GRAVITY = "grave";
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

/** The United States, framed on three places and drawn from Natural Earth: Chicago, the Atlanta penitentiary and Alcatraz. Coordinates are from English Wikipedia. */
async function routeMap() {
  const places = [await coords("Chicago"), await coords("Atlanta"), await coords("Alcatraz Island")];
  const m = frameMap(places, undefined, { zoom: 8 }), { box, project } = m;
  const visible = (poly) => { const b = ringBox(poly[0]); return b.w < box.e && b.e > box.w && b.s < box.n && b.n > box.s; };
  const focused = new Set(m.focusFeatures);
  const landD = pathOf(m.features.filter((f) => !focused.has(f)).flatMap((f) => polygonsOf(f).filter(visible)), project, true);
  const countryD = pathOf(m.focusFeatures.flatMap((f) => polygonsOf(f).filter(visible)), project, true);
  const inView = ([lon, lat]) => lon > box.w && lon < box.e && lat > box.s && lat < box.n;
  const labels = [];
  for (const f of m.features.filter((x) => !focused.has(x) && x.properties.LABELRANK <= 5).slice(0, 10)) { const p = [f.properties.LABEL_X, f.properties.LABEL_Y]; if (inView(p)) { const [x, y] = project(p); labels.push({ text: f.properties.NAME.toUpperCase(), x, y, size: 30 }); } }
  const names = ["Chicago, 1925-31", "Atlanta, 1932", "Alcatraz, 1934"];
  const pins = places.map((q, i) => { const [x, y] = project([q.lon, q.lat]); return { name: names[i], x, y, side: i === 2 ? "left" : "right" }; });
  return { rect: AREA, landD, countryD, labels: labels.slice(0, 6), pins, routeD: "M" + pins.map((p) => `${p.x} ${p.y}`).join(" L"), places, map_data: "Natural Earth 1:50m (public domain); coordinates from English Wikipedia" };
}

export default async function voxBeatsPreview({ key, runId, tools }) {
  // 1. Every claim's text must be found in the fetched article, or nothing renders.
  const wiki = Object.values((await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${WIKI_TITLE}`)).query.pages)[0].extract;
  for (const c of CLAIMS) if (!wiki.includes(c.must.text)) throw new Error(`claim ${c.claim_id}: "${c.must.text}" not found in the fetched article`);
  tools.stage("research_complete", "ok", { claims: CLAIMS.length });
  const claims = CLAIMS.map(({ must, ...c }) => c);
  const sources = [{ source_id: "wiki-capone", url: WIKI_ARTICLE, published: "2026-11-11" }, { source_id: "src-nyt", url: ASSETS.find((a) => a.key === "press").page_url, published: "1929-02-15" }];

  // 2. Script: the wording and the optional lines that land at 35 to 40 seconds at this voice's measured pace.
  const cal = await narrate({ text: CALIBRATION, edgeVoice: channel.voice.tts, outDir: tools.outDir, name: "calibration", gravity: GRAVITY, voice: VOICE });
  const fitFor = (wpm) => { const fit = fitScript({ slots: SLOTS, wpm, targetSeconds: 29.7, minSeconds: 28.8, maxSeconds: 31 }); return { fit, ...compactScenes({ scenes: SCENES, sentences: fit.sentences }) }; };
  const first = fitFor(cal.wpm * 0.88);
  tools.write("script-fit.json", { measured_wpm: cal.wpm, voice: cal.engine, ...first.fit });
  console.log(`script fit: ${cal.wpm} wpm -> ${first.fit.words} words, about ${first.fit.estimated_seconds}s, ${first.sentences.length} beats`);

  const makeProps = async ({ narration }) => {
    const dir = join(tools.outDir, "assets");
    mkdirSync(dir, { recursive: true });
    const got = {}, entries = [];
    for (const a of ASSETS) { const { file, entry } = await commonsAsset({ title: a.title, dir, id: a.id, claim: a.claim, role: a.role }); got[a.key] = { file, entry }; entries.push(entry); }
    tools.write("asset-manifest.json", { note: "Every image is a real file from Wikimedia Commons with its licence recorded. Nothing is AI-generated.", assets: entries });

    // The photographs: the repo's PhotoTreatment, the same recipe on all four so they read as one piece.
    const items = [];
    for (const a of ASSETS) {
      const k = a.key, w = a.doc ? 1700 : 1300;
      const meta = await sharp(got[k].file).metadata();
      let ww = w, hh = Math.round(w * meta.height / meta.width);
      if (hh > 1500) { hh = 1500; ww = Math.round(hh * meta.width / meta.height); }
      items.push({ key: k, input: got[k].file, w: ww - (ww % 2), h: hh - (hh % 2), saturation: a.doc ? 1 : VOX.base_saturation, halftone: a.doc ? 0.04 : VOX.halftone_opacity, baked: join(dir, `${k}-vox.png`) });
    }
    bakeStills(items, dir, narration.mp3);
    const images = {}, credits = {};
    for (const it of items) { images[it.key] = `data:image/jpeg;base64,${(await sharp(it.baked).jpeg({ quality: 90 }).toBuffer()).toString("base64")}`; credits[it.key] = got[it.key].entry.credit_line; }
    const map = await routeMap();
    tools.write("map-places.json", { places: map.places, source: map.map_data });
    delete map.places;
    return { images, credits, map };
  };

  const result = await runFixedShort({ key, runId, tools, spec: { topic: TOPIC, claims, sources, sentences: first.sentences, scenes: first.scenes, compositionId: "HiddenPastVoxCapone", edgeVoice: channel.voice.tts, gravity: GRAVITY, voice: VOICE, metadata: METADATA, minSeconds: 28, maxSeconds: 32, refit: (wpm) => { const x = fitFor(wpm * 0.98); return { sentences: x.sentences, scenes: x.scenes }; }, makeProps } });
  tools.write("quality-report.json", { format: "hidden_past_vox_capone_30s", technical: result.qa });
}
