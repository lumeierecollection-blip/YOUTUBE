// AI Tested Short: a real test of real models, scripted by the shared engine and timed by its narration.
import { join } from "node:path";
import { measureWpm } from "../../script-engine/duration.mjs";
import { runEngine } from "../../script-engine/engine.mjs";
import { liveLLM } from "../../script-engine/llm.mjs";
import { sceneTraceability } from "../../script-engine/traceability.mjs";
import { buildTimeline, durationOf, FPS, narrate, publishFrames, technicalQa } from "../../production/index.mjs";
import { runExperiment, sceneKindOfClaim } from "./experiment.mjs";

const EDGE = "en-US-AndrewNeural";
const CALIBRATION = "The report was published in March. It listed three findings. The first concerned the cost of the programme, which rose by a fifth over two years. The second looked at who paid for it, and the third asked whether anyone had checked.";
const OBJECTIVE = { hook: "Pose the question on a real test word, with its matching letters lighting up", setup: "Show how the test was run, step by step", terminal: "Show the real prompt and each model's real reply", score: "Show each model's measured score out of the total", split: "Compare scores on real words and random letter strings", miss: "Show the widest real miss: the correct count against the answer given", close: "Answer the opening question, with the final scores" };
const TREATMENT = { hook: "kinetic-question", setup: "process-diagram", terminal: "terminal-demo", score: "bar-chart", split: "split-comparison", miss: "before-after-numbers", close: "verdict-panel" };

function mapScenes(pkg) {
  const kinds = pkg.sentences.map((s, i) => {
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
  process.env.MAX_TOKENS_PER_VIDEO ||= "2000000";
  const repo = process.env.GITHUB_REPOSITORY, runUrl = repo ? `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : "local";

  const exp = await runExperiment({ runUrl });
  tools.write("experiment.json", exp);
  tools.write("claims.json", exp.claims);
  tools.stage("research_complete", "ok");

  // The word budget comes from this voice, measured now.
  const calibration = await narrate({ text: CALIBRATION, edgeVoice: EDGE, outDir, name: "calibration" });
  let wpm = { wpm: calibration.wpm, source: "measured", voice: calibration.engine };
  tools.write("voice-calibration.json", { engine: calibration.engine, wpm: calibration.wpm, seconds: calibration.seconds, notes: calibration.notes });

  const llm = liveLLM();
  let result, narration, pkg, attempt = 0;
  for (;;) {
    attempt++;
    result = await runEngine({
      channelKey: key, format: "short", topic: "Can AI models count letters? A test of real models", angle: "Tell it as one story. Open on the question of whether AI can count letters. Say how the test worked, then give the example, then the scores, then why the random letters mattered, and end by answering the opening question. One figure per sentence. Eight or nine short spoken sentences, about 54 words. Use only the measured results.",
      claimResult: { claims: exp.claims, dropped: [], sources: exp.sources }, llm, wpm, production_run: runId, profileOverrides: { minSeconds: 24, targetSeconds: 26.5, maxSeconds: 29 }, maxRevisions: 3,
      onProgress: (ev) => {
        if (ev.event === "blueprint") { tools.write("blueprint.json", ev.blueprint); tools.write("story-outline.md", `# Blueprint\n\nCentral question: ${ev.blueprint.central_question}\n\nThesis: ${ev.blueprint.thesis}\n\nConclusion: ${ev.blueprint.conclusion}\n`); tools.stage("blueprint_complete", "ok"); }
        if (ev.event === "draft") { tools.write(`script-draft-round${ev.round}.md`, ev.pkg.sentences.map((s) => s.text).join("\n")); tools.write("script-draft.md", ev.pkg.sentences.map((s) => s.text).join("\n")); tools.stage("script_complete", "ok", { round: ev.round }); }
      },
    });
    tools.write("script-quality-report.json", result.report);
    if (result.status !== "approved") { tools.write("open-findings.json", result.findings || []); throw new Error(`script engine: ${result.status}: ${JSON.stringify((result.findings || []).slice(0, 6).map((f) => `${f.rule}: ${f.problem}`)).slice(0, 700)} ${result.error || ""}`); }
    pkg = result.package;
    tools.write("script-package.json", pkg);
    if (result.report.last_critique) tools.write("critique.json", result.report.last_critique);
    tools.write("script-final.md", pkg.sentences.map((s) => s.text).join("\n"));
    tools.stage("script_approved", "ok", { approved_by: pkg.quality_report.approved_by });

    narration = await narrate({ text: pkg.sentences.map((s) => s.text).join(" "), edgeVoice: EDGE, outDir });
    if (narration.seconds <= 29.3 && narration.seconds >= 23.5) break;
    // Too long or short at natural speed: the script changes, never the voice.
    wpm = { wpm: narration.wpm, source: "measured-from-narration", voice: narration.engine };
    if (attempt >= 3) throw new Error(`narration is ${narration.seconds}s after ${attempt} rewrites`);
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
  tools.stage("awaiting_approval", "ok");
}
