#!/usr/bin/env node
/**
 * Autopilot entry point, called once per step by .github/workflows/autopilot.yml:
 *   select    decide which slot this run produces and claim it (atomic git push)
 *   produce   topic -> research -> script -> narration -> visuals -> render -> gates
 *   deliver   private upload and YouTube read-back, only after every gate passed
 *   finish    performance, dashboard, final state commit
 */
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { CONFIG, ROOT, STATE_DIR, StageError, channelConfig, log, readJson, run, sha256File, workDir, writeJson } from "./lib.mjs";
import { loadLedger, pickDueSlot, reapStale, saveLedger } from "./schedule.mjs";

const MAX_TOPICS_PER_RUN = 3;
// Failures that are about the topic itself, so the next candidate may succeed.
const TOPIC_LEVEL_STAGES = new Set(["research", "script", "tts", "assets", "vox-annotation"]);
const output = (k, v) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); log("output", `${k}=${v}`); };
const git = (args, opts) => run("git", ["-C", STATE_DIR, ...args], { capture: true, ...opts });

/** Commits the state branch. Rebase-and-retry handles a concurrent writer. Returns false if the push never landed. */
function commitState(message) {
  git(["add", "-A"]);
  if (git(["diff", "--cached", "--quiet"]).status === 0) return true;
  if (git(["commit", "-m", message]).status !== 0) return false;
  for (let i = 0; i < 3; i++) {
    if (git(["push", "origin", "HEAD:automation/state"]).status === 0) return true;
    if (git(["pull", "--rebase", "origin", "automation/state"]).status !== 0) { git(["rebase", "--abort"]); return false; }
  }
  return false;
}

const update = (ledger, slotId, patch) => { ledger.slots[slotId] = { ...ledger.slots[slotId], ...patch, updated_at: new Date().toISOString() }; };

function kickRequest() {
  if (process.env.GITHUB_EVENT_NAME !== "push") return null;
  const p = join(ROOT, "config/autopilot-kick.json");
  return existsSync(p) ? readJson(p) : { channel: "due" };
}

function select() {
  const ledger = loadLedger();
  ledger.last_poll_at = new Date().toISOString();
  const reaped = reapStale(ledger, Date.now());
  if (reaped.length) log("select", `recovered abandoned slots: ${reaped.join(", ")}`);
  const kick = kickRequest();
  let slot;
  if (kick && kick.channel !== "due") {
    slot = { id: `kick-${String(process.env.GITHUB_SHA).slice(0, 10)}-ch${kick.channel}`, channel: String(kick.channel) };
    if (ledger.slots[slot.id]) { log("select", `${slot.id} already handled`); slot = null; }
  } else {
    slot = pickDueSlot(ledger, Date.now());
  }
  if (!slot) { saveLedger(ledger); commitState("poll"); output("slot", ""); log("select", "no production is due"); return; }
  const attempts = (ledger.slots[slot.id]?.attempts || 0) + 1;
  update(ledger, slot.id, { channel: slot.channel, status: "running", attempts, run_id: process.env.GITHUB_RUN_ID, trigger: process.env.GITHUB_EVENT_NAME });
  saveLedger(ledger);
  if (!commitState(`claim ${slot.id} (attempt ${attempts})`)) throw new Error(`could not claim ${slot.id}: another run holds the state branch`);
  output("slot", slot.id);
  output("channel", slot.channel);
  output("attempts", attempts);
}

async function produce(slotId, channelId) {
  if (kickRequest()?.ollama_first) process.env.OLLAMA_FIRST = "1";
  const channel = channelConfig(channelId);
  const dir = workDir(slotId);
  const ledger = loadLedger();
  const { notify, learnedSummary } = await import("./report.mjs");
  const { discover } = await import("./discover.mjs");
  const { research, writeScript, narrate } = await import("./script-stage.mjs");
  const qa = await import("./qa.mjs");
  const productionId = `ap-${slotId}`;
  let stage = "discover";
  const mark = (s, patch = {}) => { stage = s; update(ledger, slotId, { stage: s, ...patch }); saveLedger(ledger); commitState(`${slotId}: ${s}`); };
  try {
    // Fails here, before any quota is spent, if this channel's YouTube login no longer works.
    const { verifyChannelAccess } = await import("./deliver.mjs");
    await verifyChannelAccess(channel);

    // A dry run feeds an existing accepted script through every later stage and never uploads.
    const dry = kickRequest()?.dry;
    const builder = channel.treatment === "vox" ? (await import("./hidden-past.mjs")).buildHiddenPast : (await import("./ai-tested.mjs")).buildAiTested;
    const runState = join(STATE_DIR, "autopilot/runs", slotId);
    mkdirSync(runState, { recursive: true });
    mkdirSync(join(ROOT, "data/research", channel.id), { recursive: true });
    let topic, researchPath, script, narration, built, lastErr;

    if (dry) {
      topic = { topic: dry.topic, slug: dry.slug, evidence: [], commons_query: dry.commons_query, wikipedia_title: dry.wikipedia_title, pillar: "dry-run", hook: "", score: { total: 0 } };
      researchPath = join(ROOT, dry.research);
      script = { scriptPath: join(ROOT, dry.script), scriptRel: dry.script, stem: basename(dry.script, ".json") };
      mark("narration", { topic: topic.topic });
      narration = narrate({ channel, topic, researchPath, script });
      mark("visuals");
      built = await builder({ channel, topic, script, narration, research: researchPath, dir, productionId });
    } else {
    const { eligible, withAngle } = await discover({ channel, ledger, dir, learned: learnedSummary(ledger, channel.id) });
    writeJson(join(runState, "candidates.json"), readJson(join(dir, "candidates.json")));

    // Topics that cannot be grounded or scripted hand over to the next candidate. A topic tried
    // here stays in the history, so it is never picked again just to get a run through.
    const tried = [];
    let attempted = 0;
    for (const candidate of eligible.slice(0, 8)) {
      if (attempted >= MAX_TOPICS_PER_RUN) break;
      if (channel.treatment === "vox" && !(await (await import("./hidden-past.mjs")).hasExactImage(candidate))) {
        tried.push({ topic: candidate.topic, score: candidate.score.total, stage: "image-precheck", reason: "no freely licensed image of the actual subject" });
        log("produce", `skipped before research (no exact image): ${candidate.topic}`);
        continue;
      }
      attempted++;
      const current = await withAngle(candidate);
      ledger.topics.push({ channel: channel.id, topic: current.topic, slug: current.slug, slot: slotId, at_ms: Date.now(), score: current.score.total, pillar: current.pillar });
      mark("research", { topic: current.topic, score: current.score.total, pillar: current.pillar, hook: current.hook });
      try {
        researchPath = await research({ channel, topic: current, dir });
        mark("script");
        script = await writeScript({ channel, topic: current, researchPath, dir });
        mark("narration");
        narration = narrate({ channel, topic: current, researchPath, script });
        mark("visuals");
        built = await builder({ channel, topic: current, script, narration, research: researchPath, dir, productionId });
        topic = current;
        break;
      } catch (e) {
        if (e.stage === "outage") { ledger.topics.pop(); throw e; } // a service outage must not burn the topic
        if (!TOPIC_LEVEL_STAGES.has(e.stage)) throw e; // a broken tool will not be fixed by another topic
        lastErr = e;
        tried.push({ topic: current.topic, score: current.score.total, stage: e.stage || stage, reason: String(e.message).slice(0, 500) });
        log("produce", `topic abandoned at ${e.stage || stage}: ${current.topic}`);
      }
    }
    writeJson(join(runState, "topics-tried.json"), { tried, selected: topic?.topic || null });
    if (!topic) throw new StageError(lastErr?.stage || "discover", `${tried.length} topic(s) tried, none usable. Last: ${String(lastErr?.message || tried.at(-1)?.reason).slice(0, 500)}`);
    writeJson(join(runState, "selected-topic.json"), topic);
    await notify(ledger, `${channel.name}: topic selected\n${topic.topic}\nScore ${topic.score.total}/100`);
    }


    mark("render");
    const { renderEditor } = await import("../../src/skills/remotion-render/render-editor.js");
    const mp4Rel = `data/autopilot-runs/${slotId}/final.mp4`;
    let renderErr;
    for (let i = 1; i <= CONFIG.max_render_attempts; i++) {
      try { await renderEditor({ timelinePath: built.timelinePath, audioPath: built.audioPath, outputPath: mp4Rel, scale: 1 }); renderErr = null; break; }
      catch (e) { renderErr = e; log("render", `attempt ${i} failed: ${e.message}`); }
    }
    if (renderErr) throw new StageError("render", renderErr.message);
    const mp4 = join(ROOT, mp4Rel);

    let voxReport = null;
    if (channel.treatment === "vox") {
      mark("vox-inspection");
      const { voxGate } = await import("./vox-gate.mjs");
      voxReport = await voxGate({ mp4, dir, outDir: join(dir, "vox-frames"), productionId });
    }
    mark("technical-qa");
    const technical = qa.technicalChecks(mp4);
    const videoQa = qa.runVideoQa({ mp4, timelinePath: built.timelinePath, dir, treatment: channel.treatment });
    const frame = await qa.frameReview({ mp4, dir, channelName: channel.name, treatment: channel.treatment, duration: technical.duration });
    const acceptance = qa.acceptance({ channel, topic, script, narration, mp4, timelinePath: built.timelinePath, manifestPath: built.manifestPath, dir, productionId });

    mark("metadata");
    const meta = await import("./metadata.mjs");
    const seo = await meta.buildMetadata({ channel, topic, script, attributions: built.attributions || built.credits || [] });
    const summary = { production_id: productionId, sha256: sha256File(mp4), technical, video_qa: { pass: videoQa.pass, blocking: videoQa.blocking, superseded_for_vox: videoQa.superseded }, frame_review: frame, acceptance: { pass: acceptance.pass, failures: acceptance.report.failures }, vox: voxReport ? { pass: voxReport.pass, failures: voxReport.failures, counts: voxReport.counts } : null, seo };
    writeJson(join(dir, "qa-summary.json"), summary);
    writeJson(join(STATE_DIR, "autopilot/runs", slotId, "qa-summary.json"), summary);
    await qa.proofPackage({ channel, dir, mp4, voxReport, frame, video: technical, attributions: built.attributions, manifestPath: built.manifestPath, title: seo.title });

    const gates = { vox: voxReport ? voxReport.pass : true, technical: technical.pass, video_qa: videoQa.pass, frame_review: frame.pass, acceptance: acceptance.pass };
    const failed = Object.entries(gates).filter(([, ok]) => !ok).map(([k]) => k);
    if (failed.length) throw new StageError("qa", `gates failed: ${failed.join(", ")}. ${JSON.stringify({ blocking: videoQa.blocking, frame: frame.problems || frame.why, acceptance: acceptance.report.failures, vox: voxReport?.failures, technical: technical.checks }).slice(0, 700)}`);
    writeJson(join(dir, "deliver.json"), { title: seo.title, description: seo.description, tags: seo.tags, mp4: mp4Rel, production_id: productionId, pillar: topic.pillar, hook: topic.hook });
    mark("qa-passed", { status: "qa-passed", qa: "all gates passed", sha256: summary.sha256 });
    await notify(ledger, `${channel.name}: passed QA\n${seo.title}\nPreview: ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`);
    saveLedger(ledger); commitState(`${slotId}: qa passed`);
    output("ready", dry ? "false" : "true");
    if (dry) { update(ledger, slotId, { status: "dry-run-passed" }); saveLedger(ledger); commitState(`${slotId}: dry run passed every gate`); }
  } catch (e) {
    const failedStage = e.stage || stage;
    const attempts = ledger.slots[slotId].attempts;
    const final = attempts >= CONFIG.max_attempts_per_slot || slotId.startsWith("kick-");
    update(ledger, slotId, { status: final ? "failed-final" : "failed", stage: failedStage, error: String(e.message).slice(0, 900), qa: failedStage === "qa" ? "failed" : ledger.slots[slotId].qa });
    if (final) {
      await notify(ledger, `${channel.name}: production failed after ${attempts} attempt(s)\nStage: ${failedStage}\n${String(e.message).slice(0, 300)}`);
      const { addAttention } = await import("./report.mjs");
      addAttention(ledger, `${channel.name} ${slotId} failed at ${failedStage}: ${String(e.message).slice(0, 200)}`);
    }
    saveLedger(ledger); commitState(`${slotId}: failed at ${failedStage}`);
    log("produce", `FAILED at ${failedStage}: ${e.stack || e.message}`);
    output("ready", "false");
  }
}

async function deliverStep(slotId, channelId) {
  const channel = channelConfig(channelId);
  const dir = workDir(slotId);
  const ledger = loadLedger();
  const { notify, addAttention } = await import("./report.mjs");
  const { deliver } = await import("./deliver.mjs");
  const d = readJson(join(dir, "deliver.json"));
  const mp4 = join(ROOT, d.mp4);
  try {
    const ev = await deliver({ channel, mp4, title: d.title, description: d.description, tags: d.tags, productionId: d.production_id, ledger });
    // Recorded before the verdict: once a video exists it must never be uploaded again by a retry.
    ledger.uploads.push({ channel: channel.id, slot: slotId, video_id: ev.video_id, url: ev.url, title: d.title, sha256: ev.sha256, production_id: d.production_id, privacy_status: ev.privacy_status, uploaded_at: new Date().toISOString(), pillar: d.pillar, hook: d.hook, run_id: process.env.GITHUB_RUN_ID });
    writeJson(join(STATE_DIR, "autopilot/runs", slotId, "upload-evidence.json"), ev);
    if (!ev.verified) throw new StageError("verify", `YouTube read-back did not match: ${JSON.stringify(ev.checks)}`);
    update(ledger, slotId, { status: "delivered", stage: "delivered", video_id: ev.video_id, privacy_status: ev.privacy_status });
    saveLedger(ledger); commitState(`${slotId}: delivered ${ev.video_id}`);
    await notify(ledger, `${channel.name}: private upload verified\n${d.title}\n${ev.url}`);
    saveLedger(ledger); commitState(`${slotId}: notified`);
    output("video_id", ev.video_id);
  } catch (e) {
    const uploaded = ledger.uploads.some((u) => u.slot === slotId);
    // With no video on YouTube this is an ordinary failure, so the slot may try again.
    const attempts = ledger.slots[slotId].attempts;
    update(ledger, slotId, { status: !uploaded && attempts < CONFIG.max_attempts_per_slot && !slotId.startsWith("kick-") ? "failed" : "failed-final", stage: e.stage || "upload", error: String(e.message).slice(0, 900) });
    addAttention(ledger, `${channel.name} ${slotId}: ${e.message}${uploaded ? " (the video exists on YouTube; check it by hand)" : ""}`);
    await notify(ledger, `${channel.name}: upload problem\n${String(e.message).slice(0, 300)}`);
    saveLedger(ledger); commitState(`${slotId}: delivery failed`);
    log("deliver", `FAILED: ${e.stack || e.message}`);
    process.exitCode = 1;
  }
}

async function finish() {
  const ledger = loadLedger();
  const { collectPerformance, writeDashboard } = await import("./report.mjs");
  let perf = readJson(join(STATE_DIR, "autopilot/performance.json"), { videos: {}, analytics_status: {} });
  try { perf = await collectPerformance(ledger); } catch (e) { log("finish", `performance: ${e.message}`); }
  const md = writeDashboard(ledger, perf);
  saveLedger(ledger);
  commitState("dashboard");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}

const [mode, slotId, channelId] = process.argv.slice(2);
mkdirSync(join(STATE_DIR, "autopilot"), { recursive: true });
if (mode === "select") select();
else if (mode === "produce") await produce(slotId, channelId);
else if (mode === "deliver") await deliverStep(slotId, channelId);
else if (mode === "finish") await finish();
else { console.error(`unknown mode ${mode}`); process.exit(2); }
