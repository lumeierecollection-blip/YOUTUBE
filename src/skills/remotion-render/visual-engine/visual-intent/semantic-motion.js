/**
 * SEMANTIC MOTION — the action comes from the sentence's own verb.
 *
 * "Motion that does not explain the narration" was the complaint, and it was
 * fair: every object entered by fading and scaling regardless of what the line
 * said. Here the verb picks the action, so "deeper" descends, "connected"
 * draws a line, "disappeared" actually disappears, and a quantity counts.
 *
 * The list is deliberately short. Eight actions that each mean something beat
 * fifty that mean nothing, and an action with no cue in the sentence falls to
 * SETTLE rather than to a random pick — a beat with no verb of its own should
 * not be given borrowed motion.
 */

const CUES = [
  ["DESCEND", /\b(deep(er|est)?|down(ward)?|below|beneath|sink|fell|drop|under)\b/i],
  ["COUNT", /\b(\d[\d,]*|percent|%|one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundred|thousand|million|billion)\b/i],
  ["CONNECT", /\b(connect(ed|s)?|network|linked?|between|together|chain|web|relationship)\b/i],
  ["GROW", /\b(grow(s|ing)?|expand(s|ing|ed)?|spread(s|ing)?|rise|rising|increas\w+|more|entire)\b/i],
  ["VANISH", /\b(disappear\w*|vanish\w*|gone|lost|extinct|end(ed|s)?|nothing)\b/i],
  ["SPLIT", /\b(split|divid\w+|separat\w+|broke|break|apart|branch\w*|different)\b/i],
  ["TRANSFORM", /\b(becomes?|turn(s|ed|ing)? into|convert\w*|chang\w+|eat(s|ing)? \w+|feeds? on)\b/i],
  ["REVEAL_IN", /\b(inside|within|hidden|reveal\w*|discover\w*|found|beneath the)\b/i],
];

/** The hero action this sentence asks for. */
export function heroAction(text) {
  for (const [action, re] of CUES) if (re.test(String(text || ""))) return action;
  return "SETTLE";
}

/**
 * The typography action, from the intent. Each is the literal motion its name
 * describes so the movement and the meaning cannot drift apart.
 */
const TYPE_ACTION = {
  CONTRAST: "STRIKE",
  QUANTIFY: "SCALE",
  REVEAL: "REVEAL",
  BUILD: "SLIDE",
  EMPHASIZE: "EXPLODE",
  RESOLVE: "COLLAPSE",
  TRANSFORM: "REPLACE",
  CONNECT: "SLIDE",
  COMPARE: "SPLIT",
  INTRODUCE: "SCALE",
};
export const typographyAction = (intent) => TYPE_ACTION[intent] || "SCALE";

/**
 * How this beat gets on screen. A change of owner is a hard clear — the old
 * focal element must be gone before the new one arrives, which is the whole
 * point of one performer at a time. Staying with the same owner MORPHs.
 */
export function transitionBetween(prevMode, mode, action) {
  if (!prevMode) return "CUT";
  if (prevMode !== mode) return mode === "HERO" ? "MORPH" : "CLEAR";
  return action === "COUNT" ? "MATCH_CUT" : "DISSOLVE";
}
