// AI Tested follow-up preview: measure real models on the spell-out test, build the script from the measured numbers, then use the shared Short path.
// This cut is 35 to 40 seconds (the owner's request after the letter-counting video performed well); natural voice speed, never altered.
import { runFixedShort } from "../../production/fixed-short.mjs";
import { measure, plan } from "./spellout.mjs";

async function verifyWikipedia() {
  const j = await (await fetch("https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&explaintext=1&redirects=1&titles=Large_language_model", { headers: { "User-Agent": "AiTested/1.0" } })).json();
  const text = Object.values(j.query.pages)[0].extract;
  for (const must of ["the text must be converted to numbers", "byte-pair encoding (BPE)"]) if (!text.includes(must)) throw new Error(`Wikipedia article no longer contains "${must}"`);
}

export default async function spelloutPreview({ key, runId, tools }) {
  const repo = process.env.GITHUB_REPOSITORY, runUrl = repo ? `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : "local";
  await verifyWikipedia();
  const exp = await measure({ runUrl });
  tools.write("experiment.json", exp);
  tools.stage("research_complete", "ok");
  const p = plan(exp);
  const dateText = new Date(exp.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const metadata = {
    title: "Why AI Can't Count Letters (And the Simple Fix)",
    description: `Last time, some AI models miscounted letters. We gave ${exp.models.length} models the same 20 questions twice: once plainly, once asking them to spell the word out first. Code marked every reply. Spelling out first added ${p.sumGain} right answers across the models. One test, run on ${dateText}; results change between runs and as models update. Token count measured with Gemini's tokenizer.\n\n#Shorts #AI #AITested #ChatGPT #Gemini\n\nSource for how models read text: https://en.wikipedia.org/wiki/Large_language_model`,
    tags: ["AI test", "letter counting", "AI tokens", "ChatGPT", "Gemini", "prompt engineering", "strawberry test"],
  };
  const result = await runFixedShort({ key, runId, tools, spec: { topic: "Why do some AI models fail at counting letters, and what fixes it?", claims: p.claims, sources: p.sources, sentences: p.sentences, scenes: p.scenes, compositionId: "AiTestedSpellout", edgeVoice: "en-US-AndrewNeural", style: "Clear, curious and brisk, like a tech reviewer", metadata, minSeconds: 34, maxSeconds: 40, makeProps: () => ({ data: p.data }) } });
  tools.write("quality-report.json", { format: "ai_tested_spellout", technical: result.qa });
}
