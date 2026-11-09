// AI Tested sample: Claude Code print mode. Narration is PROVISIONAL (hand-planned, not from the script engine).
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
import { captureRows } from "./capture.mjs";
import { runQa } from "./qa.mjs";

const PAGE = "https://code.claude.com/docs/en/cli-reference";
const FLAGS = ["--print", "--output-format"];
const CMD = `npx -y @anthropic-ai/claude-code --help | grep -E -- '^ +(-p, --print|--output-format <format>)'`;
const FPS = 30, GAP = 0.3, TTS = "en-US-AndrewNeural";
const sleep = (s) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, s * 1000);
// edge-tts sometimes returns NoAudioReceived from CI: retry, then try sibling voices. Voice used is logged.
function speak(tools, text, output) {
  const errs = [];
  for (const voice of [TTS, TTS, TTS, "en-US-GuyNeural", "en-US-ChristopherNeural"]) {
    try { const f = tools.voice({ text, voice, output }); console.log("voice used:", voice); return f; } catch (e) { errs.push(`${voice}: ${e.message}`); sleep(5); }
  }
  throw new Error("edge-tts failed: " + errs.join(" | "));
}

// Narration per scene. PROVISIONAL.
const NARRATION = [
  ["hook", "Claude Code can answer once, then exit. No chat.", ["c1"], "contrast-hook"],
  ["reference", "The CLI reference: dash p prints the response without interactive mode.", ["c2"], "annotated-capture"],
  ["terminal", "Run help. The print and output-format flags appear in the real output.", ["c3"], "terminal-demo"],
  ["pipe", "Pipe a log file in, ask a question, and get the answer back.", ["c4"], "process-diagram"],
  ["controls", "Output format takes text, json or stream-json. Max turns caps agentic turns.", ["c5", "c6"], "annotated-capture"],
  ["close", "A chat-free mode, one flag away.", ["c2"], "close-card"],
];

const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args]);
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());

export default async function preview({ key, runId, outDir, tools }) {
  // 1. Real page capture (headless Chrome, annotation anchored on the real rows).
  const cap = await captureRows({ url: PAGE, rows: { print: { match: "--print" }, format: { match: "--output-format", before: 40, after: 30 }, turns: { match: "--max-turns", before: 40, after: 30 } } });
  const fetchedAt = new Date().toISOString();
  tools.write("capture-meta.json", { url: PAGE, title: cap.title, fetchedAt, cells: Object.fromEntries(Object.entries(cap.captures).map(([k, v]) => [k, { cellText: v.cellText, rowText: v.rowText }])) });
  for (const [k, v] of Object.entries(cap.captures)) copyFileSync(join(ROOT, "src/skills/remotion-render/public", v.file), join(outDir, `capture-${k}.jpg`));
  tools.stage("research_complete", "page captured");

  // 2. Real command, real output.
  const r = spawnSync("bash", ["-c", CMD], { encoding: "utf8", timeout: 240000 });
  const stdout = (r.stdout || "").trimEnd();
  tools.write("terminal-raw.txt", `$ ${CMD}\n${stdout}\n--- stderr ---\n${r.stderr || ""}\n--- exit ${r.status} ---\n`);
  const found = FLAGS.filter((f) => stdout.includes(f));
  if (found.length !== FLAGS.length) throw new Error(`help output lacks flags (found ${found}); see terminal-raw.txt`);
  const lines = stdout.split("\n").map((l) => l.trim().replace(/ {2,}/g, "  ")).filter(Boolean).map((l) => (l.length > 41 ? l.slice(0, 40) + "…" : l)).slice(0, 5);

  // 3. Script package, claims, scene plan (hand-planned).
  const doc = (k) => cap.captures[k].rowText;
  const claims = [
    { claim_id: "c1", claim: 'The CLI reference describes `claude -p "query"` as "Query via SDK, then exit" and `claude` as "Start interactive session".', source_id: "s1", source_url: PAGE, published: null, excerpt: 'claude -p "query" | Query via SDK, then exit | claude -p "explain this function"', confidence: "high", editorial_status: "documented_not_run", context: "Docs wording, not executed here: running a query needs an authenticated account." },
    { claim_id: "c2", claim: "--print / -p prints the response without interactive mode.", source_id: "s1", source_url: PAGE, published: null, excerpt: doc("print").slice(0, 160), confidence: "high", editorial_status: "documented_not_run" },
    { claim_id: "c3", claim: "The installed Claude Code CLI lists --print and --output-format in its --help output (--max-turns is not in that output, so it stays documented-only).", source_id: "s2", source_url: "https://www.npmjs.com/package/@anthropic-ai/claude-code", published: null, excerpt: stdout.slice(0, 400), confidence: "high", editorial_status: "demonstrated_feature", context: "Captured by running the displayed command on the GitHub runner during this render (see terminal-raw.txt)." },
    { claim_id: "c4", claim: 'The CLI reference shows `cat logs.txt | claude -p "explain"` as the example for processing piped content.', source_id: "s1", source_url: PAGE, published: null, excerpt: 'Process piped content | cat logs.txt | claude -p "explain"', confidence: "high", editorial_status: "documented_not_run" },
    { claim_id: "c5", claim: "--output-format specifies the output format for print mode: text, json or stream-json.", source_id: "s1", source_url: PAGE, published: null, excerpt: doc("format").slice(0, 160), confidence: "high", editorial_status: "documented_not_run" },
    { claim_id: "c6", claim: "--max-turns limits the number of agentic turns, print mode only.", source_id: "s1", source_url: PAGE, published: null, excerpt: doc("turns").slice(0, 160), confidence: "high", editorial_status: "documented_not_run" },
  ];

  // 4. Voice per scene, so every cut is timed from measured speech.
  const parts = [];
  for (const [i, [id, text]] of NARRATION.entries()) {
    const raw = speak(tools, text, `.v${i}.mp3`);
    const d = dur(raw), len = d + GAP;
    ff(["-i", raw, "-af", `apad=whole_dur=${len.toFixed(3)}`, "-ar", "44100", "-ac", "1", join(outDir, `.p${i}.mp3`)]);
    parts.push({ id, text, speech: d, len });
  }
  writeFileSync(join(outDir, ".list.txt"), parts.map((_, i) => `file '${join(outDir, `.p${i}.mp3`).replace(/\\/g, "/")}'`).join("\n"));
  const audio = join(outDir, "voice-track.mp3");
  ff(["-f", "concat", "-safe", "0", "-i", join(outDir, ".list.txt"), "-c:a", "libmp3lame", "-q:a", "3", audio]);
  ff(["-i", audio, "-t", "9", "-c:a", "libmp3lame", "-q:a", "3", join(outDir, "voice-preview.mp3")]);
  tools.stage("voice_complete", "voice measured");

  let t = 0;
  const scenes = parts.map((p, i) => { const from = Math.round(t * FPS); t += p.len; return { id: `s${i + 1}`, kind: p.id, from, to: Math.round(t * FPS), start_s: from / FPS, end_s: Math.round(t * FPS) / FPS, text: p.text, speech: p.speech }; });
  const total = scenes.at(-1).to;
  if (total / FPS > 30) throw new Error(`runtime ${total / FPS}s exceeds 30s`);
  const captionChunks = scenes.flatMap((s) => {
    const chunks = []; // split per sentence first, then into even groups of at most 5 words
    for (const sentence of s.text.match(/[^.]+\.?/g).map((x) => x.trim()).filter(Boolean)) { const w = sentence.split(" "), n = Math.ceil(w.length / 5), per = Math.ceil(w.length / n); for (let i = 0; i < w.length; i += per) chunks.push(w.slice(i, i + per).join(" ")); }
    const chars = chunks.reduce((a, c) => a + c.length, 0); let at = s.from;
    return chunks.map((c) => { const n = Math.max(1, Math.round((c.length / chars) * s.speech * FPS)); const o = { text: c, from: at, to: at + n }; at += n; return o; }).map((o, i, a) => (i === a.length - 1 ? { ...o, to: s.to } : o));
  });

  const sentences = NARRATION.map(([id, text, ids], i) => ({ sentence_id: `n${i + 1}`, beat_id: `b${i + 1}`, text, role: id, claim_ids: ids, link_from_previous: i ? "explanation" : "none", on_screen_text: "" }));
  const pkg = {
    channel: key, topic: "Claude Code print mode (claude -p)", format: "short", target_seconds: 30, provisional: "hand-planned sample, not from the script engine",
    blueprint: { central_question: "What does Claude Code's print mode do?", thesis: "claude -p answers once and exits, with documented controls for output format and turns.", why_it_matters: "It runs without a chat session.", viewer_start: "Claude Code is an interactive chat tool.", viewer_end: "A documented non-interactive mode exists, with output-format and max-turns controls.", key_evidence: ["c2", "c3"],
      beats: NARRATION.map(([id, , ids], i) => ({ beat_id: `b${i + 1}`, role: i === 0 ? "opening" : i === NARRATION.length - 1 ? "ending" : i === 2 ? "payoff" : "development", purpose: id, claim_ids: ids, link_from_previous: i ? "explanation" : "none" })),
      questions_raised: [{ question: "Is the flag real?", raised_in: "b1", answered_in: "b3" }], conclusion: "A chat-free mode, one flag away." },
    hook_options: [{ text: NARRATION[0][1], family: "contrast", honest: true }, { text: "Claude Code does not need a chat window.", family: "claim", honest: true }],
    selected_hook: NARRATION[0][1], sentences, payoff: NARRATION[2][1], ending: NARRATION[5][1], cta: null,
    sources: [{ source_id: "s1", url: PAGE, published: null }, { source_id: "s2", url: "https://www.npmjs.com/package/@anthropic-ai/claude-code", published: null }],
    claims, duration_estimate_s: total / FPS, quality_report: { note: "provisional narration" },
  };
  tools.write("script-package.json", pkg);
  tools.write("claims.json", claims);
  tools.write("story-outline.md", `# Claude Code print mode\n\nProvisional, hand-planned.\n\n${NARRATION.map(([id, t, c]) => `- ${id}: ${t} [${c.join(",")}]`).join("\n")}\n`);
  tools.write("script-draft.md", `PROVISIONAL narration (hand-planned sample, not from the script engine)\n\n${NARRATION.map(([, t]) => t).join(" ")}\n`);
  tools.stage("script_complete", "provisional");

  const plan = {
    channel: key, production_run: runId, format: "short",
    scenes: scenes.map((s, i) => {
      const [, , ids, treatment] = NARRATION[i];
      const objective = { hook: "Contrast interactive claude with claude -p, wording from the docs table", reference: "Show the real documented --print row, highlighted", terminal: "Show the real help output containing the three flags", pipe: "Show the documented piping example as a process", controls: "Show the real --output-format and --max-turns rows", close: "Restate the command and the source" }[s.kind];
      return { scene_id: s.id, narration: s.text, main_point: objective, visual_objective: objective, treatment, background: "white", skill: { hook: "motion-graphics", reference: "article-highlights + headless Chrome capture", terminal: "terminal-inserts", pipe: "motion-graphics", controls: "article-highlights + headless Chrome capture", close: "motion-graphics" }[s.kind],
        assets: s.kind === "terminal" ? [{ id: "terminal-raw", origin: "command run on the GitHub runner during this render" }] : ["reference", "controls"].includes(s.kind) ? [{ id: `capture-${s.kind}`, origin: "headless Chrome screenshot of the fetched page", source_url: PAGE }] : [],
        animation: { hook: "type rise, comparison cards", reference: "marker stroke over real row, callout", terminal: "typed command, real output lines", pipe: "connectors draw, dot travels", controls: "two marker strokes, callouts", close: "type rise" }[s.kind],
        on_screen_text: [], claim_ids: ids, data_sources: [PAGE], transition: "fade", start_s: s.start_s, end_s: s.end_s };
    }),
  };
  tools.write("scene-plan.json", plan);
  tools.stage("visual_complete", "plan written");

  // 5. Render silent, then mux the measured voice.
  const props = { durationInFrames: total, scenes, captionChunks, captures: cap.captures, terminal: { display: CMD, lines }, pageUrl: PAGE.replace("https://", ""), pageHost: "code.claude.com" };
  const silent = tools.renderComposition({ id: "AiTestedShort", props, output: "silent.mp4", durationInFrames: total });
  const video = join(outDir, "preview.mp4");
  ff(["-i", silent, "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", String(total / FPS), video]);
  tools.stage("render_complete", "rendered");

  // 6. Frames, contact sheet.
  for (const s of scenes) ff(["-ss", (s.start_s + (s.end_s - s.start_s) * 0.75).toFixed(2), "-i", video, "-frames:v", "1", "-q:v", "2", join(outDir, `scene-${s.id}.jpg`)]);
  await tools.contactSheet({ video, scenes: scenes.map((s, i) => ({ id: s.id, start_s: s.start_s, end_s: s.end_s, treatment: NARRATION[i][3], objective: plan.scenes[i].visual_objective })) });

  // 7. QA.
  const qa = await runQa({ outDir, video, scenes, plan, claims, pkg, stdout, found: FLAGS });
  tools.stage(qa.pass ? "qa_passed" : "blocked", qa.pass ? "QA passed" : "QA failed: " + qa.failures.join("; "));
  if (qa.pass) { tools.stage("preview_ready", "ready"); tools.stage("awaiting_approval", "provisional narration"); }
}
