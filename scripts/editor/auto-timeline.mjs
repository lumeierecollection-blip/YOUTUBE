#!/usr/bin/env node
/**
 * Build the editor timeline for every finished script of a channel, automatically, inside the render job.
 *
 *   node scripts/editor/auto-timeline.mjs --channel 2 [--script data/research/2/<stem>-shorts-script.json] [--github-env]
 *
 * For each data/research/<ch>/*-script.json that has its voiceover (data/tts/<ch>/<stem>-vo.mp3 and -vo-words.json), writes
 *   data/editor/auto/<stem>/{plan.json,transcript.json,timeline.json,*.svg}
 * and registers it in data/editor/auto/map.json (the repo's own scripts/editor/timelines.json plus these). With --github-env the
 * map path is exported as EDITOR_TIMELINE_MAP for the later steps of the job. A script that cannot be turned into a valid timeline
 * is an ERROR (exit 1): the render must never fall back to a different renderer behind the owner's back.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, appendFileSync } from "fs";
import { join, resolve, basename, relative } from "path";
import { execFileSync } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { buildAutoPlan, seededRandom } from "./auto-plan.mjs";
import { graphicLayers, decorationLayers, sweepLayers, fieldLayers } from "./graphics.mjs";
import { buildTimeline } from "./timeline.mjs";
import { buildCaptions } from "./captions.mjs";
import { resolveEditorTimeline } from "../lib/editor-timeline-lookup.mjs";
import { flagFinder } from "./flag.mjs";

import { scriptSentences } from "./captions.mjs";
import { resolveChannel } from "../lib/channel-lookup.mjs";
import { conceptQueries, searchCommons, downloadPhoto, defaultAsk, defaultAskVision, verifyConceptPhoto } from "./concept-photo.mjs";

const require = createRequire(import.meta.url);
const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const PUBLIC = join(ROOT, "src", "skills", "remotion-render", "public");
const rel = (p) => relative(ROOT, p).split("\\").join("/");

/** Pixel size of a JPEG or PNG without a dependency. */
export function imageSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  throw new Error("unrecognised image");
}

/** The word list of a voiceover as whisper-style segments (one per spoken sentence), which buildCaptions reads. */
export function transcriptFromWords(words) {
  const by = new Map();
  for (const w of words.words || []) {
    if (!by.has(w.sentence)) by.set(w.sentence, []);
    by.get(w.sentence).push(w);
  }
  const segments = [...by.keys()].sort((a, b) => a - b).map((k, i) => {
    const ws = by.get(k);
    return { id: i, start: ws[0].start, end: ws.at(-1).end, text: " " + ws.map((x) => x.text).join(" "), words: ws.map((x) => ({ word: x.text, start: x.start, end: x.end })) };
  });
  return { text: segments.map((s) => s.text).join(""), segments, language: "en", source: words.source };
}

/** Logo lookup: the scene resolver's organisation path (Wikipedia infobox, Wikidata, Commons; free licence or the owner's fair-use record). */
function logoResolverFromSceneResolver(channelId) {
  const { resolveSceneEntity } = createRequire(import.meta.url)("../resolve-scene.cjs");
  return async ({ name, sentence, context }) => {
    const r = await resolveSceneEntity({ channel: channelId, beatIndex: `logo-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, entity: { type: "organization", name }, context, sentence });
    if (!r?.ok || !r.logo) return { ok: false, why: r?.why || "no verified mark" };
    const L = r.logo;
    const fu = L.fair_use;
    const credit = fu
      ? `Logo: ${fu.holder || L.name}, fair use for identification (file page: ${fu.descurl || L.source_url})`
      : `Logo: ${L.name}, ${L.license || "Wikimedia Commons"} (${L.source_url})`;
    return { ok: true, file: rel(L.abs), width: L.w, height: L.h, credit, source_url: L.source_url, license: fu ? fu.license || "Fair use (identification)" : L.license, dark_mark: await isDarkMark(L.abs) };
  };
}

/** True when the mark's visible pixels are mostly dark (a plate must then be light). */
async function isDarkMark(file) {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0, n = 0;
  for (let k = 0; k < data.length; k += info.channels) {
    if (data[k + 3] < 128) continue;
    sum += 0.299 * data[k] + 0.587 * data[k + 1] + 0.114 * data[k + 2];
    n++;
  }
  return n > 0 && sum / n < 110;
}

function resolverFromEntityAssets() {
  const { resolveEntity } = require("../entity-assets.cjs");
  return async ({ type, name, context }) => {
    const r = await resolveEntity({ type, name, context });
    if (!r?.ok) return r || { ok: false, why: "no result" };
    const file = join(PUBLIC, r.asset);
    const { width, height } = imageSize(readFileSync(file));
    return { ok: true, file: rel(file), width, height, credit: r.credit, source_url: r.source_url || r.page_url, license: r.license };
  };
}

/** concept({query, used}) -> a real, free-licence Commons photo of the concept, saved under data/editor/auto/concept/, or null. */
function conceptFinder(askVision = defaultAskVision(), maxChecks = 120) {
  let checks = 0;
  return async ({ query, sentence, topic, used }) => {
    const found = await searchCommons(query, 8);
    for (const rec of found) {
      const slug = rec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
      const file = join(ROOT, "data", "editor", "auto", "concept", slug + ".jpg");
      if (used.has(rel(file))) continue;
      try {
        const buf = await downloadPhoto(rec, file);
        const { width, height } = imageSize(buf);
        if (++checks > maxChecks) { console.error("[concept-photo] vision budget spent; no more concept photos"); return null; }
        const v = await verifyConceptPhoto({ sentence, query, topic, jpeg: buf, askVision });
        console.log(`[concept-photo] "${query}" / ${rec.title}: ${v.ok ? "accepted (" + v.why + ")" : "rejected, " + v.why}`);
        if (!v.ok) continue;
        return { file: rel(file), width, height, credit: rec.credit, source_url: rec.page || rec.url, license: rec.license };
      } catch (e) { console.error("[concept-photo] " + rec.title + ": " + e.message); }
    }
    return null;
  };
}

/**
 * The animated graphics of each scene (graphics.mjs) go on top of the scene's picture, entering after the scene's own fade (the look's
 * stagger, in frames) and leaving with it. They are real layers: solid bars with a keyframed clip, svg paths that draw on, text that counts.
 */
export function addGraphics(timeline, plan, { secondary } = {}) {
  plan.scenes.forEach((sc, i) => {
    const base = timeline.layers.find((l) => l.id === "scene-" + i + "-image");
    if (!base) return;
    // Every beat has the drifting dot field just above its picture (below the scrim and the graphics): nothing on screen is ever a held still.
    timeline.layers.push(...fieldLayers({ id: "scene-" + i + "-d", palette: plan.palette, inF: base.in, outF: base.out, z: base.z + 0.5, onPhoto: /^(photo|concept)-/.test(sc.asset) }));
    if (!sc.graphic) {
      // A photo scene with no figure still moves: the accent draws itself across it (graphics.mjs decorationLayers).
      if (/^card-/.test(sc.asset)) timeline.layers.push(...sweepLayers({ id: "scene-" + i + "-d", palette: plan.palette, inF: base.in, outF: base.out }));
      if (/^(photo|concept)-/.test(sc.asset)) timeline.layers.push(...decorationLayers({ id: "scene-" + i + "-d", look: sc.look, palette: plan.palette, inF: base.in + (sc.stagger || 0), outF: base.out }));
      return;
    }
    const g = sc.graphic;
    const inF = base.in + (sc.stagger || 0);
    const layers = graphicLayers({ ...g, id: "scene-" + i + "-g", look: g.look, palette: plan.palette, inF, outF: base.out, rng: seededRandom(plan.id + ":" + i) });
    timeline.layers.push(...layers);
    // a hero panel is the whole picture: a thin accent line crosses the frame so it never sits still once its counter has finished
    if (["hero", "bare", "full"].includes(g.mode)) timeline.layers.push(...sweepLayers({ id: "scene-" + i + "-d", palette: plan.palette, inF: base.in, outF: base.out }));
  });
  timeline.layers.sort((x, y) => x.z - y.z);
  return timeline;
}

export async function buildOne({ channelId, scriptPath, channel, resolve: resolver, concept, ask, style = 1, probeDuration, logoResolver = async () => ({ ok: false }), flagResolver = async () => ({ ok: false }) }) {
  const stem = basename(scriptPath, ".json");
  const base = join(ROOT, "data", "tts", channelId, `${stem}-vo`);
  const audio = `${base}.mp3`;
  const wordsPath = `${base}-words.json`;
  if (!existsSync(wordsPath)) throw new Error(`${stem}: no word timings at ${rel(wordsPath)} (the voiceover step writes them)`);
  const script = JSON.parse(readFileSync(scriptPath, "utf8"));
  const researchPath = scriptPath.replace(/-(shorts|longform)-script\.json$/, ".json");
  const research = existsSync(researchPath) ? JSON.parse(readFileSync(researchPath, "utf8")) : {};
  const words = JSON.parse(readFileSync(wordsPath, "utf8"));
  const audioDuration = probeDuration(audio);

  const dir = join(ROOT, "data", "editor", "auto", stem);
  mkdirSync(dir, { recursive: true });
  const transcript = transcriptFromWords(words);
  const transcriptPath = join(dir, "transcript.json");
  writeFileSync(transcriptPath, JSON.stringify(transcript, null, 1));

  const pairs = concept ? await conceptQueries({ sentences: scriptSentences(script), topic: research?.strongest_angle, niche: channel?.niche, ask }) : { first: [], second: [] };
  const queries = pairs.first;
  const queries2 = pairs.second;
  const topic = pairs.topic || research?.strongest_angle || "";
  const { plan, cards, report } = await buildAutoPlan({
    script, research, words: words.words, audioDuration, channel, stem, concept, queries, queries2, story: pairs.story || [], topic, logo: logoResolver, flag: flagResolver, style,
    audioPath: rel(audio), transcriptPath: rel(transcriptPath), scriptPath: rel(scriptPath), resolve: resolver,
  });
  const source = (script.sources_used || [])[0] || "";
  for (const c of cards) {
    const file = join(dir, `${c.id}.svg`);
    writeFileSync(file, c.svg);
    plan.assets[c.id] = { file: rel(file), width: 1080, height: 1920, credit: "Graphic: automatic editor, figures from the sources", source_url: source || "https://github.com/lumeierecollection-blip/YOUTUBE", license: "Original diagram" };
  }
  writeFileSync(join(dir, "plan.json"), JSON.stringify(plan, null, 2));

  const captions = buildCaptions({ script, whisper: transcript, duration: audioDuration });
  const timeline = addGraphics(buildTimeline(plan, { audioDuration, captions }), plan, { secondary: channel?.colors?.secondary });
  timeline.metadata.plan = rel(join(dir, "plan.json"));
  timeline.metadata.audio_duration_sec = audioDuration;
  timeline.metadata.generator = "scripts/editor/auto-timeline.mjs";
  const timelinePath = join(dir, "timeline.json");
  writeFileSync(timelinePath, JSON.stringify(timeline, null, 2));
  return { stem, timelinePath: rel(timelinePath), report, scenes: plan.scenes.length, frames: timeline.durationInFrames };
}

function findScripts(channelId) {
  const dir = join(ROOT, "data", "research", channelId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith("-script.json")).map((f) => join(dir, f))
    .filter((p) => existsSync(join(ROOT, "data", "tts", channelId, `${basename(p, ".json")}-vo.mp3`)));
}

async function main() {
  const args = process.argv.slice(2);
  const get = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
  const channelId = get("channel");
  if (!channelId) throw new Error("usage: auto-timeline.mjs --channel <id> [--script <path>] [--github-env]");
  const channels = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf8")).channels;
  const channel = resolveChannel(channelId, channels);
  const scripts = get("script") ? [resolve(ROOT, get("script"))] : findScripts(channelId);
  if (!scripts.length) throw new Error(`channel ${channelId}: no script with a voiceover to build a timeline for`);

  const baseMapPath = join(ROOT, process.env.EDITOR_TIMELINE_BASE_MAP || "scripts/editor/timelines.json");
  const map = existsSync(baseMapPath) ? JSON.parse(readFileSync(baseMapPath, "utf8")) : {};
  const probeDuration = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f], { encoding: "utf8" }).trim());
  const resolver = resolverFromEntityAssets();
  const logoResolver = logoResolverFromSceneResolver(channelId);
  const flagResolver = flagFinder({ isDark: isDarkMark });
  const concept = conceptFinder();
  const ask = defaultAsk();
  // --style N / EDITOR_STYLE=N forces one look (the comparison workflow); otherwise each video chooses its own from its slug (auto-plan.mjs)
  const forced = get("style") || process.env.EDITOR_STYLE;
  const style = forced ? Number(forced) || 0 : 0;

  for (const scriptPath of scripts) {
    const stem = basename(scriptPath, ".json");
    const r = await buildOne({ channelId, scriptPath, channel, resolve: resolver, concept, ask, style, probeDuration, logoResolver, flagResolver });
    map[stem] = r.timelinePath;
    console.log(`[auto-timeline] ch-${channelId} ${stem}: ${r.scenes} scenes, ${r.frames} frames -> ${r.timelinePath} (style ${r.report.style}, timing from ${r.report.spans}, ${r.report.photos} verified photo(s))`);
    for (const s of r.report.scenes) console.log(`  [${s.sentence}] ${s.start}-${s.end}s ${s.shows}`);
    for (const m of r.report.misses) console.log(`  [${m.sentence}] no verified photo of ${m.entity}: ${m.why}`);
  }

  const mapPath = join(ROOT, "data", "editor", "auto", "map.json");
  const existing = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, "utf8")) : map;
  writeFileSync(mapPath, JSON.stringify({ ...existing, ...map }, null, 2));
  // The timeline must pass the same checks the renderer applies, here, so a bad one fails this step and not a 15-minute render.
  for (const scriptPath of scripts) {
    resolveEditorTimeline(scriptPath, { env: { EDITOR_ENGINE: "1", EDITOR_STRICT: "1", EDITOR_TIMELINE_MAP: rel(mapPath) }, root: ROOT });
  }
  if (args.includes("--github-env") && process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `EDITOR_TIMELINE_MAP=${rel(mapPath)}\n`);
  console.log(`[auto-timeline] map ${rel(mapPath)} (${Object.keys(map).length} entries)`);
}

if (process.argv[1] && /auto-timeline\.mjs$/.test(process.argv[1].split("\\").join("/"))) {
  main().catch((e) => { console.error(`::error::auto-timeline: ${e.message}`); process.exit(1); });
}
