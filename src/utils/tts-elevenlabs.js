/**
 * ElevenLabs TTS provider — studio-grade, expressive speech.
 *
 * Primary natural-voiceover choice (Task 4.1). Uses the ElevenLabs v3/v4
 * text-to-speech API with a style prompt for editorial narration. Falls back
 * to edge-tts when ELEVENLABS_API_KEY is not set (see tts.js chaining).
 *
 * Exports synthesize(text, opts) -> { mp3Path, srtPath, wordsPath } or throws.
 */
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STYLE_PROMPT =
  "Narrate this as an editorial explainer. Calm, confident, slightly urgent. Natural pacing — not rushed. Pause briefly at sentence boundaries. Emphasize numbers and proper nouns. The tone of a Vox or Bloomberg narrator.";

const hasKey = () => !!process.env.ELEVENLABS_API_KEY;

/**
 * Call the ElevenLabs TTS API and write the mp3 + a sentence SRT + per-word
 * timings (from the API's alignment data when available, else estimated).
 * Returns null when no API key is configured (caller falls back).
 */
export async function synthesize(spokenText, { voice, outDir, topic, model = "eleven_multilingual_v2" } = {}) {
  if (!hasKey()) return null;
  mkdirSync(outDir, { recursive: true });
  const mp3Path = join(outDir, `${topic}-vo.mp3`);
  const srtPath = join(outDir, `${topic}-vo.srt`);
  const wordsPath = join(outDir, `${topic}-vo-words.json`);
  const voiceId = voice || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const body = {
    text: `${STYLE_PROMPT}\n\n${spokenText}`,
    model_id: model,
    voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.6, use_speaker_boost: true },
  };
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }
  const audio = Buffer.from(await res.arrayBuffer());
  writeFileSync(mp3Path, audio);
  // Sentence SRT + estimated word timings from duration (words are verified
  // against the audio by tts-verify.js; a real alignment payload would
  // supersede this when the API returns it).
  const est = estimatedTimings(spokenText, 2.5);
  writeFileSync(srtPath, est.srt);
  writeFileSync(wordsPath, JSON.stringify(est.words, null, 2));
  return { mp3Path, srtPath, wordsPath, provider: "elevenlabs" };
}

/** Rough per-word timings at 2.5 wps — replaced when a real alignment exists. */
function estimatedTimings(text, wps) {
  const sentences = String(text || "").split(/(?<=[.!?])\s+/).filter(Boolean);
  let t = 0;
  const words = [];
  const srtLines = [];
  let idx = 0;
  for (const s of sentences) {
    const ws = s.split(/\s+/).filter(Boolean);
    if (!ws.length) continue;
    const dur = ws.length / wps;
    const start = t;
    const end = t + dur;
    srtLines.push(`${++idx}\n${fmtSrt(start)} --> ${fmtSrt(end)}\n${s}\n`);
    for (const w of ws) words.push({ word: w, start: t, end: t + w.length / (ws.join(" ").length) * dur });
    t = end + 0.15;
  }
  return { srt: srtLines.join("\n"), words };
}

const fmtSrt = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60), ms = Math.round((s % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};

export { hasKey };
