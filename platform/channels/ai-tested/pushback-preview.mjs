// AI Tested "If you tell AI it's wrong, will it change a right answer?" preview: measure real models, build the script from the counts,
// then use the shared Short path. 35 to 40 seconds, natural voice speed, never altered. A test already run today is reused.
import { spawnSync } from "node:child_process";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { measure, plan, tally, TASKS } from "./pushback.mjs";
import { compactScenes, fitScript } from "../../production/fitscript.mjs";
import { narrate } from "../../production/index.mjs";

const STYLE = "Clear, curious and brisk, like a tech reviewer";
const CALIBRATION = "The first model answered in under a second. The second took longer, and its reply was twice as long. Both were asked the same question, using the same words, one after the other, thirty times.";

export default async function pushbackPreview({ key, runId, tools }) {
  const repo = process.env.GITHUB_REPOSITORY, runUrl = repo ? `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : "local";
  const today = new Date().toISOString().slice(0, 10);
  // Branch preview/ai-tested-pushback-letters runs the letter-counting test; any other pushback branch runs the multiplication test.
  const taskId = /sentences/.test(process.env.GITHUB_REF_NAME || "") ? "sentences" : /letters/.test(process.env.GITHUB_REF_NAME || "") ? "letters" : "maths", TK = TASKS[taskId];
  const g0 = (...a) => spawnSync("git", a, { encoding: "utf8", maxBuffer: 2e8 });
  // The multiplication result, when this run is the letters test, is shown beside it as the contrast. It is read from that run's own file.
  const contrast = taskId !== "maths" && g0("fetch", "--depth=1", "origin", "automation/previews").status === 0 ? (() => {
    const files = g0("ls-tree", "-r", "--name-only", "FETCH_HEAD", "previews/ai-tested").stdout.split(/\r?\n/).filter((f) => f.endsWith("/experiment.json")).sort().reverse();
    for (const f of files) { try { const j = JSON.parse(g0("show", `FETCH_HEAD:${f}`).stdout); if (j.kind === "pushback" && (j.task || "maths") === "maths" && j.models?.length >= 2 && j.models[0].items) { const ts = j.models.map(tally); return { switches: ts.reduce((a, t) => a + t.plain.switched + t.teacher.switched, 0), pushes: ts.reduce((a, t) => a + 2 * t.n, 0), date: j.date, run_url: j.run_url || `https://github.com/${repo}/actions/runs/${f.match(/run-([0-9]+)-/)[1]}` }; } } catch {} }
    return null;
  })() : null;
  const earlier = (() => {
    const g = (...a) => spawnSync("git", a, { encoding: "utf8", maxBuffer: 2e8 });
    if (g("fetch", "--depth=1", "origin", "automation/previews").status !== 0) return null;
    const files = g("ls-tree", "-r", "--name-only", "FETCH_HEAD", "previews/ai-tested").stdout.split(/\r?\n/).filter((f) => f.endsWith("/experiment.json")).sort().reverse();
    for (const f of files) { try { const j = JSON.parse(g("show", `FETCH_HEAD:${f}`).stdout); if (j.kind === "pushback" && (j.task || "maths") === taskId && j.date === today && j.models?.length >= 2 && j.models[0].items) return { ...j, run_url: j.run_url || `https://github.com/${repo}/actions/runs/${f.match(/run-([0-9]+)-/)[1]}`, reused_from: f }; } catch {} }
    return null;
  })();
  const exp = earlier || await measure({ runUrl, task: taskId });
  tools.write("experiment.json", exp);
  tools.stage("research_complete", "ok");
  const p = plan(exp, contrast);
  const dateText = new Date(exp.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const line = (m) => `${m.name}: plain push, switched ${m.plain.switched} of ${m.n}; "I'm ${TK.teacherLabel}" push, switched ${m.teacher.switched} of ${m.n}`;
  const metadata = {
    title: p.anySwitch ? (taskId !== "maths" ? "AI Knew the Answer. Then We Said It Was Wrong. (We Tested It)" : "Tell AI It's Wrong and It Might Agree (We Tested It)") : "We Told AI It Was Wrong. It Didn't Budge.",
    description: `We asked ${exp.models.length} AI models ${exp.questions} ${TK.noun} questions. After each correct answer we replied that it was wrong and gave a false answer, then counted how often the model switched to it. ${p.data.models.map(line).join(". ")}. Agreement from an AI is not proof: ask again in a new chat and check answers that matter. One small test on ${TK.subject} only, run on ${dateText} at temperature 0; results can change between runs, on other subjects and as models update.\n\n#Shorts #AI #AITested #ChatGPT #Gemini`,
    tags: ["AI test", "AI sycophancy", "ChatGPT", "Gemini", "can you trust AI", "AI agrees with you", "AI mistakes"],
  };
  // The 35 to 40 second rule: measure this voice's pace, then choose the wording that fits. The voice is never sped up.
  const cal = await narrate({ text: CALIBRATION, edgeVoice: "en-US-AndrewNeural", outDir: tools.outDir, name: "calibration", style: STYLE });
  const fit = fitScript({ slots: p.slots, wpm: cal.wpm * 0.88, targetSeconds: 36.5, minSeconds: 35, maxSeconds: 38.5 });
  const { scenes, sentences } = compactScenes({ scenes: p.scenes, sentences: fit.sentences });
  tools.write("script-fit.json", { measured_wpm: cal.wpm, voice: cal.engine, ...fit });
  console.log(`script fit: ${cal.wpm} wpm -> ${fit.words} words, about ${fit.estimated_seconds}s, kept ${fit.kept.join(",")}`);
  const result = await runFixedShort({ key, runId, tools, spec: { topic: p.anySwitch ? "AI had the right answer. We told it it was wrong." : "Will AI agree with you just to be nice?", claims: p.claims, sources: p.sources, sentences, scenes, compositionId: "AiTestedPushback", edgeVoice: "en-US-AndrewNeural", style: STYLE, metadata, minSeconds: 35, maxSeconds: 40, refit: (wpm) => compactScenes({ scenes: p.scenes, sentences: fitScript({ slots: p.slots, wpm: wpm * 0.98, targetSeconds: 36.5, minSeconds: 35, maxSeconds: 38.5 }).sentences }), makeProps: () => ({ data: p.data }) } });
  tools.write("quality-report.json", { format: "ai_tested_pushback", technical: result.qa });
}
