// Hidden Past, layered Vox cut on Charles Ponzi, at about 30 seconds (branch preview/hidden-past-ponzi). Facts come from one fetched Wikipedia article (each claim's
// text is checked against it before anything renders). Four real public-domain Commons photographs go through the repo's PhotoTreatment (vignette, halftone, grain).
// Natural voice speed, never sped up. Same path as the Capone cut: fixed script, measured voice, GitHub render, technical QA.
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "../../preview/lib.mjs";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { commonsAsset } from "../../production/commons.mjs";
import { compactScenes, fitScript } from "../../production/fitscript.mjs";
import { narrate } from "../../production/index.mjs";
import { bakeStills } from "./vox-hippos.mjs";
import { ASSETS, CLAIMS, METADATA, RUN_TEXT, SCENES, SLOTS, TOPIC, WIKI_ARTICLE, WIKI_TITLE } from "./vox-ponzi-story.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const channel = JSON.parse(readFileSync(join(here, "channel.json"), "utf8"));
const sharp = createRequire(join(ROOT, "package.json"))("sharp");
const VOX = JSON.parse(readFileSync(join(ROOT, "config/autopilot.json"), "utf8")).vox;
const UA = { "User-Agent": "HiddenPastPreview/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; evidence-led history)" };
const VOICE = "Charon", GRAVITY = "serious";
const CALIBRATION = "The report was published in March. It listed three findings. The first concerned the cost of the programme, which rose by a fifth over two years. The second looked at who paid for it, and the third asked whether anyone had checked.";

async function getJson(url) {
  for (let i = 1; ; i++) { const r = await fetch(url, { headers: UA }); if (r.ok) return r.json(); if (i >= 4) throw new Error(`${url} -> ${r.status}`); await new Promise((res) => setTimeout(res, i * 3000)); }
}

export default async function voxPonziPreview({ key, runId, tools }) {
  // 1. Every claim's text, and the quoted sentence on screen, must be found in the fetched article, or nothing renders.
  const wiki = Object.values((await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${WIKI_TITLE}`)).query.pages)[0].extract;
  for (const c of CLAIMS) if (!wiki.includes(c.must.text)) throw new Error(`claim ${c.claim_id}: "${c.must.text}" not found in the fetched article`);
  if (!wiki.includes(RUN_TEXT)) throw new Error(`on-screen quote not found in the fetched article: ${RUN_TEXT}`);
  tools.stage("research_complete", "ok", { claims: CLAIMS.length });
  const claims = CLAIMS.map(({ must, ...c }) => c);
  const sources = [{ source_id: "wiki-ponzi", url: WIKI_ARTICLE, published: "2026-11-12" }];

  // 2. Script: the wording and the optional line that land at about 30 seconds at this voice's measured pace.
  const cal = await narrate({ text: CALIBRATION, edgeVoice: channel.voice.tts, outDir: tools.outDir, name: "calibration", gravity: GRAVITY, voice: VOICE });
  const fitFor = (wpm) => { const fit = fitScript({ slots: SLOTS, wpm, targetSeconds: 29.7, minSeconds: 28.8, maxSeconds: 31 }); return { fit, ...compactScenes({ scenes: SCENES, sentences: fit.sentences }) }; };
  const first = fitFor(cal.wpm * 0.88);
  tools.write("script-fit.json", { measured_wpm: cal.wpm, voice: cal.engine, ...first.fit });
  console.log(`script fit: ${cal.wpm} wpm -> ${first.fit.words} words, about ${first.fit.estimated_seconds}s, ${first.sentences.length} beats`);

  const makeProps = async ({ narration }) => {
    const dir = join(tools.outDir, "assets");
    mkdirSync(dir, { recursive: true });
    const got = {}, entries = [];
    for (const a of ASSETS) { const { file, entry } = await commonsAsset({ title: a.title, dir, id: a.id, claim: a.claim, role: a.role }); if (!/public domain/i.test(entry.licence)) throw new Error(`${a.title}: licence ${entry.licence}`); got[a.key] = { file, entry }; entries.push(entry); }
    tools.write("asset-manifest.json", { note: "Every image is a real file from Wikimedia Commons with its licence recorded. Nothing is AI-generated. No caption gives a date or place the file does not carry.", assets: entries });
    const items = [];
    for (const a of ASSETS) {
      const k = a.key, w = 1300, meta = await sharp(got[k].file).metadata();
      let ww = w, hh = Math.round(w * meta.height / meta.width);
      if (hh > 1500) { hh = 1500; ww = Math.round(hh * meta.width / meta.height); }
      items.push({ key: k, input: got[k].file, w: ww - (ww % 2), h: hh - (hh % 2), saturation: VOX.base_saturation, halftone: VOX.halftone_opacity, baked: join(dir, `${k}-vox.png`) });
    }
    bakeStills(items, dir, narration.mp3);
    const images = {}, credits = {};
    for (const it of items) { images[it.key] = `data:image/jpeg;base64,${(await sharp(it.baked).jpeg({ quality: 90 }).toBuffer()).toString("base64")}`; credits[it.key] = got[it.key].entry.credit_line; }
    return { images, credits, runText: RUN_TEXT };
  };

  const result = await runFixedShort({ key, runId, tools, spec: { topic: TOPIC, claims, sources, sentences: first.sentences, scenes: first.scenes, compositionId: "HiddenPastVoxPonzi", edgeVoice: channel.voice.tts, gravity: GRAVITY, voice: VOICE, metadata: METADATA, minSeconds: 28, maxSeconds: 32, refit: (wpm) => { const x = fitFor(wpm * 0.98); return { sentences: x.sentences, scenes: x.scenes }; }, makeProps } });
  tools.write("quality-report.json", { format: "hidden_past_vox_ponzi_30s", technical: result.qa });
}
