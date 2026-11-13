// AI Tested Short: a real test of real models, scripted by the shared engine and timed by its narration.
import { join } from "node:path";
import { measureWpm } from "../../script-engine/duration.mjs";
import { runEngine } from "../../script-engine/engine.mjs";
import { liveLLM } from "../../script-engine/llm.mjs";
import { sceneTraceability } from "../../script-engine/traceability.mjs";
import { buildTimeline, durationOf, FPS, narrate, publishFrames, technicalQa } from "../../production/index.mjs";
import { spawnSync } from "node:child_process";
import { METADATA, SENTENCES as FIXED_SENTENCES, USE_FIXED } from "./fixed-script.mjs";
import { assemble, measure, sceneKindOfClaim } from "./experiment.mjs";

const EDGE = "en-US-AndrewNeural";
const CALIBRATION = "The report was published in March. It listed three findings. The first concerned the cost of the programme, which rose by a fifth over two years. The second looked at who paid for it, and the third asked whether anyone had checked.";
const OBJECTIVE = { hook: "Pose the question on a real test word, with its matching letters lighting up", setup: "Show how the test was run, step by step", terminal: "Show the real prompt and each model's real reply", score: "Show each model's measured score out of the total", split: "Compare scores on real words and random letter strings", miss: "Show the widest real miss: the correct count against the answer given", close: "Answer the opening question, with the final scores" };
const TREATMENT = { hook: "kinetic-question", setup: "process-diagram", terminal: "terminal-demo", score: "bar-chart", split: "split-comparison", miss: "before-after-numbers", close: "verdict-panel" };

function fixedResult(SENTENCES, claims, topic, key, blueprint) {
  const sentences = SENTENCES.map((x, i) => ({ sentence_id: `f${i + 1}`, beat_id: `b${i + 1}`, role: "narration", link_from_previous: i ? "explanation" : "none", on_screen_text: "", ...x }));
  const words = sentences.map((x) => x.text).join(" ");
  const quality_report = { approved_by: "not reviewed by the engine critic", written_by: "written directly on the owner's instruction", independent_provider: false };
  const pkg = { channel: key, topic, format: "short", target_seconds: 27, blueprint, hook_options: [{ text: sentences[0].text, family: "direct question", honest: true }], selected_hook: sentences[0].text, sentences, payoff: sentences.at(-2).text, ending: sentences.at(-1).text, cta: null, sources: [...new Map(claims.map((c) => [c.source_id, { source_id: c.source_id, url: c.source_url, published: c.published ?? null }])).values()], claims, duration_estimate_s: words.split(/\s+/).length / 2.05, quality_report };
  return { status: "written_directly", package: pkg, report: { status: "written_directly", note: "The script engine and its independent critic did not review this script." }, findings: [] };
}

function mapScenes(pkg) {
  const kinds = pkg.sentences.map((s, i) => {
    if (s.kind) return s.kind;
    if (i === 0) return "hook";
    if (i === pkg.sentences.length - 1) return "close";
    return (s.claim_ids || []).map(sceneKindOfClaim).find(Boolean) || null;
  });
  // A sentence with no claim stays on the picture before it, since it is still talking about that.
  for (let i = 1; i < kinds.length; i++) if (!kinds[i]) kinds[i] = kinds[i - 1];
  const sceneOfSentence = [], meta = [];
  kinds.forEach((kind, i) => {
    if (!meta.length || meta.at(-1).kind !== kind) meta.push({ id: `s${meta.length + 1}`, kind, treatment: TREATMENT[kind], sentenceIds: [] });
    meta.at(-1).sentenceIds.push(pkg.sentences[i].sentence_id);
    sceneOfSentence.push(meta.length - 1);
  });
  return { sceneOfSentence, meta };
}

export default async function preview({ key, runId, outDir, tools }) {
  if (/multiply/.test(process.env.GITHUB_REF_NAME || "")) return (await import("./multiply-preview.mjs")).default({ key, runId, tools });
  if (/expert/.test(process.env.GITHUB_REF_NAME || "")) return (await import("./expert-preview.mjs")).default({ key, runId, tools });
  if (/unknown/.test(process.env.GITHUB_REF_NAME || "")) return (await import("./unknown-preview.mjs")).default({ key, runId, tools });
  if (/privacy/.test(process.env.GITHUB_REF_NAME || "")) return (await import("./privacy-preview.mjs")).default({ key, runId, tools });
  if (/links/.test(process.env.GITHUB_REF_NAME || "")) return (await import("./links-preview.mjs")).default({ key, runId, tools });
  if (/pushback/.test(process.env.GITHUB_REF_NAME || "")) return (await import("./pushback-preview.mjs")).default({ key, runId, tools });
  if (/random/.test(process.env.GITHUB_REF_NAME || "")) return (await import("./randompick-preview.mjs")).default({ key, runId, tools });
  if (/spell/.test(process.env.GITHUB_REF_NAME || "")) return (await import("./spellout-preview.mjs")).default({ key, runId, tools });
  if (/honesty/.test(process.env.GITHUB_REF_NAME || "")) return (await import("./honesty-preview.mjs")).default({ key, runId, tools });
  process.env.MAX_TOKENS_PER_VIDEO ||= "2000000";
  const repo = process.env.GITHUB_REPOSITORY, runUrl = repo ? `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : "local";

  // A test already run today is reused rather than spending the models' daily quota again; its own run stays the cited source.
  const today = new Date().toISOString().slice(0, 10);
  const earlier = (() => {
    const g = (...a) => spawnSync("git", a, { encoding: "utf8", maxBuffer: 2e8 });
    if (g("fetch", "--depth=1", "origin", "automation/previews").status !== 0) return null;
    const files = g("ls-tree", "-r", "--name-only", "FETCH_HEAD", "previews/ai-tested").stdout.split("\n").filter((f) => f.endsWith("/experiment.json")).sort().reverse();
    for (const f of files) { try { const j = JSON.parse(g("show", `FETCH_HEAD:${f}`).stdout); if (j.date === today && j.models?.length >= 2) return { date: j.date, run_url: j.run_url || `https://github.com/${repo}/actions/runs/${f.match(/run-([0-9]+)-/)[1]}`, models: j.models, reused_from: f }; } catch {} }
    return null;
  })();
  const exp = assemble(earlier || await measure({ runUrl }));
  tools.write("experiment.json", exp);
  tools.write("claims.json", exp.claims);
  tools.stage("research_complete", "ok");

  // The word budget comes from this voice, measured now.
  const calibration = USE_FIXED ? { engine: "skipped", wpm: 125, seconds: 0, notes: [] } : await narrate({ text: CALIBRATION, edgeVoice: EDGE, outDir, name: "calibration" });
  let wpm = { wpm: calibration.wpm, source: "measured", voice: calibration.engine };
  tools.write("voice-calibration.json", { engine: calibration.engine, wpm: calibration.wpm, seconds: calibration.seconds, notes: calibration.notes });

  const llm = liveLLM();
  let result, narration, pkg, attempt = 0;
  for (;;) {
    attempt++;
    result = USE_FIXED ? fixedResult(FIXED_SENTENCES, exp.claims, "Can AI models count letters?", key, { central_question: "Can AI models count letters?", thesis: "In this test one model was perfect and the other was not.", why_it_matters: "The same question got very different reliability.", viewer_start: "Has heard AI struggles to count letters.", viewer_end: "Knows what this test measured and how each model scored.", key_evidence: ["score0", "score1", "split_random1", "miss"], beats: [], questions_raised: [{ question: "Can AI count letters?", raised_in: "f1", answered_in: "f9" }], conclusion: "AI can count, but not every model." }) : await runEngine({
      channelKey: key, format: "short", topic: "Can AI models count letters? A test of real models", angle: "Tell it as one story. Open on the question of whether AI can count letters. Say how the test worked, then give the example, then the scores, then why the random letters mattered, and end by answering the opening question. One figure per sentence. Eight or nine short spoken sentences, about 54 words. Use only the measured results.",
      claimResult: { claims: exp.claims, dropped: [], sources: exp.sources }, llm, wpm, production_run: runId, profileOverrides: { minSeconds: 24, targetSeconds: 26.5, maxSeconds: 29 }, maxRevisions: 3,
      onProgress: (ev) => {
        if (ev.event === "blueprint") { tools.write("blueprint.json", ev.blueprint); tools.write("story-outline.md", `# Blueprint\n\nCentral question: ${ev.blueprint.central_question}\n\nThesis: ${ev.blueprint.thesis}\n\nConclusion: ${ev.blueprint.conclusion}\n`); tools.stage("blueprint_complete", "ok"); }
        if (ev.event === "draft") { tools.write(`script-draft-round${ev.round}.md`, ev.pkg.sentences.map((s) => s.text).join("\n")); tools.write("script-draft.md", ev.pkg.sentences.map((s) => s.text).join("\n")); tools.stage("script_complete", "ok", { round: ev.round }); }
      },
    });
    tools.write("script-quality-report.json", result.report);
    if (!["approved", "written_directly"].includes(result.status)) { tools.write("open-findings.json", result.findings || []); throw new Error(`script engine: ${result.status}: ${JSON.stringify((result.findings || []).slice(0, 6).map((f) => `${f.rule}: ${f.problem}`)).slice(0, 700)} ${result.error || ""}`); }
    pkg = result.package;
    tools.write("script-package.json", pkg);
    if (result.report.last_critique) tools.write("critique.json", result.report.last_critique);
    tools.write("script-final.md", pkg.sentences.map((s) => s.text).join("\n"));
    tools.stage("script_approved", "ok", { approved_by: pkg.quality_report.approved_by });

    narration = await narrate({ text: pkg.sentences.map((s) => s.text).join(" "), edgeVoice: EDGE, outDir });
    if (narration.seconds <= 29.3 && narration.seconds >= 23.5) break;
    // Too long or short at natural speed: the script changes, never the voice.
    wpm = { wpm: narration.wpm, source: "measured-from-narration", voice: narration.engine };
    if (USE_FIXED || attempt >= 3) throw new Error(`narration is ${narration.seconds}s after ${attempt} rewrites`);
  }
  tools.write("narration.json", { engine: narration.engine, seconds: narration.seconds, wpm: narration.wpm, playback_speed: narration.playback_speed, notes: narration.notes });
  tools.stage("voice_complete", "ok", { narration_s: narration.seconds, engine: narration.engine });

  const { sceneOfSentence, meta } = mapScenes(pkg);
  const closing = pkg.sentences.at(-1);
  meta.forEach((m) => { if (m.kind === "close") m.headline = closing.on_screen_text || closing.text; });
  const sentenceCount = narration.sentences.length;
  if (sentenceCount !== pkg.sentences.length) throw new Error(`voice produced ${sentenceCount} sentences for ${pkg.sentences.length} script sentences`);
  const timeline = buildTimeline({ narration, sceneOfSentence, sceneMeta: meta });
  tools.write("timeline.json", timeline);

  const data = { date: exp.date, total: exp.total, models: exp.models.map(({ answers, ...m }) => m), example: exp.example, miss: exp.miss };
  const planScenes = timeline.scenes.map((s) => {
    const sents = pkg.sentences.filter((x) => s.sentenceIds.includes(x.sentence_id));
    return { scene_id: s.id, narration: sents.map((x) => x.text).join(" "), main_point: OBJECTIVE[s.kind], visual_objective: OBJECTIVE[s.kind], treatment: s.treatment, background: "white", skill: { terminal: "terminal-inserts", hook: "motion-graphics", setup: "motion-graphics", score: "motion-graphics", split: "motion-graphics", miss: "motion-graphics", close: "motion-graphics" }[s.kind], assets: [{ id: "experiment", origin: "test run during this render", source_url: runUrl }], animation: s.kind, on_screen_text: sents.map((x) => x.on_screen_text).filter(Boolean), claim_ids: [...new Set(sents.flatMap((x) => x.claim_ids || []))], data_sources: [runUrl], transition: "fade", start_s: s.start_s, end_s: s.end_s };
  });
  const plan = { channel: key, production_run: runId, format: "short", scenes: planScenes };
  tools.write("scene-plan.json", plan);
  const alignment = sceneTraceability(plan, pkg, exp.claims);
  tools.write("script-visual-alignment.json", alignment);
  const blockers = (Array.isArray(alignment) ? alignment : alignment.findings || []).filter((x) => x.severity === "critical");
  if (blockers.length) throw new Error(`scene plan does not match the script: ${JSON.stringify(blockers.slice(0, 4)).slice(0, 500)}`);
  tools.stage("visual_complete", "ok");

  const video = tools.renderComposition({ id: "AiTestedExperiment", props: { durationInFrames: timeline.durationInFrames, scenes: timeline.scenes, captions: timeline.captions, data }, audio: narration.mp3, durationInFrames: timeline.durationInFrames });
  tools.stage("render_complete", "ok", { mp4_s: durationOf(video) });
  await publishFrames({ tools, video, timeline, objectiveOf: (s) => OBJECTIVE[s.kind] });
  tools.voice({ text: pkg.sentences[0].text, voice: EDGE });
  const qa = technicalQa({ video, narration, timeline });
  tools.write("qa-report.json", { ...qa, fps: FPS, scenes: timeline.scenes.map((s) => ({ id: s.id, kind: s.kind, start_s: s.start_s, end_s: s.end_s })), script: { status: result.status, approved_by: pkg.quality_report.approved_by, written_by: pkg.quality_report.written_by, independent_provider: pkg.quality_report.independent_provider }, alignment_findings: Array.isArray(alignment) ? alignment.length : (alignment.findings || []).length });
  if (!qa.pass) { tools.stage("blocked", "failed", { issues: qa.failures.join("; ") }); throw new Error(`QA failed: ${qa.failures.join("; ")}`); }
  tools.stage("qa_passed", "ok");
  tools.stage("preview_ready", "ok");
  tools.write("delivery.json", METADATA);
  tools.stage("awaiting_approval", "ok");
}
