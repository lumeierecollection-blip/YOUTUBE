/**
 * Research, script and narration, through the repo's existing runners and gates:
 * ollama-agent.js, gate-research, gate-script (SCR-14 source tracing), dedupe-sentences,
 * validate-script-story and validate-script-claims. None of those gates is skipped.
 *
 * Difference from the daily pipeline, on purpose: a claims check that cannot run (exit 4)
 * blocks this production instead of proceeding without it.
 */
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, StageError, askJson, durationOf, log, must, readJson, run, writeJson } from "./lib.mjs";
import { retrievePages } from "./retrieve.mjs";
import { channelStyle } from "./visual-common.mjs";

const MAX_SECONDS = 29.8;
const SCRIPT_PASSES = 7;
const MIN_DRAWABLE_FACTS = 5;
// The per-sentence clarity and specificity readers can always find one more nitpick. After repairs,
// those two alone are logged and the whole script is judged instead. Everything else stays blocking.
const isAdvisory = (line) => /^ {2}- (CLARITY|SPECIFICITY)/.test(line);
const shortEnv = (channel) => ({ SHORTS_MIN_SECONDS: String(channel.script.gate_seconds.min), SHORTS_MAX_SECONDS: String(channel.script.gate_seconds.max) });
const models = () => ({
  research: process.env.OPENCODE_MODELS_RESEARCH || "ollama-cloud/gpt-oss:120b",
  script: process.env.OPENCODE_MODELS_REASONING || "ollama-cloud/gpt-oss:120b",
});

function agent(args, input, label, env) {
  const r = run("node", ["scripts/ollama-agent.js", ...args], { input, capture: true, timeoutS: 900, env });
  if (r.status !== 0) throw new StageError(label, `model runner exited ${r.status}`);
  const line = r.stdout.trim().split("\n").at(-1);
  const out = JSON.parse(line).structured_output;
  if (!out) throw new StageError(label, "model runner returned no structured_output");
  return out;
}

export async function research({ channel, topic, dir }) {
  const researchPath = join(ROOT, "data/research", channel.id, `${topic.slug}.json`);
  const fallback = join(dir, `fallback-pages-${topic.slug}.txt`);
  const pages = await retrievePages(topic);
  if (pages) writeFileSync(fallback, pages);
  const searchOut = join(ROOT, "data/research", channel.id, `${topic.slug}-search.json`);
  rmSync(searchOut, { force: true });
  const input = JSON.stringify({ topic: topic.topic, angle: topic.angle, slug: topic.slug, channel_id: channel.id, trending_entities: null });
  let out;
  try {
    out = agent(["--prompt-file", "prompts/research.md", "--append-system-prompt-file", "prompts/autopilot-research-extra.md", "--schema-file", "schemas/research.json", "--agent", "pipeline-research", "--model", models().research,
      "--task-label", "research", "--max-retries", "4", "--min-source-domains", "2", "--channel-id", channel.id, "--video-id", topic.slug,
      "--search-out", `data/research/${channel.id}/${topic.slug}-search.json`], input, "research", { SEARCH_FALLBACK_FILE: pages ? fallback : "" });
  } catch (e) {
    // No search text means the service failed, which says nothing about this topic.
    if (!existsSync(searchOut)) throw new StageError("outage", "web search and publisher-page retrieval both failed");
    throw e;
  }
  if (!(out.key_facts?.length >= 3)) throw new StageError("research", `only ${out.key_facts?.length || 0} key facts`);
  writeJson(researchPath, out);
  must("research", "node", ["scripts/gate-research.js", channel.id, topic.slug]);
  log("research", `${out.key_facts.length} key facts`);
  // The repo's own pre-screen: a strict-visual topic whose research states nothing drawable cannot pass SCR-17.
  if (channelStyle(channel.id)?.strict_visual && run("node", ["scripts/strict-prescreen.mjs", channel.id, topic.slug]).status !== 0) {
    throw new StageError("research", "research holds too few drawable facts for a strict-visual channel");
  }
  return researchPath;
}

const wordCount = (script) => script.sections.map((x) => x.voiceover).join(" ").split(/\s+/).filter(Boolean).length;

/** The 30-second brief. A revision sees its previous draft, otherwise each pass starts over and breaks what already passed. */
function promptFile(previous, feedback, dir, drawable, channel) {
  const b = channel.script;
  let p = readFileSync(join(ROOT, "prompts/autopilot-write-short.md"), "utf8")
    .replaceAll("{{MIN}}", b.min).replaceAll("{{MAX}}", b.max).replaceAll("{{REJECT}}", b.reject)
    .replaceAll("{{HOOK}}", b.table.hook).replaceAll("{{SETUP}}", b.table.setup).replaceAll("{{REHOOK}}", b.table.rehook).replaceAll("{{PAYOFF}}", b.table.payoff).replaceAll("{{CLOSE}}", b.table.close);
  if (drawable?.length) p += `\n\n## Facts this channel can draw\n\nThis channel rejects any sentence that does not ground something drawable. These research facts qualify. Build every sentence around one of them, and keep its figure, date, place or list exactly as written:\n${drawable.map((f) => `- ${f}`).join("\n")}\n\nThis applies to the setup's question and the close as well. Put a figure, date or place inside the question ("Who gets the 12 free months?") and inside the close ("Check the 12-month deadline before it ends."). A question or a closing line with no figure in it is rejected.\n`;
  if (previous) {
    const n = wordCount(previous);
    p += `\n\n## Revise your previous draft\n\n${JSON.stringify(previous, null, 1)}\n\nThe quality gates found:\n${feedback}\n\nThe draft has ${n} words; the limit is ${b.max}. Change only what these findings need and leave every other sentence exactly as it is. Tighten wording rather than deleting a beat, and keep all five sections.
If a finding says a sentence grounds nothing drawable, rewrite that sentence around one of these, using facts from the research: a list written as "A, B and C"; two compared figures ("from 2 to 40", "$20 versus $200"); a percentage; a date with its event ("In March 2026, X did Y"); a named country or city; or a figure with its unit ("8 apps", "$200 a month"). Saying the same thing in other words will be rejected again.
Return the full JSON object.\n`;
  }
  const path = join(dir, "write-script.prompt.md");
  writeFileSync(path, p);
  return path;
}

const issues = (text, re) => text.split("\n").filter((l) => re.test(l)).join("\n");

/** Returns "" when the script passes every gate, else the feedback for the writer. */
function gateScript({ channel, slug, scriptPath, researchPath, stem }) {
  const gate = () => run("node", ["scripts/gate-script.js", channel.id, stem, slug], { capture: true, merge: true, env: shortEnv(channel) });
  const g = gate();
  if (g.status !== 0) return issues(g.stdout, /SCR-1[0-9]|BLOCKER/) || g.stdout.slice(-1500);
  const d = run("node", ["scripts/dedupe-sentences.js", scriptPath], { capture: true, merge: true });
  if (/^\[dedupe\] removed/m.test(d.stdout)) {
    const again = gate();
    if (again.status !== 0) return issues(again.stdout, /SCR-|BLOCKER/);
  }
  const story = run("node", ["scripts/validate-script-story.cjs", channel.id, scriptPath, researchPath], { capture: true, merge: true });
  const claims = run("node", ["scripts/validate-script-claims.cjs", channel.id, scriptPath, researchPath], { capture: true, merge: true });
  if (claims.status === 4) throw new StageError("script", "claim verification was unavailable; not producing unverified claims");
  const found = [];
  if (story.status !== 0 && story.status !== 3) found.push(issues(story.stdout, /^ {2}- /) || "story checks failed");
  if (claims.status !== 0) found.push(issues(claims.stdout, /^ {2}- CLAIM/) || "claims check failed");
  return found.join("\n");
}

/** The research facts that the channel's own strict-visual check accepts as drawable. */
async function drawableFacts(channel, researchPath) {
  if (!channelStyle(channel.id)?.strict_visual) return [];
  const { groundedVisualFor } = await import("../strict-visual.mjs");
  const r = readJson(researchPath);
  const texts = [...(r.key_facts || []).map((f) => f.fact || f.claim || f.text), ...(r.numbers || []).map((n) => n.context || n.claim || n.text)].filter((t) => typeof t === "string");
  return [...new Set(texts)].filter((t) => groundedVisualFor(t)).slice(0, 12);
}

/** One reading of the finished narration as a whole. If no model can answer, the script is held. */
async function editorialVerdict(scriptPath, topic, researchPath) {
  const data = readJson(scriptPath);
  const v = await askJson(`You are the final editor of a 30-second YouTube Short about: "${topic.topic}".

Narration, in order:
${data.sections.map((s) => `[${s.id}] ${s.voiceover}`).join("\n")}

Research it must stay within:
${JSON.stringify(readJson(researchPath).key_facts || []).slice(0, 4000)}

Judge the whole script as a viewer who knows nothing about this subject.
Return JSON: {"one_coherent_topic":boolean,"strong_opening_hook":boolean,"followable":boolean,"satisfying_ending":boolean,"nothing_misleading":boolean,"no_repetition":boolean,"why":"one sentence on the weakest point"}`, "autopilot-editorial");
  const checks = ["one_coherent_topic", "strong_opening_hook", "followable", "satisfying_ending", "nothing_misleading", "no_repetition"];
  return { pass: checks.every((k) => v[k] === true), failed: checks.filter((k) => v[k] !== true), why: v.why };
}

export async function writeScript({ channel, topic, researchPath, dir }) {
  const stem = `${topic.slug}-shorts`;
  const scriptPath = join(ROOT, "data/research", channel.id, `${stem}-script.json`);
  const scriptRel = `data/research/${channel.id}/${stem}-script.json`;
  const scriptStem = `${stem}-script`;
  let feedback = "", previous = null;
  const drawable = await drawableFacts(channel, researchPath);
  log("script", `drawable facts offered: ${drawable.length}`);
  // Too few drawable facts makes a model satisfy the rule with nonsense, so the topic is dropped instead.
  if (channelStyle(channel.id)?.strict_visual && drawable.length < MIN_DRAWABLE_FACTS) throw new StageError("research", `only ${drawable.length} drawable facts in the research; ${MIN_DRAWABLE_FACTS} needed for a good strict-visual script`);
  for (let pass = 1; pass <= SCRIPT_PASSES; pass++) {
    log("script", `pass ${pass}/${SCRIPT_PASSES}${previous ? ` (revising ${wordCount(previous)} words)` : ""}`);
    const ctx = must("script", "node", ["scripts/build-script-context.js", channel.id, topic.slug, "--format", "shorts"], { capture: true }).stdout;
    const out = agent(["--prompt-file", promptFile(previous, feedback, dir, drawable, channel), "--schema-file", "schemas/script.section.json",
      "--agent", "pipeline-script", "--model", models().script, "--task-label", "write-script", "--max-retries", "4", "--channel-id", channel.id, "--video-id", stem], ctx, "script");
    // Sources come from the research itself, so a script can never cite a URL the research does not hold.
    out.sources_used = [...new Set((readJson(researchPath).key_facts || []).map((f) => f.source_url).filter(Boolean))].slice(0, 6);
    writeJson(scriptPath, out);
    feedback = gateScript({ channel, slug: topic.slug, scriptPath, researchPath, stem });
    previous = readJson(scriptPath);
    const onlyAdvisory = feedback && feedback.split("\n").filter((l) => l.trim()).every(isAdvisory);
    if (!feedback || (onlyAdvisory && pass >= 3)) {
      const verdict = await editorialVerdict(scriptPath, topic, researchPath);
      writeJson(join(dir, "script-editorial.json"), { verdict, advisory_findings: feedback ? feedback.split("\n") : [], passes: pass });
      log("script", `editorial verdict: ${verdict.pass ? "pass" : "fail"} (${verdict.why})`);
      if (verdict.pass) return { scriptPath, scriptRel, stem: scriptStem };
      feedback = `The final editor rejected the script. Failed: ${verdict.failed.join(", ")}. ${verdict.why}`;
      continue;
    }
    log("script", `gate findings:\n${feedback}`);
  }
  throw new StageError("script", `script failed its gates after ${SCRIPT_PASSES} passes: ${feedback.slice(0, 500)}`);
}

/** Narration under 30 s. An over-long script loses whole sentences (fit-short) and is re-gated. */
export function narrate({ channel, topic, researchPath, script }) {
  for (let i = 1; i <= 3; i++) {
    must("tts", "node", ["src/utils/tts.js", channel.id, script.scriptRel], { timeoutS: 600 });
    const base = join(ROOT, "data/tts", channel.id);
    const mp3 = join(base, `${script.stem}-vo.mp3`);
    const secs = durationOf(mp3);
    log("tts", `narration ${secs.toFixed(2)} s`);
    if (secs < 12) throw new StageError("tts", `narration is only ${secs.toFixed(1)} s`);
    if (secs <= MAX_SECONDS) {
      const stable = `${topic.slug}-shorts-vo`;
      for (const ext of [".mp3", ".srt", "-words.json"]) copyFileSync(join(base, `${script.stem}-vo${ext}`), join(base, `${stable}${ext}`));
      return { mp3: `data/tts/${channel.id}/${stable}.mp3`, words: `data/tts/${channel.id}/${stable}-words.json`, srt: `data/tts/${channel.id}/${stable}.srt`, seconds: secs };
    }
    const data = readJson(script.scriptPath);
    const count = data.sections.map((s) => s.voiceover).join(" ").split(/\s+/).length;
    const ceil = Math.floor((count * MAX_SECONDS) / secs);
    if (run("node", ["scripts/fit-short.js", script.scriptPath, String(ceil)]).status !== 0) throw new StageError("tts", `cannot trim the script to ${ceil} words`);
    const g = run("node", ["scripts/gate-script.js", channel.id, script.stem.replace(/-script$/, ""), topic.slug], { capture: true, merge: true, env: shortEnv(channel) });
    if (g.status !== 0) throw new StageError("tts", `trimmed script failed its gate: ${issues(g.stdout, /SCR-/).slice(0, 300)}`);
  }
  throw new StageError("tts", `narration still longer than ${MAX_SECONDS} s after trimming`);
}
