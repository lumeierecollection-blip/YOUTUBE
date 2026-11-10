// AI Tested "If you tell AI it's wrong, will it change a right answer?" preview: measure real models, build the script from the counts,
// then use the shared Short path. 35 to 40 seconds, natural voice speed, never altered. A test already run today is reused.
import { spawnSync } from "node:child_process";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { measure, plan } from "./pushback.mjs";
import { compactScenes, fitScript } from "../../production/fitscript.mjs";
import { narrate } from "../../production/index.mjs";

const STYLE = "Clear, curious and brisk, like a tech reviewer";
const CALIBRATION = "The first model answered in under a second. The second took longer, and its reply was twice as long. Both were asked the same question, using the same words, one after the other, thirty times.";

export default async function pushbackPreview({ key, runId, tools }) {
  const repo = process.env.GITHUB_REPOSITORY, runUrl = repo ? `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : "local";
  const today = new Date().toISOString().slice(0, 10);
  const earlier = (() => {
    const g = (...a) => spawnSync("git", a, { encoding: "utf8", maxBuffer: 2e8 });
    if (g("fetch", "--depth=1", "origin", "automation/previews").status !== 0) return null;
    const files = g("ls-tree", "-r", "--name-only", "FETCH_HEAD", "previews/ai-tested").stdout.split(/\r?\n/).filter((f) => f.endsWith("/experiment.json")).sort().reverse();
    for (const f of files) { try { const j = JSON.parse(g("show", `FETCH_HEAD:${f}`).stdout); if (j.kind === "pushback" && j.date === today && j.models?.length >= 2 && j.models[0].items) return { ...j, run_url: j.run_url || `https://github.com/${repo}/actions/runs/${f.match(/run-([0-9]+)-/)[1]}`, reused_from: f }; } catch {} }
    return null;
  })();
  const exp = earlier || await measure({ runUrl });
  tools.write("experiment.json", exp);
  tools.stage("research_complete", "ok");
  const p = plan(exp);
  const dateText = new Date(exp.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const line = (m) => `${m.name}: plain push, switched ${m.plain.switched} of ${m.n}; "I'm a maths teacher" push, switched ${m.teacher.switched} of ${m.n}`;
  const metadata = {
    title: p.anySwitch ? "Tell AI It's Wrong and It Might Agree (We Tested It)" : "We Told AI It Was Wrong. It Didn't Budge.",
    description: `We asked ${exp.models.length} AI models ${exp.questions} multiplication questions. After each correct answer we replied that it was wrong and gave a false answer, then counted how often the model switched to it. ${p.data.models.map(line).join(". ")}. Agreement from an AI is not proof: ask again in a new chat and check answers that matter. One small test on arithmetic only, run on ${dateText} at temperature 0; results can change between runs, on other subjects and as models update.\n\n#Shorts #AI #AITested #ChatGPT #Gemini`,
    tags: ["AI test", "AI sycophancy", "ChatGPT", "Gemini", "can you trust AI", "AI agrees with you", "AI mistakes"],
  };
  // The 35 to 40 second rule: measure this voice's pace, then choose the wording that fits. The voice is never sped up.
  const cal = await narrate({ text: CALIBRATION, edgeVoice: "en-US-AndrewNeural", outDir: tools.outDir, name: "calibration", style: STYLE });
  const fit = fitScript({ slots: p.slots, wpm: cal.wpm * 0.88, targetSeconds: 36.5, minSeconds: 35, maxSeconds: 38.5 });
  const { scenes, sentences } = compactScenes({ scenes: p.scenes, sentences: fit.sentences });
  tools.write("script-fit.json", { measured_wpm: cal.wpm, voice: cal.engine, ...fit });
  console.log(`script fit: ${cal.wpm} wpm -> ${fit.words} words, about ${fit.estimated_seconds}s, kept ${fit.kept.join(",")}`);
  const result = await runFixedShort({ key, runId, tools, spec: { topic: "If you tell AI it's wrong, will it change a right answer?", claims: p.claims, sources: p.sources, sentences, scenes, compositionId: "AiTestedPushback", edgeVoice: "en-US-AndrewNeural", style: STYLE, metadata, minSeconds: 34, maxSeconds: 40, refit: (wpm) => compactScenes({ scenes: p.scenes, sentences: fitScript({ slots: p.slots, wpm: wpm * 0.98, targetSeconds: 36.5, minSeconds: 35, maxSeconds: 38.5 }).sentences }), makeProps: () => ({ data: p.data }) } });
  tools.write("quality-report.json", { format: "ai_tested_pushback", technical: result.qa });
}
