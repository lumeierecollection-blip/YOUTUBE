/** Gray Matter sample Short: sources are recorded in sample.mjs, geometry comes from the Anima kit, rendering from Remotion. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFigures } from "./figures.mjs";
import { claims, scenePlan, scriptPackage, sentences } from "./sample.mjs";
import { runQa } from "./qa.mjs";
import { SCENES } from "./scenes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const require = createRequire(join(ROOT, "package.json"));
const sharp = require("sharp");
const Ajv = require("ajv");
const channel = JSON.parse(readFileSync(join(HERE, "channel.json"), "utf8"));
const schema = (n) => JSON.parse(readFileSync(join(ROOT, "platform/contracts", n), "utf8"));
const LIMIT = channel.format.max_seconds, FPS = channel.format.fps, TAIL_S = 0.45;

/** Clones Anima at the pinned commit, so a run never depends on what the repository looks like later. */
export function fetchAnima() {
  if (process.env.ANIMA_DIR) return process.env.ANIMA_DIR;
  const dir = join(tmpdir(), `anima-${channel.anima.commit.slice(0, 7)}`);
  if (existsSync(join(dir, "kit/iso-kit.mjs"))) return dir;
  mkdirSync(dir, { recursive: true });
  const git = (...a) => execFileSync("git", ["-C", dir, ...a], { stdio: "inherit" });
  git("init", "-q");
  git("remote", "add", "origin", `${channel.anima.repository}.git`);
  git("fetch", "-q", "--depth=1", "origin", channel.anima.commit);
  git("checkout", "-q", "FETCH_HEAD");
  const got = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"]).toString().trim();
  if (got !== channel.anima.commit) throw new Error(`Anima checkout is ${got}, expected ${channel.anima.commit}`);
  return dir;
}

export function validators() {
  const ajv = new Ajv({ strict: false, allErrors: true });
  ajv.addSchema(schema("claim-record.schema.json"), "claim-record.schema.json");
  ajv.addSchema(schema("story-blueprint.schema.json"), "story-blueprint.schema.json");
  const check = (v, data, name) => { if (!v(data)) throw new Error(`${name} fails its contract: ${ajv.errorsText(v.errors)}`); };
  const script = ajv.compile(schema("script-package.schema.json"));
  const plan = ajv.compile(schema("scene-plan.schema.json"));
  return { script: (d) => check(script, d, "script package"), plan: (d) => check(plan, d, "scene plan") };
}

/** The hippocampus mask comes from the plate's own cyan colouring, so the highlight cannot drift off the anatomy. */
async function platePayload() {
  const file = join(HERE, "assets/Gray739-emphasizing-hippocampus.png");
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = Buffer.alloc(info.width * info.height * 4);
  let area = 0, minX = 1e9, minY = 1e9, maxX = 0, maxY = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * info.channels], g = data[i * info.channels + 1], b = data[i * info.channels + 2];
    const hit = r < 150 && g > 150 && b > 150 && g - r > 50;
    mask[i * 4] = mask[i * 4 + 1] = mask[i * 4 + 2] = 255; mask[i * 4 + 3] = hit ? 255 : 0;
    if (hit) { area++; const x = i % info.width, y = Math.floor(i / info.width); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  if (area < 1500) throw new Error(`hippocampus mask only has ${area} pixels; the plate's colouring was not found`);
  const up = 2.16, W = Math.round(info.width * up), H = Math.round(info.height * up);
  const uri = (buf, type = "png") => `data:image/${type};base64,${buf.toString("base64")}`;
  const plate = await sharp(file).flatten({ background: "#FFFFFF" }).resize(W, H, { kernel: "lanczos3" }).sharpen({ sigma: 0.8 }).png().toBuffer();
  const maskUp = await sharp(mask, { raw: { width: info.width, height: info.height, channels: 4 } }).resize(W, H, { kernel: "cubic" }).blur(1.1).png().toBuffer();
  const lateral = await sharp(join(HERE, "assets/Gray726.png")).flatten({ background: "#FFFFFF" }).resize(1400, null, { kernel: "lanczos3" }).png().toBuffer();
  return { plate: uri(plate), mask: uri(maskUp), lateral: uri(lateral), plateSize: [info.width, info.height], mask_stats: { area_px: area, bbox: [minX, minY, maxX, maxY] } };
}

/** Each sentence is voiced alone, so scene timing comes from measured audio, not an estimate. */
function synthesise(tools, outDir) {
  mkdirSync(join(outDir, "vo"), { recursive: true });
  const gap = channel.voice.gap_seconds;
  for (const rate of channel.voice.rates_to_try) {
    const parts = sentences.map((s, i) => {
      const output = `vo/${s.sentence_id}.mp3`;
      tools.voice({ text: s.text, voice: channel.voice.tts_voice, output, rate });
      return { sentence_id: s.sentence_id, file: join(outDir, output), duration: tools.durationOf(join(outDir, output)), index: i };
    });
    const total = parts.reduce((sum, p) => sum + p.duration, 0) + gap * (parts.length - 1);
    if (total + TAIL_S > LIMIT - 0.2) { console.log(`rate ${rate}: ${total.toFixed(2)}s is too long`); continue; }
    let t = 0;
    const timed = parts.map((p) => { const start = t; t += p.duration + gap; return { ...p, start, end: start + p.duration }; });
    const inputs = timed.flatMap((p) => ["-i", p.file]);
    const pads = timed.map((p, i) => `[${i}:a]aresample=44100,apad=pad_dur=${i < timed.length - 1 ? gap : 0}[a${i}]`).join(";");
    const filter = `${pads};${timed.map((_, i) => `[a${i}]`).join("")}concat=n=${timed.length}:v=0:a=1[out]`;
    const voiceFile = join(outDir, "voice-preview.mp3");
    execFileSync("ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", filter, "-map", "[out]", "-c:a", "libmp3lame", "-q:a", "2", voiceFile]);
    rmSync(join(outDir, "vo"), { recursive: true, force: true });
    return { voiceFile, timed, rate, total: tools.durationOf(voiceFile) };
  }
  throw new Error(`narration does not fit ${LIMIT}s even at the fastest allowed rate; cut the script`);
}

/** Caption chunks of at most 34 characters, timed in proportion to their length inside the measured sentence. */
function captionChunks(timed) {
  return timed.flatMap((p) => {
    const words = sentences[p.index].text.split(" "), chunks = [];
    let line = "";
    for (const w of words) { if (`${line} ${w}`.trim().length > 34) { chunks.push(line); line = w; } else line = `${line} ${w}`.trim(); }
    if (line) chunks.push(line);
    const chars = chunks.reduce((s, c) => s + c.length, 0);
    let t = p.start;
    return chunks.map((text) => { const from = t; t += (text.length / chars) * p.duration; return { text, from: Math.round(from * FPS), to: Math.round(t * FPS) }; });
  });
}

export default async function preview({ key, runId, outDir, tools }) {
  const v = validators();
  tools.write("story-outline.md", ["# Gray Matter sample: story outline", "", `Topic: ${scriptPackage.topic}`, `Status: ${scriptPackage.provisional}`, "", `Question: ${scriptPackage.blueprint.central_question}`, "", `Thesis: ${scriptPackage.blueprint.thesis}`, "", ...scriptPackage.blueprint.beats.map((b) => `- ${b.beat_id} (${b.role}): ${b.purpose} [${b.claim_ids.join(", ")}]`), ""].join("\n"));
  tools.write("script-draft.md", ["# Script draft. PROVISIONAL: hand-planned sample, not from the script engine", "", ...sentences.map((s) => `${s.sentence_id}. ${s.text}  \n   claims: ${s.claim_ids.join(", ")}`), "", "## Sources", ...scriptPackage.sources.map((s) => `- ${s.source_id}: ${s.title}. ${s.journal}. doi:${s.doi}. Fetched from ${s.url}`), ""].join("\n"));
  tools.write("claims.json", claims);
  tools.stage("research_complete", "running", { note: "claim records copied from fetched sources, see claims.json" });
  tools.stage("blueprint_complete", "running");
  tools.stage("script_complete", "running", { provisional: scriptPackage.provisional });

  const anima = fetchAnima();
  const figures = await buildFigures(anima, channel.palette);
  tools.write("figure-audit.json", { anima_commit: channel.anima.commit, anima_bio_audit: figures.audit, note: "Audits membrane intersection and that labels point at real parts. It does not validate biological accuracy; the claim records do that." });
  if (!figures.audit.ok) throw new Error(`Anima bio audit failed: ${figures.audit.errors.join("; ")}`);
  const plates = await platePayload();
  tools.stage("visual_complete", "running");

  const { voiceFile, timed, rate, total } = synthesise(tools, outDir);
  tools.stage("voice_complete", "running", { rate });

  const frames = (s) => Math.round(s * FPS);
  const totalFrames = Math.ceil((total + TAIL_S) * FPS);
  const sceneBounds = scenePlan.map((_, i) => ({ from: i === 0 ? 0 : frames(timed[i].start), to: i === scenePlan.length - 1 ? totalFrames : frames(timed[i + 1].start) }));
  const scenes = scenePlan.map((scene, i) => {
    const library = SCENES[scene.treatment];
    if (!library) throw new Error(`treatment ${scene.treatment} is not in SCENES`);
    return library.build({ scene, from: sceneBounds[i].from, duration: sceneBounds[i].to - sceneBounds[i].from });
  });
  const plan = {
    channel: key, production_run: runId, format: "short",
    scenes: scenePlan.map((scene, i) => {
      const s = sentences.find((x) => x.sentence_id === scene.sentence);
      return { scene_id: `sc${i + 1}`, narration: s.text, main_point: scene.main_point, visual_objective: scene.visual_objective, treatment: scene.treatment, background: SCENES[scene.treatment].background, skill: SCENES[scene.treatment].skill, assets: scene.assets, animation: SCENES[scene.treatment].purposes[0], on_screen_text: scene.on_screen_text, claim_ids: s.claim_ids, data_sources: [...new Set(s.claim_ids.map((id) => claims.find((c) => c.claim_id === id).source_url))], transition: scene.transition, start_s: sceneBounds[i].from / FPS, end_s: sceneBounds[i].to / FPS };
    }),
  };
  v.plan(plan);
  tools.write("scene-plan.json", plan);
  const pkg = { ...scriptPackage, duration_estimate_s: total };
  v.script(pkg);
  tools.write("script-package.json", pkg);
  

  const silent = tools.renderComposition({ id: "GrayMatterShort", output: "silent.mp4", durationInFrames: totalFrames, props: { scenes, captions: captionChunks(timed), figures: { css: figures.css, neuron: figures.neuron, synapse: figures.synapse, bare: figures.bare, actin: figures.actin }, plates: { plate: plates.plate, mask: plates.mask, lateral: plates.lateral, size: plates.plateSize }, palette: channel.palette, type: channel.type, statusLabels: channel.status_labels } });
  const video = join(outDir, "preview.mp4");
  // One mux, on the runner: the composition has no audio element because the voice is measured and fixed before rendering.
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", silent, "-i", voiceFile, "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-af", "apad", "-shortest", "-movflags", "+faststart", video]);
  rmSync(silent, { force: true });
  tools.stage("render_complete", "running");

  // Beats sample each scene at the moments where its picture changes.
  const beatFracs = { "everyday-to-biology": [0.3, 0.92], "region-highlight": [0.75], "activity-compare": [0.75], "neuron-to-spines": [0.3, 0.92], "mechanism-rescue": [0.35, 0.92], "evidence-ledger": [0.18, 0.95] };
  const beats = plan.scenes.flatMap((s) => beatFracs[s.treatment].map((f, n) => {
    const at = s.start_s + (s.end_s - s.start_s) * f;
    return { id: `${s.scene_id}${n ? "b" : "a"}`, start_s: s.start_s, end_s: s.start_s + (at - s.start_s) / 0.72, treatment: s.treatment, objective: s.visual_objective, at };
  }));
  await tools.contactSheet({ video, scenes: beats });
  mkdirSync(join(outDir, "frames"), { recursive: true });
  const grab = (at, file) => execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", at.toFixed(3), "-i", video, "-frames:v", "1", "-q:v", "3", file]);
  for (const b of beats) grab(b.at, join(outDir, "frames", `${b.id}.jpg`));
  // scene-N.jpg: each scene near its end, when its labels and evidence tag are all on screen.
  plan.scenes.forEach((sc, i) => grab(sc.start_s + (sc.end_s - sc.start_s) * 0.9, join(outDir, `scene-${i + 1}.jpg`)));

  // What each scene must carry on screen, read from the same data the composition renders.
  const st = channel.status_labels;
  const labelsOf = (sc, d) => {
    const status = d.ledger ? d.ledger.map((r) => `${st[r.status]}: ${r.head}`).join(" | ") : `${st[d.status]}: ${d.statusDetail}`;
    const by = {
      "everyday-to-biology": { structure: "Temporal lobe", function_or_process: "Sleep loss and new information" },
      "region-highlight": { structure: d.region?.name, function_or_process: d.region?.does },
      "activity-compare": { structure: "Hippocampus", function_or_process: "Activity while learning, two conditions" },
      "neuron-to-spines": { structure: `${d.neuronTitle}, ${d.neuronRegion}; dendritic spine; presynaptic terminal; receptors`, function_or_process: "Synapse: spines lost after sleep loss" },
      "mechanism-rescue": { structure: "Dendrite and actin filament", function_or_process: d.actinLabel },
      "evidence-ledger": { structure: "Dendritic spines", function_or_process: d.recoveryLabel },
    }[sc.treatment];
    return { ...by, evidence_status: status };
  };
  tools.write("label-manifest.json", { note: "Labels each scene must show, derived from the scene data the composition renders.", scenes: plan.scenes.map((sc, i) => ({ scene_id: sc.scene_id, treatment: sc.treatment, labels: labelsOf(sc, scenePlan[i].data) })) });

  const duration = tools.durationOf(video);
  const unsupported = sentences.filter((s) => !s.claim_ids.length || s.claim_ids.some((id) => !claims.some((c) => c.claim_id === id))).map((s) => s.sentence_id);
  const qa = await runQa(outDir, { voice_rate: rate, voice_total_s: total, anima_commit: channel.anima.commit, anima_bio_audit: figures.audit, mask: plates.mask_stats, sentences_without_valid_claims: unsupported });
  tools.stage("qa_passed", qa.ok ? "ok" : "failed");
  if (!qa.ok) throw new Error(`QA failed: ${qa.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`).join("; ")}`);
  tools.stage("preview_ready", "ok", { duration_s: duration });
}
