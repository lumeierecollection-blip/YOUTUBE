// AI Tested "Gemini 4 Hydrogen vs the older model: big multiplication" preview, about 57 seconds: a faceless news-card look, in the existing Shorts engine (same voice, timeline and QA).
// Numbers come from the stored test runs (gemini4-data.json); nothing is measured again here.
import { runFixedShort } from "../../production/fixed-short.mjs";
import { compactScenes, fitScript } from "../../production/fitscript.mjs";
import { narrate } from "../../production/index.mjs";
import { DATA, plan } from "./gemini4.mjs";

const VOICE = "Charon", GRAVITY = "serious";
const CALIBRATION = "The first model answered in under a second. The second took longer, and its reply was twice as long. Both were asked the same question, using the same words, one after the other, thirty times.";

export default async function gemini4Preview({ key, runId, tools }) {
  tools.write("experiment.json", { kind: "multiply", source: "stored test run", ...DATA });
  tools.stage("research_complete", "ok");
  const p = plan(DATA);
  tools.write("asset-manifest.json", { note: "No third-party images: every picture is built from the stored test's own numbers.", assets: [] });
  const metadata = {
    title: "Gemini 4 vs Big Multiplication: 48 of 50, Older Model 0",
    description: `We gave Google's new Gemini 4 Hydrogen and the older Gemini 3.1 Flash-Lite the same ninety multiplications, from two to ten digits, answering with only the number. Code checked every digit. From six to ten digits Hydrogen got ${p.data.hydrogen.big.right} of ${p.data.hydrogen.big.of} right and the older model ${p.data.older.big.right} of ${p.data.older.big.of}. Both of Hydrogen's misses were empty replies, not wrong numbers. One run at temperature 0 with a ${DATA.token_cap}-token reply limit; two other Gemini 4 models could not be tested. Results can change between runs and as models update.

#Shorts #AI #AITested #Gemini

Source (test run and every reply): ${DATA.run_url}
Earlier run on the same problems: ${DATA.earlier_run_url}`,
    tags: ["Gemini 4", "Gemini 4 Hydrogen", "AI test", "AI multiplication", "can you trust AI", "AI maths"],
  };

  const cal = await narrate({ text: CALIBRATION, edgeVoice: "en-US-AndrewNeural", outDir: tools.outDir, name: "calibration", gravity: GRAVITY, voice: VOICE });
  const fitFor = (wpm) => { const fit = fitScript({ slots: p.slots, wpm, targetSeconds: 57, minSeconds: 54, maxSeconds: 60 }); return { fit, ...compactScenes({ scenes: p.scenes, sentences: fit.sentences }) }; };
  const first = fitFor(cal.wpm * 0.88);
  tools.write("script-fit.json", { measured_wpm: cal.wpm, voice: cal.engine, ...first.fit });
  console.log(`script fit: ${cal.wpm} wpm -> ${first.fit.words} words, about ${first.fit.estimated_seconds}s, ${first.sentences.length} beats`);
  const result = await runFixedShort({ key, runId, tools, spec: { topic: "Gemini 4 Hydrogen vs the older model: big multiplication", claims: p.claims, sources: p.sources, sentences: first.sentences, scenes: first.scenes, compositionId: "AiTestedGemini4", edgeVoice: "en-US-AndrewNeural", gravity: GRAVITY, voice: VOICE, metadata, minSeconds: 54, maxSeconds: 60.5, refit: (wpm) => { const x = fitFor(wpm * 0.98); return { sentences: x.sentences, scenes: x.scenes }; }, makeProps: () => ({ data: p.data }) } });
  tools.write("quality-report.json", { format: "ai_tested_gemini4_58s", technical: result.qa });
}
