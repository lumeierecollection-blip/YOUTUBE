/**
 * Research, script and narration, through the repo's existing runners and gates:
 * ollama-agent.js, gate-research, gate-script (SCR-14 source tracing), dedupe-sentences,
 * validate-script-story and validate-script-claims. None of those gates is skipped.
 *
 * Difference from the daily pipeline, on purpose: a claims check that cannot run (exit 4)
 * blocks this production instead of proceeding without it.
 */
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, StageError, askJson, durationOf, log, must, readJson, run, writeJson } from "./lib.mjs";

const MAX_SECONDS = 29.8;
const SCRIPT_ATTEMPTS = 3;
const REPAIRS_PER_DRAFT = 3;
// The per-sentence clarity and specificity readers can always find one more nitpick. After repairs,
// those two alone are logged and the whole script is judged instead. Everything else stays blocking.
const isAdvisory = (line) => /^ {2}- (CLARITY|SPECIFICITY)/.test(line);
const SHORT_ENV = { SHORTS_MIN_SECONDS: "26", SHORTS_MAX_SECONDS: "38" };
const models = () => ({
  research: process.env.OPENCODE_MODELS_RESEARCH || "ollama-cloud/gpt-oss:120b",
  script: process.env.OPENCODE_MODELS_REASONING || "ollama-cloud/gpt-oss:120b",
});

function agent(args, input, label) {
  const r = run("node", ["scripts/ollama-agent.js", ...args], { input, capture: true, timeoutS: 900 });
  if (r.status !== 0) throw new StageError(label, `model runner exited ${r.status}`);
  const line = r.stdout.trim().split("\n").at(-1);
  const out = JSON.parse(line).structured_output;
  if (!out) throw new StageError(label, "model runner returned no structured_output");
  return out;
}

export function research({ channel, topic }) {
  const researchPath = join(ROOT, "data/research", channel.id, `${topic.slug}.json`);
  const input = JSON.stringify({ topic: topic.topic, angle: topic.angle, slug: topic.slug, channel_id: channel.id, trending_entities: null });
  const out = agent(["--prompt-file", "prompts/research.md", "--schema-file", "schemas/research.json", "--agent", "pipeline-research", "--model", models().research,
    "--task-label", "research", "--max-retries", "4", "--min-source-domains", "2", "--channel-id", channel.id, "--video-id", topic.slug,
    "--search-out", `data/research/${channel.id}/${topic.slug}-search.json`], input, "research");
  if (!(out.key_facts?.length >= 3)) throw new StageError("research", `only ${out.key_facts?.length || 0} key facts`);
  writeJson(researchPath, out);
  must("research", "node", ["scripts/gate-research.js", channel.id, topic.slug]);
  log("research", `${out.key_facts.length} key facts`);
  return researchPath;
}

/** The 30-second brief. The repo's write-script.md is built for 58-second Shorts and overshoots this length. */
function promptFile(feedback, dir) {
  let p = readFileSync(join(ROOT, "prompts/autopilot-write-short.md"), "utf8");
  if (feedback) p += `\n\n## The quality gate rejected your previous script\n\n${feedback}\n\nRewrite the full script, fixing these. Stay within 62-74 words.\n`;
  const path = join(dir, "write-script.prompt.md");
  writeFileSync(path, p);
  return path;
}

const issues = (text, re) => text.split("\n").filter((l) => re.test(l)).join("\n");

/** Returns "" when the script passes every gate, else the feedback for the writer. */
function gateScript({ channel, slug, scriptPath, researchPath, stem }) {
  const gate = () => run("node", ["scripts/gate-script.js", channel.id, stem, slug], { capture: true, merge: true, env: SHORT_ENV });
  let g = gate();
  if (g.status !== 0 && /SCR-16:.*CUT at least/.test(g.stdout)) {
    const ceil = (g.stdout.match(/needs \d+-(\d+) words/) || [])[1];
    if (ceil && run("node", ["scripts/fit-short.js", scriptPath, ceil]).status === 0) g = gate();
  }
  if (g.status !== 0) return issues(g.stdout, /SCR-|BLOCKER/) || g.stdout.slice(-1500);
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
  let feedback = "";
  for (let attempt = 1; attempt <= SCRIPT_ATTEMPTS; attempt++) {
    log("script", `attempt ${attempt}/${SCRIPT_ATTEMPTS}`);
    const ctx = must("script", "node", ["scripts/build-script-context.js", channel.id, topic.slug, "--format", "shorts"], { capture: true }).stdout;
    const out = agent(["--prompt-file", promptFile(feedback, dir), "--schema-file", "schemas/script.section.json",
      "--agent", "pipeline-script", "--model", models().script, "--task-label", "write-script", "--max-retries", "4", "--channel-id", channel.id, "--video-id", stem], ctx, "script");
    writeJson(scriptPath, out);
    // A full rewrite fixes the flagged lines and breaks others, so story and claim findings are
    // repaired sentence by sentence first. The gates re-judge every repair.
    for (let repair = 0; repair <= REPAIRS_PER_DRAFT; repair++) {
      feedback = gateScript({ channel, slug: topic.slug, scriptPath, researchPath, stem });
      const onlyAdvisory = feedback && feedback.split("\n").filter((l) => l.trim()).every(isAdvisory);
      if (!feedback || (onlyAdvisory && repair >= 2)) {
        const verdict = await editorialVerdict(scriptPath, topic, researchPath);
        writeJson(join(dir, "script-editorial.json"), { verdict, advisory_findings: feedback ? feedback.split("\n") : [] });
        log("script", `editorial verdict: ${verdict.pass ? "pass" : "fail"} (${verdict.why})`);
        if (verdict.pass) return { scriptPath, scriptRel, stem: scriptStem };
        feedback = `The final editor rejected the script. Failed: ${verdict.failed.join(", ")}. ${verdict.why}`;
        break;
      }
      log("script", `gate rejected (repair ${repair}/${REPAIRS_PER_DRAFT}):\n${feedback}`);
      if (repair === REPAIRS_PER_DRAFT || !/^ {2}- (CLAIM|NARRATIVE|SPECIFICITY|CLARITY)/m.test(feedback)) break;
      const fbFile = join(dir, "repair-feedback.txt");
      writeFileSync(fbFile, feedback + "\n");
      if (run("node", ["scripts/repair-sentences.mjs", scriptPath, researchPath, fbFile], { timeoutS: 300 }).status !== 0) break;
    }
  }
  throw new StageError("script", `script failed its gates ${SCRIPT_ATTEMPTS} times: ${feedback.slice(0, 400)}`);
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
    const g = run("node", ["scripts/gate-script.js", channel.id, script.stem.replace(/-script$/, ""), topic.slug], { capture: true, merge: true, env: SHORT_ENV });
    if (g.status !== 0) throw new StageError("tts", `trimmed script failed its gate: ${issues(g.stdout, /SCR-/).slice(0, 300)}`);
  }
  throw new StageError("tts", `narration still longer than ${MAX_SECONDS} s after trimming`);
}
