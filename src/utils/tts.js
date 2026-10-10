/**
 * TTS Utility — Generates voiceover audio using EdgeTTS (free, no provider key).
 *
 * Usage: node src/utils/tts.js <channel-id> [script-path]
 * Output: data/tts/<channel-id>/<topic>-vo.mp3 (+ matching .srt subtitles and
 *         <topic>-vo-words.json: real per-word timings, Edge WordBoundary)
 *
 * Delivery: rate +0%, pitch +0Hz — the voice's own natural pace. The old
 * -8% / +2Hz defaults were removed 2026-09-29 (owner: reset any deviation).
 * Per-channel overrides can still be set via channel.tts_rate /
 * channel.tts_pitch in channels.json; voices live in channel.tts_voice.
 * Default voice: en-US-GuyNeural
 *
 * Written text -> spoken text: everything sent to the engine goes through
 * speakable() (src/utils/tts-normalize.js), so "50/30/20" is said as
 * "fifty, thirty, twenty", never "fifty slash thirty slash twenty". The
 * WRITTEN text goes to tts_words.py as --display-file, and the SRT sentence
 * cues keep it: the planner's gates read digits from those cues.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, copyFileSync } from "fs";
import { resolveChannel } from "../../scripts/lib/channel-lookup.mjs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync, spawnSync } from "child_process";
import { narrationSections } from "./script-narration.js";
import { speakable } from "./tts-normalize.js";
import { synthesize as synthesizeElevenLabs } from "./tts-elevenlabs.js";
import { synthesize as synthesizeMai } from "./tts-mai.js";
import { verifyTts } from "./tts-verify.js";
import { chooseTake } from "./tts-takes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");

/**
 * Parse script into segments for TTS.
 * Handles both JSON scripts (from script-writer) and plain text/markdown.
 */
function parseScriptForTTS(scriptContent, isJson = false) {
  if (isJson) {
    try {
      const script = JSON.parse(scriptContent);
      const segments = [];
      // narrationSections() folds the top-level `hook` into section one —
      // without it the hook (the first thing that's supposed to be spoken)
      // is never narrated at all. See src/utils/script-narration.js.
      const sections = narrationSections(script);
      if (sections.length > 0) {
        for (const section of sections) {
          if (section.voiceover) {
            // Split voiceover into paragraphs
            const paragraphs = section.voiceover.split(/\n\n+/).filter(p => p.trim());
            for (const para of paragraphs) {
              segments.push({ section: section.id, text: para.trim() });
            }
          }
        }
      }
      return segments;
    } catch (e) {
      // Fall through to text parsing
    }
  }

  // Plain text / markdown parsing
  const lines = scriptContent.split("\n");
  const segments = [];
  let currentSection = "intro";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("---")) continue;
    if (trimmed.startsWith("[")) continue;
    if (trimmed.startsWith("SOURCE:")) continue;
    if (trimmed.startsWith("NOTES:")) continue;
    if (trimmed.startsWith("|")) continue;
    if (trimmed.startsWith("##")) {
      const sectionMatch = trimmed.match(/##\s+(.+)/);
      if (sectionMatch) currentSection = sectionMatch[1];
      continue;
    }

    let text = trimmed;
    if (text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1);
    }

    if (text.length > 5) {
      segments.push({ section: currentSection, text });
    }
  }

  return segments;
}

/**
 * Generate TTS audio using edge-tts CLI.
 * Falls back to noting the dependency if edge-tts is not installed.
 * Uses natural rate/pitch so the delivery is not robotic, and writes an SRT
 * subtitle file for caption sync.
 */
/**
 * The Gemini prebuilt voice for a channel's Edge voice (same gender and register), and the delivery note Gemini TTS reads as a
 * style instruction. channels.json `gemini_voice` overrides. The note asks for the human reading the owner described: varied
 * intonation, breaths at the punctuation, emphasis on the word that matters.
 */
const GEMINI_VOICE = { "en-US-GuyNeural": "Charon", "en-US-AndrewNeural": "Sadaltager", "en-GB-RyanNeural": "Rasalgethi", "en-US-AriaNeural": "Sulafat", "en-US-JennyNeural": "Aoede" };
export function geminiVoiceFor(edgeVoice, override = null) {
  const voice = override || GEMINI_VOICE[edgeVoice] || (/Guy|Andrew|Ryan|Davis|Tony|Christopher|Eric|Brian/i.test(edgeVoice || "") ? "Charon" : "Sulafat");
  const british = /^en-GB/i.test(edgeVoice || "");
  const style = `Read this as a documentary narrator speaking to one person${british ? ", in a natural British English accent" : ""}: warm, engaged and conversational, with real variation in pitch across each sentence, a short breath at every comma and dash, a clear stop at every full stop, and a little weight on the one word in each sentence that matters. Never sing-song, never flat, never rushed.`;
  return { voice, style };
}

async function generateTTS(segments, voice, outputDir, topic, settings = {}) {
  const fullText = segments.map((s) => s.text).join("\n\n");

  // Save text for reference
  const textPath = join(outputDir, `${topic}-vo-text.txt`);
  writeFileSync(textPath, fullText);

  // Try edge-tts
  const audioPath = join(outputDir, `${topic}-vo.mp3`);
  const srtPath = join(outputDir, `${topic}-vo.srt`);
  const wordsPath = join(outputDir, `${topic}-vo-words.json`);

  const rate = settings.rate || "+0%";
  const pitch = settings.pitch || "+0Hz";

  // Write text to a temp file to avoid shell escaping issues with special
  // characters (Unicode, quotes, etc.) in the inline --text argument.
  // The engine gets the SPOKEN text; the written text is the display file.
  const spokenText = segments.map((s) => speakable(s.text)).join("\n\n");
  const tmpTextPath = join(outputDir, `${topic}-tts-input.txt`);
  const displayPath = join(outputDir, `${topic}-tts-display.txt`);
  writeFileSync(tmpTextPath, spokenText);
  writeFileSync(displayPath, fullText);
  writeFileSync(join(outputDir, `${topic}-vo-spoken.txt`), spokenText);

  // Gemini's own TTS first (owner, 2026-10-10: "THE VOICE IS ROBOTIC"). In a blind Gemini listening test edge-tts scored
  // SYNTHETIC 4/10 and gemini-3.1-flash-tts-preview HUMAN 9/10 on the same sentence. src/utils/tts_gemini.py writes the mp3, the
  // sentence SRT and per-word timings (faster-whisper alignment) in tts_words.py's exact shape; any failure falls through to the chain below.
  if (process.env.TTS_PROVIDER !== "edge" && ["GEMINI_API_KEY_4", "GEMINI_API_KEY_1", "GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"].some((k) => process.env[k])) {
    const g = geminiVoiceFor(voice, settings.gemini_voice);
    const helper = join(ROOT, "src", "utils", "tts_gemini.py");
    const args = `--voice "${g.voice}" --style "${g.style.replace(/"/g, "'")}" --file "${tmpTextPath}" --display-file "${displayPath}" --mp3 "${audioPath}" --srt "${srtPath}" --words "${wordsPath}"`;
    const pythons = [...new Set([settings.python, process.platform === "win32" ? "python" : "python3", "python"].filter(Boolean))];
    // TAKES (board 38044082797, ch 26): see tts-takes.js. Up to TTS_GEMINI_TAKES takes (default 3), each heard by the render's own narration
    // judge at its own threshold; the first that passes is kept, else the best-scoring one. A judge that cannot run keeps the take given.
    const takes = process.env.TTS_NARRATION_RETAKE === "0" ? 1 : Math.max(1, Number(process.env.TTS_GEMINI_TAKES) || 3);
    const judge = join(ROOT, "scripts", "narration-judge.mjs");
    const kept = [audioPath, srtPath, wordsPath];
    const cleanup = () => { for (const f of [tmpTextPath, displayPath, ...kept.map((k) => `${k}.besttake`)]) { try { unlinkSync(f); } catch {} } };
    const r = chooseTake({
      takes,
      log: (m) => console.log(`[tts] ${m}`),
      record: (take) => {
        for (const py of pythons) {
          try {
            const out = execSync(`${py} "${helper}" ${args}`, { stdio: "pipe", timeout: 600000 }).toString().trim();
            console.log(out);
            console.log(`Delivery: gemini voice=${g.voice} (channel voice ${voice})${takes > 1 ? `, take ${take}/${takes}` : ""}`);
            verifyTts({ mp3Path: audioPath, srtPath, wordsPath, spokenText, channel: settings.channel || "?", topic });
            return true;
          } catch (err) {
            console.error(`::warning::Gemini TTS failed (${py}): ${String(err.stderr || err.message).trim().split("\n").slice(-3).join(" | ").slice(0, 400)} — falling back`);
          }
        }
        return false;
      },
      judge: (take) => {
        if (takes === 1) return { status: "unavailable" };   // one take: nothing to choose between, no extra Gemini call
        const jsonPath = join(outputDir, `${topic}-take${take}-narration.json`);
        const jr = spawnSync("node", [judge, "--audio", audioPath, "--srt", srtPath, "--out", jsonPath], { stdio: "pipe", timeout: 300000, env: process.env });
        for (const l of String(jr.stdout || "").split("\n").filter(Boolean)) console.log(`[take ${take}] ${l}`);
        if (jr.status === 0) return { status: "pass" };
        if (jr.status !== 1) return { status: "unavailable" };
        let mean = 0;
        try { const rows = JSON.parse(readFileSync(jsonPath, "utf8")).sentences || []; mean = rows.reduce((n, x) => n + Number(x.score || 0), 0) / Math.max(1, rows.length); } catch {}
        return { status: "fail", mean };
      },
      save: () => { for (const f of kept) if (existsSync(f)) copyFileSync(f, `${f}.besttake`); },
      restore: () => { for (const f of kept) if (existsSync(`${f}.besttake`)) copyFileSync(`${f}.besttake`, f); },
    });
    cleanup();
    if (r.outcome !== "none") return audioPath;   // none = no take at all: the chain below, as before
  }

  // Task 4.1 — natural voiceover provider chain: ElevenLabs → MAI-Voice →
  // edge-tts. A provider that is not configured (no API key) returns null and
  // the next is tried, so the pipeline always produces audio.
  let natural = null;
  try { natural = await synthesizeElevenLabs(spokenText, { voice, outDir: outputDir, topic, model: settings.elevenlabs_model }); } catch (e) { console.error(`ElevenLabs failed: ${e.message}`); }
  if (!natural) {
    try { natural = await synthesizeMai(spokenText, { voice, outDir: outputDir, topic, region: settings.mai_region, model: settings.mai_model }); } catch (e) { console.error(`MAI-Voice failed: ${e.message}`); }
  }
  if (natural) {
    console.log(`TTS audio saved (${natural.provider}): ${natural.mp3Path}`);
    const v = verifyTts({ mp3Path: natural.mp3Path, srtPath: natural.srtPath, wordsPath: natural.wordsPath, spokenText, channel: settings.channel || "?", topic });
    if (!v.ok && v.reason === "monotone") console.warn(`[tts] ch-${settings.channel || "?"}: monotone reading — consider a different voice or edge-tts prosody post-processing`);
    return natural.mp3Path;
  }

  try {

    // One synthesis (src/utils/tts_words.py, the edge_tts Python API) writes
    // the mp3, the sentence SRT and the per-word timings from the same audio.
    // The CLI can only write sentence-level subtitles, and the word-level
    // captions need the real time each word is spoken.
    // Rate/pitch use --flag=value: argparse treats "-8%" as an option otherwise.
    const helper = join(ROOT, "src", "utils", "tts_words.py");
    const args =
      `--voice "${voice}" ` +
      `--rate="${rate}" --pitch="${pitch}" ` +
      `--file "${tmpTextPath}" --display-file "${displayPath}" ` +
      `--mp3 "${audioPath}" --srt "${srtPath}" --words "${wordsPath}"`;
    // A real interpreter can be pinned per channel via channel.tts_python.
    const pythons = [...new Set([settings.python, process.platform === "win32" ? "python" : "python3", "python"].filter(Boolean))];
    const cmds = pythons.map((py) => `${py} "${helper}" ${args}`);
    let lastErr = null;
    for (const cmd of cmds) {
      try {
        execSync(cmd, { stdio: "pipe", timeout: 180000 });
        lastErr = null;
        break;
      } catch (err) {
        // Capture stderr for diagnostics — execSync puts it in err.stderr
        const stderr = err.stderr ? err.stderr.toString().trim() : "(no stderr)";
        console.error(`TTS command failed: ${cmd}
stderr: ${stderr}`);
        lastErr = err;
      }
    }
    // Clean up temp files
    try { unlinkSync(tmpTextPath); } catch {}
    try { unlinkSync(displayPath); } catch {}
    if (lastErr) throw lastErr;
    console.log(`TTS audio saved: ${audioPath}`);
    console.log(`TTS subtitles saved: ${srtPath}`);
    console.log(`TTS word timings saved: ${wordsPath}`);
    console.log(`Delivery: voice=${voice} rate=${rate} pitch=${pitch}`);
    // Task 4.3 — prosody/timing verification even on the edge-tts path.
    verifyTts({ mp3Path: audioPath, srtPath, wordsPath, spokenText, channel: settings.channel || "?", topic });
    return audioPath;
  } catch (err) {
    // Clean up temp files on error too
    try { unlinkSync(tmpTextPath); } catch {}
    try { unlinkSync(displayPath); } catch {}
    // Remove whatever the failed attempt left behind — a partial or
    // zero-length mp3/srt is exactly the kind of artifact that looks real
    // and isn't (T1.6). Never leave one sitting next to the topic's other
    // files where a later step might mistake it for real output.
    for (const partial of [audioPath, srtPath, wordsPath]) {
      if (existsSync(partial)) {
        try {
          unlinkSync(partial);
        } catch {}
      }
    }
    // PROMPT-SELF-HEALING-RUN.md T1.6 — fail loudly, never silently. edge-tts
    // is confirmed working on real GitHub Actions runners (a real mp3, real
    // duration, verified via the tts-probe.yml diagnostic), so a failure here
    // is a real problem — bad voice name, rate limit, transient network
    // error — not an expected/tolerable state. The manifest below is a
    // diagnostic artifact for whoever investigates, not a substitute for
    // failing: this function still throws, and main() still exits non-zero.
    const manifest = {
      voice,
      segments: segments.length,
      total_words: fullText.split(/\s+/).length,
      text_file: textPath,
      audio_output: audioPath,
      generated_at: new Date().toISOString(),
      status: "FAILED",
      error: err.message,
    };
    writeFileSync(
      join(outputDir, `${topic}-tts-manifest.FAILED.json`),
      JSON.stringify(manifest, null, 2)
    );
    console.error(`::warning::TTS synthesis failed for "${topic}" (voice=${voice}): ${err.message}`);
    throw new Error(`TTS synthesis failed for "${topic}" (voice=${voice}): ${err.message}`);
  }
}

/**
 * Parse a JSON script (script-writer schema) into spoken segments.
 * Uses each section's `voiceover` text.
 */
function parseJsonScript(script) {
  const segments = [];
  for (const section of script.sections || []) {
    if (!section.voiceover || !section.voiceover.trim()) continue;
    const text = section.voiceover.replace(/\s*\n\s*/g, " ").trim();
    if (text.length > 5) {
      segments.push({ section: section.id || section.timing || "section", text });
    }
  }
  return segments;
}

async function main() {
  const channelId = process.argv[2];
  const scriptPath = process.argv[3];

  if (!channelId) {
    console.error("Usage: node tts.js <channel-id> [script-path]");
    process.exit(1);
  }

  // Load channel config
  const channelsPath = join(ROOT, "config", "channels.json");
  const data = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channels = data.channels || data;
  const channel = resolveChannel(channelId, channels);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  const voice = channel.tts_voice || "en-US-GuyNeural";

  // If script path provided, generate TTS for that script
  if (scriptPath) {
    const fullPath = join(ROOT, ...scriptPath.split(/[\/\\]/));
    const scriptContent = readFileSync(fullPath, "utf-8");
    const isJson = scriptPath.endsWith(".json");
    const segments = parseScriptForTTS(scriptContent, isJson);
    const topic = scriptPath.split(/[\/\\]/).pop()?.replace(/\.(json|md|txt)$/, "") || "video";

    const outDir = join(ROOT, "data", "tts", channelId);
    mkdirSync(outDir, { recursive: true });

    try {
      await generateTTS(segments, voice, outDir, topic, {
        rate: channel.tts_rate,
        pitch: channel.tts_pitch,
        python: channel.tts_python,
        gemini_voice: channel.gemini_voice,
        channel: channelId,
      });
    } catch (err) {
      console.error(`TTS failed: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // Otherwise, show pending TTS jobs
  const ttsDir = join(ROOT, "data", "tts", channelId);
  if (!existsSync(ttsDir)) {
    console.log(`No TTS data for ${channelId}. Provide a script path to generate.`);
    return;
  }

  console.log(`TTS directory: ${ttsDir}`);
  console.log(`Voice: ${voice}`);
}

main().catch((err) => {
  console.error(`TTS failed: ${err.message}`);
  process.exit(1);
});
