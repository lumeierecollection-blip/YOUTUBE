/**
 * Gray Matter channel QA. Runs on the runner with no Claude session:
 *   node platform/channels/gray-matter/qa.mjs <run output dir>
 * Writes qa-report.json into that directory and exits 1 when a check fails.
 *
 * What it can and cannot show: it measures the MP4 (duration, size, audio), checks that every scene
 * declares the labels the picture must carry (region or structure, what it does, process, evidence
 * status) against label-manifest.json written by preview.mjs from the same props the composition renders,
 * and checks every scene frame is not blank. It does not OCR the frames, so whether a label is
 * legible and correctly placed is a human judgement made on the contact sheet and scene-*.jpg.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const channel = JSON.parse(readFileSync(join(HERE, "channel.json"), "utf8"));

const probe = (file, args) => execFileSync("ffprobe", ["-v", "error", ...args, "-of", "csv=p=0", file]).toString().trim();

export async function runQa(outDir, extra = {}) {
  const sharp = createRequire(join(ROOT, "package.json"))("sharp");
  const video = join(outDir, "preview.mp4");
  const checks = [];
  const check = (id, ok, detail) => checks.push({ id, ok: Boolean(ok), detail });

  const duration = existsSync(video) ? Number(probe(video, ["-show_entries", "format=duration"])) : NaN;
  const [width, height] = existsSync(video) ? probe(video, ["-select_streams", "v:0", "-show_entries", "stream=width,height"]).split(",").map(Number) : [0, 0];
  const fps = existsSync(video) ? probe(video, ["-select_streams", "v:0", "-show_entries", "stream=r_frame_rate"]).replace(/,$/, "") : "";
  const audio = existsSync(video) ? probe(video, ["-select_streams", "a", "-show_entries", "stream=codec_name"]) : "";
  check("duration", duration <= channel.format.max_seconds && duration > 5, `${duration.toFixed(2)} s, limit ${channel.format.max_seconds} s, measured from the MP4`);
  check("resolution", width === channel.format.width && height === channel.format.height, `${width}x${height}, required ${channel.format.width}x${channel.format.height}`);
  check("fps", fps === `${channel.format.fps}/1`, fps);
  check("audio", Boolean(audio), audio || "no audio stream");
  check("voice-preview", existsSync(join(outDir, "voice-preview.mp3")), "voice-preview.mp3");

  const plan = JSON.parse(readFileSync(join(outDir, "scene-plan.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(join(outDir, "label-manifest.json"), "utf8"));
  const scenes = [];
  for (const [i, scene] of plan.scenes.entries()) {
    const m = manifest.scenes.find((x) => x.scene_id === scene.scene_id) || { labels: {} };
    const frame = join(outDir, `scene-${i + 1}.jpg`);
    const problems = [];
    for (const need of ["structure", "function_or_process", "evidence_status"]) if (!m.labels[need] || !String(m.labels[need]).trim()) problems.push(`missing ${need} label`);
    if (!scene.claim_ids.length) problems.push("no claim ids");
    if (scene.background !== "white") problems.push(`background is ${scene.background}, explanatory scenes are white`);
    if (!existsSync(frame)) problems.push("no scene frame");
    else {
      const s = await sharp(frame).stats();
      const spread = Math.max(...s.channels.map((c) => c.stdev));
      if (spread < 8) problems.push(`frame looks blank (stdev ${spread.toFixed(1)})`);
    }
    scenes.push({ scene_id: scene.scene_id, treatment: scene.treatment, labels: m.labels, problems });
  }
  check("every-scene-labelled", scenes.every((s) => !s.problems.length), scenes.filter((s) => s.problems.length).map((s) => `${s.scene_id}: ${s.problems.join(", ")}`).join("; ") || `${scenes.length} scenes, each with structure, function/process and evidence-status labels`);
  const frames = readdirSync(outDir).filter((f) => /^scene-\d+\.jpg$/.test(f));
  check("scene-frames", frames.length === plan.scenes.length, `${frames.length} scene-*.jpg for ${plan.scenes.length} scenes`);
  const script = JSON.parse(readFileSync(join(outDir, "script-package.json"), "utf8"));
  check("narration-marked-provisional", Boolean(script.provisional), script.provisional || "missing");
  const claimIds = new Set(JSON.parse(readFileSync(join(outDir, "claims.json"), "utf8")).map((c) => c.claim_id));
  const dangling = script.sentences.filter((s) => !s.claim_ids.length || s.claim_ids.some((id) => !claimIds.has(id))).map((s) => s.sentence_id);
  check("every-sentence-has-claim-record", !dangling.length, dangling.join(", ") || "all sentences cite existing claim records");

  const report = { channel: channel.key, ok: checks.every((c) => c.ok), duration_s: duration, width, height, fps, audio, provisional: script.provisional, voice_notice: channel.voice.generated_speech_notice, checks, scenes, ...extra, not_checked: "Legibility and anatomical placement are judged by looking at contact-sheet.jpg and scene-*.jpg; this script does not OCR." };
  writeFileSync(join(outDir, "qa-report.json"), JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await runQa(resolve(process.argv[2] || "."));
  console.log(JSON.stringify({ ok: report.ok, checks: report.checks.map((c) => `${c.ok ? "pass" : "FAIL"} ${c.id}: ${c.detail}`) }, null, 2));
  process.exit(report.ok ? 0 : 1);
}
