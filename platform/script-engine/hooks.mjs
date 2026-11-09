/**
 * Hook selection. Method taken from Jakeschincariol/youtube-agent-skill (yt-script: write several hooks against named
 * formulas, score them, keep the best; the score is weakest-link weighted) and from the WATCH framework's "W".
 * Two things the source tools do not do, and this does:
 *  - a hook is only a candidate if it is HONEST: every figure and name in it is in the claims, it promises
 *    nothing the payoff does not deliver, and it uses no clickbait;
 *  - the score only ranks honest candidates. It never overrides accuracy or channel identity.
 * The score is a port of hookscore.py's five properties (its own docstring says a high score is no promise).
 */
import { CLICKBAIT } from "./channels.mjs";
import { capitalised, contains, numberWords, numbers, overlap, words } from "./text.mjs";

export const FORMULAS = ["the-statistic", "someone-elses-result", "the-mistake", "contrarian-flip", "the-reveal", "the-superlative", "the-clock", "i-tried-it", "the-question", "the-before-after", "the-teardown", "the-stack", "the-warning", "the-list", "the-receipt", "the-insider", "the-impossible", "the-comparison", "the-origin", "the-deadline", "the-direct-address"];

const FILLER = new Set("basically actually literally just really very so kind sort like guys hey welcome today video subscribe channel".split(" "));
const VAGUE = new Set("amazing incredible insane crazy huge massive game changer secret powerful ultimate best revolutionary mind blowing unbelievable".split(" "));
const CONCRETE = /(\d[\d,.]*\s?(%|k|m|x|percent)?|\$\d)/gi;
const YOU = /\b(you|your|you're|yourself)\b/i;
const STAKE = /\b(lose|lost|wasting|waste|quit|fail|broke|cost|risk|before|stop|never|die|dying|dead)\b/gi;
const CURIOSITY = /\b(why|how|what|which|until|before|but|nobody|almost|except|reason)\b/gi;
const clamp = (n) => Math.max(0, Math.min(100, n));

export function hookScore(text) {
  const w = words(text).map((x) => x.toLowerCase().replace(/[^a-z0-9'%$.]/g, ""));
  if (!w.length) return { total: 0, parts: {} };
  const nums = (text.match(CONCRETE) || []).length;
  const vague = w.filter((x) => VAGUE.has(x)).length, filler = w.filter((x) => FILLER.has(x)).length;
  const caps = words(text).slice(1).filter((x) => /^[A-Z]/.test(x)).length;
  const specificity = clamp(34 + nums * 22 - vague * 16 - filler * 5 + Math.min(18, 6 * caps));
  const address = clamp(26 + (text.match(new RegExp(YOU.source, "gi")) || []).length * 20 + (YOU.test(words(text).slice(0, 6).join(" ")) ? 30 : 0));
  const stakes = clamp(22 + (text.match(STAKE) || []).length * 26 + (/d/.test(text) ? 14 : 0));
  const curiosity = clamp(24 + (text.match(CURIOSITY) || []).length * 17 + (/\?\s*$/.test(text.trim()) ? 18 : 0) - (/\b(because|so that|which means)\b/i.test(text) ? 18 : 0));
  const n = w.length;
  const brevity = n >= 9 && n <= 24 ? 100 : n < 9 ? Math.max(30, 100 - (9 - n) * 11) : Math.max(10, 100 - (n - 24) * 7);
  const parts = { specificity, address, stakes, curiosity, brevity };
  const vals = Object.values(parts);
  return { total: Math.round(0.6 * (vals.reduce((a, b) => a + b, 0) / vals.length) + 0.4 * Math.min(...vals)), parts };
}

/** Reasons a hook is not honest. Empty array means it may be chosen. */
export function hookDishonesty(hook, { claims, payoff, central_question, profile }) {
  const why = [];
  const text = hook.text;
  if (CLICKBAIT.test(text)) why.push("uses clickbait phrasing");
  const claimText = claims.map((c) => `${c.claim} ${c.excerpt}`).join(" ");
  const claimNums = new Set([...numbers(claimText), ...numberWords(claimText)]);
  for (const n of [...numbers(text), ...numberWords(text)]) if (!claimNums.has(n)) why.push(`the figure ${n} is in no claim`);
  for (const name of capitalised(text)) if (!contains(claimText, name) && !contains(central_question || "", name)) why.push(`the name "${name}" is in no claim`);
  if (profile && words(text).length > profile.hookMaxWords) why.push(`over ${profile.hookMaxWords} words; it cannot land in the first seconds`);
  // The promise must be delivered: the hook's content words must recur in the payoff or the central question.
  const delivered = overlap(text, `${payoff || ""} ${central_question || ""}`);
  if (delivered.shared < Math.min(2, Math.max(1, Math.floor(delivered.a / 3)))) why.push("the payoff does not deliver what the hook promises");
  if (hook.honest === false) why.push("the writer itself marked it as not honest");
  return why;
}

export function chooseHook(options, ctx) {
  const scored = options.map((h) => {
    const why = hookDishonesty(h, ctx);
    return { ...h, honest: why.length === 0, dishonest_reasons: why, score: hookScore(h.text).total };
  });
  const honest = scored.filter((h) => h.honest && !(ctx.reject && ctx.reject(h)));
  if (!honest.length) return { options: scored, selected: null };
  honest.sort((a, b) => b.score - a.score);
  return { options: scored, selected: honest[0] };
}

