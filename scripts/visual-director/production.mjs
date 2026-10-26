#!/usr/bin/env node
// Production wrapper for the visual-director pipeline (CI only).
//
// One channel, one committed shorts script:
//   script/research/TTS -> direct -> gate -> materials -> render -> frames ->
//   critic -> rebuild failing scenes (up to VD_MAX_ROUNDS corrective cycles) ->
//   deterministic visual QA -> truthful terminal state -> review queue.
//
// Terminal states (written into the manifest, the QA report and the queue marker):
//   APPROVED       every deterministic check passed, every scene KEEP, the whole-video
//                  mute/alternation checks passed, no hard-gate failure, every material verified
//   FAILED_QA      an MP4 exists (or the director/gate/materials stage stopped before one),
//                  but the video did not earn APPROVED; the report says which check failed
//   RENDER_FAILED  the renderer ran and produced no MP4
//   INPUT_MISSING  script, research, voiceover or word timings absent
//
// Production means VD_PROOF=0: an unverified material is refused, never drawn as a
// marked placeholder. The queue is approved-review/ for APPROVED (human-review policy:
// nothing goes public from this workflow) and rejected/ for everything else.
//
//   node scripts/visual-director/production.mjs --channel 1 [--script <path>]
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runLoop } from "./loop.mjs";
import { qaVideo } from "./qa-video.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "..", "..");
export const TIMELINE_VERSION = "visual-director-v1";
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");
const exists = (p) => !!p && existsSync(p);

function git(args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

export function sourceCommit() {
  return process.env.GITHUB_SHA || git(["rev-parse", "HEAD"]) || "unknown";
}

export function generationId(runId, channel, slug) {
  return `${runId}-ch${channel}-${slug}-${Date.now().toString(36)}`;
}

/** The script prep chose for this channel, or the newest committed shorts script. */
export function findScript(channel, override = null) {
  if (override) {
    const p = resolve(ROOT, override);
    return exists(p) ? p : null;
  }
  const statusPath = join(ROOT, "data", "prep-status", `${channel}.json`);
  if (exists(statusPath)) {
    try {
      const s = readJson(statusPath);
      if (s.script) {
        const p = resolve(ROOT, s.script);
        if (exists(p)) return p;
      }
    } catch { /* fall through to the scan */ }
  }
  const dir = join(ROOT, "data", "research", String(channel));
  if (!exists(dir)) return null;
  // data/tts/** is gitignored and only the prep artifact brings today's voiceover,
  // so a script with audio is today's script and every other is history (same
  // filter as render-and-qa.js findScripts). Newest voiceover wins if two exist.
  const candidates = readdirSync(dir)
    .filter((f) => f.endsWith("-shorts-script.json"))
    .map((f) => join(dir, f))
    .map((p) => {
      const t = ttsFor(p, channel);
      const times = [t.mp3, t.words].filter(exists).map((f) => statSync(f).mtimeMs);
      return { p, tts: times.length ? Math.max(...times) : null };
    })
    .filter((c) => c.tts != null)
    .sort((a, b) => b.tts - a.tts);
  return candidates[0]?.p || null;
}

export function researchFor(script) {
  const p = script.replace(/-shorts-script\.json$/i, ".json").replace(/-longform-script\.json$/i, ".json");
  return exists(p) ? p : null;
}

export function ttsFor(script, channel) {
  const stem = basename(script).replace(/\.json$/i, "");
  const dir = join(ROOT, "data", "tts", String(channel));
  return {
    dir,
    mp3: join(dir, `${stem}-vo.mp3`),
    srt: join(dir, `${stem}-vo.srt`),
    words: join(dir, `${stem}-vo-words.json`),
  };
}

export function slugFor(script) {
  return basename(script).replace(/-shorts-script\.json$/i, "").replace(/-longform-script\.json$/i, "").replace(/\.json$/i, "");
}

/**
 * The name a queued MP4 must carry. render-and-qa.js names it
 * `<script basename minus -script>-<format>-<date>.mp4`, and the publisher
 * recovers the script from that name (`topicSlugFromVideo` -> `<slug>-script.json`
 * -> the script's authoritative topic_slug). Keeping the same shape is what lets
 * review-publish find the SEO file and the per-video thumbnail.
 */
export function queueSlugFor(script) {
  return basename(script).replace(/\.json$/i, "").replace(/-script$/i, "");
}

/** Voiceover is an input: synthesize it once if prep did not leave all three files. */
export function ensureTts(script, channel) {
  const t = ttsFor(script, channel);
  if (exists(t.mp3) && exists(t.srt) && exists(t.words)) return { ok: true, tts: t, synthesized: false };
  const r = spawnSync(process.execPath, [join(ROOT, "src", "utils", "tts.js"), String(channel), rel(script)], { cwd: ROOT, encoding: "utf8", timeout: 15 * 60 * 1000 });
  if (r.status !== 0 || !exists(t.mp3) || !exists(t.srt) || !exists(t.words)) {
    return { ok: false, tts: t, synthesized: true, error: `tts.js exit ${r.status}: ${(r.stderr || r.stdout || "").slice(-600)}` };
  }
  return { ok: true, tts: t, synthesized: true };
}

/** True when the critic kept every scene and the whole-video checks passed. */
export function criticApproved(critic) {
  if (!critic || critic.status !== "complete") return false;
  const scenes = critic.scenes || [];
  if (!scenes.length || scenes.some((s) => s.effective_verdict !== "KEEP")) return false;
  const w = critic.whole_video?.answer;
  return !!w && w.template_alternation === "yes" && w.whole_mute_test === "yes";
}

/** Terminal state from the evidence. Pure; tested. */
export function decideTerminal({ hasVideo, renderFailed = false, qa, critic, gateFailures = [] }) {
  if (!hasVideo) return renderFailed ? "RENDER_FAILED" : "FAILED_QA";
  const gateClean = !(gateFailures || []).length;
  if (qa?.pass && criticApproved(critic) && gateClean) return "APPROVED";
  return "FAILED_QA";
}

function firstFailure(qa, critic, gateFailures) {
  const failed = (qa?.checks || []).filter((c) => !c.pass).map((c) => c.id);
  if (failed.length) return { stage: "deterministic-qa", check: failed.join(",") };
  if ((gateFailures || []).length) return { stage: "gate", check: gateFailures.map((f) => `b${f.beat_index ?? "*"}:${f.rule}`).join(",") };
  const bad = (critic?.scenes || []).filter((s) => s.effective_verdict !== "KEEP").map((s) => `b${s.beat_index}:${s.effective_verdict || s.status}`);
  if (bad.length) return { stage: "critic", check: bad.join(",") };
  if (!criticApproved(critic)) return { stage: "critic", check: `whole-video: ${critic?.status || "absent"}` };
  return { stage: null, check: null };
}

function lastRendered(report) {
  return (report?.rounds || []).filter((r) => r.video && exists(r.video)).slice(-1)[0] || null;
}

function materialRows(report) {
  return (report?.beats || []).flatMap((b) => (b.materials || []).map((m) => ({
    beat_index: b.beat_index, shot_id: m.shot_id, id: m.material_id, kind: m.kind,
    must_show: m.must_show, status: m.status, why_missing: m.why_missing || null,
    source_url: m.chosen?.source_url || null, credit: m.chosen?.credit || null, license: m.chosen?.license || null,
  })));
}

/** CC-BY/Wikimedia attribution the publisher appends to the description. Pure; tested. */
export function imageCredits(materials) {
  const out = new Set();
  for (const m of materialRows(materials)) {
    if (m.status !== "verified") continue;
    if (m.credit) out.add(m.credit);
    else if (m.source_url) out.add(`${m.license || "source"}: ${m.source_url}`);
  }
  return [...out];
}

/** Build the manifest that travels with the MP4 and into the QA report. */
export function buildManifest({ runId, source, generation, channel, script, research, video, direction, shotsDoc, sfxDoc, materials, materialsPath, critic, loopReport, qa, terminal, qaReport, contactSheet, comparison, timelineSha256 = null, gateFailures = [] }) {
  const beats = direction?.beats || [];
  const shots = shotsDoc?.shots || [];
  return {
    schema_version: 1,
    producer: "scripts/visual-director/production.mjs",
    terminal_state: terminal,
    run_id: runId,
    source_commit: source,
    generation_id: generation,
    timeline_version: TIMELINE_VERSION,
    timeline_sha256: timelineSha256,
    channel: Number(channel),
    script: rel(script),
    research: research ? rel(research) : null,
    video: rel(video),
    duration_s: qa?.probe?.duration ?? null,
    created_at: new Date().toISOString(),
    rounds: loopReport?.rounds?.length ?? null,
    max_rounds: loopReport?.max_rounds ?? null,
    stop_reason: loopReport?.stop_reason ?? null,
    timeline: {
      beats: beats.length,
      shots: shots.length,
      families: [...new Set(shots.map((s) => s.family).filter(Boolean))],
      camera_moves: [...new Set(shots.map((s) => s.move).filter(Boolean))],
      transitions: [...new Set(shots.map((s) => s.transition_out || "cut"))],
      beat_windows: beats.map((b) => ({ beat_index: b.beat_index, t_start: b.t_start, t_end: b.t_end, family: b.mechanism?.family, shots: (b.shots || []).length })),
    },
    effects: {
      shots: shots.length,
      moving_shots: shots.filter((s) => s.move && s.move !== "hold").length,
      non_cut_transitions: shots.filter((s) => (s.transition_out || "cut") !== "cut").length,
      sfx_cues: (sfxDoc?.cues || []).length,
      mapped_sfx: (sfxDoc?.cues || []).filter((c) => c.mapped && c.file).length,
      sidecar: video ? rel(video.replace(/\.mp4$/i, ".shots.json")) : null,
    },
    asset_manifest: {
      report: materialsPath ? rel(materialsPath) : null,
      summary: materials?.summary || null,
      materials: materialRows(materials),
    },
    qa: {
      deterministic: qa?.checks || [],
      deterministic_pass: !!qa?.pass,
      probe: qa?.probe || null,
      black_segments: qa?.black || [],
      freeze_segments: qa?.freeze || [],
      volume: qa?.volume || null,
      critic_status: critic?.status || "absent",
      critic_approved: criticApproved(critic),
      scenes: (critic?.scenes || []).map((s) => ({ beat_index: s.beat_index, status: s.status, verdict: s.verdict, effective_verdict: s.effective_verdict, escalated: s.escalated || null })),
      whole_video: critic?.whole_video || null,
      gate_failures: gateFailures,
      report: qaReport ? rel(qaReport) : null,
    },
    contact_sheet: contactSheet ? rel(contactSheet) : null,
    comparison: comparison ? rel(comparison) : null,
  };
}

function writeJson(p, x) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(x, null, 2) + "\n");
}

function queue({ terminal, video, channel, markerExtra, credits = [], approvedDir, rejectedDir }) {
  const verdict = terminal === "APPROVED" ? "approved-review" : "rejected";
  const dir = verdict === "approved-review" ? approvedDir : rejectedDir;
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, basename(video));
  copyFileSync(video, dest);
  try { rmSync(video); } catch { /* the queue copy is the record */ }
  writeJson(join(dir, `${basename(video, ".mp4")}.json`), { ...markerExtra, verdict, qa_verdict: terminal });
  // The publisher looks for <slug>-<format>-image-credits.json beside the queued MP4
  // (src/skills/youtube-publish/run.js creditsPathFor), or the CC-BY attribution is lost.
  const creditsName = `${basename(video, ".mp4").replace(/-\d{4}-\d{2}-\d{2}$/, "")}-image-credits.json`;
  writeJson(join(dir, creditsName), credits);
  return { verdict, dest };
}

export async function runProduction({ channel, scriptOverride = null, runId = process.env.GITHUB_RUN_ID || `local-${Date.now()}`, maxRounds = +(process.env.VD_MAX_ROUNDS || 5), maxMs = +(process.env.VD_MAX_MS || 60 * 60 * 1000), log = console.log } = {}) {
  const source = sourceCommit();
  const script = findScript(channel, scriptOverride);
  const results = [];
  if (!script) {
    const r = { channel: Number(channel), terminal_state: "INPUT_MISSING", reason: "no committed shorts script with a voiceover", run_id: runId, source_commit: source };
    const p = join(ROOT, "data", "visual-director", String(channel), "input-missing.json");
    writeJson(p, r);
    results.push({ ...r, report: rel(p) });
    return results;
  }
  const slug = slugFor(script);
  const research = researchFor(script);
  const tts = ensureTts(script, channel);
  if (!research || !tts.ok) {
    const r = {
      channel: Number(channel), script: rel(script), terminal_state: "INPUT_MISSING",
      reason: !research ? "research file missing" : `voiceover missing: ${tts.error}`,
      run_id: runId, source_commit: source,
    };
    const p = join(ROOT, "data", "visual-director", String(channel), "input-missing.json");
    writeJson(p, r);
    results.push({ ...r, report: rel(p) });
    return results;
  }
  const outDir = join(ROOT, "data", "visual-director", String(channel), slug);
  mkdirSync(outDir, { recursive: true });
  log(`[production] ch-${channel} ${rel(script)} -> ${rel(outDir)} (run ${runId}, commit ${source.slice(0, 8)})`);
  const loopReport = await runLoop({
    script, research, tts: tts.tts.dir, channel: String(channel), outDir,
    maxRounds, maxMs, gateMode: process.env.VD_GATE || "record",
  });
  const last = lastRendered(loopReport);
  const base = { channel: Number(channel), script: rel(script), research: rel(research), run_id: runId, source_commit: source, out_dir: rel(outDir), rounds: loopReport.rounds.length };
  if (!last) {
    const terminal = decideTerminal({ hasVideo: false, renderFailed: /render failed/i.test(loopReport.stop_reason || "") });
    const r = { ...base, terminal_state: terminal, reason: loopReport.stop_reason || "no rendered round", loop_report: rel(join(outDir, "loop-report.json")) };
    writeJson(join(outDir, "production-report.json"), r);
    results.push(r);
    return results;
  }

  const directionPath = last.direction;
  const direction = readJson(directionPath);
  const materialsPath = last.materials_report;
  const materials = exists(materialsPath) ? readJson(materialsPath) : null;
  const critic = last.critic;
  const roundDir = join(outDir, `round-${last.round}`);
  const framesPath = join(roundDir, "frames", "frames-index.json");
  const framesIndex = exists(framesPath) ? readJson(framesPath) : null;
  const shotsPath = last.video.replace(/\.mp4$/i, ".shots.json");
  const sfxPath = last.video.replace(/\.mp4$/i, ".sfx.json");
  const shotsDoc = exists(shotsPath) ? readJson(shotsPath) : null;
  const sfxDoc = exists(sfxPath) ? readJson(sfxPath) : null;
  let qa;
  try {
    qa = qaVideo({ video: last.video, direction, framesIndex, shotsDoc, sfxDoc, materialsReport: materials, expected: null });
  } catch (e) {
    // ffmpeg/ffprobe missing or a corrupt MP4: a QA that cannot run is a failure,
    // never a pass, and the reason travels with the report.
    qa = { pass: false, checks: [{ id: "qa.error", pass: false, detail: String(e?.message || e).slice(0, 500) }], probe: null, black: [], freeze: [], volume: null };
  }
  const qaPath = join(roundDir, "qa-deterministic.json");
  writeJson(qaPath, qa);
  const gateFailures = last.gate_failures || [];
  const terminal = decideTerminal({ hasVideo: true, qa, critic, gateFailures });
  const generation = generationId(runId, channel, slug);
  const failure = terminal === "APPROVED" ? { stage: null, check: null } : firstFailure(qa, critic, gateFailures);
  const timelineSha256 = createHash("sha256").update(readFileSync(directionPath)).digest("hex");
  const manifest = buildManifest({
    runId, source, generation, channel, script, research, video: last.video, direction, shotsDoc, sfxDoc,
    materials, materialsPath, critic, loopReport, qa, terminal, qaReport: qaPath,
    contactSheet: last.contact_sheet, comparison: join(outDir, "comparison.md"),
    timelineSha256, gateFailures,
  });
  const manifestPath = join(outDir, `${slug}-manifest.json`);
  writeJson(manifestPath, manifest);
  const qaReport = {
    schema_version: 1, terminal_state: terminal, generation_id: generation, run_id: runId, source_commit: source,
    timeline_version: TIMELINE_VERSION, channel: Number(channel), script: rel(script),
    manifest: rel(manifestPath), qa_deterministic: rel(qaPath), loop_report: rel(join(outDir, "loop-report.json")),
    comparison: rel(join(outDir, "comparison.md")), contact_sheet: last.contact_sheet ? rel(last.contact_sheet) : null,
    failed_stage: failure.stage, failed_check: failure.check,
    deterministic: qa.checks, critic: { status: critic?.status || "absent", approved: criticApproved(critic), scenes: manifest.qa.scenes, whole_video: manifest.qa.whole_video },
    gate_failures: gateFailures,
    asset_coverage: materials?.summary || null,
    rounds: loopReport.rounds.map((r) => ({ round: r.round, rebuilt: r.rebuilt, verdicts: (r.critic?.scenes || []).map((s) => ({ beat_index: s.beat_index, effective_verdict: s.effective_verdict })) })),
  };
  const qaReportPath = join(outDir, `${slug}-qa-report.json`);
  writeJson(qaReportPath, qaReport);

  // The queue owns the MP4: data/renders/<ch>/ must not keep a copy outside a queue.
  const renderDir = join(ROOT, "data", "renders", String(channel));
  mkdirSync(renderDir, { recursive: true });
  const dated = join(renderDir, `${queueSlugFor(script)}-shorts-${new Date().toISOString().slice(0, 10)}.mp4`);
  copyFileSync(last.video, dated);
  const markerExtra = {
    run_id: runId, channel: Number(channel), failed_stage: failure.stage, failed_check: failure.check,
    reason: terminal === "APPROVED" ? "visual director APPROVED: every scene KEEP, deterministic QA pass" : `visual director ${terminal}: ${failure.stage || "qa"} ${failure.check || ""}`.trim(),
    duration_s: qa.probe?.duration ? Math.round(qa.probe.duration * 10) / 10 : null,
    queued_at: new Date().toISOString(), source_commit: source, generation_id: generation,
    timeline_version: TIMELINE_VERSION, manifest: rel(manifestPath), qa_report: rel(qaReportPath),
    rounds: loopReport.rounds.length, contact_sheet: manifest.contact_sheet,
  };
  const q = queue({ terminal, video: dated, channel, markerExtra, credits: imageCredits(materials),
    approvedDir: join(ROOT, "data", "renders", "approved-review"),
    rejectedDir: join(ROOT, "data", "renders", "rejected") });

  const summary = {
    ...base, terminal_state: terminal, failed_stage: failure.stage, failed_check: failure.check,
    generation_id: generation, video: rel(q.dest), manifest: rel(manifestPath), qa_report: rel(qaReportPath),
    contact_sheet: manifest.contact_sheet, comparison: manifest.comparison, rounds_used: loopReport.rounds.length,
    asset_coverage: materials?.summary || null,
    qa_pass: !!qa.pass, critic_approved: criticApproved(critic),
  };
  writeJson(join(outDir, "production-report.json"), summary);
  results.push(summary);
  return results;
}

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const channels = String(arg("channel") || process.env.VD_CHANNEL || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!channels.length) { console.error("usage: production.mjs --channel <id[,id]> [--script <path>]"); process.exit(2); }
  const all = [];
  for (const ch of channels) all.push(...await runProduction({ channel: ch, scriptOverride: arg("script") }));
  mkdirSync(join(ROOT, "data", "renders"), { recursive: true });
  const approved = all.filter((r) => r.terminal_state === "APPROVED").length;
  const review = all.filter((r) => r.terminal_state === "APPROVED").length; // APPROVED queues to approved-review/
  const rejected = all.filter((r) => r.terminal_state !== "APPROVED").length;
  writeFileSync(join(ROOT, "data", "renders", "qa-counts.json"), JSON.stringify({ approved: 0, "approved-review": review, rejected }) + "\n");
  writeJson(join(ROOT, "data", "renders", "production-summary.json"), all);
  const lines = ["# Visual director production", ""];
  for (const r of all) lines.push(`- ch-${r.channel}: **${r.terminal_state}**${r.failed_stage ? ` (${r.failed_stage}: ${r.failed_check})` : ""}${r.video ? ` — \`${r.video}\`` : ""}`);
  writeFileSync(join(ROOT, "data", "renders", "production-summary.md"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { writeFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n", { flag: "a" }); } catch { /* summary is best-effort */ }
  }
  // An APPROVED video is still a human-review upload, so approved-count is 0;
  // the old contract is "at least one video passed QA". A red job with a real
  // MP4 in rejected/ is honest; a green job with none is not.
  if (approved === 0) {
    console.error("::error::no video reached APPROVED - nothing for review-publish to upload.");
    process.exit(1);
  }
}
