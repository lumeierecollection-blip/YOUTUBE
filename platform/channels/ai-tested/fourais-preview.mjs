// AI Tested Short pointing to the long-form "We Gave Free AIs the Same 5 Jobs. One Took 7 Minutes." Facts come from our recorded run logs.
// 35 to 40 seconds at natural voice speed (never altered), then the shared Short path.
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { commonsMeta } from "../../production/commons.mjs";
import { compactScenes, fitScript } from "../../production/fitscript.mjs";
import { narrate } from "../../production/index.mjs";
import { plan } from "./fourais.mjs";

const sharp = createRequire(join(ROOT, "package.json"))("sharp");
const STYLE = "Clear, curious and brisk, like a tech reviewer";
const CALIBRATION = "The first model answered in under a second. The second took longer, and its reply was twice as long. Both were asked the same question, using the same words, one after the other, thirty times.";
const LOGOS = { gemini: "File:Google Gemini logo.svg", openai: "File:OpenAI logo 2025 (wordmark).svg" };

async function logo(title) {
  const meta = await commonsMeta(title), name = title.replace(/^File:/, "");
  for (let i = 1; ; i++) {
    const r = await fetch(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=700`, { headers: { "User-Agent": "AiTestedPreview/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; logos to identify companies)" } });
    if (r.ok) { const png = await sharp(Buffer.from(await r.arrayBuffer())).trim().png().toBuffer(); return { uri: `data:image/png;base64,${png.toString("base64")}`, entry: { title, page_url: meta.page, licence: meta.licence, author: meta.author || "unknown", note: "A company logo shown only to name the company; trademark of its owner." } }; }
    if (i >= 4) throw new Error(`logo ${title} -> ${r.status}`);
    await new Promise((res) => setTimeout(res, i * 4000));
  }
}

export default async function fourAisPreview({ key, runId, tools }) {
  const p = plan();
  tools.write("experiment.json", { note: "numbers read from data/clone/runs/ai-tested-four-ais", models: p.data.models.map(({ name, seconds, passed }) => ({ name, seconds, passed })) });
  tools.stage("research_complete", "ok");
  const images = {}, entries = [];
  for (const [k, t] of Object.entries(LOGOS)) { const l = await logo(t); images[k] = l.uri; entries.push({ id: k, ...l.entry }); }
  tools.write("asset-manifest.json", { note: "Logos are Wikimedia Commons files with licences recorded, shown only to name the company. The app pictures are our own screen recordings (src/skills/remotion-render/public/lf2/ai-tested/clips/ai-tested-four-ais).", assets: entries });
  const metadata = {
    title: "AI Speed Test: 19 Seconds vs 7 Minutes",
    description: `We gave three AIs the same five coding jobs, one try each. Gemini 3.8 Flash took 434 s in total and made all five work. gpt-oss-120b took about 19 s and 4 of 5 worked (the solar system never moved). gpt-oss-20b took about 16 s and 4 of 5 worked (the hexagon had 1 ball, not 10). Times are each model's generation time from our run logs; pass or fail was judged from screen recordings. One try per job on 16 November 2026, so results can change between runs and as models update. A fourth model, Qwen 3.8 27B, could not be scored on our tier.\n\nFull test: on our channel\n\n#Shorts #AI #AITested #Gemini #ChatGPT`,
    tags: ["AI test", "Gemini", "gpt-oss", "AI speed", "can you trust AI", "AI coding", "free AI"],
  };
  const cal = await narrate({ text: CALIBRATION, edgeVoice: "en-US-AndrewNeural", outDir: tools.outDir, name: "calibration", style: STYLE });
  const fitFor = (wpm) => { const fit = fitScript({ slots: p.slots, wpm, targetSeconds: 36.5, minSeconds: 35, maxSeconds: 38.5 }); return { fit, ...compactScenes({ scenes: p.scenes, sentences: fit.sentences }) }; };
  const first = fitFor(cal.wpm * 0.88);
  tools.write("script-fit.json", { measured_wpm: cal.wpm, voice: cal.engine, ...first.fit });
  console.log(`script fit: ${cal.wpm} wpm -> ${first.fit.words} words, about ${first.fit.estimated_seconds}s`);
  const result = await runFixedShort({ key, runId, tools, spec: { topic: "Fast AIs vs the slow one that finished every job", claims: p.claims, sources: p.sources, sentences: first.sentences, scenes: first.scenes, compositionId: "AiTestedFourAis", edgeVoice: "en-US-AndrewNeural", style: STYLE, metadata, minSeconds: 35, maxSeconds: 40, refit: (wpm) => { const x = fitFor(wpm * 0.98); return { sentences: x.sentences, scenes: x.scenes }; }, makeProps: () => ({ data: p.data, images }) } });
  tools.write("quality-report.json", { format: "ai_tested_four_ais_short", technical: result.qa });
}
