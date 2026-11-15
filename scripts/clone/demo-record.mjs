// Real AI test, screen-recorded. The AI Search reference (S7lpCyZSdJQ) is ~73% screen recordings of a model actually being used:
// a prompt is typed, the answer streams in, then the thing it built runs. Page captures with highlight boxes are not that, which is why
// both ai-tested rebuilds looked like the old video. This script does the real thing with a model we can call for free (GEMINI_API_KEY):
//   1. type the prompt into a neutral chat page (our own UI, no product branding) and stream the model's real answer at its real pace,
//   2. pull the ```html block out of the answer and record it running, with scripted key presses,
//   3. write run.json (model id as the API reported it, timestamps, full answer) so every on-screen claim traces to this run.
// Usage: GEMINI_API_KEY=... node scripts/clone/demo-record.mjs <job.json> <outDir>
// job: { "prompt": "...", "model": "optional exact id", "keys": ["ArrowLeft", ...], "app_seconds": 14 }
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [jobPath, outDir] = process.argv.slice(2);
const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));
const provider = job.provider || "gemini";
// OpenAI-compatible providers we hold free keys for (GitHub secrets). `prefer` orders the live /models list; the id actually used is recorded.
const OAI = {
  groq: { base: "https://api.groq.com/openai/v1", env: "GROQ_API_KEY", label: "Groq", prefer: [/gpt-oss-120b/, /kimi/, /llama-4/, /llama-3\.3-70b/, /qwen/] },
  mistral: { base: "https://api.mistral.ai/v1", env: "MISTRAL_API_KEY", label: "Mistral", prefer: [/mistral-large-latest/, /mistral-medium-latest/, /magistral-medium/, /codestral-latest/] },
  cerebras: { base: "https://api.cerebras.ai/v1", env: "CEREBRAS_API_KEY", label: "Cerebras", prefer: [/gpt-oss-120b/, /qwen-3.*235b/, /llama-4/, /llama3\.3|llama-3\.3/, /qwen/] },
};
const KEY = provider === "gemini" ? process.env.GEMINI_API_KEY : process.env[OAI[provider]?.env];
if (!KEY) throw new Error(`key for ${provider} missing`);
fs.mkdirSync(outDir, { recursive: true });
const API = "https://generativelanguage.googleapis.com/v1beta";

async function pickModel() {
  if (job.model) return [job.model];
  if (provider !== "gemini") {
    const p = OAI[provider];
    const r = await fetch(`${p.base}/models`, { headers: { authorization: `Bearer ${KEY}` } });
    if (!r.ok) throw new Error(`list models ${r.status}`);
    const ms = (await r.json()).data.map((m) => m.id).filter((m) => !/whisper|tts|embed|guard|vision|ocr|moderation|audio|voxtral|pixtral/.test(m));
    fs.writeFileSync(path.join(outDir, "models.json"), JSON.stringify(ms, null, 1));
    const out = [];
    for (const re of p.prefer) for (const m of ms) if (re.test(m) && !out.includes(m)) out.push(m);
    return out.length ? out : ms;
  }
  const r = await fetch(`${API}/models?pageSize=200`, { headers: { "x-goog-api-key": KEY } });
  if (!r.ok) throw new Error(`list models ${r.status}`);
  const ms = (await r.json()).models.filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => m.name.replace("models/", ""));
  fs.writeFileSync(path.join(outDir, "models.json"), JSON.stringify(ms, null, 1));
  // newest pro, else newest flash; ids sort well enough by version number
  // text models only (first run picked "nano-banana-pro-preview", an image model, and got 429)
  const text = ms.filter((m) => /^gemini-/.test(m) && !/embed|tts|image|audio|live|robotics|computer-use/.test(m)).sort().reverse();
  return [...text.filter((m) => /flash/.test(m) && !/lite/.test(m)), ...text.filter((m) => /pro/.test(m)), ...text];
}

// Stream the real answer; keep arrival times so the replay runs at the model's own pace.
async function generate(model) {
  const t0 = Date.now();
  const oai = provider !== "gemini";
  const r = oai
    ? await fetch(`${OAI[provider].base}/chat/completions`, {
        method: "POST", headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ model, stream: true, messages: [{ role: "user", content: job.prompt }] }),
      })
    : await fetch(`${API}/models/${model}:streamGenerateContent?alt=sse`, {
        method: "POST", headers: { "x-goog-api-key": KEY, "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: job.prompt }] }] }),
      });
  if (!r.ok) throw new Error(`generate ${r.status} ${await r.text()}`);
  const chunks = []; let buf = "";
  for await (const piece of r.body) {
    buf += Buffer.from(piece).toString("utf8").replace(/\r/g, ""); // the API separates events with \r\n\r\n
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const ev = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = ev.split("\n").find((l) => l.startsWith("data: "));
      if (!line || line === "data: [DONE]") continue;
      const d = JSON.parse(line.slice(6));
      const text = oai ? d.choices?.[0]?.delta?.content || "" : (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
      if (text) chunks.push({ t: Date.now() - t0, text });
    }
  }
  return { chunks, ms: Date.now() - t0, answer: chunks.map((c) => c.text).join("") };
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
// the answer holds HTML with </script>; escape < so it cannot end our inline script
const js = (v) => JSON.stringify(v).replace(/</g, String.fromCharCode(92) + "u003c");
function chatPage(model, prompt, chunks) {
  return `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#1b1b1d;color:#e8e6e3;font:17px/1.55 Inter,Segoe UI,system-ui,sans-serif;height:100vh;display:flex;flex-direction:column}
  header{padding:14px 28px;border-bottom:1px solid #2c2c30;color:#9a9aa2;font-size:14px}header b{color:#e8e6e3}
  #log{flex:1;overflow:auto;padding:28px 18%}.u{background:#2a2a2e;border-radius:14px;padding:14px 18px;margin:0 0 22px auto;max-width:70%;white-space:pre-wrap}
  .a{white-space:pre-wrap}.a code,.a pre{font-family:Consolas,monospace;font-size:14px;color:#b5d7a8}
  #box{margin:0 18% 26px;background:#2a2a2e;border-radius:16px;padding:16px 18px;min-height:52px;white-space:pre-wrap;color:#cfcfd4}
  .cur{display:inline-block;width:9px;height:19px;background:#e8e6e3;vertical-align:-3px;animation:b 1s steps(1) infinite}@keyframes b{50%{opacity:0}}
  </style><header>AI Tested · live run · ${esc(provider === "gemini" ? "Google Gemini API" : OAI[provider].label + " API")} · model <b>${esc(model)}</b></header><div id="log"></div><div id="box"><span id="typed"></span><span class="cur"></span></div>
  <script>
  const prompt=${js(prompt)}, chunks=${js(chunks)};
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  (async()=>{await sleep(600);const ty=document.getElementById('typed');
   for(const ch of prompt){ty.textContent+=ch;await sleep(prompt.length>220?12:28);} await sleep(500);
   const log=document.getElementById('log');const u=document.createElement('div');u.className='u';u.textContent=prompt;log.appendChild(u);ty.textContent='';
   const a=document.createElement('div');a.className='a';log.appendChild(a);let last=0;
   // replay at real pace, capped so a 60 s generation still fits a shot
   const scale=Math.min(1, 14000/Math.max(1,chunks.at(-1)?.t||1));
   for(const c of chunks){await sleep((c.t-last)*scale);last=c.t;a.textContent+=c.text;log.scrollTop=log.scrollHeight;}
   window.__done=true;})();
  </script>`;
}

const cands = job.model ? [job.model] : await pickModel();
let model, gen;
for (const m of cands.slice(0, 6)) {
  try { gen = await generate(m); model = m; break; } catch (e) { console.log("model", m, "failed:", String(e.message).slice(0, 120)); }
}
if (!gen) throw new Error("no model answered");
console.log("model", model);
const run = { provider, model, prompt: job.prompt, started: new Date().toISOString(), generation_ms: gen.ms, chunks: gen.chunks.length, answer: gen.answer };
fs.writeFileSync(path.join(outDir, "run.json"), JSON.stringify(run, null, 1));

const browser = await chromium.launch();
async function record(name, html, seconds, act) {
  const dir = path.join(outDir, name + "-raw");
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir, size: { width: 1920, height: 1080 } } });
  const page = await ctx.newPage();
  const file = path.join(outDir, name + ".html");
  fs.writeFileSync(file, html);
  await page.goto("file://" + path.resolve(file));
  if (act) await act(page); else await page.waitForTimeout(seconds * 1000);
  await ctx.close();
  const vid = fs.readdirSync(dir).find((f) => f.endsWith(".webm"));
  fs.renameSync(path.join(dir, vid), path.join(outDir, name + ".webm"));
  fs.rmSync(dir, { recursive: true });
}
await record("chat", chatPage(model, job.prompt, gen.chunks), 0, async (p) => {
  await p.waitForFunction(() => window.__done, null, { timeout: 120000 }); await p.waitForTimeout(1500);
});
// fenced block (closing fence optional: long answers can end without it), else a bare <html> document
const m = gen.answer.match(/```html\s*([\s\S]*?)(?:```|$)/i) || gen.answer.match(/(<!doctype html[\s\S]*<\/html>)/i);
console.log("answer chars", gen.answer.length, "| start", JSON.stringify(gen.answer.slice(0, 80)), "| end", JSON.stringify(gen.answer.slice(-80)));
if (m) {
  await record("app", m[1], 0, async (p) => {
    await p.waitForTimeout(1500);
    const keys = job.keys || [];
    const end = Date.now() + (job.app_seconds || 14) * 1000;
    for (let i = 0; Date.now() < end; i++) { if (keys.length) await p.keyboard.press(keys[i % keys.length]); await p.mouse.click(960, 540); await p.waitForTimeout(350); }
  });
} else console.log("no html block in answer; app not recorded");
await browser.close();
console.log("done", outDir);
