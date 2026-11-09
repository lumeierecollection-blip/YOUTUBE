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
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
import { FPS, H, W, captions, channelStyle, fit, layoutCheck, paletteFor, paperBackground, sec, solid, stripForRender, stroke, text } from "../../../scripts/autopilot/visual-common.mjs";
import { buildMapLayers } from "../../../scripts/autopilot/map-vox.mjs";
import { voxGate } from "../../../scripts/autopilot/vox-gate.mjs";
import { CLAIMS, FILES, ROUTES, SENTENCES, SLUG, TOPIC, WIKI_ARTICLE } from "./story.mjs";

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
  if (licence !== "Public domain") throw new Error(`${f.title}: licence is "${licence}", not public domain`);
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
  const base = await p.toBuffer();
  const out2 = await sharp(base).composite([{ input: { create: { width: m2.width, height: m2.height, channels: 3, background: paper } }, blend: "multiply" }]).resize({ width }).sharpen({ sigma: 0.8 }).jpeg({ quality: 93 }).toBuffer();
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

export default async function preview({ key, runId, outDir, tools, entry }) {
  const work = join(ROOT, "output/work", `hidden-past-${runId}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const P = paletteFor(channelStyle(entry.legacy_channel_id));

  // 1. Research: fetch every source, record licences, and refuse any claim whose text is not in its source.
  const src = {};
  for (const [k, f] of Object.entries(FILES)) src[k] = await fetchCommons(k, f, work);
  const wiki = Object.values((await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent("Assassination of Archduke Franz Ferdinand")}`)).query.pages)[0].extract;
  const wikiSarajevo = Object.values((await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&format=json&titles=Sarajevo`)).query.pages)[0].extract;
  for (const c of CLAIMS) {
    const hay = c.must.from === "wiki" ? wiki : c.must.from === "wiki-sarajevo" ? wikiSarajevo : c.must.from === "commons-wikitext" ? src[c.must.file].wikitext : `${src[c.must.file].title} ${src[c.must.file].description}`;
    if (!hay.includes(c.must.text)) throw new Error(`claim ${c.claim_id}: "${c.must.text}" not found in ${c.must.from}`);
  }
  const sarajevo = await wikiCoordinates("Sarajevo");
  tools.write("sources.json", { retrieved: new Date().toISOString(), wikipedia_article: WIKI_ARTICLE, files: Object.values(src).map(({ wikitext, file, ...r }) => r), place: { ...sarajevo, source: "https://en.wikipedia.org/wiki/Sarajevo (coordinates API)" }, map_data: "Natural Earth 1:50m and 1:110m (public domain)" });
  tools.stage("research_complete", "ok", { claims: CLAIMS.length });

  // 2. Blueprint and script.
  const claimsOut = CLAIMS.map(({ must, ...c }) => c);
  const blueprint = {
    central_question: "A famous arrest photograph from Sarajevo, 1914: whose arrest does it show?",
    thesis: "The photograph is a primary source for the day, but its famous caption is a later interpretation that scholars dispute.",
    why_it_matters: "A widely reproduced caption can outlive the evidence for it.",
    viewer_start: "Knows the assassination happened in Sarajevo.", viewer_end: "Can tell what the 1914 sources show from what later captions claim.",
    key_evidence: ["c1", "c4", "c5"],
    beats: [
      { beat_id: "b1", role: "opening", purpose: "Evidence first: the photograph of the couple at the city hall.", claim_ids: ["c1"], link_from_previous: "none" },
      { beat_id: "b2", role: "context", purpose: "Where and under whose borders: modern map then dated map.", claim_ids: ["c2", "c3"], link_from_previous: "change_over_time" },
      { beat_id: "b3", role: "development", purpose: "The primary report of the day.", claim_ids: ["c4"], link_from_previous: "chronology" },
      { beat_id: "b4", role: "payoff", purpose: "The arrest photograph and what scholars say it shows.", claim_ids: ["c5", "c6"], link_from_previous: "contradiction" },
    ],
    questions_raised: [{ question: "Whose arrest does the photograph show?", raised_in: "b3", answered_in: "b4" }],
    conclusion: "The arrest photograph is real; its caption is the disputed part.",
  };
  const pkg = {
    provisional: "hand-planned sample, not from the script engine",
    channel: key, topic: TOPIC, format: "short", target_seconds: 28, blueprint,
    hook_options: [{ text: SENTENCES[0].text, family: "evidence-first cold open", honest: true }, { text: "A famous photograph. A caption scholars dispute.", family: "contradiction", honest: true }],
    selected_hook: SENTENCES[0].text,
    sentences: SENTENCES.map((s, i) => ({ sentence_id: s.id, beat_id: ["b1", "b2", "b2", "b3", "b4", "b4", "b4"][i], text: s.text, role: ["evidence", "context", "context", "primary report", "later interpretation", "later interpretation", "later interpretation"][i], claim_ids: s.claim_ids, link_from_previous: i ? "chronology" : "none" })),
    payoff: SENTENCES[5].text, ending: SENTENCES[6].text, cta: null,
    sources: [{ source_id: "src-couple", url: FILES.couple.page_url }, { source_id: "src-wiki", url: WIKI_ARTICLE }, { source_id: "src-wiki-sarajevo", url: "https://en.wikipedia.org/wiki/Sarajevo" }, { source_id: "src-map", url: FILES.map1914.page_url }, { source_id: "src-nyt", url: FILES.nyt.page_url, published: "1914-06-29" }, { source_id: "src-behr", url: FILES.behr.page_url }],
    claims: claimsOut, duration_estimate_s: 24, quality_report: { note: "not produced by the script engine; claims were string-checked against fetched sources" },
  };
  tools.write("script-package.json", pkg);
  tools.write("story-outline.md", `# Story outline (PROVISIONAL, hand-planned sample)\n\nStory: ${TOPIC}\n\n${blueprint.beats.map((b) => `- **${b.role}** (${b.beat_id}): ${b.purpose} Claims: ${b.claim_ids.join(", ")}`).join("\n")}\n\nThesis: ${blueprint.thesis}\n`);
  tools.write("script-draft.md", `# Script draft (PROVISIONAL narration: hand-planned sample, not from the script engine)\n\n${SENTENCES.map((s) => `- ${s.text}  \n  _claims: ${s.claim_ids.join(", ")}_`).join("\n")}\n\n## Claims\n\n${CLAIMS.map((c) => `- **${c.claim_id}** [${c.editorial_status}] ${c.claim}  \n  Source: ${c.source_url}  \n  Excerpt: "${c.excerpt}"${c.context ? `  \n  Context: ${c.context}` : ""}`).join("\n")}\n`);
  tools.stage("blueprint_complete", "ok");
  tools.stage("script_complete", "provisional");

  // 3. Voice: one take per sentence, so scene timing comes from the audio itself.
  let timing, narration;
  for (const rate of ["+0%", "+6%", "+12%", "+18%"]) {
    const files = SENTENCES.map((s, i) => tools.voice({ text: s.text, voice: entry.tts_voice, output: `.s${i}.mp3`, rate }));
    const durs = files.map((f) => tools.durationOf(f));
    const GAP = 0.12;
    narration = join(work, "narration.mp3");
    const filt = durs.map((d, i) => `[${i}:a]apad=pad_dur=${GAP},atrim=0:${(d + GAP).toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`).join(";") + `;${durs.map((_, i) => `[a${i}]`).join("")}concat=n=${durs.length}:v=0:a=1[out]`;
    sh("ffmpeg", ["-y", "-v", "error", ...files.flatMap((f) => ["-i", f]), "-filter_complex", filt, "-map", "[out]", "-b:a", "160k", narration]);
    let t = 0;
    timing = SENTENCES.map((s, i) => { const o = { ...s, start: t, end: t + durs[i] }; t += durs[i] + GAP; return o; });
    files.forEach((f) => rmSync(f, { force: true }));
    if (tools.durationOf(narration) <= 29.0) break;
    console.log(`narration ${tools.durationOf(narration)}s at rate ${rate}; retrying faster`);
  }
  const narrationS = tools.durationOf(narration);
  const durationS = Math.min(30, Math.ceil(narrationS + 0.6));
  if (narrationS > 29.4) throw new Error(`narration is ${narrationS}s; cannot fit a 30 s Short`);
  copyFileSync(narration, join(outDir, "voice-preview.mp3"));
  tools.stage("voice_complete", "ok", { narration_s: narrationS, narration: "provisional" });
  const durationF = sec(durationS);

  // Scenes: one per picture; consecutive sentences with the same scene id share it.
  const sceneIds = [...new Set(SENTENCES.map((s) => s.scene))];
  const scenes = sceneIds.map((id, k) => {
    const ss = timing.filter((s) => s.scene === id);
    return { index: id, text: ss.map((s) => s.text).join(" "), from: k === 0 ? 0 : ss[0].start, to: k === sceneIds.length - 1 ? null : timing.find((s) => s.scene === sceneIds[k + 1]).start, claim_ids: [...new Set(ss.flatMap((s) => s.claim_ids))] };
  });
  const bounds = (s) => ({ inF: sec(s.from), outF: s.to === null ? durationF : sec(s.to) });

  // 4. Images: photographs through PhotoTreatment as they are; documents get the document treatment first.
  const paperTone = { r: 244, g: 236, b: 220 };
  const nytCrop = { x: 0.49, y: 0.113, w: 0.505, h: 0.292 };
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
  await mkItem("couple", { layout: "ledger", maxW: 760, maxH: 820, saturation: VOX.base_saturation, halftone: VOX.halftone_opacity });
  await mkItem("map1914", { layout: "card", maxW: 960, maxH: 700, docOpts: { paper: paperTone, greyscale: false, width: 1920 }, saturation: 0.62, halftone: 0.035 });
  await mkItem("nyt", { layout: "card", maxW: 960, maxH: 760, docOpts: { crop: nytCrop, paper: paperTone, greyscale: true, width: 1920 }, saturation: 1, halftone: 0.04 });
  await mkItem("behr", { layout: "card", maxW: 960, maxH: 700, saturation: VOX.base_saturation, halftone: VOX.halftone_opacity });
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

    if (scene.index === 4) {
      const cOut = inF + 34, f = fit(ROUTES.chapterTitle, { maxW: 840, maxLines: 3, max: 88, min: 52 });
      layers.push(solid("ch1-page", { x: 0, y: 0, w: W, h: H, background: paperBackground(P, P.surface), inF, outF: cOut, z: 500, keyframes: { opacity: [{ f: 0, v: 1 }, { f: 34, v: 1 }] } }));
      layers.push(text("ch1-num", "CHAPTER I", { y: 640, size: 40, weight: 700, color: P.accent, inF, outF: cOut, z: 501, font: SERIF, tracking: 0.3, slideX: -60, slide: 0 }));
      layers.push(stroke("ch1-rule", "M300 716 L780 716", { color: P.accent, width: 3, inF, outF: cOut, z: 501, delay: 4, drawFrames: 14 }));
      layers.push(text("ch1-title", f.text, { y: 770, size: f.size, weight: 700, color: P.text, inF: inF + 4, outF: cOut, z: 501, font: SERIF, slideX: 60, slide: 0 }));
      rec.treatments.push({ type: "chapter_opener", in_f: inF, out_f: cOut, number: 1, title: ROUTES.chapterTitle });
      sfx.push({ sound: "whoosh", at: Math.max(0, inF / FPS - 0.08) });
      bodyIn = cOut;
      plan.transition = "chapter opener (book-section page)";
    }
    headline(scene.index, bodyIn, outF);
    rec.treatments.push({ type: "slide_in_typography", layer: `s${scene.index}-head` });

    if (scene.index === 0) {
      const it = placeStill(0, "couple", bodyIn, outF, `${src.couple.creator}; ${src.couple.credit}`);
      layers.push(stroke("s0-margin", `M${it.x + it.w + 34} ${it.y} L${it.x + it.w + 34} ${it.y + it.h}`, { color: P.accent, width: 4, inF: bodyIn, outF, z: z++, delay: 6, drawFrames: Math.min(40, outF - bodyIn - 6) }));
      rec.photo = { asset_id: "couple", source_url: src.couple.page_url, source_file: rel(src.couple.file), baked_file: rel(it.baked), rect: { x: it.x, y: it.y, w: it.w, h: it.h }, in_f: bodyIn, out_f: outF, kind: "photograph", license: src.couple.licence, relation: "exact" };
      rec.treatments.push({ type: "photo_treatment", recipe: "PhotoTreatment.jsx via VoxStill: vignette, halftone, grain, chromatic aberration, editorial LUT", halftone_opacity: VOX.halftone_opacity }, { type: "grounded_shadow" });
      const a = circleOn(0, it, { x0: 0.36, x1: 0.60, y0: 0.49, y1: 0.68 }, 0, bodyIn, outF);
      rec.treatments.push({ type: "annotation", target: "the couple at the car", confirmed_as: "the archduke bending to the car beside a woman in a light dress, per the IWM caption; checked by eye on the source", box: { x0: 0.36, x1: 0.60, y0: 0.49, y1: 0.68 }, ...a });
      stack("s0", "PRIMARY SOURCE: PHOTOGRAPH", [{ text: "Circled: the couple at the car", accent: true }, { text: "Sarajevo City Hall, 28 June 1914. Photographer unknown." }], bodyIn, outF);
      Object.assign(plan, { main_point: "Open on the evidence itself.", visual_objective: "Show the named place and moment before explaining it.", treatment: "archival-photo-ledger", background: "light archival paper", skill: ".agents/skills/vox-style-treatment + PhotoTreatment", assets: [{ id: "couple", origin: "Wikimedia Commons (Imperial War Museums)", licence: src.couple.licence, source_url: src.couple.page_url }], animation: "headline slides in; accent circle draws on; photograph never moves", on_screen_text: [ROUTES.headlines[0], "Circled: the couple at the car"] });
    } else if (scene.index === 1) {
      const { pts } = buildMapLayers({ id: "s1", inF: bodyIn, outF, points: [sarajevo], P, font: SERIF, nextZ: () => z++, layers, handCircle });
      rec.treatments.push({ type: "map", places: pts.map((q) => q.name), source: "Natural Earth 1:50m; coordinates from Wikipedia" });
      layers.push(text("s1-maptag", "MODERN BORDERS  |  NATURAL EARTH", { x: 60, w: 960, y: 1446, size: 30, weight: 700, align: "left", color: P.accent, tracking: 0.14, inF: bodyIn + 10, outF, z: z++, font: SERIF, slideX: -40, slide: 0 }));
      Object.assign(plan, { main_point: "Where Sarajevo is today.", visual_objective: "Show the country and today's borders, so the 1914 map next reads as a change.", treatment: "modern-map-locator", background: "light archival paper", skill: "scripts/autopilot/map-vox.mjs buildMapLayers", assets: [{ id: "natural-earth", origin: "Natural Earth (public domain)", licence: "Public domain" }], animation: "country tints, pin and ring draw on, labels slide in", on_screen_text: [ROUTES.headlines[1], "Sarajevo"] });
    } else if (scene.index === 2) {
      const it = placeStill(2, "map1914", bodyIn, outF, `Richard Andree, Times Atlas 1895; comparative borders added later; via Wikimedia Commons`);
      rec.treatments.push({ type: "document_treatment", recipe: "sharp colour-mute + paper multiply, then PhotoTreatment at low halftone" }, { type: "grounded_shadow" });
      const a = circleOn(2, it, { x0: 0.50, x1: 0.555, y0: 0.885, y1: 0.935 }, 2, bodyIn, outF);
      rec.treatments.push({ type: "document_annotation", target: "SERAJEVO label", ...a });
      stack("s2", "DATED MAP: 1895 BASE, 1914 BORDER IN RED", [{ text: "Circled: Sarajevo, spelled Serajevo on this map", accent: true }, { text: "Inside the red 1914 line. Blue lines are 1920 borders, added later." }], bodyIn, outF);
      Object.assign(plan, { main_point: "In 1914 the borders were not today's.", visual_objective: "A dated map where the 1914 empire border differs from today's, with the date on screen.", treatment: "dated-historical-map", background: "light archival paper", skill: "document treatment (platform/channels/hidden-past) + PhotoTreatment", assets: [{ id: "map1914", origin: "Wikimedia Commons", licence: src.map1914.licence, source_url: src.map1914.page_url }], animation: "map fades in unmoving; accent circle draws on Sarajevo; evidence lines arrive in turn", on_screen_text: [ROUTES.headlines[2], "DATED MAP: 1895 BASE, 1914 BORDER IN RED"] });
    } else if (scene.index === 3) {
      const it = placeStill(3, "nyt", bodyIn, outF, `The New York Times, 29 June 1914, p. 1; via Wikimedia Commons / Internet Archive`);
      rec.treatments.push({ type: "document_treatment", recipe: "sharp greyscale ink + paper multiply, then PhotoTreatment at low halftone" }, { type: "grounded_shadow" });
      stack("s3", "PRIMARY SOURCE: NEWSPAPER", [{ text: "The New York Times, Monday 29 June 1914, page 1", accent: true }, { text: "The paper's own words, 1914. Public-domain scan." }], bodyIn, outF, it.y + it.h + 44);
      Object.assign(plan, { main_point: "The primary report of the day.", visual_objective: "Show the actual front page headline.", treatment: "newspaper-scan", background: "light archival paper", skill: "document treatment (platform/channels/hidden-past) + PhotoTreatment", assets: [{ id: "nyt", origin: "Wikimedia Commons / Internet Archive", licence: src.nyt.licence, source_url: src.nyt.page_url }], animation: "page fades in unmoving; evidence lines arrive in turn", on_screen_text: [ROUTES.headlines[3], "The New York Times, Monday 29 June 1914, page 1"] });
    } else {
      const it = placeStill(4, "behr", bodyIn, outF, `${src.behr.creator}; ${src.behr.credit}`);
      rec.photo = { asset_id: "behr", source_url: src.behr.page_url, source_file: rel(src.behr.file), baked_file: rel(it.baked), rect: { x: it.x, y: it.y, w: it.w, h: it.h }, in_f: bodyIn, out_f: outF, kind: "photograph", license: src.behr.licence, relation: "exact" };
      rec.treatments.push({ type: "photo_treatment", recipe: "PhotoTreatment.jsx via VoxStill: vignette, halftone, grain, chromatic aberration, editorial LUT", halftone_opacity: VOX.halftone_opacity }, { type: "grounded_shadow" });
      const box = { x0: 0.565, x1: 0.70, y0: 0.24, y1: 0.78 };
      const a = circleOn(4, it, box, 4, bodyIn, outF);
      rec.treatments.push({ type: "annotation", target: "the man being held", confirmed_as: "the man in the dark coat held by a policeman and a man in a cap; checked by eye on the source", box, ...a });
      stack("s4", "LATER INTERPRETATION", [{ text: "Circled: the man being held", accent: true }, { text: "Often captioned: the arrest of Gavrilo Princip" }, { text: "Scholars: Ferdinand Behr, a bystander (Finestone and Massie, 1981)" }, { text: "David James Smith, 2010: no photograph of Princip's arrest exists" }], bodyIn, outF);
      Object.assign(plan, { main_point: "The famous caption is a later claim scholars dispute.", visual_objective: "Show the photograph, then separate what it was captioned from what scholars say.", treatment: "archival-photo-card-with-claim-ladder", background: "light archival paper", skill: ".agents/skills/vox-style-treatment + PhotoTreatment", assets: [{ id: "behr", origin: "Wikimedia Commons", licence: src.behr.licence, source_url: src.behr.page_url }], animation: "chapter opener, then photograph holds still; circle draws on; claim lines arrive in turn", on_screen_text: ["CHAPTER I", ROUTES.chapterTitle, ROUTES.headlines[4], "LATER INTERPRETATION"] });
    }
    voxRecord.push(rec);
    scenePlan.push(plan);
  }
  layoutCheck(layers, "hidden-past-layout");

  // Sound: the repo's own whoosh and impact, mixed under the voice at the cues.
  const cues = sfx.slice(0, 6), sfxFile = { whoosh: "whoosh.mp3", impact: "impact.mp3" };
  const mixed = join(work, "narration-with-sfx.mp3");
  sh("ffmpeg", ["-y", "-v", "error", "-i", narration, ...cues.flatMap((c) => ["-i", join(REMOTION_DIR, "public/sfx", sfxFile[c.sound])]), "-filter_complex", `${cues.map((c, i) => `[${i + 1}:a]adelay=${Math.round(c.at * 1000)}|${Math.round(c.at * 1000)},volume=0.22[s${i}]`).join(";")};[0:a]${cues.map((_, i) => `[s${i}]`).join("")}amix=inputs=${cues.length + 1}:duration=first:normalize=0[out]`, "-map", "[out]", "-b:a", "192k", mixed]);

  const words = { sentences: timing.map((s) => ({ text: s.text, start: s.start, end: s.end })), words: timing.flatMap((s, i) => { const ws = s.text.split(/\s+/); const tot = ws.reduce((n, w) => n + w.length + 1, 0); let at = s.start; return ws.map((w) => { const d = ((w.length + 1) / tot) * (s.end - s.start); const o = { text: w, start: at, end: at + d, sentence: i }; at += d; return o; }); }) };
  const timeline = {
    version: 1, id: SLUG, title: `Hidden Past: ${TOPIC}`, production_id: runId, channel_id: "ch-01", width: W, height: H, fps: FPS, durationInFrames: durationF, palette: P, fonts: { primary: SERIF }, assets,
    layers: stripForRender(layers), captions: captions(words), caption_style: { x: 90, y: 1560, w: W - 180, h: 200, size: 52 },
    scenes: scenes.map((s) => ({ id: `s${s.index}`, start: s.from, end: s.to ?? durationS })),
    metadata: { topic: TOPIC, duration_s: durationS, treatment: "vox", narration: "provisional, hand-planned sample" },
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
    channel: key, run: runId, narration_status: "PROVISIONAL: hand-planned sample, not from the script engine",
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
  tools.stage(report.pass && movingKeys.length === 0 ? "qa_passed" : "blocked", report.pass ? "ok" : "vox gate failed", { gate_failures: report.failures.length });
  tools.stage("preview_ready", "ok");
}
