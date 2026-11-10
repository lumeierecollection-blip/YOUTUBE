/**
 * Hidden Past preview: one real Short from Wikimedia Commons material, rendered on GitHub.
 * Narration is PROVISIONAL (hand-planned sample, not from the script engine).
 *
 * Reused unedited: scripts/autopilot/{map-vox,vox-gate,visual-common}.mjs, tools.renderTimeline and the
 * repo's PhotoTreatment through the VoxStill composition (baked the same way bakeStills in
 * scripts/autopilot/hidden-past.mjs bakes them, gamma restored the same way).
 * Added here: the newspaper/document treatment and the dated historical map scene.
 */
import { spawnSync } from "node:child_process";
import { METADATA, SENTENCES as FIXED_SENTENCES } from "./vox-berlin-story.mjs";
const USE_FIXED = true;
import { runEngine } from "../../script-engine/engine.mjs";
import { liveLLM } from "../../script-engine/llm.mjs";
import { sceneTraceability } from "../../script-engine/traceability.mjs";
import { buildTimeline, narrate, technicalQa } from "../../production/index.mjs";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
import { FPS, H, W, captions, channelStyle, fit, layoutCheck, paletteFor, paperBackground, sec, solid, stripForRender, stroke, text } from "../../../scripts/autopilot/visual-common.mjs";
import { buildMapLayers } from "../../../scripts/autopilot/map-vox.mjs";
import { voxGate } from "../../../scripts/autopilot/vox-gate.mjs";
import { CLAIMS, FILES, ROUTES, SENTENCES, SLUG, TOPIC, WIKI_ARTICLE } from "./vox-berlin-story.mjs";

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

export default async function preview({ key, runId, outDir, tools, entry }) {
    const work = join(ROOT, "output/work", `hidden-past-${runId}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const P = paletteFor(channelStyle(entry.legacy_channel_id));

  // 1. Research: fetch every source, record licences, and refuse any claim whose text is not in its source.
  const src = {};
  for (const [k, f] of Object.entries(FILES)) src[k] = await fetchCommons(k, f, work);
  const wiki = Object.values((await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=Fall_of_the_Berlin_Wall`)).query.pages)[0].extract;
  for (const c of CLAIMS) if (!wiki.includes(c.must.text)) throw new Error(`claim ${c.claim_id}: "${c.must.text}" not found in the fetched article`);
  const berlin = await wikiCoordinates("Berlin");
  const sarajevo = berlin;
  tools.write("sources.json", { retrieved: new Date().toISOString(), wikipedia_article: WIKI_ARTICLE, files: Object.values(src).map(({ wikitext, file, ...r }) => r), place: { ...sarajevo, source: "https://en.wikipedia.org/wiki/Sarajevo (coordinates API)" }, map_data: "Natural Earth 1:50m and 1:110m (public domain)" });
  tools.stage("research_complete", "ok", { claims: CLAIMS.length });

  // 2. The shared engine writes from the verified claims. Each claim belongs to one picture, so the citations place the sentences.
  const claimsOut = CLAIMS.map(({ must, ...c }) => c);
  tools.write("claims.json", claimsOut);
  process.env.MAX_TOKENS_PER_VIDEO ||= "2000000";
  const SCENE_OF_CLAIM = { c1: 0, c2: 1, c3: 2, c4: 3, c5: 4, c6: 4 };
  const calibration = USE_FIXED ? { engine: "skipped", wpm: 130, seconds: 0, notes: [] } : await narrate({ text: "The report was published in March. It listed three findings. The first concerned the cost of the programme, which rose by a fifth over two years. The second looked at who paid for it, and the third asked whether anyone had checked.", edgeVoice: entry.tts_voice, outDir, name: "calibration", gravity: "serious" });
  tools.write("voice-calibration.json", { engine: calibration.engine, wpm: calibration.wpm, seconds: calibration.seconds, notes: calibration.notes });
  let wpm = { wpm: calibration.wpm, source: "measured", voice: calibration.engine };
  const llm = liveLLM();
  const claimSources = [...new Map(claimsOut.map((c) => [c.source_id, { source_id: c.source_id, url: c.source_url, published: c.published ?? null }])).values()];
  let result, pkg, narrationInfo, attempt = 0;
  for (;;) {
    attempt++;
    result = USE_FIXED ? fixedResult(FIXED_SENTENCES, claimsOut, TOPIC, key, { central_question: "How did a press conference open the Berlin Wall's checkpoints?", thesis: "On 9 November 1989 a spokesman, handed a note and not fully briefed, said new travel rules took effect immediately; that night guards opened the checkpoints.", why_it_matters: "A turning point can hinge on one unprepared answer.", viewer_start: "Knows the Wall fell in 1989.", viewer_end: "Knows how the announcement went out and what followed.", key_evidence: ["B2", "B4", "B6"], beats: [], questions_raised: [], conclusion: "One unprepared answer opened the checkpoints." }) : await runEngine({
      channelKey: key, format: "short", topic: TOPIC, angle: "Tell it as one investigation, evidence first. Open at Sarajevo City Hall on 28 June 1914 with the couple's photograph. Place the city in today's country and in Austria-Hungary in 1914. Then the next day's newspaper. Then the famous arrest photograph, and what scholars say it really shows. End by answering whether the photograph shows Princip. Say plainly what is disputed. Seven or eight short spoken sentences.",
      claimResult: { claims: claimsOut, dropped: [], sources: claimSources }, llm, wpm, production_run: runId, profileOverrides: { minSeconds: 24, targetSeconds: 26.5, maxSeconds: 29 }, maxRevisions: 3,
      onProgress: (ev) => {
        if (ev.event === "blueprint") { tools.write("blueprint.json", ev.blueprint); tools.write("story-outline.md", `# Blueprint\n\nCentral question: ${ev.blueprint.central_question}\n\nThesis: ${ev.blueprint.thesis}\n\nConclusion: ${ev.blueprint.conclusion}\n`); tools.stage("blueprint_complete", "ok"); }
        if (ev.event === "draft") { tools.write(`script-draft-round${ev.round}.md`, ev.pkg.sentences.map((x) => x.text).join("\n")); tools.write("script-draft.md", ev.pkg.sentences.map((x) => x.text).join("\n")); tools.stage("script_complete", "ok", { round: ev.round }); }
      },
    });
    tools.write("script-quality-report.json", result.report);
    if (!["approved", "written_directly"].includes(result.status)) { tools.write("open-findings.json", result.findings || []); throw new Error(`script engine: ${result.status}: ${JSON.stringify((result.findings || []).slice(0, 6).map((f) => `${f.rule}: ${f.problem}`)).slice(0, 700)} ${result.error || ""}`); }
    pkg = result.package;
    tools.write("script-package.json", pkg);
    if (result.report.last_critique) tools.write("critique.json", result.report.last_critique);
    tools.write("script-final.md", pkg.sentences.map((x) => x.text).join("\n"));
    tools.stage("script_approved", "ok", { approved_by: pkg.quality_report.approved_by });
    narrationInfo = await narrate({ text: pkg.sentences.map((x) => x.text).join(" "), edgeVoice: entry.tts_voice, outDir, gravity: "serious" });
    if (narrationInfo.seconds <= 29.3 && narrationInfo.seconds >= 23.5) break;
    // Too long or short at natural speed: the script changes, never the voice.
    wpm = { wpm: narrationInfo.wpm, source: "measured-from-narration", voice: narrationInfo.engine };
    if (attempt >= 3) throw new Error(`narration is ${narrationInfo.seconds}s after ${attempt} rewrites`);
  }
  const narration = narrationInfo.mp3;
  copyFileSync(narration, join(outDir, "voice-preview.mp3"));
  tools.write("narration.json", { engine: narrationInfo.engine, seconds: narrationInfo.seconds, wpm: narrationInfo.wpm, playback_speed: narrationInfo.playback_speed, notes: narrationInfo.notes });
  tools.stage("voice_complete", "ok", { narration_s: narrationInfo.seconds, engine: narrationInfo.engine });
  if (narrationInfo.sentences.length !== pkg.sentences.length) throw new Error(`voice produced ${narrationInfo.sentences.length} sentences for ${pkg.sentences.length} script sentences`);

  // Pictures run in story order: a sentence with no claim of its own stays on the picture before it.
  const picture = [];
  pkg.sentences.forEach((x, i) => {
    const cited = (x.claim_ids || []).map((c) => SCENE_OF_CLAIM[c]).filter((n) => n !== undefined);
    const prev = i ? picture[i - 1] : 0;
    if (x.scene !== undefined) { picture.push(x.scene); return; }
    picture.push(i === 0 ? 0 : cited.length ? Math.max(prev, Math.min(...cited.filter((n) => n >= prev).concat(4))) : prev);
  });
  const order = [...new Set(picture)];
  const sceneOfSentence = picture.map((n) => order.indexOf(n));
  const tl = buildTimeline({ narration: narrationInfo, sceneOfSentence, sceneMeta: order.map((n) => ({ id: `s${n}`, index: n })) });
  tools.write("timeline.json", tl);
  const durationS = tl.duration_s, durationF = tl.durationInFrames;
  const scenes = tl.scenes.map((sc, k) => {
    const members = pkg.sentences.filter((_, i) => sceneOfSentence[i] === k);
    return { index: sc.index, text: members.map((x) => x.text).join(" "), from: sc.start_s, to: k === tl.scenes.length - 1 ? null : sc.end_s, claim_ids: [...new Set(members.flatMap((x) => x.claim_ids || []))] };
  });
  const bounds = (x) => ({ inF: sec(x.from), outF: x.to === null ? durationF : sec(x.to) });

  // 4. Images: photographs through PhotoTreatment as they are; documents get the document treatment first.
  const paperTone = { r: 244, g: 236, b: 220 };
  const nytCrop = { x: 0.503, y: 0.116, w: 0.478, h: 0.279 };
  const items = {};
  const mkItem = async (k, { layout, maxW, maxH, docOpts, saturation, halftone }) => {
    let input = src[k].file, aspect;
    if (docOpts) {
      input = join(work, `${k}-doc.jpg`);
      const d = await treatDocument(src[k].file, input, docOpts);
      aspect = d.w / d.h;
    } else { const m = await sharp(src[k].file).metadata(); aspect = m.width / m.height; }
    let w = maxW, h = Math.round(w / aspect);
    if (h > maxH) { h = maxH; w = Math.round(h * aspect); }
    w -= w % 2; h -= h % 2;
    items[k] = { key: k, input, w, h, layout, x: layout === "ledger" ? 60 : Math.round((W - w) / 2), y: 330, saturation, halftone, baked: join(work, `${k}-vox.png`) };
  };
  await mkItem("press", { layout: "card", maxW: 980, maxH: 700, saturation: VOX.base_saturation, halftone: VOX.halftone_opacity });
  await mkItem("note", { layout: "card", maxW: 700, maxH: 880, docOpts: { paper: paperTone, greyscale: true, width: 1600 }, saturation: 1, halftone: 0.04 });
  await mkItem("gate", { layout: "card", maxW: 980, maxH: 650, saturation: VOX.base_saturation, halftone: VOX.halftone_opacity });
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
  /** Evidence block under a picture: a kind tag, then lines that arrive in turn. Accent lines tie to an annotation. */
  const stack = (id, tag, lines, inF, outF, y0 = 990) => {
    const span = outF - inF;
    layers.push(stroke(`${id}-tagrule`, `M60 ${y0 - 14} L190 ${y0 - 14}`, { color: P.accent, width: 6, inF: inF + 6, outF, z: z++, drawFrames: 12 }));
    layers.push(text(`${id}-tag`, tag, { x: 60, w: 960, y: y0, size: 30, weight: 700, align: "left", color: P.accent, tracking: 0.18, inF: inF + 8, outF, z: z++, font: SERIF, slideX: -40, slide: 0 }));
    const step = Math.max(16, Math.min(60, Math.floor((span - 50) / Math.max(1, lines.length))));
    lines.forEach((ln, k) => {
      const at = inF + 24 + k * step;
      if (at > outF - 10) return;
      const f = fit(ln.text, { maxW: 940, maxLines: 2, max: 40, min: 30 });
      if (!f) throw new Error(`line will not fit: ${ln.text}`);
      layers.push(text(`${id}-line${k}`, f.text, { x: 60, w: 960, y: y0 + 54 + k * 104, size: f.size, weight: ln.accent ? 700 : 600, align: "left", color: ln.accent ? P.accent : P.text, inF: at, outF, z: z++, font: SERIF, slideX: -50, slide: 0 }));
    });
  };
  /** Puts a still on the page with its shadow and returns what the gate needs. Never any scale or position keyframe. */
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

  const scenePlan = [];
  for (const scene of scenes) {
    const { inF, outF } = bounds(scene);
    const rec = { scene: scene.index, start_s: scene.from, end_s: scene.to ?? durationS, treatments: [], exceptions: [] };
    let bodyIn = inF;
    const plan = { scene_id: `s${scene.index}`, narration: scene.text, claim_ids: scene.claim_ids, start_s: scene.from, end_s: scene.to ?? durationS, transition: "cut" };

    headline(scene.index, bodyIn, outF);
    rec.treatments.push({ type: "slide_in_typography", layer: `s${scene.index}-head` });
    const credit = (k) => `${src[k].creator}, ${src[k].licence}, via Wikimedia Commons`;
    const photoRec = (k, it) => ({ asset_id: k, source_url: src[k].page_url, source_file: rel(src[k].file), baked_file: rel(it.baked), rect: { x: it.x, y: it.y, w: it.w, h: it.h }, in_f: bodyIn, out_f: outF, kind: "photograph", license: src[k].licence, relation: "exact" });
    const PT = { type: "photo_treatment", recipe: "PhotoTreatment.jsx via VoxStill: vignette, halftone, grain, chromatic aberration, editorial LUT", halftone_opacity: VOX.halftone_opacity };
    const base = { background: "light archival paper", skill: ".agents/skills/vox-style-treatment + PhotoTreatment" };

    if (scene.index === 0) {
      const it = placeStill(0, "press", bodyIn, outF, credit("press"));
      rec.photo = photoRec("press", it);
      rec.treatments.push(PT, { type: "grounded_shadow" });
      const box = { x0: 0.50, x1: 0.88, y0: 0.14, y1: 0.40 };
      const a = circleOn(0, it, box, 0, bodyIn, outF);
      rec.treatments.push({ type: "annotation", target: "the press-conference table", confirmed_as: "the officials' table at the front of the hall, per the Bundesarchiv caption (Schabowski at the press conference, 9 Nov 1989); checked by eye on the source", box, ...a });
      stack("s0", "PRIMARY SOURCE: PHOTOGRAPH", [{ text: "Circled: the officials' table", accent: true }, { text: "East Berlin, 9 November 1989. Bundesarchiv." }], bodyIn, outF, it.y + it.h + 40);
      Object.assign(plan, { main_point: "Open on the evidence itself.", visual_objective: "Show the real press conference before explaining it.", treatment: "archival-photo-ledger", ...base, assets: [{ id: "press", origin: "Wikimedia Commons (Bundesarchiv)", licence: src.press.licence, source_url: src.press.page_url }], animation: "headline slides in; accent circle draws on; photograph never moves", on_screen_text: [ROUTES.headlines[0], "Circled: the officials' table"] });
    } else if (scene.index === 1) {
      const it = placeStill(1, "note", bodyIn, outF, credit("note"));
      rec.treatments.push({ type: "document_treatment", recipe: "sharp greyscale ink + paper multiply, then PhotoTreatment at low halftone" }, { type: "grounded_shadow" });
      stack("s1", "PRIMARY SOURCE: HIS OWN NOTES", [{ text: "Handed to him just before the briefing", accent: true }, { text: "No instructions on how to handle it (Wikipedia)" }], bodyIn, outF, it.y + it.h + 40);
      Object.assign(plan, { main_point: "The paper he was handed.", visual_objective: "Show Schabowski's own note.", treatment: "newspaper-scan", ...base, assets: [{ id: "note", origin: "Wikimedia Commons", licence: src.note.licence, source_url: src.note.page_url }], animation: "page fades in unmoving; evidence lines arrive in turn", on_screen_text: [ROUTES.headlines[1], "HIS OWN NOTES"] });
    } else if (scene.index === 2) {
      const q = fit("“…immediately, without delay.”", { maxW: 940, maxLines: 3, max: 104, min: 64 });
      layers.push(text("s2-quote", q.text, { x: 70, w: 940, y: 360, size: q.size, weight: 700, align: "left", color: P.accent, inF: bodyIn + 4, outF, z: z++, font: SERIF, slideX: -60, slide: 0, tracking: -0.01 }));
      rec.treatments.push({ type: "quotation_typography", text: "As far as I know, it takes effect immediately, without delay (English rendering as given on Wikipedia)" });
      stack("s2", "THE EVENING, 9 NOVEMBER 1989", [{ text: "18:00  Press conference begins, live on TV", accent: false }, { text: "18:53  Asked when the new rules start", accent: false }, { text: "19:04  West German agency: borders open", accent: true }], bodyIn, outF, 780);
      Object.assign(plan, { main_point: "The answer, and the broadcast.", visual_objective: "Quote his answer and show the evening's timed events.", treatment: "quote-with-timeline", ...base, assets: [], animation: "quotation slides in; timeline lines arrive in turn", on_screen_text: [ROUTES.headlines[2], "THE EVENING, 9 NOVEMBER 1989"] });
    } else if (scene.index === 3) {
      const { pts } = buildMapLayers({ id: "s3", inF: bodyIn, outF, points: [berlin], P, font: SERIF, nextZ: () => z++, layers, handCircle });
      rec.treatments.push({ type: "map", places: pts.map((q) => q.name), source: "Natural Earth 1:50m; coordinates from Wikipedia" });
      layers.push(text("s3-maptag", "MODERN BORDERS  |  NATURAL EARTH", { x: 60, w: 960, y: 1446, size: 30, weight: 700, align: "left", color: P.accent, tracking: 0.14, inF: bodyIn + 10, outF, z: z++, font: SERIF, slideX: -40, slide: 0 }));
      Object.assign(plan, { main_point: "Where it happened.", visual_objective: "Locate Berlin on today's map.", treatment: "modern-map-locator", background: "light archival paper", skill: "scripts/autopilot/map-vox.mjs buildMapLayers", assets: [{ id: "natural-earth", origin: "Natural Earth (public domain)", licence: "Public domain" }], animation: "country tints, pin and ring draw on, labels slide in", on_screen_text: [ROUTES.headlines[3], "Berlin"] });
    } else {
      const it = placeStill(4, "gate", bodyIn, outF, credit("gate"));
      rec.photo = photoRec("gate", it);
      rec.treatments.push(PT, { type: "grounded_shadow" });
      stack("s4", "LATER PHOTOGRAPH: DECEMBER 1989", [{ text: "Brandenburg Gate, weeks after that night", accent: true }, { text: "22:45 at Bornholmer Straße (some accounts: 23:30)" }], bodyIn, outF, it.y + it.h + 40);
      Object.assign(plan, { main_point: "The checkpoints opened.", visual_objective: "Show the aftermath, labelled as a later photograph.", treatment: "archival-photo-card-with-claim-ladder", ...base, assets: [{ id: "gate", origin: "Wikimedia Commons", licence: src.gate.licence, source_url: src.gate.page_url }], animation: "photograph holds still; evidence lines arrive in turn", on_screen_text: [ROUTES.headlines[4], "LATER PHOTOGRAPH: DECEMBER 1989"] });
    }
    voxRecord.push(rec);
    scenePlan.push(plan);
  }
  layoutCheck(layers, "hidden-past-layout");

  // Sound: the repo's own whoosh and impact, mixed under the voice at the cues.
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
  if (dur > 30) throw new Error(`final MP4 is ${dur}s; a Short is at most 30 s`);

  const gateDir = join(work, "gate");
  const report = await voxGate({ mp4: video, dir: work, outDir: gateDir, productionId: runId });
  const stillLayers = layers.filter((l) => l.type === "image");
  const movingKeys = stillLayers.map((l) => ({ id: l.id, keys: Object.keys(l.keyframes || {}) })).filter((x) => x.keys.some((k) => k !== "opacity"));
  const frames = [];
  for (const r of report.scenes) for (const f of [r.frame_file, r.map_frame, r.chapter_frame].filter(Boolean)) {
    const name = `scene-${basename(f).replace(/^scene-/, "").replace(/\.png$/, "")}.jpg`.replace("scene-map-", "scene-map-").replace("scene-chapter-", "scene-chapter-");
    await sharp(f).jpeg({ quality: 88 }).toFile(join(outDir, name));
    frames.push(name);
  }
  tools.write("vox-compliance-report.json", report);
  const sheetScenes = scenes.map((s, i) => ({ id: `s${s.index}`, start_s: s.from, end_s: s.to ?? durationS, treatment: scenePlan[i].treatment, objective: scenePlan[i].visual_objective }));
  await tools.contactSheet({ video, scenes: sheetScenes });
  const qa = {
    channel: key, run: runId, script: { status: result.status, approved_by: pkg.quality_report.approved_by, written_by: pkg.quality_report.written_by, independent_provider: pkg.quality_report.independent_provider }, technical: technicalQa({ video, narration: narrationInfo, timeline: tl }), alignment_findings: sceneTraceability({ channel: key, production_run: runId, format: "short", scenes: scenePlan }, pkg, claimsOut),
    duration_s: dur, max_s: 30, size: `${W}x${H}`, fps: FPS,
    vox_gate: { pass: report.pass, failures: report.failures, counts: report.counts, report_file: "vox-compliance-report.json", mp4_sha256: report.mp4_sha256 },
    photo_stability: report.scenes.filter((s) => s.measured?.stability).map((s) => ({ scene: s.scene, asset: s.treatments.find((t) => t.type === "photo_treatment") ? "photograph" : "", ...s.measured.stability })),
    still_layers_with_non_opacity_keyframes: movingKeys,
    stability_scope: "voxGate measures the two archival photographs in the final MP4. The newspaper and the historical map are documents, not photographs: the gate does not measure them, and their layers are asserted static above (no keyframe other than opacity).",
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
