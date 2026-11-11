/**
 * AI Tested: "If you ask AI for a source, will the link work?" Each available model is asked, for twelve topics, for one direct link to a news
 * article or study ("Reply with only the link."). Code then requests every link it was given and records what the server said:
 *   opened     the server returned a page (HTTP 2xx after redirects)
 *   dead       HTTP 404 or 410, or the web address does not exist (DNS failure)
 *   unchecked  anything else: the site blocked the request, timed out, returned a server error, or no link was given
 * "Opened" only means a page came back; it does not mean the page is about the topic, and a site that shows a "not found" page with a 200 status
 * counts as opened. Those limits are said in the description. Temperature 0. One small test; links and models change.
 */
import { MODELS } from "./pushback.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const TOPICS = ["the Chernobyl disaster", "the Apollo 11 moon landing", "the 2008 financial crisis", "the Panama Papers leak", "CRISPR gene editing", "the discovery of penicillin", "the invention of the World Wide Web", "the Great Barrier Reef bleaching", "the Black Death", "the Hubble Space Telescope launch", "Moore's law", "the Deepwater Horizon oil spill"];
export const askText = (topic) => `Give me one direct link to a news article or study about ${topic}. Reply with only the link.`;
const URL_RE = /https?:\/\/[^\s<>"')\]]+/i;
export const extractUrl = (reply) => { const m = String(reply || "").match(URL_RE); return m ? m[0].replace(/[.,;:!?*_`]+$/, "") : null; };
const BROWSER = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", accept: "text/html,application/xhtml+xml,*/*;q=0.8" };

/** What the server says about one link. Never throws. */
export async function check(url) {
  if (!url) return { outcome: "unchecked", why: "no link in the reply" };
  try {
    const r = await fetch(url, { redirect: "follow", headers: BROWSER, signal: AbortSignal.timeout(25000) });
    try { await r.body?.cancel(); } catch {}
    if (r.status >= 200 && r.status < 300) return { outcome: "opened", status: r.status, final: r.url };
    if (r.status === 404 || r.status === 410) return { outcome: "dead", status: r.status, final: r.url };
    return { outcome: "unchecked", status: r.status, why: `the site answered ${r.status}` };
  } catch (e) {
    const code = e?.cause?.code || e?.code || "";
    if (code === "ENOTFOUND") return { outcome: "dead", why: "the web address does not exist" };
    return { outcome: "unchecked", why: String(code || e?.name || e).slice(0, 60) };
  }
}

async function askWithRetry(model, turns) {
  for (let attempt = 1; ; attempt++) {
    try { return await model.ask(turns); } catch (e) { if (attempt >= 3 || (e.status === 429 && /no Gemini key/.test(e.message))) throw e; await sleep((e.status === 429 ? 20000 : 5000) * attempt); }
  }
}

export async function measure({ runUrl, now = new Date(), log = console.error }) {
  const models = [];
  for (const m of MODELS.filter((c) => c.available())) {
    const out = { name: m.name, speak: m.speak, id: m.id, items: [] };
    try {
      for (const topic of TOPICS) {
        const reply = await askWithRetry(m, [{ role: "user", text: askText(topic) }]); await sleep(m.pause);
        const url = extractUrl(reply), res = await check(url);
        out.items.push({ topic, reply, url, ...res });
      }
    } catch (e) { log(`[links] ${m.name} dropped: ${e.message} after ${out.items.length} topics`); continue; }
    models.push(out);
    log(`[links] ${m.name}: ${JSON.stringify(tally(out))}`);
  }
  if (models.length < 2) throw new Error(`only ${models.length} model(s) completed; a comparison needs at least 2`);
  return { kind: "links", date: now.toISOString().slice(0, 10), run_url: runUrl, temperature: 0, questions: TOPICS.length, models };
}

export function tally(m) {
  const c = (o) => m.items.filter((i) => i.outcome === o).length;
  return { n: m.items.length, opened: c("opened"), dead: c("dead"), unchecked: c("unchecked") };
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const say = (n) => (n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "") : String(n));
const Cap = (s) => s[0].toUpperCase() + s.slice(1);
const short = (u, n = 46) => { const t = String(u || "").replace(/^https?:\/\//, ""); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** Claims, script, scenes and composition data, all built from the measured counts. The wording follows the result, whichever way it went. */
export function plan(exp) {
  const ms = exp.models.map((m) => ({ ...m, ...tally(m) }));
  const url = exp.run_url, date = exp.date, total = exp.questions, n2 = say(ms.length);
  const dead = ms.reduce((s, m) => s + m.dead, 0), anyDead = dead > 0, all = ms.reduce((s, m) => s + m.n, 0);
  const claim = (claim_id, text, status = "measured_statistic") => ({ claim_id, claim: text, source_id: "s1", source_url: url, published: date, excerpt: text, confidence: "high", context: `Measured in this production's own test on ${date}: each link was requested once from a GitHub runner and the server's answer recorded. Opened means the server returned a page (HTTP 2xx); dead means HTTP 404 or 410 or no such web address; unchecked is everything else. One test on ${total} topics; results change between runs and as sites and models change. Models: ${ms.map((m) => m.name).join(", ")}.`, editorial_status: status });
  const counts = (m) => `${m.opened} opened, ${m.dead} dead, ${m.unchecked} unchecked`;
  const claims = [
    claim("design", `${Cap(n2)} models were each asked for one direct link to a news article or study on ${total} topics, and every link was requested.`, "demonstrated_feature"),
    ...ms.map((m, i) => claim(`m${i}`, `${m.speak}, ${m.n} links: ${counts(m)}.`)),
    claim("total", `Across ${n2} models, ${dead} of ${all} links were dead: ${ms.map((m) => `${m.name} ${m.dead} of ${m.n}`).join(", ")}.`),
  ];
  const pick = () => { for (const o of ["dead", "opened", "unchecked"]) for (const m of ms) { const it = m.items.find((i) => i.outcome === o && i.url); if (it) return { model: m.name, topic: it.topic, ask: askText(it.topic), url: it.url, outcome: it.outcome, status: it.status || null, why: it.why || null }; } return null; };
  const example = pick();
  const V = (text, claim_ids = []) => ({ text, claim_ids });
  const NR = { allow_no_claim: true, editorial: "question, transition or recommendation drawn from the measured results" };
  const line = (m) => (m.dead === 0 ? [`${m.speak} gave no dead links.`, `${m.speak}: no dead links.`] : m.dead === m.n ? [`Every one of ${m.speak}'s links was dead.`, `${m.speak}: every link dead.`] : [`${m.speak} gave ${say(m.dead)} dead links out of ${say(m.n)}.`, `${m.speak}: ${say(m.dead)} dead.`]);
  const slots = [
    { id: "hook", scene: 0, ...NR, variants: [V("If you ask AI for a source, will the link work?")] },
    { id: "design", scene: 1, variants: [V(`We asked ${n2} AI models for a link on ${say(total)} topics, then clicked every single one.`, ["design"]), V(`We asked ${n2} AI models for a link on ${say(total)} topics, then clicked every one.`, ["design"]), V(`We asked ${n2} models for ${say(total)} links, then clicked them all.`, ["design"])] },
    { id: "ask", scene: 1, optional: true, ...NR, variants: [V("Each one had to give a news article or a study."), V("One news article or study each.")] },
    ...ms.map((m, i) => ({ id: `m${i}`, scene: 2, variants: line(m).map((t) => V(t, [`m${i}`])) })),
    { id: "total", scene: 2, variants: [V(anyDead ? `That is ${say(dead)} dead links out of ${say(all)}.` : `That is no dead links out of ${say(all)}.`, ["total"]), V(anyDead ? `${Cap(say(dead))} of ${say(all)} were dead.` : `None were dead.`, ["total"])] },
    { id: "example", scene: 3, optional: true, ...NR, variants: [V(anyDead ? "Here is one real answer, and what the site said." : "Here is one real answer."), V("Here is one real answer.")] },
    ...(example ? [{ id: "exTopic", scene: 3, optional: true, ...NR, variants: [V(`This one was about ${example.topic}.`)] }] : []),
    { id: "tip1", scene: 4, ...NR, variants: [V(anyDead ? "A dead link looks exactly like a working one." : "Even a working link only proves a page exists."), V("A link is not a source until you click it.")] },
    { id: "tip2", scene: 4, ...NR, variants: [V("So how many links have you trusted without clicking?"), V("How many links have you trusted unclicked?")] },
  ];
  const scenes = [
    { kind: "hookL", treatment: "kinetic-question", objective: "Pose the question over a real chat: a request for a link and the link the AI gave", background: "white" },
    { kind: "setupL", treatment: "process-diagram", objective: "Show the real request, the twelve topics, and that every link was clicked", background: "white" },
    { kind: "gridL", treatment: "count-grid", objective: "Show one square per link for each model, coloured opened, dead or unchecked, with the count", background: "white" },
    { kind: "exampleL", treatment: "terminal", objective: "Show one real link from the test and what the server said", background: "white" },
    { kind: "tipL", treatment: "verdict-panel", objective: "Close with the dead count and the question: how many links have you trusted unclicked", background: "accent panel" },
  ];
  const data = { date, total, anyDead, dead, all, example, models: ms.map((m) => ({ name: m.name, id: m.id, n: m.n, opened: m.opened, dead: m.dead, unchecked: m.unchecked, seq: m.items.map((i) => i.outcome === "none" ? "unchecked" : i.outcome) })), topics: TOPICS, sampleAsk: askText(TOPICS[0]), shortUrl: example ? short(example.url) : "" };
  return { claims, slots, scenes, data, anyDead, sources: [{ source_id: "s1", url, published: date, title: "AI Tested links test run" }] };
}
