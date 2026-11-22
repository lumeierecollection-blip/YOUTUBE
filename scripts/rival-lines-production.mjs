#!/usr/bin/env node
/** Isolated Rival Lines storyboard → explicit approval → Remotion render → inspection workflow. */
import "dotenv/config";
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { currentApproval, startReviewServer, storyboardHash, validateRivalLinesStoryboard, writePostRenderReport } from "./rival-lines-storyboard.mjs";
import { validateRivalLinesScript } from "./rival-lines-script-gate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_JSX = join(ROOT, "src", "skills", "remotion-render", "Root.jsx");
const require = createRequire(import.meta.url);
const ffmpeg = (() => { try { return require("ffmpeg-static"); } catch { return "ffmpeg"; } })();
const get = (k, fallback = null) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? fallback : process.argv[i + 1] || fallback; };
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, x) => writeFileSync(p, JSON.stringify(x, null, 2) + "\n");
const ensure = (p) => mkdirSync(p, { recursive: true });
const safeName = (x) => String(x).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "rival-lines";
const allowedRoot = resolve(ROOT, "data", "rival-lines");
const ensureRivalPath = (p) => { const dest = resolve(ROOT, p); if (dest !== allowedRoot && !dest.startsWith(allowedRoot + sep)) throw new Error("Rival Lines job files must stay inside data/rival-lines/"); return dest; };

async function bundleFor(outDir) {
  const publicDir = join(outDir, "public"); ensure(publicDir);
  const serveUrl = await bundle({ entryPoint: ROOT_JSX, publicDir, onProgress: () => {} });
  return { serveUrl, publicDir };
}

async function prepare() {
  const inputPath = get("storyboard");
  if (!inputPath) throw new Error('prepare requires --storyboard <Rival Lines storyboard JSON>');
  const inputAbs = resolve(ROOT, inputPath);
  const original = json(inputAbs);
  const scriptInput = get("script", original.script_path || null);
  if (!scriptInput) throw new Error("prepare requires --script <final Rival Lines script JSON>; include the final script in the storyboard version hash.");
  const scriptAbs = resolve(ROOT, scriptInput), script = json(scriptAbs), scriptGate = validateRivalLinesScript(script);
  const jobId = safeName(original.job_id || original.topic_slug || basename(inputAbs, extname(inputAbs)));
  const outDir = ensureRivalPath(get("out", join("data", "rival-lines", jobId)));
  const publicDir = join(outDir, "public", "rival-lines", "assets");
  const stillsDir = join(outDir, "stills"); ensure(publicDir); ensure(stillsDir);
  const doc = structuredClone(original);
  doc.script_path = scriptInput;
  doc.script_sha256 = (await import("node:crypto")).createHash("sha256").update(readFileSync(scriptAbs)).digest("hex");
  doc.script_gate = scriptGate;
  doc.fps = Number(doc.fps) || 30; doc.width = Number(doc.width) || 1920; doc.height = Number(doc.height) || 1080;
  const mediaErrors = [];
  for (const a of doc.assets || []) {
    if (!a.path) { mediaErrors.push(`${a.id}: no local media file`); continue; }
    const src = resolve(ROOT, a.path);
    if (!existsSync(src)) { mediaErrors.push(`${a.id}: local file missing (${a.path})`); continue; }
    const file = `${safeName(a.id)}${extname(src).toLowerCase() || ".bin"}`;
    const dest = join(publicDir, file); copyFileSync(src, dest);
    a.render_path = `rival-lines/assets/${file}`;
    a.preview_path = a.render_path;
  }
  for (const scene of doc.scenes || []) {
    const a = (doc.assets || []).find((x) => x.id === scene.media?.asset_id);
    if (a?.render_path) scene.media.path = a.render_path;
    else mediaErrors.push(`scene ${scene.id}: selected media is unavailable`);
    if (scene.branding?.crest_asset_id) {
      const crest = (doc.assets || []).find((x) => x.id === scene.branding.crest_asset_id);
      if (crest?.render_path) scene.branding.crest_path = crest.render_path;
      else mediaErrors.push(`scene ${scene.id}: selected club crest is unavailable`);
    }
    if (scene.branding?.competition_asset_id) {
      const competition = (doc.assets || []).find((x) => x.id === scene.branding.competition_asset_id);
      if (competition?.render_path) scene.branding.competition_path = competition.render_path;
      else mediaErrors.push(`scene ${scene.id}: selected competition mark is unavailable`);
    }
    scene.duration_frames = Number(scene.duration_frames) || Math.round((Number(scene.duration_sec) || 5) * doc.fps);
  }
  if (doc.voiceover?.path) {
    const audioPath = resolve(ROOT, doc.voiceover.path);
    if (existsSync(audioPath)) {
      const file = `voiceover${extname(audioPath).toLowerCase() || ".mp3"}`;
      copyFileSync(audioPath, join(publicDir, file)); doc.voiceover.render_path = `rival-lines/assets/${file}`;
    } else mediaErrors.push(`voiceover file missing (${doc.voiceover.path})`);
  } else mediaErrors.push("final voiceover path is required");
  doc.storyboard_hash = storyboardHash(doc);
  const validation = validateRivalLinesStoryboard(doc, { root: ROOT, requireFiles: false });
  const scriptSections = new Set((script.sections || []).map((s) => String(s.id || "")));
  const narrationErrors = (doc.scenes || []).filter((s) => !scriptSections.has(String(s.narration_ref || ""))).map((s) => `scene ${s.id}: narration_ref "${s.narration_ref || ""}" does not match a final-script section`);
  const blockers = [...validation.errors, ...mediaErrors, ...scriptGate.errors, ...narrationErrors];
  const report = { channel_id: "ch-51", storyboard_hash: doc.storyboard_hash, validation, script_gate: scriptGate, media_errors: [...new Set(mediaErrors)], narration_errors: narrationErrors, blockers: [...new Set(blockers)], prepared_at: new Date().toISOString() };
  writeJson(join(outDir, "storyboard.json"), doc); writeJson(join(outDir, "preflight.json"), report);

  const { serveUrl } = await bundleFor(outDir);
  for (const scene of doc.scenes || []) {
    const still = join(stillsDir, `${safeName(scene.id)}.png`);
    const props = { storyboard: doc, onlySceneId: scene.id };
    const comp = await selectComposition({ serveUrl, id: "RivalLinesVideo", inputProps: props });
    const frame = Math.min(Math.max(0, Math.floor((Number(scene.duration_frames) || 1) * 0.55)), comp.durationInFrames - 1);
    await renderStill({ serveUrl, composition: comp, inputProps: props, output: still, frame, imageFormat: "png" });
    scene.preview_file = safeName(scene.id);
  }
  const cols = 2, cardW = 960, cardH = 540, pad = 18, rows = Math.ceil(doc.scenes.length / cols);
  const sheet = sharp({ create: { width: cols * cardW + (cols + 1) * pad, height: rows * cardH + (rows + 1) * pad, channels: 4, background: "#101820" } });
  const composites = [];
  for (let i = 0; i < doc.scenes.length; i++) {
    const scene = doc.scenes[i], x = pad + (i % cols) * (cardW + pad), y = pad + Math.floor(i / cols) * (cardH + pad);
    composites.push({ input: await sharp(join(stillsDir, `${safeName(scene.id)}.png`)).resize(cardW, cardH, { fit: "cover" }).png().toBuffer(), left: x, top: y });
  }
  await sheet.composite(composites).png().toFile(join(outDir, "contact-sheet.png"));
  writeJson(join(outDir, "storyboard.json"), doc);
  console.log(`[rival-lines] pre-render scenes: ${doc.scenes.length}; contact sheet: ${join(outDir, "contact-sheet.png")}`);
  console.log(`[rival-lines] storyboard hash: ${doc.storyboard_hash}`);
  for (const e of report.blockers) console.error(`::error::[rival-lines] ${e}`);
  if (report.blockers.length) console.error("Previews are review evidence only; approval and final rendering are blocked until script, timing, and media requirements are met.");
  return outDir;
}

async function renderFinal() {
  const storyboardPath = get("storyboard");
  if (!storyboardPath) throw new Error('render requires --storyboard <prepared storyboard.json>');
  const docPath = ensureRivalPath(storyboardPath), outDir = dirname(docPath), doc = json(docPath);
  const preflightPath = join(outDir, "preflight.json");
  if (!existsSync(preflightPath)) throw new Error("Full render blocked: preflight report is missing.");
  const preflight = json(preflightPath);
  if (preflight.storyboard_hash !== storyboardHash(doc)) throw new Error("Full render blocked: preflight does not match the current storyboard/script version; prepare previews again.");
  if (preflight.blockers?.length) throw new Error(`Full render blocked by preflight: ${preflight.blockers.join("; ")}`);
  const approvalPath = join(outDir, "approval.json");
  if (!existsSync(approvalPath)) throw new Error("No persisted approval exists. Open the review interface and explicitly approve every scene and the complete storyboard first.");
  const approval = json(approvalPath), approved = currentApproval(doc, approval);
  if (!approved.approved) throw new Error(`Full render blocked: ${approved.reason}`);
  const validation = validateRivalLinesStoryboard(doc, { root: ROOT, requireFiles: true });
  if (!validation.ok) throw new Error(`Full render blocked by asset/storyboard validation: ${validation.errors.join("; ")}`);
  const scriptFile = doc.script_path ? resolve(ROOT, doc.script_path) : null;
  if (!scriptFile || !existsSync(scriptFile)) throw new Error("Full render blocked: approved final script file is missing.");
  const actualScriptHash = (await import("node:crypto")).createHash("sha256").update(readFileSync(scriptFile)).digest("hex");
  if (actualScriptHash !== doc.script_sha256) throw new Error("Full render blocked: final script changed since storyboard approval; prepare and approve the revised storyboard.");
  const identityError = (doc.assets || []).filter((a) => !a.source_url || !a.rights?.basis || !a.rights?.evidence_url || !a.rights?.permitted_use || a.rights?.status === "rejected" || a.verification?.status === "rejected");
  if (identityError.length) throw new Error(`Full render blocked: media records are incomplete/rejected: ${identityError.map((a) => a.id).join(", ")}`);
  if (!doc.voiceover?.render_path) throw new Error("Full render blocked: the approved storyboard has no staged voiceover audio.");
  const framesArg = get("frames", null);
  const frameRange = framesArg ? framesArg.split("-").map((n) => Number(n)) : null;
  if (frameRange && (frameRange.length !== 2 || frameRange.some((n) => !Number.isFinite(n) || n < 0))) throw new Error("--frames must be start-end");
  const muted = process.argv.includes("--muted");
  const outputLocation = get("output") ? resolve(ROOT, get("output")) : join(outDir, "final.mp4");
  const { serveUrl } = await bundleFor(outDir);
  const composition = await selectComposition({ serveUrl, id: "RivalLinesVideo", inputProps: { storyboard: doc, onlySceneId: null } });
  await renderMedia({ composition, serveUrl, codec: "h264", audioCodec: muted ? undefined : "aac", muted, inputProps: { storyboard: doc, onlySceneId: null }, outputLocation, imageFormat: "jpeg", crf: 18, pixelFormat: "yuv420p", concurrency: Math.max(2, Math.min(4, require("node:os").cpus().length)), timeoutInMilliseconds: 120000, ...(frameRange ? { frameRange } : {}) });
  console.log(`[rival-lines] final render: ${outputLocation}`);
  if (!frameRange) await inspectFinal(docPath, outputLocation, outDir);
}

async function inspectFinal(storyboardPath, videoPath = null, outDir = null) {
  const p = ensureRivalPath(storyboardPath), doc = json(p), dir = outDir || dirname(p), video = videoPath || join(dir, "final.mp4");
  if (!existsSync(video)) throw new Error(`Post-render inspection requires the actual MP4: ${video}`);
  const frameDir = join(dir, "post-render-frames"); ensure(frameDir);
  const ffprobe = process.env.FFPROBE || "ffprobe";
  const { execFileSync } = await import("node:child_process");
  const duration = Number(execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", video], { encoding: "utf8" }).trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("MP4 duration is unreadable");
  const frames = [];
  let start = 0;
  for (const scene of doc.scenes) {
    const sec = Number(scene.duration_frames) / Number(doc.fps || 30);
    const t = Math.min(duration - 0.05, start + Math.max(0.25, sec * 0.55));
    const path = join(frameDir, `${safeName(scene.id)}.png`);
    execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(t), "-i", video, "-frames:v", "1", path]);
    frames.push({ scene_id: scene.id, narration: scene.narration, timestamp_sec: +t.toFixed(3), path: `post-render-frames/${basename(path)}`, expected_player: scene.player?.name || null, media_asset_id: scene.media?.asset_id || null });
    start += sec;
  }
  const cols = 2, w = 960, h = 540, pad = 18, rows = Math.ceil(frames.length / cols);
  await sharp({ create: { width: cols * w + (cols + 1) * pad, height: rows * h + (rows + 1) * pad, channels: 4, background: "#101820" } })
    .composite(await Promise.all(frames.map(async (f, i) => ({ input: await sharp(join(dir, f.path)).resize(w, h, { fit: "cover" }).png().toBuffer(), left: pad + (i % cols) * (w + pad), top: pad + Math.floor(i / cols) * (h + pad) }))))
    .png().toFile(join(dir, "post-render-contact.png"));
  const report = { channel_id: "ch-51", video: video, video_duration_sec: duration, expected_storyboard_duration_sec: frames.reduce((n, f, i) => n + Number(doc.scenes[i].duration_frames) / Number(doc.fps || 30), 0), storyboard_hash: storyboardHash(doc), scene_frames: frames, status: "awaiting-independent-visual-inspection", inspected_at: null, note: "A contact sheet of actual MP4 frames was generated. No visual pass is recorded until the reviewer inspects these frames and completes the post-render review interface." };
  writePostRenderReport(dir, report);
  console.log(`[rival-lines] post-render inspection evidence: ${join(dir, "post-render-contact.png")}`);
  console.log(`[rival-lines] report status: awaiting-independent-visual-inspection`);
}

async function main() {
  const command = process.argv[2];
  if (command === "prepare") return prepare();
  if (command === "review") {
    const p = get("storyboard"); if (!p) throw new Error("review requires --storyboard");
    const storyboardPath = ensureRivalPath(p), outDir = dirname(storyboardPath);
    const server = await startReviewServer({ storyboardPath, outDir, port: Number(get("port", "4173")) });
    console.log(`Rival Lines review server: http://127.0.0.1:${server.address().port}`);
    console.log(`Pre-render approval file: ${join(outDir, "approval.json")}`);
    return new Promise(() => {});
  }
  if (command === "render") return renderFinal();
  if (command === "inspect") { const p = get("storyboard"); if (!p) throw new Error("inspect requires --storyboard"); return inspectFinal(p); }
  throw new Error("Usage: node scripts/rival-lines-production.mjs <prepare|review|render|inspect> --storyboard file.json");
}

main().catch((e) => { console.error(`[rival-lines] ${e.message}`); process.exit(1); });
