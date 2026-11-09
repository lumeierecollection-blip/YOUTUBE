/**
 * Per-channel configuration. Identity comes from config/channel-registry.json (name, editorial line, voice,
 * claim_categories, formats, tts_voice). This file adds only what the registry cannot hold: the editorial
 * RULES each channel's scripts are checked against, as deterministic checks plus guidance for the prompts.
 * A hook score or a critic score never overrides these rules.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./schema.mjs";
import { norm } from "./text.mjs";

export const registry = () => JSON.parse(readFileSync(join(ROOT, "config/channel-registry.json"), "utf8"));
export function channelEntry(key, reg = registry()) {
  const c = reg.channels.find((x) => x.key === key);
  if (!c) throw new Error(`no channel "${key}" in config/channel-registry.json`);
  return c;
}

/** Shorts and long form are separate paths. Long form never inherits Shorts pacing. */
export function formatProfile(format, reg = registry()) {
  if (format === "short") {
    const max = reg.max_shorts_seconds ?? 30;
    return { mode: "short", targetSeconds: max - 3, minSeconds: 18, maxSeconds: max - 1, maxBeats: 5, minBeats: 3, maxSentenceWords: 20, hookMaxWords: 16, maxSentences: 9, watch: true };
  }
  return { mode: "long", targetSeconds: 240, minSeconds: 120, maxSeconds: 900, maxBeats: 14, minBeats: 5, maxSentenceWords: 34, hookMaxWords: 40, maxSentences: 160, watch: false };
}

export const CLICKBAIT = /\b(you won'?t believe|shocking(?:ly)?|mind[- ]?blowing|this changes everything|what (?:they|nobody) (?:don'?t )?want(?:s)? you to know|doctors hate|insane|jaw[- ]dropping|the (?:real )?truth (?:about|behind)|here'?s the (?:thing|kicker|twist)|what if i told you|game[- ]?changer|like and subscribe|smash that|hey guys|welcome (?:back|to)|before we (?:start|begin)|you might be shocked)\b/i;

const has = (re, s) => re.test(s);
const ATTRIB = /\b(according to|said|says|say|claims?|claimed|announced|reported|reports?|states?|stated|described|describes|promises?|promised|argued?|argues|alleged|alleges|accused|charged|denied|told|wrote|published|found|estimates?|estimated|historians?|scholars?|researchers?|critics?|officials?|prosecutors?|government|supporters?|advocates?)\b/i;
const HEDGE = /\b(if|would|could|might|may|imagine|suppose|hypothetical(?:ly)?|what if|suggests?|suggested|believed|thought to|likely|possibly|perhaps|proposed|theor(?:y|ies)|estimated)\b/i;
const MODEL_CUE = /\b(model|models|simulation|simulated|estimate|estimated|calculated|predict(?:s|ed|ion)?|theory|suggests?|inferred|thought|believed|likely|based on)\b/i;
const ESTIMATE_CUE = /\b(estimated?|roughly|about|approximately|around|tracking|from (?:the )?video|model suggests?)\b/i;
const CAUSAL = /\b(causes?|caused|causing|leads? to|led to|triggers?|triggered|makes? (?:your|you|the)|results? in|because of|due to|produces?)\b/i;
const CORR_CUE = /\b(linked|link(?:s|ed)? to|associated|correlat\w+|tends? to|more likely|goes along|goes together|alongside|tied to)\b/i;
const GUILT = /\b(guilty|committed (?:a |the )?(?:fraud|crime|murder|theft|offen[cs]e|assault|abuse|perjury|insider trading)|defrauded|swindled|embezzled|stole|cheated|murdered|abused|fraudster|scammer)\b/i;
const DIAGNOSE = /\b(you (?:have|had|are suffering|suffer from|may have|might have|probably have|likely have|are (?:depressed|anxious|addicted|bipolar|ill))|your (?:disorder|condition|illness)|diagnos\w+|symptoms? of|treat(?:ment)? for|cure[sd]?)\b/i;
const MYSTERY = /\b(shocking secret|hidden truth|they don'?t want you to know|cover[- ]?up they|dark secret|no one can explain|nobody (?:knows|can explain)|unsolved mystery)\b/i;
const GROUP_AS_ONE = /\b(?:the (?:arabs|muslims|jews|russians|americans|chinese|westerners|europeans|africans|palestinians|israelis|iranians|ukrainians|indians|christians)|all (?:arabs|muslims|jews|russians|americans|chinese|palestinians|israelis|iranians|ukrainians)) (?:want|believe|think|hate|support|are|were|did|decided|wanted)\b/i;
const TERM = /(hippocamp\w*|amygdala|cortex|neurons?|synap\w+|dopamine|cortisol|melatonin|consolidation|thalam\w+|serotonin|hormones?|neurotransmitters?|spindles?|REM|prefrontal|slow[- ]wave)/i;
const DEFINES = /(\bis (?:a|an|the)\b|\bare (?:the|a)\b|\bcalled\b|\bknown as\b|\bwhich\b|\bthat (?:helps|stores|controls|handles|turns)\b|,\s*(?:a|an|the)\b|\bmeans\b|\bpart of\b|\bstage\b)/i;

/**
 * Rules are { id, applies(ctx) -> findings }. ctx = { sentences, claimsOf(sentence), claims, blueprint }.
 * A finding is { severity, category, sentence_ids, problem, fix, rule }.
 */
const f = (rule, severity, category, ids, problem, fix) => ({ rule, severity, category, sentence_ids: ids, problem, fix });
const statuses = (claims) => new Set(claims.map((c) => c.editorial_status));

export const CHANNEL_RULES = {
  "ai-tested": {
    guidance: "Demonstrate what the tool actually does, from the sources: inputs, outputs, steps. Report a vendor's performance or benefit statement only as that vendor's claim, attributed by name. Do not repeat announcements as fact. Do not claim you ran or tested the tool unless a source says someone did.",
    terms: [],
    script({ sentences, claimsOf, claims }) {
      const out = [];
      for (const s of sentences) {
        const st = statuses(claimsOf(s));
        if (st.has("marketing_claim") && !st.has("demonstrated_feature") && !has(ATTRIB, s.text)) out.push(f("AIT-1", "major", "misleading_claim", [s.sentence_id], "A marketing claim is stated as fact.", "Attribute it to whoever made it (\"the project says ...\")."));
        if (/\b(i|we) (tested|ran|tried|benchmarked)\b/i.test(s.text) && !claims.some((c) => /\b(tested|ran|benchmark)/i.test(c.claim))) out.push(f("AIT-2", "critical", "unsupported_claim", [s.sentence_id], "The script says a test was run; no claim records one.", "Remove it or describe only what the source documents."));
      }
      if (!claims.some((c) => ["demonstrated_feature", "measured_statistic"].includes(c.editorial_status))) out.push(f("AIT-3", "major", "wrong_channel_tone", [], "No demonstrated feature or measured statistic is available: this would only repeat announcements.", "Research what the feature does, step by step, or skip the topic."));
      else if (!sentences.some((s) => claimsOf(s).some((c) => ["demonstrated_feature", "measured_statistic"].includes(c.editorial_status)))) out.push(f("AIT-3", "major", "wrong_channel_tone", [], "The script never states what the tool does; it only reports claims about it.", "Add a sentence showing the actual behaviour."));
      return out;
    },
  },
  "hidden-past": {
    guidance: "Evidence first. Say what the record shows, then what later writers made of it, and keep the two apart. Never invent mystery where the record is plain; if something is truly unknown, say exactly what is unknown and why.",
    script({ sentences, claimsOf }) {
      const out = [];
      for (const s of sentences) {
        const cs = claimsOf(s);
        if (cs.length && cs.every((c) => c.editorial_status === "later_interpretation") && !has(ATTRIB, s.text) && !has(HEDGE, s.text)) out.push(f("HP-1", "major", "misleading_claim", [s.sentence_id], "A later interpretation is told as established fact.", "Name who proposed it and phrase it as their reading."));
        if (has(MYSTERY, s.text)) out.push(f("HP-2", "major", "wrong_channel_tone", [s.sentence_id], "Manufactured mystery.", "State what the record shows and what it leaves open."));
      }
      return out;
    },
  },
  "red-space-facts": {
    guidance: "Keep four things apart and say which one each sentence is: an observation (measured), a scientific model (calculated or inferred), a hypothetical (if/what-if), artistic interpretation (illustration). Hypotheticals open with their condition.",
    script({ sentences, claimsOf }) {
      const out = [];
      for (const s of sentences) {
        const st = statuses(claimsOf(s));
        if (st.has("hypothetical") && !has(HEDGE, s.text)) out.push(f("RSF-1", "major", "misleading_claim", [s.sentence_id], "A hypothetical is stated as if it happened.", "Open with its condition (\"If ...\", \"Imagine ...\")."));
        if (st.has("scientific_model") && !st.has("observation") && !has(MODEL_CUE, s.text)) out.push(f("RSF-2", "major", "misleading_claim", [s.sentence_id], "A model result is stated as an observation.", "Say it is calculated, modelled or inferred."));
        if (st.has("artistic_interpretation") && !/\b(illustrat|artist|depict|render|concept|image shows)/i.test(s.text)) out.push(f("RSF-3", "major", "visual_mismatch", [s.sentence_id], "Artistic interpretation is not labelled.", "Say it is an artist's illustration."));
      }
      return out;
    },
  },
  "dopamine-loop": {
    guidance: "Give the viewer the feeling first, in the second person and in sensory, concrete terms, before any explanation. Then explain with sourced facts. Never diagnose, never say the viewer has a condition, never give treatment advice.",
    script({ sentences, claimsOf }) {
      const out = [];
      for (const s of sentences) if (has(DIAGNOSE, s.text)) out.push(f("DL-1", "critical", "wrong_channel_tone", [s.sentence_id], "The script diagnoses or gives treatment advice.", "Describe the experience only; do not name a condition the viewer has."));
      const firstFact = sentences.findIndex((s) => claimsOf(s).some((c) => c.editorial_status === "established_fact"));
      const head = sentences.slice(0, Math.max(1, firstFact < 0 ? 1 : firstFact));
      if (sentences.length > 2 && !head.some((s) => /\b(you|your|feel|felt|imagine|picture|remember)\b/i.test(s.text))) out.push(f("DL-2", "major", "wrong_channel_tone", [sentences[0].sentence_id], "The feeling does not come before the explanation.", "Open with the lived sensation, then explain it."));
      return out;
    },
  },
  "gray-matter": {
    guidance: "Define every technical term the first time it is spoken, in a few plain words. Separate correlation from causation: say \"linked to\" for a correlation and use cause words only where a source establishes causation. Name the brain structure the sentence is about.",
    script({ sentences, claimsOf }) {
      const out = [];
      const seen = new Set();
      sentences.forEach((s, i) => {
        const cs = claimsOf(s);
        if (has(CAUSAL, s.text) && !cs.some((c) => c.editorial_status === "causation")) out.push(f("GM-1", "major", "causal_error", [s.sentence_id], "A causal verb is used without a claim that establishes causation.", "Say \"is linked to\" or cite a causation claim."));
        if (cs.some((c) => c.editorial_status === "correlation") && !has(CORR_CUE, s.text)) out.push(f("GM-2", "major", "causal_error", [s.sentence_id], "A correlation is not marked as one.", "Use \"is linked to\" or \"goes along with\"."));
        const t = s.text.match(TERM);
        if (t && !seen.has(t[0].toLowerCase())) {
          seen.add(t[0].toLowerCase());
          const near = `${s.text} ${sentences[i + 1]?.text || ""}`;
          if (!DEFINES.test(near)) out.push(f("GM-3", "major", "unexplained_term", [s.sentence_id], `"${t[0]}" is used without being defined.`, "Define it in a few plain words where it first appears."));
        }
      });
      return out;
    },
  },
  "rival-lines": {
    guidance: "State one thesis and argue it. Keep measured data (counted by the competition or the data provider) apart from estimates (read from video, tracking, or inferred) and label every estimate as one. Serious, never cartoonish.",
    script({ sentences, claimsOf, blueprint }) {
      const out = [];
      for (const s of sentences) if (claimsOf(s).some((c) => c.editorial_status === "estimate_from_video") && !has(ESTIMATE_CUE, s.text)) out.push(f("RL-1", "major", "misleading_claim", [s.sentence_id], "An estimate is stated as a measured fact.", "Say it is an estimate and where it comes from."));
      if (blueprint && (!blueprint.thesis || blueprint.thesis.split(/\s+/).length < 8 || /\?\s*$/.test(blueprint.thesis))) out.push(f("RL-2", "major", "unsupported_conclusion", [], "The thesis is missing or is only a question.", "State a one-sentence argument the script then proves."));
      return out;
    },
  },
  "court-and-spotlight": {
    guidance: "Separate allegation, evidence, statement and outcome, in that vocabulary. An allegation is attributed to whoever made it. Guilt is stated only where a conviction or proven fact is recorded. Always report the outcome, and any denial, alongside the allegation. Nothing about private individuals; nothing speculative stated as fact.",
    script({ sentences, claimsOf }) {
      const out = [];
      for (const s of sentences) {
        const cs = claimsOf(s), st = statuses(cs);
        if ([...st].some((x) => ["allegation", "charge", "disputed_claim", "speculation"].includes(x)) && !has(ATTRIB, s.text)) out.push(f("CS-1", "critical", "misleading_claim", [s.sentence_id], "An allegation, charge or disputed claim is not attributed.", "Say who alleged or charged it (\"prosecutors charged ...\")."));
        if (has(GUILT, s.text) && !["conviction", "proven_fact"].some((x) => st.has(x))) out.push(f("CS-2", "critical", "unsupported_conclusion", [s.sentence_id], "Guilt is implied with no conviction or proven fact behind it.", "Remove it or state the recorded outcome."));
      }
      const used = sentences.flatMap((s) => claimsOf(s));
      if (used.some((c) => ["allegation", "charge"].includes(c.editorial_status)) && !used.some((c) => ["conviction", "proven_fact", "public_statement", "disputed_claim"].includes(c.editorial_status))) out.push(f("CS-3", "major", "unfulfilled_hook", [], "An allegation or charge is reported with no outcome or response.", "Add the recorded outcome or the person's response."));
      return out;
    },
  },
  "world-view": {
    guidance: "Neutral, measured. Where interpretations differ, say whose interpretation each is. Never treat a people, religion, or country's population as one actor; name the government, party, army or official. At most four genuine quotations, each verbatim from a source excerpt and attributed.",
    script({ sentences, claimsOf }) {
      const out = [];
      let quotes = 0;
      for (const s of sentences) {
        const cs = claimsOf(s), st = statuses(cs);
        const contested = ["historical_interpretation", "allegation", "political_claim", "propaganda", "scholarly_disagreement", "speculation", "public_opinion"];
        if ([...st].some((x) => contested.includes(x)) && !has(ATTRIB, s.text)) out.push(f("WV-1", "critical", "misleading_claim", [s.sentence_id], "A contested view is stated as fact.", "Say whose view it is."));
        if (has(GROUP_AS_ONE, s.text)) out.push(f("WV-2", "critical", "misleading_claim", [s.sentence_id], "A group is treated as one political entity.", "Name the government, party or body that acted."));
        quotes += (s.text.match(/"[^"]{3,}"/g) || []).length;
      }
      if (quotes > 4) out.push(f("WV-3", "major", "unnatural_phrasing", [], `${quotes} quotations; the limit is four.`, "Paraphrase all but the strongest four."));
      return out;
    },
  },
};

export function channelConfig(key, format = "short", reg = registry()) {
  const entry = channelEntry(key, reg);
  if (!entry.formats.includes(format) && !(format === "short" && entry.formats.includes("short"))) throw new Error(`${key} does not offer format "${format}" (has ${entry.formats.join(", ")})`);
  const rules = CHANNEL_RULES[key] || { guidance: "", script: () => [] };
  return { key, name: entry.name, entry, editorial: entry.editorial, voice: entry.voice_direction, ttsVoice: entry.tts_voice, categories: entry.claim_categories, guidance: rules.guidance, rules, profile: formatProfile(format, reg), format, uploadStatus: entry.upload.status };
}

export const describeCategory = (c) => ({
  demonstrated_feature: "a source describes concretely what the feature does (inputs, steps, outputs)",
  marketing_claim: "the vendor's or project's own statement of benefit or performance",
  measured_statistic: "a number someone measured or counted, with the source naming who",
  primary_source: "a statement from a document or witness of the time",
  later_interpretation: "what later writers or historians made of the record",
  established_fact: "a fact the sources state without qualification and that is not disputed",
  observation: "something measured or seen directly",
  scientific_model: "a result calculated or inferred from a model, not observed",
  hypothetical: "a what-if",
  artistic_interpretation: "an artist's rendering",
  hypothesis: "a proposed explanation not yet established",
  interpretation: "a reading of experience, not a measured result",
  correlation: "two things found together",
  causation: "a cause established by the source",
  estimate_from_video: "a figure estimated from footage or tracking",
  allegation: "a claim made against someone, not established",
  charge: "a formal charge",
  conviction: "a recorded conviction",
  proven_fact: "a fact established in court or by documents",
  disputed_claim: "a claim the source says is disputed",
  public_statement: "what a person or body said publicly",
  speculation: "a guess",
  award_won: "an award recorded as won",
  nomination: "a nomination recorded",
  historical_interpretation: "a historian's reading",
  political_claim: "a claim made by a political actor",
  propaganda: "material the source identifies as propaganda",
  public_opinion: "a poll or reported opinion",
  documented_policy: "a policy recorded in an official document",
  scholarly_disagreement: "a disagreement between scholars",
}[c] || c);

export const clean = (s) => norm(s);
