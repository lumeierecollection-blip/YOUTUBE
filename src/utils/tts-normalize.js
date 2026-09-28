/**
 * tts-normalize.js — written text -> the words a narrator says.
 *
 * Edge TTS reads "50/30/20" as "fifty slash thirty slash twenty" and "$1.5M"
 * as "dollar one point five M". Every string sent to the TTS engine goes
 * through speakable() first (src/utils/tts.js). The WRITTEN text is kept
 * for the SRT sentence cues (tts_words.py --display-file): the planner and
 * its gates read numbers from those cues (checkVisual needs the digits), so
 * only the audio and the word timings use the spoken form.
 *
 * Sentence boundaries are preserved: no rule adds or removes a sentence
 * terminator (decimal points inside numbers become "point"), so the spoken
 * and written texts split into the same sentences. tts_words.py checks that
 * and falls back to the spoken text for the cues, with a warning, if not.
 *
 * Where this stops: rules are pattern-based, not a language model. Dates in
 * slash form ("6/15") are read as a list ("six, fifteen"); a bare
 * four-digit number from 1100 to 2099 is read as a year ("twenty twenty-six").
 */

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven",
  "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES = [[1e12, "trillion"], [1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];
const ORD = { one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth" };
const SCALE_WORD = { k: "thousand", thousand: "thousand", m: "million", mn: "million", million: "million", b: "billion", bn: "billion", billion: "billion", t: "trillion", tn: "trillion", trillion: "trillion" };

function under1000(n) {
  const parts = [];
  if (n >= 100) { parts.push(`${ONES[Math.floor(n / 100)]} hundred`); n %= 100; }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "")); }
  else if (n > 0 || !parts.length) parts.push(ONES[n]);
  return parts.join(" ");
}

/** Integer >= 0 to words: 1000 -> "one thousand", 1500000 -> "one million five hundred thousand". */
export function intWords(n) {
  n = Math.floor(Math.abs(n));
  if (n < 1000) return under1000(n);
  const out = [];
  for (const [v, w] of SCALES) {
    if (n >= v) { out.push(`${intWords(Math.floor(n / v))} ${w}`); n %= v; }
  }
  if (n) out.push(under1000(n));
  return out.join(" ");
}

/** "1.5" -> "one point five", "1,000" -> "one thousand", "0.25" -> "zero point two five". */
export function numberWords(raw) {
  const s = String(raw).replace(/,/g, "");
  const [i, d] = s.split(".");
  const whole = intWords(Number(i || 0));
  return d ? `${whole} point ${d.split("").map((c) => ONES[Number(c)]).join(" ")}` : whole;
}

/** 2026 -> "twenty twenty-six", 2000 -> "two thousand", 2005 -> "two thousand five", 1990 -> "nineteen ninety". */
export function yearWords(y) {
  const n = Number(y);
  if (n >= 2000 && n < 2010) return intWords(n);
  const hi = Math.floor(n / 100), lo = n % 100;
  return `${under1000(hi)} ${lo === 0 ? "hundred" : lo < 10 ? `oh ${ONES[lo]}` : under1000(lo)}`;
}

function ordinalWords(n) {
  const w = intWords(n);
  const m = w.match(/([a-z]+)$/);
  const last = m[1];
  const ord = ORD[last] || (last.endsWith("y") ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return w.slice(0, -last.length) + ord;
}

// Commas only as thousands separators, so "2026," stays a year plus a comma.
const NUM = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;
const isYear = (s) => /^(1[1-9]\d\d|20\d\d)$/.test(s);
const say = (s) => (isYear(s) ? yearWords(s) : numberWords(s));

/** Written text -> spoken text. Idempotent on text that has no digits or symbols. */
export function speakable(text) {
  let t = String(text || "");

  // Quarters: "Q2/Q3" -> "second and third quarter", "Q1" -> "first quarter".
  t = t.replace(/\bQ([1-4])\s*(?:\/|&|and|-|–)\s*Q([1-4])\b/g, (_, a, b) => `${ordinalWords(+a)} and ${ordinalWords(+b)} quarter`);
  t = t.replace(/\bQ([1-4])\b/g, (_, a) => `${ordinalWords(+a)} quarter`);

  // Money: "$1.5M" -> "one point five million dollars", "$2 billion" -> "two billion dollars".
  t = t.replace(new RegExp(String.raw`\$\s?(${NUM})(?:\s?(k|m|mn|b|bn|t|tn|thousand|million|billion|trillion)\b)?`, "gi"),
    (_, n, sc) => `${numberWords(n)}${sc ? ` ${SCALE_WORD[sc.toLowerCase()]}` : ""} dollars`);
  // Bare scaled figures: "105M" -> "one hundred five million".
  t = t.replace(new RegExp(String.raw`\b(${NUM})(k|m|mn|b|bn|tn)\b`, "gi"), (_, n, sc) => `${numberWords(n)} ${SCALE_WORD[sc.toLowerCase()]}`);

  // Number lists joined by slashes: "50/30/20" -> "fifty, thirty, twenty".
  t = t.replace(new RegExp(String.raw`\b${NUM}(?:\s?%)?(?:\s?\/\s?${NUM}(?:\s?%)?)+`, "g"),
    (m) => m.split(/\s?\/\s?/).map((p) => (p.includes("%") ? `${say(p.replace(/\s?%/, ""))} percent` : say(p))).join(", "));

  // Ranges: "10–20" / "10-20" -> "ten to twenty" ("55-60%" -> "fifty-five to sixty percent").
  t = t.replace(new RegExp(String.raw`\b(${NUM})(?:\s?(%))?\s?[–—-]\s?(${NUM})(?:\s?(%))?`, "g"),
    (_, a, p1, b, p2) => `${say(a)}${p1 && !p2 ? " percent" : ""} to ${say(b)}${p1 || p2 ? " percent" : ""}`);

  // Percentages, multipliers, ordinals.
  t = t.replace(new RegExp(String.raw`(${NUM})\s?%`, "g"), (_, n) => `${numberWords(n)} percent`);
  t = t.replace(new RegExp(String.raw`\b(${NUM})x\b`, "gi"), (_, n) => `${numberWords(n)} times`);
  t = t.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_, n) => ordinalWords(+n));

  // Remaining numbers (years read as years).
  t = t.replace(new RegExp(String.raw`(^|[^\w.])(${NUM})(?![\w])`, "g"), (_, pre, n) => `${pre}${say(n)}`);

  // Symbols.
  t = t.replace(/\s*(?:→|->|⇒)\s*/g, " leads to ")
    .replace(/↑/g, " up ").replace(/↓/g, " down ")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\bvs\.?(?=\s)/gi, "versus")
    .replace(/\+(?=\s?[a-z])/gi, "plus ")
    .replace(/°/g, " degrees")
    .replace(/\s*\/\s*/g, " and ")
    .replace(/[§#*_~^|<>{}[\]\\=@]/g, " ");

  return t.replace(/[ \t]+/g, " ").replace(/ +([,.!?;:])/g, "$1").replace(/ *\n */g, "\n").trim();
}
