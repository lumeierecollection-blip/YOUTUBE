// AI Tested "Can you trust AI with your data?" preview. Two companies' own words (quoted exactly, re-checked against the live pages when the run can
// fetch them), their logos from Wikimedia Commons (public domain), and a test run on real models: a made-up secret in the system prompt, twelve ways
// to get it out, every reply read by code. 35 to 40 seconds, natural speed, a serious voice. A test already run today is reused.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { commonsMeta } from "../../production/commons.mjs";
import { compactScenes, fitScript } from "../../production/fitscript.mjs";
import { narrate } from "../../production/index.mjs";
import { COMPANY, QUOTES, measure, plan } from "./secrets.mjs";

const sharp = createRequire(join(ROOT, "package.json"))("sharp");
const VOICE = "Charon", GRAVITY = "serious";
const CALIBRATION = "The first model answered in under a second. The second took longer, and its reply was twice as long. Both were asked the same question, using the same words, one after the other, thirty times.";
const LOGOS = { gemini: "File:Google Gemini logo.svg", claude: "File:Claude AI logo.svg", openai: "File:OpenAI logo 2025 (wordmark).svg" };
const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", accept: "text/html,*/*" };
const flat = (s) => String(s).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&#39;|&rsquo;|&lsquo;|’|‘/g, "'").replace(/&quot;|“|”/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").toLowerCase();

/** Re-reads each company page and checks the quote is on it. A page that cannot be fetched here is reported, not guessed. */
async function verifyQuotes(tools) {
  const report = {}, pages = {};
  for (const [id, q] of Object.entries(QUOTES)) {
    const co = COMPANY[q.co];
    if (!(co.url in pages)) {
      try { const r = await fetch(co.url, { headers: UA, signal: AbortSignal.timeout(30000), redirect: "follow" }); pages[co.url] = r.ok ? flat(await r.text()) : `HTTP ${r.status}`; } catch (e) { pages[co.url] = `ERROR ${String(e.message).slice(0, 80)}`; }
    }
    const page = pages[co.url], fetched = !/^(HTTP|ERROR)/.test(page), found = fetched && page.includes(flat(q.text));
    report[id] = { url: co.url, page_fetched_in_run: fetched, found_in_run: found, note: fetched ? (found ? "quote found on the live page" : "PAGE FETCHED BUT QUOTE NOT FOUND") : `could not re-fetch (${page}); quote is from the 11 Nov 2026 fetch in data/research/ai-privacy-2026-11-11.json` };
    if (fetched && !found) throw new Error(`quote ${id} not found on ${co.url}; the page may have changed. Re-fetch and update data/research/ai-privacy-2026-11-11.json`);
  }
  tools.write("quote-verification.json", report);
  return report;
}

async function logo(title) {
  const meta = await commonsMeta(title), name = title.replace(/^File:/, "");
  for (let i = 1; ; i++) {
    const r = await fetch(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=700`, { headers: { "User-Agent": "AiTestedPreview/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; logos to identify companies)" } });
    if (r.ok) { const png = await sharp(Buffer.from(await r.arrayBuffer())).trim().png().toBuffer(); return { uri: `data:image/png;base64,${png.toString("base64")}`, entry: { title, page_url: meta.page, licence: meta.licence, author: meta.author || "unknown", note: "A company logo shown only to name the company; trademark of its owner." } }; }
    if (i >= 4) throw new Error(`logo ${title} -> ${r.status}`);
    await new Promise((res) => setTimeout(res, i * 4000));
  }
}

export default async function privacyPreview({ key, runId, tools }) {
  const repo = process.env.GITHUB_REPOSITORY, runUrl = repo ? `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : "local";
  const today = new Date().toISOString().slice(0, 10);
  const earlier = (() => {
    const g = (...a) => spawnSync("git", a, { encoding: "utf8", maxBuffer: 2e8 });
    if (g("fetch", "--depth=1", "origin", "automation/previews").status !== 0) return null;
    const files = g("ls-tree", "-r", "--name-only", "FETCH_HEAD", "previews/ai-tested").stdout.split(/\r?\n/).filter((f) => f.endsWith("/experiment.json")).sort().reverse();
    for (const f of files) { try { const j = JSON.parse(g("show", `FETCH_HEAD:${f}`).stdout); if (j.kind === "secrets" && j.date === today && j.models?.length >= 2 && j.models[0].items) return { ...j, run_url: j.run_url || `https://github.com/${repo}/actions/runs/${f.match(/run-([0-9]+)-/)[1]}`, reused_from: f }; } catch {} }
    return null;
  })();
  const verification = await verifyQuotes(tools);
  const exp = earlier || await measure({ runUrl });
  tools.write("experiment.json", exp);
  tools.stage("research_complete", "ok");
  const p = plan(exp);
  const images = {}, entries = [];
  for (const [k, t] of Object.entries(LOGOS)) { const l = await logo(t); images[k] = l.uri; entries.push({ id: k, ...l.entry }); }
  tools.write("asset-manifest.json", { note: "Logos are Wikimedia Commons files with their licences recorded, shown only to name the company. Nothing is AI-generated.", assets: entries });

  const d = p.data, dateText = new Date(exp.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const metadata = {
    title: d.anyLeak ? `Can You Trust AI With Your Data? We Made It Leak ${d.leaks === 1 ? "Once" : `${d.leaks} Times`}` : "Can You Trust AI With Your Data? We Could Not Make It Leak",
    description: `Google's Gemini Apps Privacy Hub (updated 26 October 2026) says "a subset of chats are reviewed by human reviewers" and that reviewed chats are "retained for up to three years". Anthropic's consumer terms update (28 August 2025) says data retention extends to five years if you allow training, and stays at 30 days if you do not. OpenAI's own pages refused our automated request, so we quote nothing from them. Then we tested the models themselves: we gave ${exp.models.length} AI models an invented secret code in their instructions, told them never to share it, and tried ${exp.attempts} different ways to get it. ${d.models.map((m) => `${m.name}: the whole secret appeared in ${m.leaked} of ${m.n} replies`).join(". ")}. A partial leak is not counted. No real personal data was used. One small test, run on ${dateText} at temperature 0; policies and models change. Company logos are trademarks of their owners, shown only to name them.\n\n#Shorts #AI #AITested #Privacy #ChatGPT #Gemini #Claude\n\nSources: ${COMPANY.google.url} and ${COMPANY.anthropic.url}`,
    tags: ["AI privacy", "can you trust AI", "AI data", "ChatGPT", "Gemini", "Claude", "AI test", "data privacy"],
  };
  const cal = await narrate({ text: CALIBRATION, edgeVoice: "en-US-AndrewNeural", outDir: tools.outDir, name: "calibration", gravity: GRAVITY, voice: VOICE });
  const fitFor = (wpm) => { const fit = fitScript({ slots: p.slots, wpm, targetSeconds: 36.2, minSeconds: 35.5, maxSeconds: 38.4 }); return { fit, ...compactScenes({ scenes: p.scenes, sentences: fit.sentences }) }; };
  const first = fitFor(cal.wpm * 0.88);
  tools.write("script-fit.json", { measured_wpm: cal.wpm, voice: cal.engine, ...first.fit });
  console.log(`script fit: ${cal.wpm} wpm -> ${first.fit.words} words, about ${first.fit.estimated_seconds}s, ${first.sentences.length} beats`);
  const result = await runFixedShort({ key, runId, tools, spec: { topic: "Can you trust AI with your data?", claims: p.claims, sources: p.sources, sentences: first.sentences, scenes: first.scenes, compositionId: "AiTestedPrivacy", edgeVoice: "en-US-AndrewNeural", gravity: GRAVITY, voice: VOICE, metadata, minSeconds: 35, maxSeconds: 40, refit: (wpm) => { const x = fitFor(wpm * 0.98); return { sentences: x.sentences, scenes: x.scenes }; }, makeProps: () => ({ images, data: p.data }) } });
  tools.write("quality-report.json", { format: "ai_tested_privacy", quote_verification: verification, technical: result.qa });
}
