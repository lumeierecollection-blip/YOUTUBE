// AI Tested "Can AI pick a random number?" preview: measure real models, build the script from the counts, then use the shared Short path.
// 35 to 40 seconds, natural voice speed, never altered. A test already run today is reused instead of spending the models' quota again.
import { spawnSync } from "node:child_process";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { measure, plan } from "./randompick.mjs";
import { compactScenes, fitScript } from "../../production/fitscript.mjs";
import { narrate } from "../../production/index.mjs";

const STYLE = "Clear, curious and brisk, like a tech reviewer";
const CALIBRATION = "The first model answered in under a second. The second took longer, and its reply was twice as long. Both were asked the same question, using the same words, one after the other, thirty times.";

async function verifyWikipedia() {
  const j = await (await fetch("https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&explaintext=1&exintro=1&redirects=1&titles=Blue%E2%80%93seven_phenomenon", { headers: { "User-Agent": "AiTested/1.0" } })).json();
  const text = Object.values(j.query.pages)[0].extract;
  for (const must of ["number seven when asked to randomly select", "The existence of the phenomenon has been disputed"]) if (!text.includes(must)) throw new Error(`Wikipedia article no longer contains "${must}"`);
}

export default async function randomPreview({ key, runId, tools }) {
  const repo = process.env.GITHUB_REPOSITORY, runUrl = repo ? `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : "local";
  await verifyWikipedia();
  const today = new Date().toISOString().slice(0, 10);
  const earlier = (() => {
    const g = (...a) => spawnSync("git", a, { encoding: "utf8", maxBuffer: 2e8 });
    if (g("fetch", "--depth=1", "origin", "automation/previews").status !== 0) return null;
    const files = g("ls-tree", "-r", "--name-only", "FETCH_HEAD", "previews/ai-tested").stdout.split(/\r?\n/).filter((f) => f.endsWith("/experiment.json")).sort().reverse();
    for (const f of files) { try { const j = JSON.parse(g("show", `FETCH_HEAD:${f}`).stdout); if (j.date === today && j.temperature === 1 && j.models?.length >= 2 && j.models[0].r10 && j.models[0].r100) return { ...j, run_url: j.run_url || `https://github.com/${repo}/actions/runs/${f.match(/run-([0-9]+)-/)[1]}`, reused_from: f }; } catch {} }
    return null;
  })();
  const exp = earlier || await measure({ runUrl });
  tools.write("experiment.json", exp);
  tools.stage("research_complete", "ok");
  const p = plan(exp);
  const dateText = new Date(exp.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const top = p.data.models.map((m) => `${m.speak} picked ${m.top10.value} in ${m.top10.count} of ${exp.asks} asks`).join("; ");
  const metadata = {
    title: "Never Let AI Pick Your Random Winner (We Tested It)",
    description: `We asked ${exp.models.length} AI models for a random number from 1 to 10, ${exp.asks} times each, and counted the replies. A fair pick lands on each number about ${p.data.fair} times. ${top}. We also tried 1 to 100. For a fair draw, use dice, or ask the AI to write code that uses a random function. One test, run on ${dateText} at the default chat temperature; results change between runs and as models update.\n\n#Shorts #AI #AITested #ChatGPT #Gemini\n\nPeople reportedly favour seven too (disputed): https://en.wikipedia.org/wiki/Blue%E2%80%93seven_phenomenon`,
    tags: ["AI test", "random number", "ChatGPT", "Gemini", "AI giveaway", "AI randomness", "number seven"],
  };
  // The 35 to 40 second rule: measure this voice's pace, then choose the wording that fits. The voice is never sped up.
  const cal = await narrate({ text: CALIBRATION, edgeVoice: "en-US-AndrewNeural", outDir: tools.outDir, name: "calibration", style: STYLE });
  const fit = fitScript({ slots: p.slots, wpm: cal.wpm });
  const { scenes, sentences } = compactScenes({ scenes: p.scenes, sentences: fit.sentences });
  tools.write("script-fit.json", { measured_wpm: cal.wpm, voice: cal.engine, ...fit });
  console.log(`script fit: ${cal.wpm} wpm -> ${fit.words} words, about ${fit.estimated_seconds}s, kept ${fit.kept.join(",")}`);
  const result = await runFixedShort({ key, runId, tools, spec: { topic: "Can AI pick a random number?", claims: p.claims, sources: p.sources, sentences, scenes, compositionId: "AiTestedRandom", edgeVoice: "en-US-AndrewNeural", style: STYLE, metadata, minSeconds: 34, maxSeconds: 40, makeProps: () => ({ data: p.data }) } });
  tools.write("quality-report.json", { format: "ai_tested_random", technical: result.qa });
}
