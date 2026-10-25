/**
 * video-tone — ONE decision per video: what is the viewer meant to FEEL, and what does that forbid.
 *
 * Owner, 2026-10-15, on the ch-2 video (an ICE agent charged with felony assault): "the voiceover sounds too playful. He doesn't sound
 * like he's talking about a serious issue ... the sound is too playful as well ... check the vibe of the video: what is the emotion
 * you are trying to engage the viewer into feeling?" Before this, channels.json carried a `tone` string that only the script writer
 * read; the voice style was one global "warm, engaged and conversational" note, the SFX palette was chosen by composition alone, and
 * the kalimba bed played under every video.
 *
 * The rule is asymmetric on purpose: the STORY can make a video graver than its channel's tone, never lighter. A channel that is
 * "playful-educational" gets a playful read only when the subject is not violence, crime, death or loss. The lexicon below reads the
 * script's own words, so no model has to remember to ask.
 *
 *   grave     violence, death, abuse, war: low and steady voice, no sound effects, no music bed
 *   serious   crime, charges, fraud, collapse: firm voice, a few quiet effects, no music bed
 *   measured  the default: the existing documentary read, effects and bed unchanged
 *   light     a channel that asked for it, on a subject with nothing grave in it
 *
 * Where it stops: this is a word-list reading of the script, not an understanding of it. A grave story told in words that are not in
 * the list reads as measured; a light story that happens to use a listed word reads graver than it is. Both errors are in the safe
 * direction for the first case and the cautious one for the second.
 */
const GRAVE = /\b(assault(?:ed|s)?|kill(?:ed|ing|s)?|murder(?:ed|s)?|death|dead|died|dies|fatal(?:ly)?|shoot(?:ing|ings)?|shot|rape[ds]?|abus(?:e|ed|ive)|victims?|violen(?:ce|t)|attack(?:ed|s)?|war|terror(?:ism|ist)?|kidnap(?:ped|ping)?|massacre|genocide|wrongful(?:ly)?|exoneree?|torture[d]?|lynch(?:ed|ing)?|cold case|missing person|disappear(?:ed|ance))\b/gi;
const SERIOUS = /\b(charg(?:e|es|ed)|felony|misdemeanor|indict(?:ed|ment)?|convict(?:ed|ion)|sentenc(?:e|ed|ing)|prison|jail|arrest(?:ed|s)?|lawsuit|sued?|fraud(?:ulent)?|scam|hack(?:ed|ers?|ing)?|breach(?:ed)?|stolen|theft|launder(?:ing|ed)|sanction(?:s|ed)?|bankrupt(?:cy)?|collaps(?:e|ed)|crisis|investigat(?:ion|ed|ors?)|court|illegal(?:ly)?|crime[s]?|criminal|recession|layoffs?|ban(?:ned)?|embezzl\w*|bribe\w*|misconduct|resign(?:ed|ation)?|scandal)\b/gi;
const LIGHT_CHANNEL = /(playful|casual|friendly|gentle|upbeat|fun|whimsical|cheerful)/i;

// ONE SHORT LINE each. These are sent to the speech model ahead of the script; a long, content-like note (the first version was ~55 words) was sometimes READ ALOUD
// before the script (board 38777811983 ch-26: 20 s of speech ahead of the first sentence). A short "Say in ...:" is the form the model treats as a direction.
const DELIVERY = {
  grave: (accent) => `Say in a low, steady, serious news voice${accent}:`,
  serious: (accent) => `Say in a firm, composed news voice${accent}:`,
};

const EMOTION = {
  grave: "sober concern: the viewer should feel the weight of what happened, not be entertained by it",
  serious: "focused seriousness: the viewer should trust the account and take the stakes seriously",
  measured: "composed interest: the viewer should feel informed and curious",
  light: "warm curiosity: the viewer should feel invited in",
};

const count = (re, text) => (String(text).match(re) || []).length;

/**
 * @param {{ text?: string, channelTone?: string }} input  text = the script's voiceover (all of it)
 * @returns {{ gravity: "grave"|"serious"|"measured"|"light", emotion: string, hits: string[],
 *             sfx: { max: number, deny: string[] }, music: boolean, edge: { rate: string|null, pitch: string|null } }}
 */
export function toneOf({ text = "", channelTone = "" } = {}) {
  const graveHits = [...new Set((String(text).match(GRAVE) || []).map((s) => s.toLowerCase()))];
  const seriousHits = [...new Set((String(text).match(SERIOUS) || []).map((s) => s.toLowerCase()))];
  let gravity;
  if (graveHits.length) gravity = "grave";
  else if (seriousHits.length) gravity = "serious";
  else if (LIGHT_CHANNEL.test(String(channelTone))) gravity = "light";
  else gravity = "measured";
  const sfx = gravity === "grave" ? { max: 0, deny: ["whoosh", "whip", "shutter", "swish", "switch"] }
    : gravity === "serious" ? { max: 3, deny: ["whip", "swish"] }
    : { max: Infinity, deny: [] };
  const edge = gravity === "grave" ? { rate: "-4%", pitch: "-3Hz" } : gravity === "serious" ? { rate: "-2%", pitch: "-2Hz" } : { rate: null, pitch: null };
  return { gravity, emotion: EMOTION[gravity], hits: [...graveHits, ...seriousHits], sfx, music: gravity === "measured" || gravity === "light", edge };
}

/** The Gemini TTS style note for a tone, or null when the tone keeps the global documentary read (gemini-voice.js). */
export function deliveryFor(gravity, { british = false } = {}) {
  const f = DELIVERY[gravity];
  return f ? f(british ? ", in a natural British English accent" : "") : null;
}

export const _lexicon = { GRAVE, SERIOUS, count };
