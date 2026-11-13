// AI Tested "Can AI multiply big numbers?" preview, about 36 seconds, in the existing Shorts format (same engine, voice, timeline and QA as the expert / unknown Shorts).
// The numbers come from the multiplication test already run on GitHub Actions and stored in multiply-data.json; nothing is measured again here.
import { runFixedShort } from "../../production/fixed-short.mjs";
import { compactScenes, fitScript } from "../../production/fitscript.mjs";
import { narrate } from "../../production/index.mjs";
import { DATA, plan } from "./multiply.mjs";

const VOICE = "Charon", GRAVITY = "serious";
const CALIBRATION = "The first model answered in under a second. The second took longer, and its reply was twice as long. Both were asked the same question, using the same words, one after the other, thirty times.";

export default async function multiplyPreview({ key, runId, tools }) {
  tools.write("experiment.json", { kind: "multiply", source: "stored test run", ...DATA });
  tools.stage("research_complete", "ok");
  const p = plan(DATA);
  tools.write("asset-manifest.json", { note: "No third-party images: every picture is built from the stored test's own numbers.", assets: [] });
  const metadata = {
    title: "AI Gets Big Multiplication Wrong. We Tested It",
    description: `We gave Google's Gemini 3.1 Flash-Lite ten multiplication problems at every size from two to ten digits, and code checked every digit of every answer. Answering with only the number it was perfect at two digits and got none right from six digits up; asked to show its working it got ${p.data.wRight} of ${p.data.wOf} right at six digits and up. One test, run on ${DATA.date}. Results can change between runs and as models update.\n\n#Shorts #AI #AITested #Gemini\n\nSource (test run and every reply): ${DATA.run_url}`,
    tags: ["AI test", "AI maths", "AI multiplication", "Gemini Flash-Lite", "can you trust AI", "chain of thought"],
  };
  const cal = await narrate({ text: CALIBRATION, edgeVoice: "en-US-AndrewNeural", outDir: tools.outDir, name: "calibration", gravity: GRAVITY, voice: VOICE });
  const fitFor = (wpm) => { const fit = fitScript({ slots: p.slots, wpm, targetSeconds: 36.5, minSeconds: 35, maxSeconds: 38.5 }); return { fit, ...compactScenes({ scenes: p.scenes, sentences: fit.sentences }) }; };
  const first = fitFor(cal.wpm * 0.88);
  tools.write("script-fit.json", { measured_wpm: cal.wpm, voice: cal.engine, ...first.fit });
  console.log(`script fit: ${cal.wpm} wpm -> ${first.fit.words} words, about ${first.fit.estimated_seconds}s, ${first.sentences.length} beats`);
  const result = await runFixedShort({ key, runId, tools, spec: { topic: "Can AI multiply big numbers?", claims: p.claims, sources: p.sources, sentences: first.sentences, scenes: first.scenes, compositionId: "AiTestedMultiply", edgeVoice: "en-US-AndrewNeural", gravity: GRAVITY, voice: VOICE, metadata, minSeconds: 35, maxSeconds: 39.2, refit: (wpm) => { const x = fitFor(wpm * 0.98); return { sentences: x.sentences, scenes: x.scenes }; }, makeProps: () => ({ data: p.data }) } });
  tools.write("quality-report.json", { format: "ai_tested_multiply_36s", technical: result.qa });
}
