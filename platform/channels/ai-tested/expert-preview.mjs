// AI Tested "Will AI admit when it doesn't know?" preview, at about 30 seconds. Twelve invented things and four real ones are put to real models, code
// counts the replies, the script is built from the counts. Natural voice speed, a serious voice. A test already run today is reused.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { commonsMeta } from "../../production/commons.mjs";
import { compactScenes, fitScript } from "../../production/fitscript.mjs";
import { narrate } from "../../production/index.mjs";
import { measure, plan } from "./expert.mjs";

const sharp = createRequire(join(ROOT, "package.json"))("sharp");
const VOICE = "Charon", GRAVITY = "serious";
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

export default async function expertPreview({ key, runId, tools }) {
  const repo = process.env.GITHUB_REPOSITORY, runUrl = repo ? `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : "local";
  const today = new Date().toISOString().slice(0, 10);
  const earlier = (() => {
    const g = (...a) => spawnSync("git", a, { encoding: "utf8", maxBuffer: 2e8 });
    if (g("fetch", "--depth=1", "origin", "automation/previews").status !== 0) return null;
    const files = g("ls-tree", "-r", "--name-only", "FETCH_HEAD", "previews/ai-tested").stdout.split(String.fromCharCode(10)).map((x) => x.trim()).filter((f) => f.endsWith("/experiment.json")).sort().reverse();
    for (const f of files) { try { const j = JSON.parse(g("show", `FETCH_HEAD:${f}`).stdout); if (j.kind === "expert" && j.date === today && j.models?.length >= 2 && j.models[0].items) return { ...j, run_url: j.run_url || `https://github.com/${repo}/actions/runs/${f.match(/run-([0-9]+)-/)[1]}`, reused_from: f }; } catch {} }
    return null;
  })();
  const exp = earlier || await measure({ runUrl });
  tools.write("experiment.json", exp);
  tools.stage("research_complete", "ok");
  const p = plan(exp);
  const images = {}, entries = [];
  for (const [k, t] of Object.entries(LOGOS)) { const l = await logo(t); images[k] = l.uri; entries.push({ id: k, ...l.entry }); }
  tools.write("asset-manifest.json", { note: "Logos are Wikimedia Commons files with their licences recorded, shown only to name the company. Nothing is AI-generated.", assets: entries });

  const d = p.data, dateText = new Date(exp.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const metadata = {
    title: d.anyCaved ? `Say "I'm an Expert" and AI Agrees With Myths? ${d.caved} of ${d.base}` : `Does AI Cave When You Say "I'm an Expert"? ${d.base} False Claims Tested`,
    description: `We took ${exp.myths} well-known false beliefs (such as "we use 10% of our brains" and "Vikings wore horned helmets") and asked ${exp.models.length} AI models to answer True or False, first plainly, then after saying "I'm an expert, I'm certain this is true". ${d.models.map((m) => `${m.name}: called ${m.plain_right} of ${m.myths} myths False when asked plainly; with the expert claim it agreed with ${m.caved} of those and held on ${m.held}`).join(". ")}. Only myths the model called False when asked plainly are counted. The count reads the first word of each reply (True or False), not everything the model says, and every reply is kept so the counts can be checked. Tell AI to check you, not to agree with you. Has AI ever just agreed with you? Tell us in the comments. One small test, run on ${dateText} at temperature 0; models change and results can change.\n\n#Shorts #AI #AITested #ChatGPT #Gemini #TrustAI`,
    tags: ["AI test", "can you trust AI", "AI sycophancy", "ChatGPT", "Gemini", "AI agrees with you", "AI myths"],
  };
  const cal = await narrate({ text: CALIBRATION, edgeVoice: "en-US-AndrewNeural", outDir: tools.outDir, name: "calibration", gravity: GRAVITY, voice: VOICE });
  const fitFor = (wpm) => { const fit = fitScript({ slots: p.slots, wpm, targetSeconds: 29.7, minSeconds: 28.8, maxSeconds: 31 }); return { fit, ...compactScenes({ scenes: p.scenes, sentences: fit.sentences }) }; };
  const first = fitFor(cal.wpm * 0.88);
  tools.write("script-fit.json", { measured_wpm: cal.wpm, voice: cal.engine, ...first.fit });
  console.log(`script fit: ${cal.wpm} wpm -> ${first.fit.words} words, about ${first.fit.estimated_seconds}s, ${first.sentences.length} beats`);
  const result = await runFixedShort({ key, runId, tools, spec: { topic: "Does AI agree with a false claim when the user says they are an expert?", claims: p.claims, sources: p.sources, sentences: first.sentences, scenes: first.scenes, compositionId: "AiTestedExpert", edgeVoice: "en-US-AndrewNeural", gravity: GRAVITY, voice: VOICE, metadata, minSeconds: 28, maxSeconds: 32, refit: (wpm) => { const x = fitFor(wpm * 0.98); return { sentences: x.sentences, scenes: x.scenes }; }, makeProps: () => ({ images, data: p.data }) } });
  tools.write("quality-report.json", { format: "ai_tested_expert_30s", technical: result.qa });
}
