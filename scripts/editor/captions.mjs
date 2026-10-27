/**
 * Build caption cues from the written script and the actual voiceover.
 *
 * The script is the source of the words on screen. The voiceover (Whisper
 * JSON, or a sentence-level SRT) is the source of when they are spoken. When
 * the recogniser returned a word for every script word in a sentence, those
 * word times are used; otherwise the sentence's words are distributed across
 * the sentence's measured span. A caption cue never invents a time outside
 * the sentence the voiceover actually spoke.
 */

const ABBREV = new Set(["u.s.", "u.k.", "e.u.", "u.n.", "mr.", "mrs.", "ms.", "dr.", "st.", "jr.", "sr.", "vs.", "e.g.", "i.e.", "inc.", "no.", "co.", "corp.", "ltd.", "etc.", "approx.", "dept.", "gov.", "sen.", "rep.", "gen.", "a.m.", "p.m."]);

export function splitSentences(text) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return [];
  const out = [];
  let start = 0;
  const re = /[.!?]+["')\]]*(?=\s)|\n\s*\n/g;
  let m;
  while ((m = re.exec(s))) {
    const end = m.index + m[0].length;
    const token = (s.slice(0, end).trim().split(/\s+/).pop() || "").toLowerCase().replace(/^["'(\[]+|["')\]]+$/g, "");
    if (m[0][0] === "." && (ABBREV.has(token) || /^(?:[a-z]\.){1,3}$/.test(token))) continue;
    const sentence = s.slice(start, end).trim();
    if (sentence) out.push(sentence);
    start = end;
  }
  const tail = s.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

export function scriptSentences(script) {
  const sections = Array.isArray(script?.sections) ? script.sections : [];
  return splitSentences(sections.map((x) => x.voiceover || "").filter(Boolean).join(" "));
}

function wordsOf(sentence) {
  return String(sentence).split(/\s+/).filter(Boolean);
}

function proportional(words, start, end) {
  const weights = words.map((w) => Math.max(1, w.replace(/[^\p{L}\p{N}]/gu, "").length + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return words.map((text, i) => {
    const a = start + ((end - start) * acc) / total;
    acc += weights[i];
    const b = start + ((end - start) * acc) / total;
    return { text, start: a, end: b };
  });
}

function fromWhisperWords(words, sentenceWords, start, end) {
  const clean = (words || [])
    .map((w) => ({ text: String(w.word ?? w.text ?? "").trim(), start: Number(w.start), end: Number(w.end) }))
    .filter((w) => w.text && Number.isFinite(w.start) && Number.isFinite(w.end));
  if (clean.length !== sentenceWords.length) return proportional(sentenceWords, start, end);
  return clean.map((w, i) => ({ text: sentenceWords[i], start: Math.max(start, w.start), end: Math.min(end, Math.max(w.start + 0.01, w.end)) }));
}

export function buildCaptions({ script, whisper = null, srt = null, duration = 0 } = {}) {
  const sentences = scriptSentences(script);
  if (!sentences.length) return [];
  let segments = Array.isArray(whisper?.segments) ? whisper.segments : [];
  if (!segments.length && Array.isArray(srt) && srt.length) {
    segments = srt.map((c) => ({ start: c.start, end: c.end, text: c.text, words: c.words }));
  }
  if (!segments.length && duration > 0) {
    const each = duration / sentences.length;
    segments = sentences.map((text, i) => ({ start: i * each, end: (i + 1) * each, text }));
  }
  if (segments.length !== sentences.length) {
    const total = Number(segments.at(-1)?.end || duration || sentences.length * 2);
    const each = total / sentences.length;
    segments = sentences.map((text, i) => ({ start: i * each, end: (i + 1) * each, text }));
  }
  return sentences.map((sentence, i) => {
    const seg = segments[i] || { start: 0, end: 1 };
    const start = Number(seg.start) || 0;
    const end = Math.max(start + 0.05, Number(seg.end) || start + 0.05);
    const sw = wordsOf(sentence);
    const words = fromWhisperWords(seg.words, sw, start, end);
    return { start, end, text: sentence, words };
  });
}
