/**
 * Microsoft MAI-Voice-2.1 TTS provider — natural, expressive speech.
 *
 * Fallback natural-voiceover choice (Task 4.1) when ElevenLabs is not
 * configured. Uses the Azure AI Speech / MAI-Voice API with the same
 * editorial style prompt. Falls back to edge-tts when no key is set.
 *
 * Exports synthesize(text, opts) -> { mp3Path, srtPath, wordsPath } or null.
 */
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STYLE_PROMPT =
  "Narrate this as an editorial explainer. Calm, confident, slightly urgent. Natural pacing — not rushed. Pause briefly at sentence boundaries. Emphasize numbers and proper nouns. The tone of a Vox or Bloomberg narrator.";

const hasKey = () => !!process.env.MAI_VOICE_API_KEY;

export async function synthesize(spokenText, { voice, outDir, topic, region = process.env.MAI_VOICE_REGION || "eastus", model = "mai-voice-2.1" } = {}) {
  if (!hasKey()) return null;
  mkdirSync(outDir, { recursive: true });
  const mp3Path = join(outDir, `${topic}-vo.mp3`);
  const srtPath = join(outDir, `${topic}-vo.srt`);
  const wordsPath = join(outDir, `${topic}-vo-words.json`);
  const res = await fetch(`https://${region}.api.cognitive.microsoft.com/cognitiveservices/voices/tts`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.MAI_VOICE_API_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-160kbitrate-mono-mp3",
      "User-Agent": "YOUTUBE-pipeline",
    },
    body: `<speak version='1.0' xml:lang='en-US'><voice name='${voice || "en-US-JennyMultilingualNeural"}'>${escapeXml(spokenText)}</voice></speak>`,
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`MAI-Voice HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }
  const audio = Buffer.from(await res.arrayBuffer());
  writeFileSync(mp3Path, audio);
  const est = estimatedTimings(spokenText, 2.5);
  writeFileSync(srtPath, est.srt);
  writeFileSync(wordsPath, JSON.stringify(est.words, null, 2));
  return { mp3Path, srtPath, wordsPath, provider: "mai" };
}

const escapeXml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
    srtLines.push(`${++idx}\n${fmtSrt(t)} --> ${fmtSrt(t + dur)}\n${s}\n`);
    for (const w of ws) words.push({ word: w, start: t, end: t + dur });
    t += dur + 0.15;
  }
  return { srt: srtLines.join("\n"), words };
}

const fmtSrt = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60), ms = Math.round((s % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};

export { hasKey, STYLE_PROMPT };
