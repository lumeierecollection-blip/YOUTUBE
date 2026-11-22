/**
 * Long-form script gate. Checks a long-form script package against its channel's format in config/longform-formats.json before any voice is made.
 * It never edits the script; it returns { ok, errors, warnings, stats }. Errors stop a run. The Shorts gates are separate and unchanged.
 *
 * Package shape:
 *   { channel, topic, title, central_question,
 *     claims: [{ claim_id, source_id, source_url, excerpt, ... }], sources: [{ source_id, url }],
 *     chapters: [{ id, title, scenes: [{ kind, treatment, objective }],
 *                  sentences: [{ text, scene, claim_ids: [], allow_no_claim?, editorial?, quote?: { source_id, text, speaker } }] }] }
 *
 * What it can check: structure, counts, length at the channel's pace, that every claim id exists, that every quotation's text is inside a claim
 * excerpt from the same source, the opening rules that can be read from words. What it cannot check: whether a sentence is true to its source
 * beyond the claim link (that is the claim record's job and the research gate's), or whether the writing is good.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const loadFormats = () => JSON.parse(readFileSync(join(ROOT, "config/longform-formats.json"), "utf8"));
const words = (t) => String(t).split(/\s+/).filter(Boolean);
const endings = (t) => (String(t).replace(/\b(Mr|Mrs|Dr|St|No|vs|U\.S|e\.g|i\.e)\.\s/g, "$1 ").match(/[.!?](?=\s+\S|$)/g) || []).length;

export function checkLongScript(pkg, formats = loadFormats()) {
  const errors = [], warnings = [], fmt = formats.channels[pkg.channel], shared = formats.shared;
  if (!fmt) return { ok: false, errors: [`no long-form format for channel "${pkg.channel}" in config/longform-formats.json`], warnings, stats: {} };
  const chapters = pkg.chapters || [], claims = new Map((pkg.claims || []).map((c) => [c.claim_id, c]));
  const all = chapters.flatMap((c, ci) => (c.sentences || []).map((s, si) => ({ ...s, ci, si, chapter: c })));
  const totalWords = all.reduce((n, s) => n + words(s.text).length, 0);
  const [wLo, wHi] = fmt.wpm, [mLo, mHi] = fmt.minutes;
  const stats = { chapters: chapters.length, sentences: all.length, words: totalWords, minutes_at_slow: +(totalWords / wLo).toFixed(1), minutes_at_fast: +(totalWords / wHi).toFixed(1) };

  if (!pkg.title) errors.push("title is missing");
  if (!pkg.central_question || !/\?\s*$/.test(pkg.central_question)) errors.push("central_question is missing or is not a question");
  if (chapters.length < fmt.chapters[0] || chapters.length > fmt.chapters[1]) errors.push(`${chapters.length} chapters; this channel's format wants ${fmt.chapters[0]} to ${fmt.chapters[1]}`);
  // Length is judged at the pace of the channel's voice range: the script must fit the window at some natural pace inside that range.
  if (totalWords / wLo < mLo) errors.push(`${totalWords} words is ${stats.minutes_at_slow} min even at the slow end of ${wLo} wpm; the format wants at least ${mLo} min`);
  if (totalWords / wHi > mHi) errors.push(`${totalWords} words is ${stats.minutes_at_fast} min even at the fast end of ${wHi} wpm; the format allows at most ${mHi} min`);

  const seen = new Set(), titles = new Set();
  for (const [ci, c] of chapters.entries()) {
    if (!c.title) errors.push(`chapter ${ci + 1} has no title`);
    else if (titles.has(c.title.toLowerCase())) errors.push(`chapter title repeated: "${c.title}"`);
    titles.add(String(c.title).toLowerCase());
    const cw = (c.sentences || []).reduce((n, s) => n + words(s.text).length, 0), mid = (wLo + wHi) / 2, cm = cw / mid;
    if ((c.sentences || []).length < 3) errors.push(`chapter "${c.title}" has fewer than 3 sentences`);
    if (cm < fmt.chapter_minutes[0] * 0.6 || cm > fmt.chapter_minutes[1] * 1.4) warnings.push(`chapter "${c.title}" is about ${cm.toFixed(1)} min; the format's chapters run ${fmt.chapter_minutes[0]} to ${fmt.chapter_minutes[1]} min`);
    if (!(c.scenes || []).length) errors.push(`chapter "${c.title}" has no scenes`);
    for (const s of c.sentences || []) if (!Number.isInteger(s.scene) || !c.scenes?.[s.scene]) errors.push(`chapter "${c.title}": sentence points to scene ${s.scene}, which does not exist: "${String(s.text).slice(0, 60)}"`);
  }

  let unclaimed = 0;
  for (const s of all) {
    const w = words(s.text).length, key = s.text.trim().toLowerCase();
    if (endings(s.text) !== 1) errors.push(`exactly one sentence-ending mark per sentence (voice timing counts them): "${s.text.slice(0, 80)}"`);
    if (w > shared.max_words_per_sentence) errors.push(`sentence of ${w} words (max ${shared.max_words_per_sentence}): "${s.text.slice(0, 80)}"`);
    if (seen.has(key)) errors.push(`repeated sentence: "${s.text.slice(0, 80)}"`);
    seen.add(key);
    const ids = s.claim_ids || [];
    for (const id of ids) if (!claims.has(id)) errors.push(`sentence cites claim "${id}", which is not in claims: "${s.text.slice(0, 60)}"`);
    if (!ids.length) { if (s.allow_no_claim && s.editorial) unclaimed += 1; else errors.push(`sentence with no claim and no editorial reason: "${s.text.slice(0, 80)}"`); }
  }
  if (all.length && unclaimed / all.length > shared.max_unclaimed_share) errors.push(`${unclaimed} of ${all.length} sentences carry no claim (max share ${shared.max_unclaimed_share}); a long-form script is evidence-led`);

  // Quotations: real words from a fetched source, attributed. The text must sit inside an excerpt of a claim from the same source.
  const quotes = all.filter((s) => s.quote);
  for (const s of quotes) {
    const q = s.quote, ok = [...claims.values()].some((c) => c.source_id === q.source_id && String(c.excerpt || "").includes(q.text));
    if (!q.speaker) errors.push(`quotation without a speaker: "${String(q.text).slice(0, 60)}"`);
    if (!ok) errors.push(`quotation not found in any claim excerpt from source "${q.source_id}": "${String(q.text).slice(0, 60)}"`);
  }
  if (quotes.length < shared.quotes_required) errors.push(`${quotes.length} quotations; long-form needs ${shared.quotes_required}, each with source and speaker`);

  // The opening: the format's rules that can be checked from the words.
  const open = all.slice(0, 40).map((s) => s.text).join(" "), first120 = words(open).slice(0, 120).join(" ");
  if (pkg.channel === "hidden-past" && !/\b(1\d{3}|20\d{2}|\d[\d,.]*\b)/.test(first120)) errors.push("Hidden Past opens on a dated, concrete moment: no date or number in the first 120 words");
  const qAt = words(all.map((s) => s.text).join(" ")).length && (() => { let n = 0; for (const s of all) { n += words(s.text).length; if (/\?\s*$/.test(s.text)) return n; } return Infinity; })();
  if (qAt > fmt.question_by_words) warnings.push(`the first question the viewer hears comes at word ${qAt === Infinity ? "never" : qAt}; this format turns to its central question by word ${fmt.question_by_words}`);
  const close = chapters.at(-1)?.sentences || [];
  if (shared.comment_question_in_close && !close.some((s) => /\?\s*$/.test(s.text))) errors.push("the last chapter has no question for the comments");

  return { ok: errors.length === 0, errors, warnings, stats: { ...stats, quotations: quotes.length, unclaimed_sentences: unclaimed, first_question_at_word: qAt } };
}
