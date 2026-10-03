#!/usr/bin/env node
/**
 * Script NARRATIVE validator (owner's spec 2026-10-03, "rewrite the script stage as a
 * narrative engine"): hook -> setup -> re-hook -> payoff -> close.
 *
 *   node scripts/validate-script-narrative.cjs <channel> <script.json> [research.json]
 *     exit 0 = PASS, 2 = FAIL. "  - " lines are the re-ask feedback.
 *
 * Beats come from the section ids the prompt asks for (hook / setup / rehook / payoff /
 * close). A script without them is split by position: sentence 1 the hook, the last the
 * close, the middle ~40% setup / ~20% re-hook / ~40% payoff.
 *
 *   HOOK    one sentence; a number, a shock word, a contradiction or a stake; not a
 *           person's name first; not "Here's what happened" / "Have you ever wondered".
 *   SETUP   every sentence names something; its LAST sentence withholds an answer
 *           ("?" or a tease: but / isn't / until / nobody / only / why / how / what …).
 *   REHOOK  present; a flip or a raise (but / except / however / catch / trap / worse …).
 *   PAYOFF  a specific number; a person / place / organization; no hedge (may / could /
 *           might / possibly / perhaps).
 *   CLOSE   one sentence; an action (an imperative) or a number; never "stay informed",
 *           "follow for more", "thanks for watching", "the future is uncertain".
 * Plus the voice rules' banned phrases, sentence length and name starts
 * (validate-script-voice.cjs).
 *
 * Where it stops: these are word tests. A hook with a number can still be dull, and a
 * "but" does not make a twist. They catch a missing beat, a summary-shaped script, a hedge
 * and a dead close — the failures the owner named — not taste.
 */
const { readFileSync } = require("node:fs");
const { sentences, specificsOf, isTurnLine } = require("./validate-script.cjs");
const V = require("./validate-script-voice.cjs");

const BEATS = ["hook", "setup", "rehook", "payoff", "close"];
const SHOCK = /\b(disappear(?:ed|s)?|vanish(?:ed|es)?|collaps(?:ed|es)|doubl(?:ed|es)|tripl(?:ed|es)|crash(?:ed|es)|plung(?:ed|es)|soar(?:ed|s)|surg(?:ed|es)|wiped|seized|banned|fined|charged|indicted|stole|stolen|fraud|lost|loses|dead|died|killed|secret|hidden|never|nobody|no one|only|first|record|biggest|worst|cost(?:s)?|pay|paid)\b/i;
const CONTRA = /\b(but|except|wasn't|isn't|didn't|doesn't|won't|instead|yet|actually|until|despite)\b/i;
const STAKE = /\b(you|your|you'll|you're)\b/i;
const TEASE = /\?\s*$|\b(but|isn't|wasn't|until|nobody|no one|only|why|how|what|which|except|yet|the real|the catch|one thing|it's not|wasn't the)\b/i;
const FLIP = /\b(but|except|however|catch|trap|worse|twist|problem|nobody|no one|turns out|instead|unless|yet|actually|only|real reason|backfire[sd]?)\b/i;
const HEDGE = /\b(may|might|could|possibly|perhaps|potentially)\b/i;
const ACTION = /^(check|call|ask|look|compare|read|watch|file|save|refinance|cancel|move|set|lock|pull|review|open|search|sign|avoid|stop|start|keep|write|find|get|use|turn|delete|update|request|claim|demand|track|don't|do|pay|sell|buy|book|count|mark|remember|note|go)\b/i;
const BAD_CLOSE = /\b(stay informed|follow for more|thanks for watching|the future is uncertain|stay tuned|like and subscribe|subscribe for more)\b/i;
const BAD_HOOK = /^(here's what happened|let me tell you|have you ever wondered|according to|the report)\b/i;

/** The script's sentences grouped by beat. */
function beatsOf(script) {
  const secs = script.sections || [];
  const byId = Object.fromEntries(BEATS.map((b) => [b, null]));
  const ids = secs.map((s) => String(s.id || "").toLowerCase().replace(/[^a-z]/g, ""));
  if (BEATS.every((b) => ids.includes(b))) {
    for (const b of BEATS) byId[b] = sentences(secs[ids.indexOf(b)].voiceover || "");
    return { beats: byId, by: "section ids" };
  }
  const all = sentences(secs.map((s) => s.voiceover || "").join(" "));
  if (all.length < 3) return { beats: { hook: all.slice(0, 1), setup: [], rehook: [], payoff: all.slice(1, -1), close: all.slice(-1) }, by: "position" };
  const mid = all.slice(1, -1), n = mid.length;
  const a = Math.max(1, Math.round(n * 0.4)), b = Math.max(a + (n > 2 ? 1 : 0), Math.round(n * 0.6));
  return { beats: { hook: all.slice(0, 1), setup: mid.slice(0, a), rehook: mid.slice(a, b), payoff: mid.slice(b), close: all.slice(-1) }, by: "position" };
}

function validateNarrative(script, research = null) {
  const { beats, by } = beatsOf(script);
  const ents = new Set((research?.named_entities || []).flatMap((e) => String(e?.name || "").split(/\s+/)).map((w) => w.toLowerCase()).filter(Boolean));
  const people = (research?.named_entities || []).filter((e) => String(e?.kind || "").toLowerCase() === "person").map((e) => e.name);
  const sp = (s) => specificsOf(s, { entities: ents });
  const names = (s) => sp(s).names.length + sp(s).objects.length;
  const r = {};
  // HOOK
  {
    const h = beats.hook || [], why = [];
    if (h.length !== 1) why.push(h.length ? `${h.length} sentences (must be one)` : "missing");
    const s = h[0] || "";
    if (s && !(sp(s).numbers.length || SHOCK.test(s) || CONTRA.test(s) || STAKE.test(s))) why.push("no stake — no number, shock, contradiction or 'you'");
    if (s && BAD_HOOK.test(s.trim())) why.push("throat-clearing opening");
    if (s && V.personStart(s, people).any) why.push("starts with a person's name");
    r.hook = { ok: !why.length, why };
  }
  // SETUP
  {
    const st = beats.setup || [], why = [];
    if (!st.length) why.push("missing");
    st.forEach((s) => { if (!names(s) && !sp(s).numbers.length && !isTurnLine(s)) why.push(`"${s}" names nothing specific`); });
    const last = st[st.length - 1] || "";
    if (last && !TEASE.test(last)) why.push(`last sentence "${last}" does not leave a question open`);
    r.setup = { ok: !why.length, why };
  }
  // RE-HOOK
  {
    const rh = beats.rehook || [], why = [];
    if (!rh.length) why.push("missing");
    else if (!rh.some((s) => FLIP.test(s) || /\b(and it gets|another problem|there's more to it|the part)\b/i.test(s))) why.push("no flip or raised stake (but / except / however / the catch / the trap / worse …)");
    r.rehook = { ok: !why.length, why };
  }
  // PAYOFF
  {
    const p = beats.payoff || [], why = [];
    if (!p.length) why.push("missing");
    const txt = p.join(" ");
    if (p.length && !sp(txt).numbers.length) why.push("no specific number");
    if (p.length && HEDGE.test(txt)) why.push(`hedged ("${txt.match(HEDGE)[0]}")`);
    if (p.length && !sp(txt).names.length) why.push("names no person, place or organization");
    r.payoff = { ok: !why.length, why };
  }
  // CLOSE
  {
    const c = beats.close || [], why = [];
    if (c.length !== 1) why.push(c.length ? `${c.length} sentences (must be one)` : "missing");
    const s = c[c.length - 1] || "";
    if (s && BAD_CLOSE.test(s)) why.push(`banned close ("${s.match(BAD_CLOSE)[0]}")`);
    if (s && !(ACTION.test(s.trim().replace(/^["'(]+/, "")) || sp(s).numbers.length)) why.push("no specific action or number");
    r.close = { ok: !why.length, why };
  }
  const voice = V.validateVoice(script, research);
  const beatFails = BEATS.filter((b) => !r[b].ok).length;
  const failures = beatFails + voice.banned + voice.long + (voice.peopleKnown && voice.nameStarts > 1 ? 1 : 0);
  return { by, beats, checks: r, banned: voice.banned, long: voice.long, nameStarts: voice.nameStarts, failures, pass: failures === 0 };
}

function summary(ch, n) {
  const b = (k) => (n.checks[k].ok ? "PASS" : `FAIL (${n.checks[k].why.join("; ")})`);
  return `[script] ch-${ch}: hook=${b("hook")} setup=${b("setup")} rehook=${b("rehook")} payoff=${b("payoff")} close=${b("close")}, ${n.banned} banned, ${n.long} long, ${n.nameStarts} name-start → ${n.pass ? "PASS" : "FAIL"}`;
}
function feedbackLines(n) {
  const out = [];
  for (const k of BEATS) for (const w of n.checks[k].why) out.push(`  - NARRATIVE: ${k.toUpperCase()} ${w}. Rewrite the ${k} beat as the structure in the prompt says — using only this video's research.`);
  return out;
}

module.exports = { validateNarrative, beatsOf, summary, feedbackLines, BEATS };

if (require.main === module) {
  const [ch, scriptPath, researchPath] = process.argv.slice(2);
  const script = JSON.parse(readFileSync(scriptPath, "utf8"));
  let research = null;
  try { if (researchPath) research = JSON.parse(readFileSync(researchPath, "utf8")); } catch {}
  const n = validateNarrative(script, research);
  console.log(`[script] ch-${ch}: beats read by ${n.by}`);
  console.log(summary(ch, n));
  for (const l of feedbackLines(n)) console.log(l);
  process.exit(n.pass ? 0 : 2);
}
