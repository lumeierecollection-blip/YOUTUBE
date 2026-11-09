/**
 * Hidden Past visual track, applying .agents/skills/vox-style-treatment/SKILL.md.
 *
 * Each photograph goes once through the repo's PhotoTreatment (vignette, halftone, grain,
 * chromatic aberration, editorial LUT) and is shown as that single unmoving still, with no
 * scale or pan keyframes at all. Movement comes from type, annotations, maps and transitions.
 *
 * The render records what each scene received in vox-plan.json; vox-gate.mjs then checks
 * those claims against pixels in the final MP4.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { CONFIG, ROOT, StageError, askJson, askVision, fetchWithTimeout, log, must, readJson, run, sha256File, writeJson } from "./lib.mjs";
import { FPS, H, W, captions, channelStyle, fit, layoutCheck, scenesFromWords, sec, solid, stripForRender, stroke, text } from "./visual-common.mjs";

const VOX = CONFIG.vox;
const SERIF = "Cormorant Garamond";
const REMOTION_DIR = join(ROOT, "src/skills/remotion-render");
const ROMAN = ["I", "II", "III", "IV"];

async function commonsSearch(query) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=14&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=900`;
  const r = await fetchWithTimeout(u);
  if (!r.ok) return [];
  const j = await r.json();
  return Object.values(j.query?.pages || {}).map((p) => {
    const ii = p.imageinfo?.[0];
    if (!ii || !/^image\/(jpeg|png)$/.test(ii.mime)) return null;
    const lic = ii.extmetadata?.LicenseShortName?.value || "";
    // The same licence rule as scripts/assets/download-historical-images.mjs, which rejects the whole pack otherwise.
    if (!/^public domain$|^pd(-|$)|^cc0(\s|$)|^cc by(-sa)?(\s+\d+(\.\d+)?)?$|^no restrictions$/i.test(lic.trim())) return null;
    if (Math.min(ii.width, ii.height) < 700) return null;
    const description = String(ii.extmetadata?.ImageDescription?.value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
    return { title: p.title, thumb: ii.thumburl, width: ii.width, height: ii.height, license: lic, description };
  }).filter(Boolean);
}

async function pickImage(scene, used, story) {
  for (const q of scene.commons_queries || []) {
    let results = [];
    try { results = await commonsSearch(q); } catch (e) { log("assets", `Commons search failed for "${q}": ${e.message}`); }
    for (const c of results.slice(0, 5)) {
      if (used.has(c.title)) continue;
      let img;
      try { img = await fetchWithTimeout(c.thumb); } catch { continue; }
      if (!img.ok) continue;
      const buf = Buffer.from(await img.arrayBuffer());
      const v = await askVision(`Story: "${story}". Narration: "${scene.text}". Wanted subject: "${scene.subject}". Commons file: ${c.title}. Commons description: ${c.description || "(none)"}.
Reply JSON {"relation":"exact|context|unrelated","kind":"photograph|portrait|document|artefact|illustration|map|other","why":"..."}.
exact: it shows a person, ship, building, object, document or site that the narration names, even if the photo was taken at another moment.
context: not the story's own object, but the same place, culture, period or the same person's world, so it honestly sets the scene.
unrelated: a different culture, site or period than the story (read the file name and description for where it comes from), logos, AI-generated art, modern stock images, or merely similar-looking things.`, buf, "autopilot-commons");
      const relation = v?.relation === "exact" || v?.relation === "context" ? v.relation : "unrelated";
      log("assets", `${c.title}: ${relation} (${v?.why || "no answer"})`);
      if (relation !== "unrelated") { used.add(c.title); return { ...c, kind: v.kind || "photograph", relation, thumbBuf: buf }; }
    }
  }
  return null;
}

/** Vision models report boxes as fractions or on a 0-1000 grid; accepts either. */
function toBox(v) {
  if (!v) return null;
  const raw = [v.x0, v.y0, v.x1, v.y1].map(Number);
  if (raw.some((n) => !Number.isFinite(n))) return null;
  const k = Math.max(...raw) > 1.5 ? 1000 : 1;
  const [x0, y0, x1, y1] = raw.map((n) => Math.min(1, Math.max(0, n / k)));
  return x1 - x0 > 0.04 && y1 - y0 > 0.04 && x1 - x0 < 0.8 && y1 - y0 < 0.8 ? { x0, y0, x1, y1 } : null;
}

/** Finds the planned detail; if the image doesn't clearly show it, asks what specific detail it does show. */
async function locateDetail(target, jpeg, subject) {
  const found = await askVision(`Find this exact detail in the image: "${target}".
Reply JSON {"found":boolean,"x0":0.1,"y0":0.1,"x1":0.5,"y1":0.5} with a tight box as fractions of the image width and height. found=false if it is not clearly visible.`, jpeg, "autopilot-locate");
  log("annotate", `locate "${target}": ${JSON.stringify(found)?.slice(0, 160)}`);
  const box = found?.found ? toBox(found) : null;
  if (box) return { box, target };
  const offered = await askVision(`This image shows: ${subject}. Choose the single most informative specific physical detail clearly visible in it (for example an inscription, a seal, a carved figure, a damaged edge).
Reply JSON {"label":"2-4 word name of the detail","x0":0.1,"y0":0.1,"x1":0.5,"y1":0.5} with a tight box as fractions of the image width and height.`, jpeg, "autopilot-locate");
  log("annotate", `offered: ${JSON.stringify(offered)?.slice(0, 160)}`);
  const first = Array.isArray(offered) ? offered[0] : offered;
  const offeredBox = toBox(first);
  return offeredBox && first?.label ? { box: offeredBox, target: String(first.label), offered: true } : null;
}

/** The located box is only trusted if a separate look at that crop alone confirms the detail. */
async function confirmDetail(target, file, box, width, height, dir, i) {
  const crop = join(dir, `crop-${i}.jpg`);
  const w = Math.round((box.x1 - box.x0) * width), h = Math.round((box.y1 - box.y0) * height);
  must("annotate", "ffmpeg", ["-y", "-v", "error", "-i", file, "-vf", `crop=${w}:${h}:${Math.round(box.x0 * width)}:${Math.round(box.y0 * height)},scale=512:-2`, "-q:v", "3", crop]);
  const v = await askVision(`Does this crop clearly show: "${target}"? Reply JSON {"match":boolean,"what":"what the crop shows"}.`, readFileSync(crop), "autopilot-confirm");
  return v?.match ? v.what : null;
}

function planPrompt(scenes, researchData) {
  return `You direct a Vox-style historical documentary Short. Each narration sentence needs real visual evidence, shown before it is explained.

Sentences:
${scenes.map((s) => `${s.index}. ${s.text}`).join("\n")}

Research: ${JSON.stringify(researchData.key_facts || []).slice(0, 3000)}

For each sentence return:
- commons_queries: 2-3 short Wikimedia Commons searches for a real historical photo, artefact, document or painting of what the sentence is about
- subject: what the image must show
- headline: 2-5 word title in tight editorial style, using only facts from the sentence
- annotation_target: one specific visible physical detail likely to be in that image (e.g. "the inscription on the stone"), or ""
- annotation_label: 1-3 word label for it, or ""

Also return:
- chapter_titles: two short book-section style titles for the story's turning points, no invented facts
- map: {"places":["exact place names from the sentences or research, in travel order"],"scene_index":N} if geography matters, else {"places":[],"scene_index":null}

Return JSON: {"scenes":[{"index":0,"commons_queries":[],"subject":"","headline":"","annotation_target":"","annotation_label":""}],"chapter_titles":["",""],"map":{"places":[],"scene_index":null}}`;
}

async function coordinates(place) {
  try {
    const r = await fetchWithTimeout(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=coordinates&redirects=1&titles=${encodeURIComponent(place)}`);
    if (!r.ok) return null;
    const p = Object.values((await r.json()).query?.pages || {})[0];
    const c = p?.coordinates?.[0];
    return c ? { name: place, lat: c.lat, lon: c.lon } : null;
  } catch { return null; }
}

/** Vector map from the repo's Natural Earth data, framed on the places. Returns paths and a projector. */
function mapGeometry(points) {
  const geo = readJson(join(REMOTION_DIR, "public/geo/ne_110m_admin_0_countries.geojson"));
  const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
  const pad = Math.max(8, (Math.max(...lons) - Math.min(...lons)) * 0.35, (Math.max(...lats) - Math.min(...lats)) * 0.35);
  const box = { w: Math.min(...lons) - pad, e: Math.max(...lons) + pad, s: Math.min(...lats) - pad, n: Math.max(...lats) + pad };
  const area = { x: 60, y: 300, w: 960, h: 1120 };
  const k = Math.min(area.w / (box.e - box.w), area.h / (box.n - box.s));
  const ox = area.x + (area.w - (box.e - box.w) * k) / 2, oy = area.y + (area.h - (box.n - box.s) * k) / 2;
  const project = ([lon, lat]) => [Math.round(ox + (lon - box.w) * k), Math.round(oy + (box.n - lat) * k)];
  const inBox = ([lon, lat]) => lon >= box.w && lon <= box.e && lat >= box.s && lat <= box.n;
  const ds = [];
  for (const f of geo.features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      const ring = poly[0];
      if (!ring.some(inBox)) continue;
      ds.push("M" + ring.map((c) => project(c).join(" ")).join(" L") + " Z");
    }
  }
  return { d: ds.join(" "), project };
}

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

/** One render of the real PhotoTreatment per image. */
async function bakeStills(items, dir, voMp3) {
  // The Remotion bundle imports vo.mp3, which only exists once a narration is staged.
  copyFileSync(join(ROOT, voMp3), join(REMOTION_DIR, "vo.mp3"));
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
  const runner = join(REMOTION_DIR, ".bake-stills.mjs");
  const jobs = items.map((it) => {
    const name = `${basename(it.file, extname(it.file))}-base.jpg`;
    must("vox-bake", "ffmpeg", ["-y", "-v", "error", "-i", it.file, "-vf", `eq=saturation=${VOX.base_saturation}`, "-q:v", "2", join(pubDir, name)]);
    return { src: `vox-src/${name}`, width: it.w, height: it.h, halftone: VOX.halftone_opacity, grain: VOX.grain_opacity, out: it.baked };
  });
  const jobsFile = join(dir, "bake-jobs.json");
  writeJson(jobsFile, jobs);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(runner, script);
  const r = run("node", [runner, jobsFile], { cwd: REMOTION_DIR, timeoutS: 900 });
  if (r.status !== 0 || items.some((it) => !existsSync(it.baked))) throw new StageError("vox-bake", "PhotoTreatment did not produce every still");
  // The composer writes linear values to the canvas in a still render: centres kept about a third of
  // their light and saturation rose. This restores display encoding, the same for every photo.
  for (const it of items) {
    const encoded = it.baked.replace(/\.png$/, "-srgb.png");
    must("vox-bake", "ffmpeg", ["-y", "-v", "error", "-i", it.baked, "-vf", "eq=gamma=2.2", encoded]);
    copyFileSync(encoded, it.baked);
  }
}

function mixSoundDesign(voMp3, cues, dir) {
  const sfx = { whoosh: "whoosh.mp3", impact: "impact.mp3" };
  const inputs = ["-i", join(ROOT, voMp3)], filters = [];
  cues.forEach((c, i) => {
    inputs.push("-i", join(REMOTION_DIR, "public/sfx", sfx[c.sound]));
    filters.push(`[${i + 1}:a]adelay=${Math.round(c.at * 1000)}|${Math.round(c.at * 1000)},volume=0.22[s${i}]`);
  });
  const out = join(dir, "narration-with-sfx.mp3");
  const mix = `[0:a]${cues.map((_, i) => `[s${i}]`).join("")}amix=inputs=${cues.length + 1}:duration=first:normalize=0[out]`;
  must("sound", "ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", `${filters.join(";")};${mix}`, "-map", "[out]", "-b:a", "192k", out]);
  return out;
}

export async function buildHiddenPast({ channel, topic, script, narration, research, dir, productionId }) {
  must("vox-skill", "node", ["-e", `const s=require('fs').readFileSync('.agents/skills/vox-style-treatment/SKILL.md','utf8');if(!/NO photograph zooming/.test(s))process.exit(1)`]);
  const { words, scenes } = scenesFromWords(narration.words);
  const durationS = Math.min(30, Math.ceil(narration.seconds + 0.6));
  const durationF = sec(durationS);
  const ch = channelStyle(channel.id);
  const researchData = readJson(research);
  const P = { bg: ch.colors.bg, accent: ch.colors.accent, text: "#F5EFE6", muted: "#B8AB98", surface: ch.colors.secondary, stroke: ch.colors.accent };
  const plan = await askJson(planPrompt(scenes, researchData), "autopilot-vox-plan");
  writeJson(join(dir, "visual-plan.json"), plan);

  const used = new Set();
  const picks = [];
  for (const s of scenes) {
    const p = plan.scenes.find((x) => Number(x.index) === s.index) || {};
    if (Number(plan.map?.scene_index) === s.index && plan.map?.places?.length) continue;
    const img = await pickImage({ ...p, text: s.text }, used, topic.topic);
    if (img) picks.push({ scene: s, plan: p, img });
  }
  // Sentences with no image of their own may use a real image of the story's wider subject.
  if (picks.length < 4) {
    const topicQueries = [topic.commons_query, topic.wikipedia_title].filter(Boolean);
    for (const s of scenes) {
      if (picks.length >= 5) break;
      if (picks.some((x) => x.scene.index === s.index) || Number(plan.map?.scene_index) === s.index) continue;
      const p = plan.scenes.find((x) => Number(x.index) === s.index) || {};
      const img = await pickImage({ ...p, text: s.text, subject: topic.topic, commons_queries: topicQueries }, used, topic.topic);
      if (img) picks.push({ scene: s, plan: { ...p, subject: p.subject || topic.topic }, img });
    }
    picks.sort((a, b) => a.scene.index - b.scene.index);
  }
  if (!picks.some((x) => x.img.relation === "exact")) throw new StageError("assets", "no image shows the story's actual subject; context images alone would mislead");
  if (picks.length < 3) throw new StageError("assets", `only ${picks.length} verified, licensed images found; need at least 3 distinct real images`);

  const pack = { name: topic.slug, pack: topic.slug, source: "Wikimedia Commons", selection: "Searched by the VOX plan; each file checked by vision against its sentence", images: picks.map((x, i) => ({ sentence_index: x.scene.index, kind: "artifact", subject: x.plan.subject, label: x.plan.subject, title: x.img.title, id: `hist-${String(i + 1).padStart(2, "0")}`, alt: x.plan.subject, note: x.plan.subject, reason: `Sentence: ${x.scene.text}` })) };
  const packRel = `data/autopilot-runs/${basename(dir)}/visual-pack.json`;
  writeJson(join(dir, "visual-pack.json"), pack);
  must("assets", "node", ["scripts/assets/download-historical-images.mjs", "--channel", channel.id, "--pack", packRel]);
  const provenance = readJson(join(ROOT, "data/editor/assets", channel.id, "provenance-manifest.json"));
  const assetManifest = readJson(join(ROOT, "data/editor/assets", channel.id, "asset-manifest.json"));
  const byId = new Map(assetManifest.images.map((a) => [a.id, a]));

  // Every photo keeps its full frame: the card takes the photo's aspect, so nothing is cropped away.
  const items = pack.images.map((im, i) => {
    const a = byId.get(im.id);
    if (!a) throw new StageError("assets", `${im.id} missing from the downloaded pack`);
    const file = join(ROOT, "data/editor/assets", channel.id, a.filename || a.file);
    const aspect = a.width / a.height;
    let w = VOX.photo_width, h = Math.round(w / aspect);
    if (h > VOX.photo_height) { h = VOX.photo_height; w = Math.round(h * aspect); }
    w -= w % 2; h -= h % 2;
    return { ...picks[i], asset: a, id: im.id, file, w, h, x: Math.round((W - w) / 2), y: VOX.photo_y + Math.round((VOX.photo_height - h) / 2), baked: join(dir, `${im.id}-vox.png`) };
  });
  await bakeStills(items, dir, narration.mp3);

  const sourceJpeg = (it, n) => { const o = join(dir, `src-${n}.jpg`); must("annotate", "ffmpeg", ["-y", "-v", "error", "-i", it.file, "-vf", `scale=${it.w}:${it.h}`, "-q:v", "3", o]); return o; };
  for (const [n, it] of items.entries()) {
    const src = sourceJpeg(it, n);
    const planned = it.plan.annotation_target || "the most important visible detail";
    const located = await locateDetail(planned, readFileSync(src), it.plan.subject || "a historical subject");
    if (!located) { it.annotationException = `no detail could be located (${planned})`; continue; }
    const what = await confirmDetail(located.target, src, located.box, it.w, it.h, dir, n);
    log("annotate", `confirm "${located.target}": ${what || "not confirmed"}`);
    if (!what) { it.annotationException = `located box not confirmed: ${located.target}`; continue; }
    it.annotation = { box: located.box, what, target: located.target, label: located.offered || it.img.relation === "context" ? located.target : it.plan.annotation_label || "" };
  }
  if (items.filter((i) => i.annotation).length < VOX.min_annotations) throw new StageError("vox-annotation", "no annotation could be tied to a confirmed detail in a real image");

  let mapScene = null;
  if (plan.map?.places?.length && plan.map.scene_index !== null) {
    const coords = (await Promise.all(plan.map.places.slice(0, 4).map(coordinates))).filter(Boolean);
    const sc = scenes.find((s) => s.index === Number(plan.map.scene_index));
    if (coords.length && sc) mapScene = { scene: sc, coords };
  }

  const layers = [], assets = {}, voxRecord = [], sfxCues = [];
  let z = 10;
  const bounds = (s) => ({ inF: sec(s.from), outF: s.to === null ? durationF : sec(s.to) });
  layers.push(solid("bg", { x: 0, y: 0, w: W, h: H, background: P.bg, inF: 0, outF: durationF, z: z++, keyframes: { opacity: [{ f: 0, v: 1 }, { f: durationF, v: 1 }] } }));
  layers.push({ id: "progress", type: "solid", rect: { x: 0, y: H - 6, w: W, h: 6 }, in: 0, out: durationF, z: z++, style: { background: P.accent }, props: { opacity: 0.8, clipR: 100 }, keyframes: { clipR: [{ f: 0, v: 100, e: "linear" }, { f: durationF, v: 0, e: "linear" }] } });

  let pendingStart = null;
  // Chapter openers cut in after the cold open and on the last turn, never over the hook's evidence.
  const chapterAt = new Set([1]);
  if (scenes.length >= 5) chapterAt.add(scenes.length - 2);
  let chapterNo = 0;
  const headlineFor = (s, p) => {
    const t = (p.headline || s.text.split(/\s+/).slice(0, 4).join(" "));
    const f = fit(t, { maxW: 900, maxLines: 2, max: 68, min: 44 });
    if (!f) throw new StageError("vox-layout", `headline will not fit: ${t}`);
    return f;
  };

  // A sentence without its own verified image keeps the previous image on screen: never a filler
  // picture, and never the narration repeated as on-screen text above its own captions.
  const shown = [];
  for (const s of scenes) {
    const hasVisual = items.some((it) => it.scene.index === s.index) || mapScene?.scene.index === s.index;
    if (hasVisual) { shown.push({ ...s, merged: [] }); continue; }
    if (shown.length) { shown.at(-1).to = s.to; shown.at(-1).merged.push(s.index); }
    else pendingStart = s.from;
  }
  if (shown.length && pendingStart !== null) shown[0].from = pendingStart;

  /** Movement inside a long hold comes from small typographic notes, never from the photograph. */
  const holdNotes = (scene, startF, endF, notes, placement) => {
    const every = 84;
    let i = 0;
    for (let f = startF + 66; f < endF - 24 && i < notes.length; f += every, i++) {
      const out = Math.min(f + every, endF);
      const nf = fit(notes[i], { maxW: placement.w, maxLines: 1, max: 44, min: 30 });
      if (!nf) continue;
      layers.push(text(`s${scene.index}-note${i}`, nf.text, { x: placement.x, w: placement.w, y: placement.y, size: nf.size, weight: 600, align: "left", color: P.text, inF: f, outF: out, z: z++, font: SERIF, slideX: -60, slide: 0 }));
      const ry = placement.y + nf.size + 12;
      layers.push(stroke(`s${scene.index}-note${i}-rule`, `M${placement.x} ${ry} L${placement.x + placement.w} ${ry}`, { color: P.accent, width: 7, inF: f, outF: out, z: z++, drawFrames: 14 }));
    }
  };

  for (const scene of shown) {
    const { inF, outF } = bounds(scene);
    const span = outF - inF;
    const p = plan.scenes.find((x) => Number(x.index) === scene.index) || {};
    const rec = { scene: scene.index, start_s: scene.from, end_s: scene.to ?? durationS, treatments: [], exceptions: [] };
    let bodyIn = inF;

    if (chapterAt.has(scene.index) && span >= 54) {
      chapterNo++;
      const cOut = inF + 34;
      const title = plan.chapter_titles?.[chapterNo - 1] || "";
      const f = fit(title, { maxW: 840, maxLines: 3, max: 88, min: 52 });
      if (f) {
        const cz = 500;
        layers.push(solid(`ch${chapterNo}-page`, { x: 0, y: 0, w: W, h: H, background: P.surface, inF, outF: cOut, z: cz, keyframes: { opacity: [{ f: 0, v: 1 }, { f: 34, v: 1 }] } }));
        layers.push(text(`ch${chapterNo}-num`, `CHAPTER ${ROMAN[chapterNo - 1]}`, { y: 640, size: 40, weight: 700, color: P.accent, inF, outF: cOut, z: cz + 1, font: SERIF, tracking: 0.3, slideX: -60, slide: 0 }));
        layers.push(stroke(`ch${chapterNo}-rule`, `M300 716 L780 716`, { color: P.accent, width: 3, inF, outF: cOut, z: cz + 1, delay: 4, drawFrames: 14 }));
        layers.push(text(`ch${chapterNo}-title`, f.text, { y: 770, size: f.size, weight: 700, color: P.text, inF: inF + 4, outF: cOut, z: cz + 1, font: SERIF, slideX: 60, slide: 0 }));
        rec.treatments.push({ type: "chapter_opener", in_f: inF, out_f: cOut, number: chapterNo, title });
        sfxCues.push({ sound: "whoosh", at: Math.max(0, inF / FPS - 0.08) });
        bodyIn = cOut;
      }
    }

    const hf = headlineFor(scene, p);
    layers.push(text(`s${scene.index}-head`, hf.text, { y: 150, size: hf.size, weight: 700, color: P.text, inF: bodyIn, outF, z: 400, font: SERIF, slideX: -50, slide: 0, tracking: -0.01 }));
    rec.treatments.push({ type: "slide_in_typography", layer: `s${scene.index}-head` });

    if (mapScene && mapScene.scene.index === scene.index) {
      const { d, project } = mapGeometry(mapScene.coords);
      layers.push({ id: `s${scene.index}-map`, type: "svg", rect: { x: 0, y: 0, w: W, h: H }, in: bodyIn, out: outF, z: z++, viewBox: [0, 0, W, H], props: { opacity: 1, draw: 1, clipT: (300 / H) * 100, clipB: ((H - 1420) / H) * 100 }, paths: [{ d, fill: P.surface, stroke: P.muted, strokeWidth: 1.5 }] });
      const pts = mapScene.coords.map((c) => ({ ...c, xy: project([c.lon, c.lat]) }));
      if (pts.length >= 2) {
        layers.push(stroke(`s${scene.index}-route`, "M" + pts.map((q) => q.xy.join(" ")).join(" L"), { color: P.accent, width: 7, inF: bodyIn, outF, z: z++, delay: 8, drawFrames: Math.min(45, span - 16) }));
        rec.treatments.push({ type: "map_route", points: pts.map((q) => q.name), in_f: bodyIn + 8, end_f: bodyIn + 8 + Math.min(45, span - 16) });
      }
      const placed = [];
      pts.forEach((q, i) => {
        const [x, y] = q.xy, m = 14;
        const labelIn = bodyIn + 8 + i * 14;
        layers.push(stroke(`s${scene.index}-pin${i}`, `M${x} ${y - m} A${m} ${m} 0 1 1 ${x} ${y + m} A${m} ${m} 0 1 1 ${x} ${y - m} Z`, { color: P.accent, width: 5, fill: P.accent, inF: labelIn, outF, z: z++, drawFrames: 8 }));
        const lf = fit(q.name, { maxW: 340, maxLines: 1, max: 40, min: 28 });
        if (!lf) return;
        // Right of the pin first, then left, above and below; a label with no free spot is dropped.
        const options = [[x + 26, y - 22, "left"], [x - 386, y - 22, "right"], [x - 180, y - 70, "center"], [x - 180, y + 26, "center"]];
        for (const [lx, ly, align] of options) {
          const candidate = text(`s${scene.index}-place${i}`, lf.text, { x: Math.round(lx), w: 360, y: Math.round(ly), size: lf.size, weight: 700, align, color: P.text, inF: labelIn, outF, z: z + 1, font: SERIF, slideX: -30, slide: 0 });
          const b = candidate.box;
          const fits = b.x0 >= 48 && b.x1 <= 1032 && b.y0 >= 120 && b.y1 <= 1540 && !placed.some((o) => b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1);
          if (fits) { candidate.z = z++; layers.push(candidate); placed.push(b); break; }
        }
      });
      holdNotes(scene, bodyIn, outF, ["Map: Natural Earth", "Location: Wikipedia", ...pts.map((q) => q.name)], { x: 60, w: 500, y: 1436 });
      rec.treatments.push({ type: "map", places: pts.map((q) => q.name), source: "Natural Earth 1:110m; coordinates from Wikipedia" });
      voxRecord.push(rec);
      continue;
    }

    const item = items.find((it) => it.scene.index === scene.index);
    if (scene.merged.length) rec.exceptions.push({ treatment: "own image", reason: `no verified image for sentence(s) ${scene.merged.join(", ")}, so this image stays on screen` });

    const assetId = item.id;
    assets[assetId] = { file: item.baked.slice(ROOT.length + 1).replace(/\\/g, "/"), width: item.w, height: item.h, credit: item.asset.attribution, source_url: item.asset.page_url, license: item.asset.license };
    const photoIn = bodyIn;
    layers.push(solid(`s${scene.index}-shadow`, { x: item.x, y: item.y, w: item.w, h: item.h, background: P.bg, boxShadow: "0 22px 60px rgba(0,0,0,0.75)", inF: photoIn, outF, z: z++ }));
    layers.push({ id: `scene-${scene.index}-image`, type: "image", asset_id: assetId, rect: { x: item.x, y: item.y, w: item.w, h: item.h }, in: photoIn, out: outF, z: z++, props: { opacity: 1 }, keyframes: { opacity: [{ f: 0, v: 0, e: "outCubic" }, { f: 6, v: 1 }, { f: Math.max(7, outF - photoIn), v: 1 }] } });
    const photoRec = { asset_id: assetId, source_url: item.asset.page_url, source_file: item.file.slice(ROOT.length + 1).replace(/\\/g, "/"), baked_file: assets[assetId].file, rect: { x: item.x, y: item.y, w: item.w, h: item.h }, in_f: photoIn, out_f: outF, kind: item.img.kind, license: item.asset.license };
    rec.photo = { ...photoRec, relation: item.img.relation };
    if (item.img.relation === "context") {
      layers.push(text(`s${scene.index}-context`, "Context image, not the find itself", { x: item.x, w: item.w, y: Math.max(122, item.y - 44), size: 30, weight: 600, align: "left", color: P.accent, inF: photoIn, outF, z: 401, font: SERIF, slide: 0, slideX: -30 }));
      rec.treatments.push({ type: "context_label" });
    }
    rec.treatments.push({ type: "photo_treatment", recipe: "PhotoTreatment.jsx: vignette, halftone, grain, chromatic aberration, editorial LUT", halftone_opacity: VOX.halftone_opacity }, { type: "grounded_shadow" });

    if (item.annotation) {
      const { box, label, what, target } = item.annotation;
      const cx = item.x + ((box.x0 + box.x1) / 2) * item.w, cy = item.y + ((box.y0 + box.y1) / 2) * item.h;
      const rx = Math.max(46, ((box.x1 - box.x0) / 2) * item.w * 1.15), ry = Math.max(46, ((box.y1 - box.y0) / 2) * item.h * 1.15);
      const delay = Math.min(14, Math.floor((outF - photoIn) / 4));
      layers.push(stroke(`s${scene.index}-circle`, handCircle(Math.round(cx), Math.round(cy), Math.round(rx), Math.round(ry), scene.index * 37 + 11), { color: P.accent, width: 8, inF: photoIn, outF, z: z++, delay, drawFrames: 18 }));
      sfxCues.push({ sound: "impact", at: (photoIn + delay) / FPS });
      const photoBottom = item.y + item.h;
      const lf = label ? fit(label, { maxW: 460, maxLines: 1, max: 42, min: 30 }) : null;
      if (lf && photoBottom < 1450) {
        const ly = photoBottom + 40;
        layers.push(stroke(`s${scene.index}-connector`, `M${Math.round(cx)} ${Math.round(cy + ry)} L${Math.round(cx)} ${ly - 6}`, { color: P.accent, width: 4, inF: photoIn, outF, z: z++, delay: delay + 14, drawFrames: 10 }));
        layers.push(text(`s${scene.index}-label`, lf.text, { x: 540, w: 480, y: ly, size: lf.size, weight: 700, align: "left", color: P.accent, inF: photoIn + delay + 18, outF, z: z++, font: SERIF, slideX: 30, slide: 0 }));
      }
      rec.treatments.push({ type: "annotation", target, confirmed_as: what, box, screen: { cx: Math.round(cx), cy: Math.round(cy), rx: Math.round(rx), ry: Math.round(ry) }, draw_start_f: photoIn + delay, draw_end_f: photoIn + delay + 18 });
    } else {
      rec.exceptions.push({ treatment: "annotation", reason: item.annotationException || "not planned" });
    }
    holdNotes(scene, photoIn, outF, ["Image: Wikimedia Commons", `Licence: ${item.asset.license}`, String(item.plan.subject || "").slice(0, 44)], { x: 60, w: 440, y: Math.min(item.y + item.h + 22, 1466) });
    voxRecord.push(rec);
  }
  layoutCheck(layers, "vox-layout");

  const audioPath = sfxCues.length ? mixSoundDesign(narration.mp3, sfxCues.slice(0, 6), dir) : join(ROOT, narration.mp3);
  const timeline = {
    version: 1, id: topic.slug, title: `Hidden Past: ${topic.topic}`, production_id: productionId, channel_id: `ch-${channel.id.padStart(2, "0")}`,
    width: W, height: H, fps: FPS, durationInFrames: durationF, palette: P, fonts: { primary: SERIF }, assets,
    layers: stripForRender(layers), captions: captions(words), caption_style: { x: 90, y: 1560, w: W - 180, h: 200, size: 52 },
    scenes: scenes.map((s) => ({ id: `s${s.index}`, start: s.from, end: s.to ?? durationS })),
    metadata: { generated_at: new Date().toISOString(), topic_slug: topic.slug, topic: topic.topic, source_script: script.scriptRel, source_audio: narration.mp3, scene_count: scenes.length, duration_s: durationS, treatment: "vox" },
  };
  const timelinePath = join(dir, "timeline.json");
  writeJson(timelinePath, timeline);
  writeJson(join(dir, "vox-plan.json"), { production_id: productionId, accent: P.accent, recipe_source: "src/skills/remotion-render/effects/PhotoTreatment.jsx", halftone_opacity: VOX.halftone_opacity, scenes: voxRecord, sfx: sfxCues });
  const provById = new Map(provenance.images.map((x) => [x.id, x]));
  writeJson(join(dir, "asset-manifest.json"), {
    assets: items.map((it) => {
      const pr = provById.get(it.id);
      return { asset_id: it.id, source_url: it.asset.page_url, sha256: sha256File(it.file), bytes: statSync(it.file).size, creator: pr?.creator, license: pr?.license, attribution: it.asset.attribution, scene_beat_assignment: `scene ${it.scene.index}`, reason_relevant: `Shows ${it.plan.subject}, named in: ${it.scene.text}`, subject: it.plan.subject, label: it.plan.subject };
    }),
    relevance_gate_result: { missing_photo_replaced_by_unrelated_image: false },
  });
  return { timelinePath, audioPath, manifestPath: join(dir, "asset-manifest.json"), attributions: items.map((it) => `${it.plan.subject}: ${it.asset.attribution} (${it.asset.license}) ${it.asset.page_url}`) };
}
