/**
 * continuity.mjs: sentence-by-sentence checks that a script FOLLOWS ITSELF.
 * Deterministic checks first (cheap, exact, no model); then ONE model review for what rules cannot see.
 * A critical finding blocks narration. Each rule is named (CON-nn) so a failure says which test caught it.
 *
 * Where a rule is a heuristic it says so in its problem text. The rules are tuned to over-flag rather than
 * under-flag: a false alarm costs one revision, a missed jump costs a bad video.
 */
import { ask } from "./llm.mjs";
import { CLICKBAIT } from "./channels.mjs";
import { prompt } from "./prompt.mjs";
import { GEOGRAPHY, STOP, capitalised, content, contentSet, fold, norm, numbers, overlap, sentences as splitSentences, stem, words, wordCount } from "./text.mjs";

export const CATEGORIES = ["abrupt_topic_change", "unexplained_name", "missing_context", "unsupported_claim", "misleading_claim", "repetition", "contradiction", "unexplained_term", "chronology", "causal_error", "unresolved_loop", "unfulfilled_hook", "unsupported_conclusion", "unnatural_phrasing", "visual_mismatch", "wrong_channel_tone", "unrealistic_duration"];

const f = (rule, severity, category, ids, problem, fix) => ({ rule, severity, category, sentence_ids: ids, problem, fix });
const GENERIC_LINK = /^(next|then|also|and|continues?|moves? on|additionally|another|furthermore|more|related|next point|following|so|now|continuing|following on)\b[\s.,;:!-]*$/i;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const NOT_NAMES = new Set([...MONTHS, "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((x) => x[0].toUpperCase() + x.slice(1)));
const DESCRIPTOR = /\b(company|startup|firm|agency|outlet|group|app|tool|model|survey|study|researchers?|court|city|country|nation|general|president|ceo|minister|king|queen|director|journalist|reporter|actor|actress|footballer|player|team|club|manager|coach|empire|battle|treaty|crisis|war|ship|machine|device|manuscript|region|sea|canal|river|island|mountain|planet|moon|spacecraft|probe|rover|framework|protocol|standard|language|agent|assistant|platform|ring|network|law|act|bill|newspaper|outlet|network|bank|party|government|army|navy|league|cup|final|stadium|wreck|mechanism|library|university|institute|foundation|lab|laboratory|service|feature|chatbot|product|brand|index|region|state|province|capital)\b/i;
const BRIDGE_NOUN_OK = new Set(["year", "month", "week", "day", "time", "way", "video", "short", "morning", "night", "point", "moment", "case", "kind", "reason", "one", "many", "much", "some"]);
const CAUSAL_CUE = /\b(because|caused?|causing|leads? to|led to|results? in|resulted|due to|therefore|as a result|thanks to|triggers?|triggered|which is why|that'?s why)\b/i;
const PROMISE = /\b(later|in a moment|i'?ll (?:show|explain|come back)|we'?ll (?:see|get to|come back)|stay tuned|wait for it|more on that)\b/i;

const dates = (t) => {
  const out = [];
  for (const m of norm(t).matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(\d{4}))?/g)) out.push({ month: MONTHS.indexOf(m[1].toLowerCase()), day: Number(m[2]), year: m[3] ? Number(m[3]) : null });
  return out;
};
const dateKey = (d) => (d.year ?? 0) * 10000 + d.month * 100 + d.day;

/** pkg: a script package (sentences with sentence_id, beat_id, text, role, claim_ids, link_from_previous). */
export function deterministicContinuity(pkg, { claims, profile, channel = null }) {
  const out = [];
  const S = pkg.sentences;
  const byClaim = new Map(claims.map((c) => [c.claim_id, c]));
  const claimText = (s) => s.claim_ids.map((id) => byClaim.get(id)).filter(Boolean).map((c) => `${c.claim} ${c.excerpt}`).join(" ");
  const roleOf = (s) => pkg.blueprint.beats.find((b) => b.beat_id === s.beat_id)?.role;
  const known = []; // content stems heard so far, per sentence
  const heard = new Set();
  const heardNames = new Set(capitalised(`${pkg.topic} ${pkg.blueprint.central_question}`).map((n) => n.toLowerCase()));
  const hookNums = new Set(numbers(S[0].text));

  S.forEach((s, i) => {
    const prev = S[i - 1];
    const text = s.text;
    const stems = contentSet(text);
    const id = s.sentence_id;

    // CON-01 a transition that says why this sentence follows.
    if (i > 0) {
      const link = norm(s.link_from_previous || "");
      if (!link || wordCount(link) < 4 || GENERIC_LINK.test(link)) out.push(f("CON-01", "major", "missing_context", [id], `No real transition: the sentence does not say why it follows the previous one ("${link || "empty"}").`, "State what this sentence answers, explains or follows from."));
      else if (overlap(link, `${prev.text} ${text}`).shared === 0) out.push(f("CON-01", "minor", "missing_context", [id], "The stated transition mentions nothing from either sentence.", "Make the link specific."));
    }

    // CON-02 topic change between neighbours.
    if (prev) {
      const o = overlap(prev.text, text);
      const sharedName = capitalised(prev.text).some((n) => capitalised(text).includes(n));
      const sharedClaim = s.claim_ids.some((c) => prev.claim_ids.includes(c));
      // A pronoun opener ("That pull ...", "It sends ...") points back at the previous sentence, and a stated reason that names
      // something from BOTH sentences is the writer saying what links them; neither proves the link, the reviews check it.
      const pronounBridge = /^(that|this|it|its|these|those|they|their|he|she|his|her|which)\b/i.test(text);
      const linkNamesBoth = overlap(s.link_from_previous || "", prev.text).shared >= 1 && overlap(s.link_from_previous || "", text).shared >= 1;
      if (o.shared === 0 && !sharedName && !sharedClaim && !pronounBridge && !linkNamesBoth) out.push(f("CON-02", "major", "abrupt_topic_change", [prev.sentence_id, id], "These two sentences share no subject, name or fact: the narration jumps.", "Add the missing step that connects them, or reorder, or remove one."));
    }

    // CON-03 a reference with no antecedent.
    if (i === 0 && /^(this|that|these|those|it|they|he|she|his|her|their|its)\b/i.test(text)) out.push(f("CON-03", "critical", "missing_context", [id], "The first sentence starts with a pronoun that points at nothing.", "Name the subject."));
    const before = new Set([...heard, ...heardNames]);
    for (const m of norm(text).matchAll(/\b(this|these|those|such|both|the same)\s+([a-z][a-z-]+)/gi)) {
      const noun = m[2].toLowerCase();
      if (STOP.has(noun) || STOPLIKE(noun) || BRIDGE_NOUN_OK.has(noun) || /(ed|ing|ly)$/.test(noun)) continue;
      const nounStem = stem(noun);
      const ownEarlier = content(norm(text).slice(0, m.index)).includes(nounStem);
      if (!before.has(nounStem) && !ownEarlier) out.push(f("CON-03", i === 0 ? "critical" : "major", "missing_context", [id], `"${m[0]}" refers to something never mentioned before this point.`, `Say what "${noun}" is, or mention it earlier.`));
    }
    if (i > 0 && /^(he|she)\b/i.test(text) && !S.slice(Math.max(0, i - 2), i).some((p) => capitalised(p.text).length || /^[A-Z][a-z]+ [A-Z]/.test(p.text))) out.push(f("CON-03", "major", "missing_context", [id], "A he/she sentence with no person named in the previous two sentences.", "Name the person."));

    // CON-04 an unsupported factual sentence; new material where only recap is allowed.
    const nums = numbers(text);
    const role = roleOf(s);
    if (!s.claim_ids.length && (nums.length || capitalised(text).some((n) => !GEOGRAPHY.has(fold(n)) && !heardNames.has(n.toLowerCase()) && !heard.has(stem(n)))) && !/\?\s*$/.test(text)) out.push(f("CON-04", "critical", "unsupported_claim", [id], "The sentence states a figure or a name but cites no claim.", "Cite a claim or remove the figure or name."));
    if (role === "ending" || role === "payoff") {
      const novel = [...stems].filter((w) => !heard.has(w));
      const newNums = nums.filter((n) => ![...heard].includes(n) && !S.slice(0, i).some((p) => numbers(p.text).includes(n)));
      if (role === "ending" && (newNums.length || (stems.size >= 3 && novel.length / stems.size > 0.4))) out.push(f("CON-04", "major", "missing_context", [id], `The ending brings in something the listener has not heard (${newNums.length ? "figure " + newNums.join(", ") : novel.slice(0, 4).join(", ")}).`, "End on what the script already established; move new material earlier and explain it."));
    }

    // CON-05 names introduced with no explanation.
    for (const name of capitalised(text)) {
      const key = name.toLowerCase();
      if (NOT_NAMES.has(name) || GEOGRAPHY.has(fold(name)) || heardNames.has(key) || [...heardNames].some((h) => h.includes(key) || key.includes(h))) continue;
      const idx = norm(text).indexOf(name);
      const around = norm(text).slice(Math.max(0, idx - 40), idx + name.length + 40);
      const explained = DESCRIPTOR.test(norm(text).slice(Math.max(0, idx - 30), idx)) || new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[,)]?\\s+(?:a|an|the)\\b`).test(around) || /\b(called|named|known as|dubbed)\b/i.test(around) || /\(.+\)/.test(around);
      if (!explained) out.push(f("CON-05", "major", "unexplained_name", [id], `"${name}" appears with no word saying what or who it is.`, `Introduce it: say what or who "${name}" is.`));
      heardNames.add(key);
    }
    for (const n of capitalised(text)) heardNames.add(n.toLowerCase());

    // CON-13 heard once.
    if (wordCount(text) > profile.maxSentenceWords) out.push(f("CON-13", "major", "unnatural_phrasing", [id], `${wordCount(text)} words in one sentence; too long to follow by ear (limit ${profile.maxSentenceWords}).`, "Split it."));
    if (nums.length > 3) out.push(f("CON-13", "major", "unnatural_phrasing", [id], `${nums.length} figures in one sentence; a listener keeps two.`, "Keep the figure that matters."));
    if (/[()[\]<>@#*\\]|https?:|\be\.g\.|\bi\.e\./i.test(text)) out.push(f("CON-13", "minor", "unnatural_phrasing", [id], "Written-only notation that cannot be spoken.", "Rewrite it as speech."));
    if (CLICKBAIT.test(text)) out.push(f("CON-14", "major", "unnatural_phrasing", [id], "Stock phrasing a viewer swipes past.", "State the fact itself."));
    if (/\b1\s+(?!percent|%)[a-z]+/i.test(text)) out.push(f("CON-16", "minor", "unnatural_phrasing", [id], 'A count of one written as "1": it reads as filler.', "Name the thing instead of counting it."));

    // CON-10 causal words need a causal claim.
    if (CAUSAL_CUE.test(text) && !CAUSAL_CUE.test(claimText(s)) && !s.claim_ids.some((c) => byClaim.get(c)?.editorial_status === "causation")) out.push(f("CON-10", "major", "causal_error", [id], "The sentence asserts a cause that none of its claims states.", "Say only what the claims say, or cite a claim that states the cause."));

    known.push(stems);
    for (const w of stems) heard.add(w);
    for (const n of nums) heard.add(n);
  });

  // CON-06 repetition.
  for (let a = 0; a < S.length; a++) for (let b = a + 1; b < S.length; b++) {
    const o = overlap(S[a].text, S[b].text);
    const loopEcho = a === 0 || /\?\s*$/.test(S[a].text); // a payoff echoing the hook, or an answer echoing a question, is the point and not a repeat
    const sameClaims = S[a].claim_ids.length && S[a].claim_ids.join() === S[b].claim_ids.join() && o.shared >= 3;
    const need = roleOf(S[b]) === "ending" ? 0.85 : 0.7; // an ending may recap the payoff; it may not copy it
    if (!loopEcho && ((Math.min(o.a, o.b) >= 4 && o.shared / Math.min(o.a, o.b) >= need) || (sameClaims && roleOf(S[b]) !== "ending"))) out.push(f("CON-06", "major", "repetition", [S[a].sentence_id, S[b].sentence_id], "These sentences say the same thing.", "Cut one, or make the second add something new."));
  }

  // CON-07 same subject, different figure (heuristic).
  for (let a = 0; a < S.length; a++) for (let b = a + 1; b < S.length; b++) {
    const na = numbers(S[a].text), nb = numbers(S[b].text);
    if (!na.length || !nb.length || na.some((x) => nb.includes(x))) continue;
    const ca = new Set(content(S[a].text.replace(/\d[\d,.]*/g, ""))), cb = new Set(content(S[b].text.replace(/\d[\d,.]*/g, "")));
    const shared = [...ca].filter((w) => cb.has(w)).length;
    const namesDiffer = capitalised(S[a].text).join("|") !== capitalised(S[b].text).join("|");
    if (shared >= 4 && !namesDiffer && !/\b(versus|compared|while|whereas|but|than)\b/i.test(`${S[a].text} ${S[b].text}`)) out.push(f("CON-07", "major", "contradiction", [S[a].sentence_id, S[b].sentence_id], `Same subject, different figures (${na.join(",")} vs ${nb.join(",")}): either a contradiction or an unlabelled comparison. (heuristic)`, "Say what each figure measures."));
  }

  // CON-09 chronology.
  S.forEach((s, i) => {
    if (i === 0) return;
    const d1 = dates(S[i - 1].text), d2 = dates(s.text);
    if (d1.length && d2.length && /\b(after|later|then|next|following|afterwards|since)\b/i.test(`${s.link_from_previous} ${s.text}`) && dateKey(d2[0]) < dateKey(d1.at(-1)) && (d1.at(-1).year ?? 0) === (d2[0].year ?? 0)) out.push(f("CON-09", "major", "chronology", [S[i - 1].sentence_id, s.sentence_id], "The second date is earlier than the first but the narration says it came after.", "Fix the order or the wording."));
  });

  // CON-11 loops: every question is answered; no promise is left hanging.
  S.forEach((s, i) => {
    if (/\?\s*$/.test(s.text)) {
      const rest = S.slice(i + 1, i + 4).filter((x) => !/\?\s*$/.test(x.text));
      const q = contentSet(s.text);
      const answered = rest.some((x) => { const o = overlap(s.text, x.text); return o.shared >= Math.min(2, q.size) || (s.claim_ids.length && x.claim_ids.some((c) => s.claim_ids.includes(c))); });
      const echoesHook = i === S.length - 1 && overlap(S[0].text, s.text).shared >= 3;
      if (!answered && !echoesHook) out.push(f("CON-11", "major", "unresolved_loop", [s.sentence_id], i === S.length - 1 ? "The script ends on a question it never answers." : "A question is asked and the next sentences do not answer it.", "Answer it in the next sentence, or do not ask it."));
    }
    if (PROMISE.test(s.text) && i >= S.length - 2) out.push(f("CON-11", "major", "unresolved_loop", [s.sentence_id], "A promise to come back to something, in the closing sentences.", "Deliver it or remove it."));
  });

  // CON-12 the hook's promise is kept.
  const hook = S[0];
  const rest = S.slice(1);
  const later = rest.map((s) => s.text).join(" ");
  for (const n of hookNums) if (!numbers(later).includes(n)) out.push(f("CON-12", "major", "unfulfilled_hook", [hook.sentence_id], `The hook says ${n} and the rest of the script never returns to it.`, "Deliver that figure in the payoff or take it out of the hook."));
  const payoffText = S.filter((s) => roleOf(s) === "payoff" || roleOf(s) === "ending").map((s) => s.text).join(" ");
  if (payoffText && overlap(`${hook.text} ${pkg.blueprint.central_question}`, payoffText).shared < 2) out.push(f("CON-12", "major", "unfulfilled_hook", [hook.sentence_id], "The payoff shares almost nothing with the hook and the central question: the promise is not delivered.", "Make the payoff answer the hook's question in the hook's terms."));

  return out;
}

const STOPLIKE = (w) => ["is", "was", "are", "were", "has", "have", "will", "can", "may", "means", "makes"].includes(w);

/** Merge, de-duplicate and rank findings. */
export const blocking = (findings) => findings.filter((x) => x.severity === "critical" || x.severity === "major");
export const critical = (findings) => findings.filter((x) => x.severity === "critical");

export async function modelContinuity(ctx, { pkg, claims, channel, known = [] }) {
  const lines = pkg.sentences.map((s) => ({ sentence_id: s.sentence_id, beat: s.beat_id, text: s.text, says_it_follows_because: s.link_from_previous, claims: s.claim_ids.map((c) => claims.find((x) => x.claim_id === c)?.claim).filter(Boolean) }));
  const { value, same_provider } = await ask(ctx, {
    role: "judge", tag: "continuity", maxTokens: 6000, temperature: 0,
    user: prompt("continuity", { channel_name: channel.name, central_question: pkg.blueprint.central_question, hook: pkg.selected_hook, sentences: lines, known: known.length ? known.map((k) => `[${k.sentence_ids.join(",")}] ${k.problem}`).join("\n") : "(none)", categories: CATEGORIES.join(", ") }),
    check: (v) => {
      const p = [];
      if (!Array.isArray(v?.findings)) p.push("findings must be an array");
      const ids = new Set(pkg.sentences.map((s) => s.sentence_id));
      for (const x of v?.findings || []) {
        if (!["critical", "major", "minor"].includes(x.severity)) p.push(`bad severity "${x.severity}"`);
        if (!CATEGORIES.includes(x.category)) p.push(`category "${x.category}" must be one of ${CATEGORIES.join(", ")}`);
        if (!Array.isArray(x.sentence_ids) || x.sentence_ids.some((i) => !ids.has(i))) p.push(`sentence_ids must be real sentence ids (${[...ids].join(",")})`);
      }
      if (typeof v?.understood_when_heard_once !== "boolean") p.push("understood_when_heard_once must be true or false");
      return p;
    },
  });
  const findings = value.findings.map((x) => ({ rule: "CON-MODEL", severity: x.severity, category: x.category, sentence_ids: x.sentence_ids, problem: String(x.problem || ""), fix: String(x.fix || "") }));
  if (value.understood_when_heard_once === false) findings.push(f("CON-MODEL", "major", "missing_context", [], `A listener hearing this once would not follow it: ${(value.confusion || []).slice(0, 3).join("; ") || "no detail given"}.`, "Fix the points listed."));
  return { findings, understood_when_heard_once: value.understood_when_heard_once, same_provider };
}

