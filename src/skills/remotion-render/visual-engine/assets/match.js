/**
 * SEMANTIC ASSET SELECTION — score on meaning, reject on topic.
 *
 * Section 4.3, in order: extract the intent, score every candidate on concepts,
 * synonyms and visualMeaning weighted by topic, HARD REJECT anything whose
 * incompatibleTopics touch the sentence's topic, and return the best. Below
 * threshold, return nothing so the caller can run the expansion loop — a miss
 * that returns a poor asset is how a document came to mean a cave.
 */
import { visualIntent, subjectCandidates } from "./visual-intent.js";

/** Below this, there is no asset for the sentence and the caller must expand. */
export const MATCH_THRESHOLD = 3.0;

const words = (t) => String(t || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Score one asset against one intent.
 *
 * Weights are ordered by how specific the evidence is. A synonym hit is the
 * strongest signal because a synonym is a name for the same thing; a concept
 * hit is next; visualMeaning is prose and scores least per word because it is
 * the easiest to hit by accident.
 */
function score(asset, intent, sentenceWords) {
  const hits = (list) => list.reduce((n, entry) =>
    n + (words(entry).some((w) => sentenceWords.has(w)) ? 1 : 0), 0);

  let s = 0;
  s += hits(asset.synonyms) * 3.0;
  s += hits(asset.concepts) * 2.0;
  s += words(asset.visualMeaning).filter((w) => w.length > 3 && sentenceWords.has(w)).length * 0.5;
  if (asset.name.split(/\s+/).some((w) => sentenceWords.has(w.toLowerCase()))) s += 2.5;

  /**
   * THE SENTENCE'S LITERAL SUBJECT OUTWEIGHS INCIDENTAL OVERLAP.
   *
   * Measured on the fixture: "They eat chemistry: bacteria turning minerals and
   * sulfur into food, exactly like the vents of the deep ocean" selected the
   * depth scale, because "deep" and "ocean" are in that asset's topics while
   * "bacteria" was only one concept hit. The sentence is about bacteria. An
   * asset that names the subject is answering the sentence; one that shares a
   * few surrounding words is answering the scenery.
   */
  // NAMES AND SYNONYMS ONLY. Concepts are descriptions, and matching inside one
  // is how "life is thriving" selected a spider: one of that spider's concepts
  // is the phrase "cave-adapted life".
  const subj = String(intent.literalSubject || "").toLowerCase();
  if (subj && [asset.name, ...asset.synonyms].some((t) => words(t).includes(subj))) s += 5.0;

  /**
   * A NEGATED SENTENCE WANTS THE ABSENCE, NOT THE THING.
   *
   * "These creatures do not eat sunlight" chose `sunlight`, which with the
   * audio off says the opposite of the sentence. Where the intent reads an
   * absence, an asset that depicts the absence takes precedence over the asset
   * that depicts the thing being denied.
   */
  if (intent.relationship === "absence") {
    const denies = /\b(no|without|absence|lightless|sunless|nothing|sealed|cut off)\b/i
      .test(`${asset.name} ${asset.concepts.join(" ")} ${asset.visualMeaning}`);
    s += denies ? 4.0 : -1.5;
  }

  // Topic agreement is a multiplier, not a bonus: an asset from the right world
  // that shares one word beats an asset from the wrong world that shares three.
  const shared = (asset.compatibleTopics || []).filter((t) => intent.topics.includes(t)).length;
  s *= shared ? 1 + shared * 0.6 : 0.45;

  return s;
}

/** Best asset for one fixed intent. */
function pickBest(intent, sentenceWords, library, opts) {
  const rejected = [];
  let best = null, bestScore = 0;
  for (const asset of library.assets) {
    // HARD REJECT. An asset that would mislead on this topic is not a weak
    // candidate to be outranked; it is not a candidate.
    const clash = (asset.incompatibleTopics || []).filter((t) => intent.topics.includes(t));
    if (clash.length) { rejected.push({ name: asset.name, why: `incompatible with ${clash.join(", ")}` }); continue; }
    if (opts.exclude && opts.exclude.has(asset.name)) continue;
    const sc = score(asset, intent, sentenceWords);
    if (sc > bestScore) { bestScore = sc; best = asset; }
  }
  return { best, bestScore, rejected };
}

/**
 * @returns {{asset, score, intent, rejected}} `asset` is null below threshold.
 */
export function selectAsset(sentence, library, opts = {}) {
  const base = visualIntent(sentence);
  const sentenceWords = new Set(words(sentence));
  /**
   * The subject is chosen by trying the candidates, not guessed once.
   *
   * Grammar alone cannot tell which noun a sentence is about — "the vents of
   * the deep ocean" and "bacteria turning minerals" are both in the same
   * clause. The candidate that turns out to NAME something in the library is
   * the one the sentence can actually be shown as, so each is tried and the
   * best-scoring result wins.
   */
  const candidates = subjectCandidates(sentence);
  const tries = (candidates.length ? candidates : [""]).map((subj) => {
    const intent = { ...base, literalSubject: subj };
    return { intent, ...pickBest(intent, sentenceWords, library, opts) };
  });
  const won = tries.sort((a, b) => b.bestScore - a.bestScore)[0];
  const { intent, best, bestScore, rejected } = won;
  return {
    asset: bestScore >= MATCH_THRESHOLD ? best : null,
    runnerUp: best,
    score: Number(bestScore.toFixed(2)),
    threshold: MATCH_THRESHOLD,
    intent,
    rejectedCount: rejected.length,
    rejected: rejected.slice(0, 5),
  };
}
