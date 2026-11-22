// AI Tested "If you ask AI for a source, will the link work?" preview: ask real models for links, request every link, build the script from the counts,
// then use the shared Short path. 35 to 40 seconds, natural voice speed, never altered. A test already run today is reused.
import { spawnSync } from "node:child_process";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { measure, plan } from "./links.mjs";
import { compactScenes, fitScript } from "../../production/fitscript.mjs";
import { narrate } from "../../production/index.mjs";

const STYLE = "Clear, curious and brisk, like a tech reviewer";
const CALIBRATION = "The first model answered in under a second. The second took longer, and its reply was twice as long. Both were asked the same question, using the same words, one after the other, thirty times.";

export default async function linksPreview({ key, runId, tools }) {
  const repo = process.env.GITHUB_REPOSITORY, runUrl = repo ? `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : "local";
  const today = new Date().toISOString().slice(0, 10);
  const earlier = (() => {
    const g = (...a) => spawnSync("git", a, { encoding: "utf8", maxBuffer: 2e8 });
    if (g("fetch", "--depth=1", "origin", "automation/previews").status !== 0) return null;
    const files = g("ls-tree", "-r", "--name-only", "FETCH_HEAD", "previews/ai-tested").stdout.split(/\r?\n/).filter((f) => f.endsWith("/experiment.json")).sort().reverse();
    for (const f of files) { try { const j = JSON.parse(g("show", `FETCH_HEAD:${f}`).stdout); if (j.kind === "links" && j.date === today && j.models?.length >= 2 && j.models[0].items) return { ...j, run_url: j.run_url || `https://github.com/${repo}/actions/runs/${f.match(/run-([0-9]+)-/)[1]}`, reused_from: f }; } catch {} }
    return null;
  })();
  const exp = earlier || await measure({ runUrl });
  tools.write("experiment.json", exp);
  tools.stage("research_complete", "ok");
  const p = plan(exp);
  const dateText = new Date(exp.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const line = (m) => `${m.name}: ${m.opened} links opened, ${m.dead} dead, ${m.unchecked} could not be checked`;
  const d = p.data;
  const metadata = {
    title: d.anyDead ? `We Clicked Every Link AI Gave Us. ${d.dead} of ${d.all} Were Dead.` : "We Clicked Every Link AI Gave Us. None Were Dead.",
    description: `We asked ${exp.models.length} AI models for one direct link to a news article or study on ${exp.questions} topics, then requested every link from a server. ${d.models.map(line).join(". ")}. Opened means the server returned a page (it does not prove the page says what the AI claimed); dead means a 404 or 410 or an address that does not exist; unchecked means the site blocked us or did not answer. A link is not a source until you click it. One small test, run on ${dateText} at temperature 0; links, sites and models change.

#Shorts #AI #AITested #ChatGPT #Gemini`,
    tags: ["AI test", "AI fake links", "AI sources", "ChatGPT", "Gemini", "can you trust AI", "AI hallucination"],
  };
  const cal = await narrate({ text: CALIBRATION, edgeVoice: "en-US-AndrewNeural", outDir: tools.outDir, name: "calibration", style: STYLE });
  const fitFor = (wpm) => { const fit = fitScript({ slots: p.slots, wpm, targetSeconds: 36.2, minSeconds: 35.5, maxSeconds: 38.4 }); return { fit, ...compactScenes({ scenes: p.scenes, sentences: fit.sentences }) }; };
  const first = fitFor(cal.wpm * 0.88);
  tools.write("script-fit.json", { measured_wpm: cal.wpm, voice: cal.engine, ...first.fit });
  console.log(`script fit: ${cal.wpm} wpm -> ${first.fit.words} words, about ${first.fit.estimated_seconds}s, kept ${first.fit.kept.join(",")}`);
  const result = await runFixedShort({ key, runId, tools, spec: { topic: "If you ask AI for a source, will the link work?", claims: p.claims, sources: p.sources, sentences: first.sentences, scenes: first.scenes, compositionId: "AiTestedLinks", edgeVoice: "en-US-AndrewNeural", style: STYLE, metadata, minSeconds: 35, maxSeconds: 40, refit: (wpm) => { const x = fitFor(wpm * 0.98); return { sentences: x.sentences, scenes: x.scenes }; }, makeProps: () => ({ data: p.data }) } });
  tools.write("quality-report.json", { format: "ai_tested_links", technical: result.qa });
}
