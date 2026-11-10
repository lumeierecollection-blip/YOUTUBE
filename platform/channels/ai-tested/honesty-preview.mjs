// AI Tested honesty test preview: measure real models, build the script from the measured numbers, then use the shared Short path.
import { runFixedShort } from "../../production/fixed-short.mjs";
import { measure, plan } from "./honesty.mjs";

export default async function honestyPreview({ key, runId, tools }) {
  const repo = process.env.GITHUB_REPOSITORY, runUrl = repo ? `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : "local";
  const exp = await measure({ runUrl });
  tools.write("experiment.json", exp);
  tools.stage("research_complete", "ok");
  const p = plan(exp);
  const dateText = new Date(exp.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const metadata = {
    title: "Will AI Say “I Don't Know”? We Tested Models on Made-Up Products",
    description: `We asked ${exp.models.length} AI models about ten products that do not exist, plus ten real questions as a control, and code marked each reply. One test, run on ${dateText}. Marking uses a phrase list, so borderline replies can be mislabelled; results change between runs and as models update.\n\n#Shorts #AI #AITested #ChatGPT #Gemini\n\nWhy now: new models keep launching, e.g. https://www.anthropic.com/claude-fable-and-mythos-5-2 (reported on Hacker News, 9 Nov 2026).`,
    tags: ["AI test", "AI hallucination", "AI models", "I don't know", "GPT-OSS", "Gemini"],
  };
  const result = await runFixedShort({ key, runId, tools, spec: { topic: "Do AI models admit what they don't know?", claims: p.claims, sources: p.sources, sentences: p.sentences, scenes: p.scenes, compositionId: "AiTestedHonestyShort", edgeVoice: "en-US-AndrewNeural", style: "Clear, curious and brisk, like a tech reviewer", metadata, minSeconds: 20, makeProps: () => ({ data: p.data }) } });
  tools.write("quality-report.json", { format: "ai_tested_honesty", technical: result.qa });
}
