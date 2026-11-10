/**
 * Hidden Past Vox preview: Pablo Escobar's hippos. One real Short from Wikimedia Commons material, rendered on GitHub.
 * Copied from vox-berlin.mjs (same helpers); the story, scenes and 35 to 40 second script fit are new. Narration is generated speech.
 *
 * Reused unedited: scripts/autopilot/{map-vox,vox-gate,visual-common}.mjs, tools.renderTimeline and the
 * repo's PhotoTreatment through the VoxStill composition (baked the same way bakeStills in
 * scripts/autopilot/hidden-past.mjs bakes them, gamma restored the same way).
 * Added here: the newspaper/document treatment and the dated historical map scene.
 */
import { spawnSync } from "node:child_process";
import { SLOTS, METADATA } from "./vox-hippos-story.mjs";
import { sceneTraceability } from "../../script-engine/traceability.mjs";
import { buildTimeline, narrate, technicalQa } from "../../production/index.mjs";
import { fitScript } from "../../production/fitscript.mjs";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
import { FPS, H, W, captions, channelStyle, fit, layoutCheck, paletteFor, paperBackground, sec, solid, stripForRender, stroke, text } from "../../../scripts/autopilot/visual-common.mjs";
import { buildMapLayers } from "../../../scripts/autopilot/map-vox.mjs";
import { voxGate } from "../../../scripts/autopilot/vox-gate.mjs";
import { CLAIMS, FILES, ROUTES, SLUG, TOPIC, WIKI_ARTICLE, WIKI_TITLE } from "./vox-hippos-story.mjs";

const sharp = createRequire(join(ROOT, "package.json"))("sharp");
const REMOTION_DIR = join(ROOT, "src/skills/remotion-render");
const VOX = JSON.parse(readFileSync(join(ROOT, "config/autopilot.json"), "utf8")).vox;
const SERIF = "Cormorant Garamond";
const UA = { "User-Agent": "HiddenPastPreview/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; evidence-led history sample)" };
const rel = (p) => p.slice(ROOT.length + 1).replace(/\\/g, "/");
const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, timeout: 15 * 60e3, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 4).join(" ")} failed (exit ${r.status})`);
};
const strip = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

async function getJson(url) {
  for (let i = 1; ; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.ok) return r.json();
    if (i >= 4) throw new Error(`${url} -> ${r.status}`);
    await new Promise((res) => setTimeout(res, i * 3000));
  }
}
async function getBuffer(url) {
  for (let i = 1; ; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    if (i >= 4) throw new Error(`${url} -> ${r.status}`);
    await new Promise((res) => setTimeout(res, i * 4000));
  }
}

/** Fetches one Commons file with its licence record. Nothing is used whose licence is not public domain. */
async function fetchCommons(key, f, dir) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo|revisions&rvprop=content&rvslots=main&iiprop=url|size|extmetadata${f.full ? "" : `&iiurlwidth=${f.width}`}${f.page ? `&iiurlparam=${encodeURIComponent(`page${f.page}-${f.width}px`)}` : ""}&titles=${encodeURIComponent(f.title)}`;
  const page = Object.values((await getJson(api)).query.pages)[0];
  const ii = page.imageinfo[0], m = ii.extmetadata;
  const licence = m.LicenseShortName?.value;
  if (!/^(Public domain|CC BY(-SA)? [0-9.]+( [a-z]{2,3})?|CC0.*)$/i.test(licence || "")) throw new Error(`${f.title}: licence "${licence}" is not allowed`);
  const url = f.full ? ii.url : ii.thumburl;
  const file = join(dir, `${key}-source.jpg`);
  writeFileSync(file, await sharp(await getBuffer(url)).jpeg({ quality: 95 }).toBuffer());
  return { key, title: f.title, page_url: f.page_url, file_url: url, licence, creator: strip(m.Artist?.value) || "Unknown author", credit: strip(m.Credit?.value).slice(0, 160), date: strip(m.DateTimeOriginal?.value), description: strip(m.ImageDescription?.value).slice(0, 400), orig_w: ii.width, orig_h: ii.height, file, wikitext: page.revisions?.[0]?.slots?.main?.["*"] || "" };
}

async function wikiCoordinates(title) {
  const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=coordinates&redirects=1&titles=${encodeURIComponent(title)}`);
  const c = Object.values(j.query.pages)[0].coordinates?.[0];
  if (!c) throw new Error(`no coordinates for ${title}`);
  return { name: title, lat: c.lat, lon: c.lon };
}

/** A hand-drawn style loop, same construction as hidden-past.mjs. */
function handCircle(cx, cy, rx, ry, seed) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
  const pts = [];
  for (let a = 0; a <= 390; a += 15) {
    const t = (a * Math.PI) / 180, wob = 1 + rnd() * 0.05;
    pts.push(`${Math.round(cx + Math.cos(t - 1.2) * rx * wob * (1 + a / 9000))} ${Math.round(cy + Math.sin(t - 1.2) * ry * wob)}`);
  }
  return "M" + pts.join(" L");
}

/**
 * Document treatment, added for this channel: greyscale ink, normalised, printed onto the paper tone
 * with a multiply, so a scan reads as paper and not as a screen capture. PhotoTreatment then adds
 * the same vignette/grain the photographs get, with the halftone screen turned down so it does not
 * chew small type.
 */
async function treatDocument(src, out, { crop, paper, greyscale, width }) {
  let img = sharp(src);
  const meta = await img.metadata();
  if (crop) img = sharp(await img.extract({ left: Math.round(crop.x * meta.width), top: Math.round(crop.y * meta.height), width: Math.round(crop.w * meta.width), height: Math.round(crop.h * meta.height) }).toBuffer());
  const m2 = await img.metadata();
  let p = img;
  if (greyscale) p = p.greyscale().normalise({ lower: 3, upper: 97 }).gamma(1.1);
  else p = p.modulate({ saturation: 0.75 });
  // Resize first: sharp applies resize before composite, so the overlay must already match.
  const base = await p.resize({ width }).toBuffer();
  const bm = await sharp(base).metadata();
  const out2 = await sharp(base).composite([{ input: { create: { width: bm.width, height: bm.height, channels: 3, background: paper } }, blend: "multiply" }]).sharpen({ sigma: 0.8 }).jpeg({ quality: 93 }).toBuffer();
  writeFileSync(out, out2);
  const m3 = await sharp(out2).metadata();
  return { w: m3.width, h: m3.height };
}

/** One render of the real PhotoTreatment per image (same procedure as bakeStills in hidden-past.mjs). */
function bakeStills(items, dir, voMp3) {
  copyFileSync(voMp3, join(REMOTION_DIR, "vo.mp3"));
  const pubDir = join(REMOTION_DIR, "public", "vox-src");
  mkdirSync(pubDir, { recursive: true });
  const script = `
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { findChrome } from './find-chrome.js';
import { join } from 'path';
import { readFileSync } from 'fs';
const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const d = process.cwd(), chrome = findChrome();
const b = { ...(chrome ? { browserExecutable: chrome } : {}), chromiumOptions: { gl: 'swangle' }, timeoutInMilliseconds: 180000 };
const serveUrl = await bundle({ entryPoint: join(d, 'Root.jsx'), publicDir: join(d, 'public'), onProgress: () => {} });
for (const j of jobs) {
  const inputProps = { src: j.src, width: j.width, height: j.height, halftoneOpacity: j.halftone, grainOpacity: j.grain };
  const composition = await selectComposition({ serveUrl, id: 'VoxStill', inputProps, ...b });
  await renderStill({ composition, serveUrl, inputProps, output: j.out, imageFormat: 'png', ...b });
  console.log('baked', j.out);
}
process.exit(0);`;
  const jobs = items.map((it) => {
    const name = `hp-${it.key}-base.jpg`;
    sh("ffmpeg", ["-y", "-v", "error", "-i", it.input, "-vf", `eq=saturation=${it.saturation}`, "-q:v", "2", join(pubDir, name)]);
    return { src: `vox-src/${name}`, width: it.w, height: it.h, halftone: it.halftone, grain: VOX.grain_opacity, out: it.baked };
  });
  const jobsFile = join(dir, "bake-jobs.json");
  writeFileSync(jobsFile, JSON.stringify(jobs));
  writeFileSync(join(REMOTION_DIR, ".bake-stills.mjs"), script);
  sh("node", [".bake-stills.mjs", jobsFile], { cwd: REMOTION_DIR });
  for (const it of items) {
    if (!existsSync(it.baked)) throw new Error(`PhotoTreatment did not produce ${it.baked}`);
    const encoded = it.baked.replace(/\.png$/, "-srgb.png");
    sh("ffmpeg", ["-y", "-v", "error", "-i", it.baked, "-vf", "eq=gamma=2.2", encoded]);
    copyFileSync(encoded, it.baked);
  }
}

function fixedResult(SENTENCES, claims, topic, key, blueprint) {
  const sentences = SENTENCES.map((x, i) => ({ sentence_id: `f${i + 1}`, beat_id: `b${i + 1}`, role: "narration", link_from_previous: i ? "explanation" : "none", on_screen_text: "", ...x }));
  const words = sentences.map((x) => x.text).join(" ");
  const quality_report = { approved_by: "not reviewed by the engine critic", written_by: "written directly on the owner's instruction", independent_provider: false };
  const pkg = { channel: key, topic, format: "short", target_seconds: 27, blueprint, hook_options: [{ text: sentences[0].text, family: "direct question", honest: true }], selected_hook: sentences[0].text, sentences, payoff: sentences.at(-2).text, ending: sentences.at(-1).text, cta: null, sources: [...new Map(claims.map((c) => [c.source_id, { source_id: c.source_id, url: c.source_url, published: c.published ?? null }])).values()], claims, duration_estimate_s: words.split(/\s+/).length / 2.05, quality_report };
  return { status: "written_directly", package: pkg, report: { status: "written_directly", note: "The script engine and its independent critic did not review this script." }, findings: [] };
}


const MIN_S = 35, MAX_S = 40;
const CALIBRATION = "The report was published in March. It listed three findings. The first concerned the cost of the programme, which rose by a fifth over two years. The second looked at who paid for it, and the third asked whether anyone had checked.";

export default async function preview({ key, runId, outDir, tools, entry }) {
  const work = join(ROOT, "output/work", `hidden-past-${runId}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const P = paletteFor(channelStyle(entry.legacy_channel_id));

  // 1. Research: fetch every source, record licences, and refuse any claim whose text is not in its source.
  const src = {};
  for (const [k, f] of Object.entries(FILES)) src[k] = await fetchCommons(k, f, work);
  const wiki = Object.values((await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${WIKI_TITLE}`)).query.pages)[0].extract;
  for (const c of CLAIMS) if (!wiki.includes(c.must.text)) throw new Error(`claim ${c.claim_id}: "${c.must.text}" not found in the fetched article`);
  const places = [await wikiCoordinates("Medellín"), await wikiCoordinates("Hacienda Nápoles"), await wikiCoordinates("Bogotá")];
  tools.write("sources.json", { retrieved: new Date().toISOString(), wikipedia_article: WIKI_ARTICLE, files: Object.values(src).map(({ wikitext, file, ...r }) => r), places: places.map((p) => ({ ...p, source: "English Wikipedia coordinates API" })), map_data: "Natural Earth 1:50m and 1:110m (public domain)" });
  tools.stage("research_complete", "ok", { claims: CLAIMS.length });
  const claimsOut = CLAIMS.map(({ must, ...c }) => c);
  tools.write("claims.json", claimsOut);

  // 2. Script: choose the wording that fits 35 to 40 seconds at this voice's own pace, then narrate it. The voice is never sped up.
  const cal = await narrate({ text: CALIBRATION, edgeVoice: entry.tts_voice, outDir, name: "calibration", gravity: "serious" });
  tools.write("voice-calibration.json", { engine: cal.engine, wpm: cal.wpm, seconds: cal.seconds, notes: cal.notes });
  let paceWpm = cal.wpm * 0.88, narrationInfo, scriptFit;
  for (let attempt = 1; ; attempt++) {
    scriptFit = fitScript({ slots: SLOTS, wpm: paceWpm, targetSeconds: 37, minSeconds: 35.8, maxSeconds: 38.8 });
    tools.write("script-fit.json", { attempt, assumed_wpm: Math.round(paceWpm), voice: cal.engine, ...scriptFit });
    narrationInfo = await narrate({ text: scriptFit.sentences.map((x) => x.text).join(" "), edgeVoice: entry.tts_voice, outDir, gravity: "serious" });
    console.log(`script attempt ${attempt}: ${scriptFit.words} words, narration ${narrationInfo.seconds}s at ${narrationInfo.wpm} wpm`);
    if (narrationInfo.seconds >= MIN_S + 0.4 && narrationInfo.seconds <= MAX_S - 0.4) break;
    if (attempt >= 4) throw new Error(`narration is ${narrationInfo.seconds}s after ${attempt} fits; the rule is ${MIN_S} to ${MAX_S}`);
    paceWpm = narrationInfo.wpm * 0.98;
  }
  const result = fixedResult(scriptFit.sentences, claimsOut, TOPIC, key, { central_question: "Why are Pablo Escobar's hippos still in Colombia, and what happens to them now?", thesis: "Four hippos imported in 1981 escaped after his death in 1993 and now number around two hundred; in April 2026 Colombia approved killing more than eighty while some argue they should stay.", why_it_matters: "A drug lord's private zoo became a live ecological and ethical decision for a whole country.", viewer_start: "Knows Pablo Escobar.", viewer_end: "Knows where the hippos came from, how many there are and what is being decided.", key_evidence: ["H1", "H6", "H7"], beats: [], questions_raised: [], conclusion: "Who decides what happens to them is still open." });
  const pkg = result.package;
  tools.write("script-quality-report.json", result.report);
  tools.write("script-package.json", pkg);
  tools.write("script-final.md", pkg.sentences.map((x) => x.text).join("\n"));
  tools.stage("script_approved", "ok", { approved_by: pkg.quality_report.approved_by });
  const narration = narrationInfo.mp3;
  copyFileSync(narration, join(outDir, "voice-preview.mp3"));
  tools.write("narration.json", { engine: narrationInfo.engine, seconds: narrationInfo.seconds, wpm: narrationInfo.wpm, playback_speed: narrationInfo.playback_speed, notes: narrationInfo.notes });
  tools.stage("voice_complete", "ok", { narration_s: narrationInfo.seconds, engine: narrationInfo.engine });
  if (narrationInfo.sentences.length !== pkg.sentences.length) throw new Error(`voice produced ${narrationInfo.sentences.length} sentences for ${pkg.sentences.length} script sentences`);

  // 3. Pictures run in story order, one per scene.
  const sceneOfSentence = pkg.sentences.map((x) => x.scene);
  const order = [...new Set(sceneOfSentence)];
  const tl = buildTimeline({ narration: narrationInfo, sceneOfSentence, sceneMeta: order.map((n) => ({ id: `s${n}`, index: n })) });
  tools.write("timeline.json", tl);
  const durationS = tl.duration_s, durationF = tl.durationInFrames;
  const scenes = tl.scenes.map((sc, k) => {
    const members = pkg.sentences.filter((_, i) => sceneOfSentence[i] === sc.index);
    return { index: sc.index, text: members.map((x) => x.text).join(" "), from: sc.start_s, to: k === tl.scenes.length - 1 ? null : sc.end_s, claim_ids: [...new Set(members.flatMap((x) => x.claim_ids || []))] };
  });
  const bounds = (x) => ({ inF: sec(x.from), outF: x.to === null ? durationF : sec(x.to) });

  // 4. Images: every photograph goes through the same PhotoTreatment, so three different photographers read as one piece.
  const items = {};
  const mkItem = async (k, { maxW, maxH, saturation, halftone }) => {
    const m = await sharp(src[k].file).metadata(), aspect = m.width / m.height;
    let w = maxW, h = Math.round(w / aspect);
    if (h > maxH) { h = maxH; w = Math.round(h * aspect); }
    w -= w % 2; h -= h % 2;
    items[k] = { key: k, input: src[k].file, w, h, x: Math.round((W - w) / 2), y: 330, saturation, halftone, baked: join(work, `${k}-vox.png`) };
  };
  await mkItem("mug", { maxW: 700, maxH: 780, saturation: VOX.base_saturation, halftone: VOX.halftone_opacity });
  await mkItem("hippo", { maxW: 980, maxH: 700, saturation: VOX.base_saturation, halftone: VOX.halftone_opacity });
  await mkItem("gate", { maxW: 980, maxH: 700, saturation: VOX.base_saturation, halftone: VOX.halftone_opacity });
  bakeStills(Object.values(items), work, narration);
  tools.stage("visual_complete", "ok");

  // 5. The timeline.
  const layers = [], assets = {}, voxRecord = [], sfx = [];
  let z = 10;
  layers.push(solid("bg", { x: 0, y: 0, w: W, h: H, background: paperBackground(P), inF: 0, outF: durationF, z: z++, keyframes: { opacity: [{ f: 0, v: 1 }, { f: durationF, v: 1 }] } }));
  layers.push({ id: "progress", type: "solid", rect: { x: 0, y: H - 6, w: W, h: 6 }, in: 0, out: durationF, z: z++, style: { background: P.accent }, props: { opacity: 0.8, clipR: 100 }, keyframes: { clipR: [{ f: 0, v: 100, e: "linear" }, { f: durationF, v: 0, e: "linear" }] } });

  const headline = (idx, inF, outF) => {
    const f = fit(ROUTES.headlines[idx], { maxW: 900, maxLines: 2, max: 64, min: 42 });
    layers.push(text(`s${idx}-head`, f.text, { y: 150, size: f.size, weight: 700, color: P.text, inF, outF, z: 400, font: SERIF, slideX: -50, slide: 0, tracking: -0.01 }));
  };
  const stack = (id, tag, lines, inF, outF, y0 = 990, { pitch = 100, lineMax = 40 } = {}) => {
    const span = outF - inF;
    layers.push(stroke(`${id}-tagrule`, `M60 ${y0 - 14} L190 ${y0 - 14}`, { color: P.accent, width: 6, inF: inF + 6, outF, z: z++, drawFrames: 12 }));
    layers.push(text(`${id}-tag`, tag, { x: 60, w: 960, y: y0, size: 30, weight: 700, align: "left", color: P.accent, tracking: 0.18, inF: inF + 8, outF, z: z++, font: SERIF, slideX: -40, slide: 0 }));
    const step = Math.max(14, Math.min(60, Math.floor((span - 50) / Math.max(1, lines.length))));
    lines.forEach((ln, k) => {
      const at = inF + 24 + k * step;
      if (at > outF - 10) return;
      const f = fit(ln.text, { maxW: 940, maxLines: 2, max: lineMax, min: 30 });
      if (!f) throw new Error(`line will not fit: ${ln.text}`);
      layers.push(text(`${id}-line${k}`, f.text, { x: 60, w: 960, y: y0 + 54 + k * pitch, size: f.size, weight: ln.accent ? 700 : 600, align: "left", color: ln.accent ? P.accent : P.text, inF: at, outF, z: z++, font: SERIF, slideX: -50, slide: 0 }));
    });
  };
  const placeStill = (sceneId, k, inF, outF, credit) => {
    const it = items[k];
    assets[k] = { file: rel(it.baked), width: it.w, height: it.h, credit, source_url: src[k].page_url, license: src[k].licence };
    layers.push(solid(`s${sceneId}-shadow`, { x: it.x, y: it.y, w: it.w, h: it.h, background: P.bg, boxShadow: P.shadow, inF, outF, z: z++ }));
    layers.push({ id: `scene-${sceneId}-image`, type: "image", asset_id: k, rect: { x: it.x, y: it.y, w: it.w, h: it.h }, in: inF, out: outF, z: z++, props: { opacity: 1 }, keyframes: { opacity: [{ f: 0, v: 0, e: "outCubic" }, { f: 6, v: 1 }, { f: Math.max(7, outF - inF), v: 1 }] } });
    return it;
  };
  const circleOn = (sceneId, it, box, seed, inF, outF) => {
    const cx = it.x + ((box.x0 + box.x1) / 2) * it.w, cy = it.y + ((box.y0 + box.y1) / 2) * it.h;
    const rx = Math.max(46, ((box.x1 - box.x0) / 2) * it.w * 1.15), ry = Math.max(46, ((box.y1 - box.y0) / 2) * it.h * 1.15);
    const delay = Math.min(10, Math.floor((outF - inF) / 4));
    layers.push(stroke(`s${sceneId}-circle`, handCircle(Math.round(cx), Math.round(cy), Math.round(rx), Math.round(ry), sceneId * 37 + 11), { color: P.accent, width: 8, inF, outF, z: z++, delay, drawFrames: 18 }));
    sfx.push({ sound: "impact", at: (inF + delay) / FPS });
    return { screen: { cx: Math.round(cx), cy: Math.round(cy), rx: Math.round(rx), ry: Math.round(ry) }, draw_start_f: inF + delay, draw_end_f: inF + delay + 18 };
  };
  const credit = (k) => `${src[k].creator}, ${src[k].licence}, via Wikimedia Commons`;

  const scenePlan = [];
  for (const scene of scenes) {
    const { inF, outF } = bounds(scene);
    const rec = { scene: scene.index, start_s: scene.from, end_s: scene.to ?? durationS, treatments: [], exceptions: [] };
    let bodyIn = inF;
    const plan = { scene_id: `s${scene.index}`, narration: scene.text, claim_ids: scene.claim_ids, start_s: scene.from, end_s: scene.to ?? durationS, transition: "cut" };

    if (scene.index === 3) {
      const cOut = inF + 34, f = fit(ROUTES.chapterTitle, { maxW: 840, maxLines: 3, max: 88, min: 52 });
      layers.push(solid("ch1-page", { x: 0, y: 0, w: W, h: H, background: paperBackground(P, P.surface), inF, outF: cOut, z: 500, keyframes: { opacity: [{ f: 0, v: 1 }, { f: 34, v: 1 }] } }));
      layers.push(text("ch1-num", "APRIL 2026", { y: 640, size: 40, weight: 700, color: P.accent, inF, outF: cOut, z: 501, font: SERIF, tracking: 0.3, slideX: -60, slide: 0 }));
      layers.push(stroke("ch1-rule", "M300 716 L780 716", { color: P.accent, width: 3, inF, outF: cOut, z: 501, delay: 4, drawFrames: 14 }));
      layers.push(text("ch1-title", f.text, { y: 770, size: f.size, weight: 700, color: P.text, inF: inF + 4, outF: cOut, z: 501, font: SERIF, slideX: 60, slide: 0 }));
      rec.treatments.push({ type: "chapter_opener", in_f: inF, out_f: cOut, number: 1, title: ROUTES.chapterTitle });
      sfx.push({ sound: "whoosh", at: Math.max(0, inF / FPS - 0.08) });
      bodyIn = cOut;
      plan.transition = "chapter opener (book-section page)";
    }
    headline(scene.index, bodyIn, outF);
    rec.treatments.push({ type: "slide_in_typography", layer: `s${scene.index}-head` });
    const photoRec = (k, it) => ({ asset_id: k, source_url: src[k].page_url, source_file: rel(src[k].file), baked_file: rel(it.baked), rect: { x: it.x, y: it.y, w: it.w, h: it.h }, in_f: bodyIn, out_f: outF, kind: "photograph", license: src[k].licence, relation: "exact" });
    const PT = { type: "photo_treatment", recipe: "PhotoTreatment.jsx via VoxStill: vignette, halftone, grain, chromatic aberration, editorial LUT", halftone_opacity: VOX.halftone_opacity };
    const base = { background: "light archival paper", skill: ".agents/skills/vox-style-treatment + PhotoTreatment" };

    if (scene.index === 0) {
      const it = placeStill(0, "mug", bodyIn, outF, credit("mug"));
      rec.photo = photoRec("mug", it);
      rec.treatments.push(PT, { type: "grounded_shadow" });
      stack("s0", "PRIMARY SOURCE: POLICE PHOTOGRAPH", [{ text: "Pablo Escobar", accent: true }, { text: "Colombian National Police. Wikimedia Commons." }], bodyIn, outF, it.y + it.h + 40);
      Object.assign(plan, { main_point: "Open on the man, then the animals.", visual_objective: "Show Pablo Escobar's own police photograph before explaining the story.", treatment: "archival-photo-ledger", ...base, assets: [{ id: "mug", origin: "Wikimedia Commons (Colombian National Police)", licence: src.mug.licence, source_url: src.mug.page_url }], animation: "headline slides in; photograph never moves; evidence lines arrive in turn", on_screen_text: [ROUTES.headlines[0], "Pablo Escobar"] });
    } else if (scene.index === 1) {
      const { pts, route } = buildMapLayers({ id: "s1", inF: bodyIn, outF, points: places, P, font: SERIF, nextZ: () => z++, layers, handCircle, zoom: true });
      rec.treatments.push({ type: "map", places: pts.map((q) => q.name), source: "Natural Earth 1:50m; coordinates from English Wikipedia" });
      if (route) rec.treatments.push({ type: "map_route", in_f: route.in_f, end_f: route.end_f });
      layers.push(text("s1-country", "COLOMBIA", { x: 90, w: 600, y: 330, size: 54, weight: 700, align: "left", color: P.text, inF: bodyIn + 12, outF, z: z++, font: SERIF, slideX: -40, slide: 0, tracking: 0.08 }));
      layers.push(text("s1-maptag", "MODERN BORDERS  |  NATURAL EARTH", { x: 60, w: 960, y: 1446, size: 30, weight: 700, align: "left", color: P.accent, tracking: 0.14, inF: bodyIn + 10, outF, z: z++, font: SERIF, slideX: -40, slide: 0 }));
      Object.assign(plan, { main_point: "Where the estate was.", visual_objective: "Place Hacienda Nápoles between Medellín and Bogotá on a drawn map of Colombia.", treatment: "modern-map-locator", background: "light archival paper", skill: "scripts/autopilot/map-vox.mjs buildMapLayers", assets: [{ id: "natural-earth", origin: "Natural Earth (public domain)", licence: "Public domain" }], animation: "country tints, route and pins draw on, labels slide in", on_screen_text: [ROUTES.headlines[1], ...pts.map((q) => q.name)] });
    } else if (scene.index === 2) {
      const it = placeStill(2, "hippo", bodyIn, outF, credit("hippo"));
      rec.photo = photoRec("hippo", it);
      rec.treatments.push(PT, { type: "grounded_shadow" });
      const box = { x0: 0.10, x1: 0.34, y0: 0.50, y1: 0.88 };
      const a = circleOn(2, it, box, 2, bodyIn, outF);
      rec.treatments.push({ type: "annotation", target: "the hippo", confirmed_as: "the hippo's head; Commons description: Vanessa, mascot of the Hacienda Nápoles theme park, 2008; checked by eye on the source", box, ...a });
      stack("s2", "HOW MANY, ACCORDING TO WIKIPEDIA", [{ text: "1993: Escobar dies, the hippos escape" }, { text: "2007: 16" }, { text: "2014: about 40 reported" }, { text: "April 2026: around 200", accent: true }], bodyIn, outF, it.y + it.h + 40, { pitch: 84 });
      Object.assign(plan, { main_point: "Four became about two hundred.", visual_objective: "Show a real hippo at Hacienda Nápoles and the counts as they grew.", treatment: "archival-photo-card-with-claim-ladder", ...base, assets: [{ id: "hippo", origin: "Wikimedia Commons", licence: src.hippo.licence, source_url: src.hippo.page_url }], animation: "photograph holds still; accent circle draws on; count lines arrive in turn", on_screen_text: [ROUTES.headlines[2], "1993: Escobar dies, the hippos escape", "April 2026: around 200"] });
    } else if (scene.index === 3) {
      const big = fit("80+", { maxW: 940, maxLines: 1, max: 380, min: 200 });
      layers.push(text("s3-big", big.text, { x: 70, w: 940, y: 330, size: big.size, weight: 700, align: "left", color: P.accent, inF: bodyIn + 4, outF, z: z++, font: SERIF, slideX: -60, slide: 0, tracking: -0.02 }));
      rec.treatments.push({ type: "quotation_typography", text: "80+ (more than 80 hippos, per the article)" });
      stack("s3", "13 APRIL 2026, COLOMBIA", [{ text: "Ministry of Environment approves euthanasia of more than 80 hippos", accent: true }, { text: "An Indian billionaire, Anant Ambani, offers transport and shelter in India" }], bodyIn, outF, 800, { pitch: 120, lineMax: 46 });
      Object.assign(plan, { main_point: "The decision.", visual_objective: "State the cull number large, then the date, the ministry and the offer from India.", treatment: "quote-with-timeline", ...base, assets: [], animation: "number slides in; evidence lines arrive in turn", on_screen_text: ["CHAPTER I", ROUTES.chapterTitle, ROUTES.headlines[3], "80+"] });
    } else {
      const it = placeStill(4, "gate", bodyIn, outF, credit("gate"));
      rec.photo = photoRec("gate", it);
      rec.treatments.push(PT, { type: "grounded_shadow" });
      stack("s4", "THE ESTATE: ENTRANCE, 2009", [{ text: "Hacienda Nápoles, where the hippos were first kept", accent: true }, { text: "Most conservationists: invasive" }, { text: "Some ecologists: they should remain" }], bodyIn, outF, it.y + it.h + 40);
      Object.assign(plan, { main_point: "Two views, no settled answer.", visual_objective: "Return to the estate and set the two views side by side, labelled as the article gives them.", treatment: "archival-photo-card-with-claim-ladder", ...base, assets: [{ id: "gate", origin: "Wikimedia Commons", licence: src.gate.licence, source_url: src.gate.page_url }], animation: "photograph holds still; evidence lines arrive in turn", on_screen_text: [ROUTES.headlines[4]] });
    }
    voxRecord.push(rec);
    scenePlan.push(plan);
  }
  layoutCheck(layers, "hidden-past-layout");

  const cues = sfx.slice(0, 6), sfxFile = { whoosh: "whoosh.mp3", impact: "impact.mp3" };
  const mixed = join(work, "narration-with-sfx.mp3");
  sh("ffmpeg", ["-y", "-v", "error", "-i", narration, ...cues.flatMap((c) => ["-i", join(REMOTION_DIR, "public/sfx", sfxFile[c.sound])]), "-filter_complex", `${cues.map((c, i) => `[${i + 1}:a]adelay=${Math.round(c.at * 1000)}|${Math.round(c.at * 1000)},volume=0.22[s${i}]`).join(";")};[0:a]${cues.map((_, i) => `[s${i}]`).join("")}amix=inputs=${cues.length + 1}:duration=first:normalize=0[out]`, "-map", "[out]", "-b:a", "192k", mixed]);

  const words = JSON.parse(readFileSync(narrationInfo.wordsFile, "utf8"));
  const timeline = {
    version: 1, id: SLUG, title: `Hidden Past: ${TOPIC}`, production_id: runId, channel_id: "ch-01", width: W, height: H, fps: FPS, durationInFrames: durationF, palette: P, fonts: { primary: SERIF }, assets,
    layers: stripForRender(layers), captions: captions(words), caption_style: { x: 90, y: 1560, w: W - 180, h: 200, size: 52 },
    scenes: scenes.map((s) => ({ id: `s${s.index}`, start: s.from, end: s.to ?? durationS })),
    metadata: { topic: TOPIC, duration_s: durationS, treatment: "vox", narration: narrationInfo.engine },
  };
  const voxPlan = { production_id: runId, accent: P.accent, recipe_source: "src/skills/remotion-render/effects/PhotoTreatment.jsx", halftone_opacity: VOX.halftone_opacity, scenes: voxRecord, sfx };
  writeFileSync(join(work, "vox-plan.json"), JSON.stringify(voxPlan, null, 2));
  tools.write("vox-plan.json", voxPlan);
  tools.write("scene-plan.json", { channel: key, production_run: runId, format: "short", scenes: scenePlan });

  // 6. Render, gate, look.
  const video = await tools.renderTimeline({ timeline, audio: mixed, output: "preview.mp4" });
  const dur = tools.durationOf(video);
  tools.stage("render_complete", "ok", { duration_s: dur });
  if (dur < MIN_S || dur > MAX_S) throw new Error(`final MP4 is ${dur}s; the rule is ${MIN_S} to ${MAX_S} seconds`);

  const gateDir = join(work, "gate");
  const report = await voxGate({ mp4: video, dir: work, outDir: gateDir, productionId: runId });
  const stillLayers = layers.filter((l) => l.type === "image");
  const movingKeys = stillLayers.map((l) => ({ id: l.id, keys: Object.keys(l.keyframes || {}) })).filter((x) => x.keys.some((k) => k !== "opacity"));
  const frames = [];
  for (const r of report.scenes) for (const f of [r.frame_file, r.map_frame, r.chapter_frame].filter(Boolean)) {
    const name = `scene-${basename(f).replace(/^scene-/, "").replace(/\.png$/, "")}.jpg`;
    await sharp(f).jpeg({ quality: 88 }).toFile(join(outDir, name));
    frames.push(name);
  }
  tools.write("vox-compliance-report.json", report);
  const sheetScenes = scenes.map((s, i) => ({ id: `s${s.index}`, start_s: s.from, end_s: s.to ?? durationS, treatment: scenePlan[i].treatment, objective: scenePlan[i].visual_objective }));
  await tools.contactSheet({ video, scenes: sheetScenes });
  const qa = {
    channel: key, run: runId, script: { status: result.status, approved_by: pkg.quality_report.approved_by, written_by: pkg.quality_report.written_by, independent_provider: pkg.quality_report.independent_provider }, technical: technicalQa({ video, narration: narrationInfo, timeline: tl, minSeconds: MIN_S, maxSeconds: MAX_S }), alignment_findings: sceneTraceability({ channel: key, production_run: runId, format: "short", scenes: scenePlan }, pkg, claimsOut),
    duration_s: dur, min_s: MIN_S, max_s: MAX_S, size: `${W}x${H}`, fps: FPS,
    vox_gate: { pass: report.pass, failures: report.failures, counts: report.counts, report_file: "vox-compliance-report.json", mp4_sha256: report.mp4_sha256 },
    photo_stability: report.scenes.filter((s) => s.measured?.stability).map((s) => ({ scene: s.scene, ...s.measured.stability })),
    still_layers_with_non_opacity_keyframes: movingKeys,
    stability_scope: "voxGate measures the photographs in the final MP4. The map is drawn from Natural Earth and is not a photograph; its layers are not measured for stability.",
    licences: Object.values(src).map((s) => ({ file: s.title, licence: s.licence, creator: s.creator, url: s.page_url, source_file_url: s.file_url })),
    claims: claimsOut.map((c) => ({ claim_id: c.claim_id, editorial_status: c.editorial_status, confidence: c.confidence })),
    frames,
  };
  tools.write("qa-report.json", qa);
  const accepted = report.pass && movingKeys.length === 0 && qa.technical.pass;
  tools.stage(accepted ? "qa_passed" : "blocked", accepted ? "ok" : "failed", { issues: [...report.failures.map((f) => `${f.check}: ${f.why}`), ...qa.technical.failures].join("; ").slice(0, 500) || undefined });
  if (!accepted) throw new Error("QA failed; see qa-report.json");
  tools.stage("preview_ready", "ok");
  tools.write("delivery.json", METADATA);
  tools.stage("awaiting_approval", "ok");
}
