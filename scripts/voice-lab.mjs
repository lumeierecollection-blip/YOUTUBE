#!/usr/bin/env node
/**
 * voice-lab — which way of asking Gemini TTS for the narration the production judge accepts, and is it the VOICE or the TEXT?
 *
 *   node scripts/voice-lab.mjs --set lab|lab2|corpus|all [--out out/lab] [--only name,name] [--corpus corpus]
 *
 * Lab 1 (38050775355) ran a production-style script through voice x direction. The control — the production voice with the production direction —
 * scored a mean of 9 with every sentence at 7+, while the same voice scored 5-6 on every real board script. So the voice setting can clear the
 * bar; what differs is the input. Lab 2 settles it on the REAL texts: for each channel of a board it takes the exact spoken text production sent
 * (data/tts/<ch>/*-vo-spoken.txt from the board's prep artifact) and
 *   existing   judges the production mp3 as it shipped (the control: should reproduce the board's score)
 *   prod       re-synthesises it with the channel's production voice and direction
 *   notes      the same voice with a structured director's note
 *   charon     Charon with the production direction (the voice that scored 9 on the lab script) — isolates voice from text
 * and records the text's features (sentence length, digits, questions, dashes...) next to each score so the pattern can be read off.
 * The judge is scripts/narration-judge.mjs, the very one the render gate runs. It reports; it changes nothing in production.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadChannels, resolveChannel } from "./lib/channel-lookup.mjs";
import { geminiVoiceFor } from "../src/utils/gemini-voice.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const set = arg("set", "lab");
const out = arg("out", join(ROOT, "out", "lab"));
const only = (arg("only") || "").split(",").map((s) => s.trim()).filter(Boolean);
const corpusDir = arg("corpus", join(ROOT, "corpus"));
const labText = join(ROOT, "scripts", "fixtures", "voice-lab", "script.txt");
mkdirSync(out, { recursive: true });

const { style: CURRENT } = geminiVoiceFor("en-US-GuyNeural");   // exactly what production sends
// A structured direction (audio profile / scene / director's notes), the form the Gemini TTS guide recommends.
const NOTES = `# AUDIO PROFILE: a seasoned documentary narrator
## THE SCENE: a quiet recording booth. The narrator is telling one curious listener a surprising true story and finds it genuinely interesting.
### DIRECTOR'S NOTES
Style: warm, close and unhurried. Energy and pitch change from sentence to sentence — a question lifts, a number lands, a reveal drops lower. Never a steady drone.
Pacing: natural and conversational; quicker through detail, slower on the key number or name; a short breath at commas and dashes.
Emphasis: lean on the single word in each sentence that matters most.
#### TRANSCRIPT`;

/** What the text is made of: the features a narrator's delivery could depend on. */
export function features(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  const sents = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  const words = t.split(/\s+/).filter(Boolean);
  const lens = sents.map((s) => s.split(/\s+/).length);
  const mean = lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length);
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, lens.length));
  return { words: words.length, sentences: sents.length, wps: +mean.toFixed(1), wps_sd: +sd.toFixed(1), digits: (t.match(/\d/g) || []).length, questions: (t.match(/\?/g) || []).length,
    commas_per_sentence: +((t.match(/,/g) || []).length / Math.max(1, sents.length)).toFixed(2), dashes: (t.match(/[—–]|\s-\s/g) || []).length,
    contrast: (t.match(/\b(but|yet|except|however|instead)\b/gi) || []).length };
}

const V = (name, voice, style, mode = "whole", extra = {}) => ({ name, voice, style, mode, ...extra });
const jobs = [];   // { text, textId, features, variants:[...] }
const add = (textId, file, variants, extra = {}) => jobs.push({ textId, file, features: features(readFileSync(file, "utf8")), variants, ...extra });

if (set === "lab" || set === "all") {
  add("labscript", labText, [
    V("baseline-charon-whole", "Charon", CURRENT), V("nodirection-charon-whole", "Charon", ""), V("notes-charon-whole", "Charon", NOTES),
    V("current-charon-sentence", "Charon", CURRENT, "sentence"), V("notes-charon-sentence", "Charon", NOTES, "sentence"),
    ...["Sulafat", "Puck", "Kore", "Zephyr", "Orus", "Fenrir"].map((v) => V(`notes-${v.toLowerCase()}-whole`, v, NOTES)),
    ...["Puck", "Kore"].map((v) => V(`notes-${v.toLowerCase()}-sentence`, v, NOTES, "sentence")),
  ]);
}
if (set === "calibrate") {
  // The labelled variants of lab 1 (38050775355) and lab 2 (38053319841): the judge's OWN labels, as given by the owner.
  // good = production-class (judge 8.78 - 9); bad = the robotic cluster (judge 5.11 - 5.33). No judge is run in this set: the acoustic
  // measure is what is being calibrated, and the Gemini quota is needed for the gate itself.
  add("labscript", labText, [
    V("good-charon-notes", "Charon", NOTES, "whole", { label: "good" }),
    V("good-charon-current", "Charon", CURRENT, "whole", { label: "good" }),
    V("good-kore-notes", "Kore", NOTES, "whole", { label: "good" }),
    V("good-zephyr-notes", "Zephyr", NOTES, "whole", { label: "good" }),
    V("good-aoede-current", "Aoede", CURRENT, "whole", { label: "good" }),
    V("bad-charon-nodirection", "Charon", "", "whole", { label: "bad" }),
    V("bad-puck-notes", "Puck", NOTES, "whole", { label: "bad" }),
    V("bad-fenrir-notes", "Fenrir", NOTES, "whole", { label: "bad" }),
  ]);
}
if (set === "lab2") {
  // The cells lab 1 lacked: the production voices with the production direction, and per-sentence (it returned WAV, now decoded).
  add("labscript", labText, [
    ...["Sulafat", "Sadaltager", "Rasalgethi", "Aoede"].map((v) => V(`current-${v.toLowerCase()}-whole`, v, CURRENT)),
    V("current-charon-sentence", "Charon", CURRENT, "sentence"), V("notes-charon-sentence", "Charon", NOTES, "sentence"),
    V("current-sulafat-sentence", "Sulafat", CURRENT, "sentence"), V("notes-kore-sentence", "Kore", NOTES, "sentence"),
  ]);
}
if (set === "corpus" || set === "lab2" || set === "stability" || set === "judge" || set === "all") {
  // Every *-vo-spoken.txt under the downloaded prep artifacts: data/tts/<channel>/<topic>-vo-spoken.txt (+ the production mp3 / srt beside it).
  const found = [];
  const walk = (d) => { if (!existsSync(d)) return; for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/-vo-spoken\.txt$/.test(n)) found.push(p); } };
  walk(corpusDir);
  const channels = loadChannels();
  for (const f of found.sort()) {
    const ch = (f.match(/[\\/]tts[\\/](\d+)[\\/]/) || [])[1];
    if (!ch) continue;
    let edge = "en-US-GuyNeural";
    try { edge = resolveChannel(ch, channels).tts_voice || edge; } catch {}
    const g = geminiVoiceFor(edge);
    const base = f.replace(/-vo-spoken\.txt$/, "");
    if (set === "judge") {
      // The determinism check (owner, 2026-10-10): the SAME mp3 judged three times, each judgement itself the median of three readings. Must agree.
      add(`ch${ch}`, f, [V(`ch${ch}-existing-judge`, g.voice, "", "existing", { mp3: `${base}-vo.mp3`, srt: `${base}-vo.srt`, repeat: 3 })], { channel: ch });
      continue;
    }
    if (set === "stability") {
      // Lab 2 showed the SAME text, voice and direction scoring 4.6-9 take to take, and the same mp3 scoring differently from the board's own judging.
      // Two things can move: the judge (same audio, judged 3x) and the synthesis (same request, 4 takes, each judged once).
      add(`ch${ch}`, f, [
        V(`ch${ch}-existing-judge`, g.voice, "", "existing", { mp3: `${base}-vo.mp3`, srt: `${base}-vo.srt`, repeat: 3 }),
        ...[1, 2, 3, 4].map((n) => V(`ch${ch}-prod-take${n}`, g.voice, g.style)),
      ], { channel: ch });
      continue;
    }
    add(`ch${ch}`, f, [
      V(`ch${ch}-existing`, g.voice, "", "existing", { mp3: `${base}-vo.mp3`, srt: `${base}-vo.srt` }),
      V(`ch${ch}-prod-${g.voice.toLowerCase()}`, g.voice, g.style),
      V(`ch${ch}-notes-${g.voice.toLowerCase()}`, g.voice, NOTES),
      ...(g.voice === "Charon" ? [] : [V(`ch${ch}-charon-current`, "Charon", CURRENT)]),
    ], { channel: ch });
  }
}

const rows = [];
for (const job of jobs) {
  for (const v of job.variants.filter((x) => !only.length || only.includes(x.name))) {
    const dir = join(out, job.textId, v.name); mkdirSync(dir, { recursive: true });
    const f = (n) => join(dir, n);
    console.log(`\n=== ${job.textId} / ${v.name} (voice ${v.voice}, ${v.mode}${v.style ? "" : v.mode === "existing" ? ", the production mp3 as shipped" : ", no direction"}) — ${job.features.words} words, ${job.features.wps} w/sentence`);
    let mp3 = f("vo.mp3"), srt = f("vo.srt");
    if (set === "calibrate") {
      // Up to three tries: the free tier's per-minute quota refuses a burst, and a refused call is not a bad voice. The error is printed.
      let tts = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        tts = spawnSync("python3", [join(ROOT, "src", "utils", "tts_gemini.py"), "--voice", v.voice, "--style", v.style, "--mode", v.mode, "--file", job.file, "--mp3", mp3, "--srt", srt, "--words", f("vo-words.json")], { encoding: "utf8", env: process.env, timeout: 900000 });
        if (tts.status === 0) break;
        console.log(`${v.name}: attempt ${attempt} failed: ${String(tts.stderr || "").trim().split("\n").slice(-2).join(" | ").slice(0, 300)}`);
        await new Promise((r) => setTimeout(r, 60000 * attempt));
      }
      rows.push({ name: v.name, label: v.label, voice: v.voice, ok: tts.status === 0, why: tts.status === 0 ? null : "tts failed", dir, textId: "calibrate" });
      console.log(`${v.name} (${v.label}): ${tts.status === 0 ? "synthesised" : "TTS FAILED"}`);
      continue;
    }
    if (v.mode === "existing") {
      if (!existsSync(v.mp3) || !existsSync(v.srt)) { console.log("no production mp3 / srt beside the text"); rows.push({ ...v, textId: job.textId, features: job.features, ok: false, why: "no mp3" }); continue; }
      mp3 = v.mp3; srt = v.srt;
    } else {
      const tts = spawnSync("python3", [join(ROOT, "src", "utils", "tts_gemini.py"), "--voice", v.voice, "--style", v.style, "--mode", v.mode, "--file", job.file, "--mp3", mp3, "--srt", srt, "--words", f("vo-words.json")], { encoding: "utf8", env: process.env, timeout: 900000 });
      if (tts.status !== 0) { console.log(`TTS failed: ${(tts.stderr || "").trim().split("\n").slice(-2).join(" | ").slice(0, 300)}`); rows.push({ ...v, textId: job.textId, features: job.features, ok: false, why: "tts failed" }); continue; }
    }
    const dur = Number((spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3], { encoding: "utf8" }).stdout || "0").trim()) || null;
    for (let rep = 1; rep <= (v.repeat || 1); rep++) {
      const nj = f(`narration${rep > 1 ? "-" + rep : ""}.json`);
      const j = spawnSync("node", [join(ROOT, "scripts", "narration-judge.mjs"), "--audio", mp3, "--srt", srt, "--out", nj], { encoding: "utf8", env: process.env, timeout: 400000 });
      if (!existsSync(nj)) { console.log(`judge could not run (exit ${j.status}): ${(j.stderr || "").trim().slice(-200)}`); rows.push({ ...v, textId: job.textId, features: job.features, ok: false, why: "judge could not run", seconds: dur }); continue; }
      const parsed = JSON.parse(readFileSync(nj, "utf8"));
      const sentences = parsed.sentences || [];
      const scores = sentences.map((s) => Number(s.score));
      const mean = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
      const name = v.repeat ? `${v.name}#${rep}` : v.name;
      const row = { ...v, name, judge: parsed.model, textId: job.textId, features: job.features, ok: true, seconds: dur, mean: +mean.toFixed(2), min: Math.min(...scores), passing: scores.filter((x) => x >= 7).length, of: scores.length, scores, gate: (parsed.failing || []).length ? `FAIL(${parsed.failing.length})` : "pass", why: sentences.map((s) => s.why).filter(Boolean).slice(0, 2) };
      rows.push(row);
      console.log(`${name}: mean ${row.mean}, min ${row.min}, ${row.passing}/${row.of} at 7+ [${scores.join(" ")}] (${dur ? dur.toFixed(1) + " s" : "?"}, judge ${parsed.model})`);
    }
  }
}

const agree = [...new Set(rows.filter((r) => r.repeat && r.ok).map((r) => r.textId))].map((id) => { const g = rows.filter((r) => r.textId === id && r.repeat && r.ok).map((r) => (r.gate === "pass" ? "pass" : "FAIL")); return `${id}: ${g.join(" / ")} -> ${g.length && g.every((x) => x === g[0]) ? "AGREE" : "DISAGREE"}`; });
if (agree.length) console.log(`\nsame audio, three judgements (each the median of three readings):\n${agree.join("\n")}`);
if (set === "calibrate") { console.log("calibrate: all variants synthesised; scripts/acoustic/calibrate.py measures them next"); process.exit(0); }
rows.sort((a, b) => String(a.textId).localeCompare(String(b.textId)) || (b.mean ?? -1) - (a.mean ?? -1));
const cells = ["| text | variant | voice | mode | judge | mean | per sentence | at 7+ | gate |", "|---|---|---|---|---|---|---|---|---|", ...rows.map((r) => `| ${r.textId} | ${r.name} | ${r.voice} | ${r.mode} | ${r.judge || "—"} | ${r.ok ? r.mean : "—"} | ${r.ok ? r.scores.join(" ") : r.why} | ${r.ok ? `${r.passing}/${r.of}` : "—"} | ${r.gate || "—"} |`)].join("\n");
const byText = new Map(); for (const r of rows) if (!byText.has(r.textId)) byText.set(r.textId, r.features);
const feat = ["| text | words | sentences | words/sentence | sd | digits | questions | commas/sentence | dashes | contrast words | best mean | production-setting mean |", "|---|---|---|---|---|---|---|---|---|---|---|---|",
  ...[...byText].map(([id, ft]) => { const rs = rows.filter((r) => r.textId === id && r.ok); const best = rs.length ? Math.max(...rs.map((r) => r.mean)) : "—";
    const prod = rs.find((r) => /-prod-|^baseline-/.test(r.name))?.mean ?? "—";
    return `| ${id} | ${ft.words} | ${ft.sentences} | ${ft.wps} | ${ft.wps_sd} | ${ft.digits} | ${ft.questions} | ${ft.commas_per_sentence} | ${ft.dashes} | ${ft.contrast} | ${best} | ${prod} |`; })].join("\n");
console.log(`\n${cells}\n\n${feat}`);
writeFileSync(join(out, "lab.json"), JSON.stringify({ at: new Date().toISOString(), set, rows }, null, 2) + "\n");
writeFileSync(join(out, "lab.md"), `${cells}\n\n${feat}\n`);
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## voice lab (${set})\n\n${agree.length ? `**same audio, three judgements:**\n\n${agree.map((a) => `- ${a}`).join("\n")}\n\n` : ""}${cells}\n\n### text features vs score\n\n${feat}\n`, { flag: "a" });
