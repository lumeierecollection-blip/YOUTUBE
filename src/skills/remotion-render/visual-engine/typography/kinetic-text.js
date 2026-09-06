/**
 * THE KINETIC LAYER — the display line, which is not the caption.
 *
 * Section 2.2 asks for two text layers and the old renderer had one. The
 * caption carries the spoken words verbatim and sits still; this layer carries
 * the IDEA, changes every beat, and animates. Keeping them separate is what
 * stops the picture reciting the narration: the caption already says the
 * sentence, so this layer says the word the sentence turns on.
 *
 * Rule 4 of Section 3.5 — typography flows logically — is why `previous` is
 * threaded through. A line whose word is unchanged from the beat before does
 * not re-enter; it holds and the next change is a REPLACE rather than a second
 * APPEAR of the same thing.
 *
 * THE WORDS ARE THE SENTENCE'S OWN. The emphasis word is picked out of the
 * beat text and the secondary line is a clause of it. Nothing is written here.
 */

/** Section 2.2's nine actions. */
export const ACTIONS = [
  "APPEAR", "SLIDE_IN", "REPLACE", "STRIKE_THROUGH", "EXPLODE",
  "REVEAL", "SCALE", "EMPHASIZE", "FADE_TRANSFORM",
];

/**
 * Which action an intent asks for. A contrast strikes the old word out before
 * the new one lands; a reveal writes itself; a quantity scales. These are the
 * literal reading of each intent, so the motion and the meaning cannot drift.
 */
const ACTION_FOR = {
  INTRODUCE: "APPEAR",
  BUILD: "SLIDE_IN",
  CONNECT: "FADE_TRANSFORM",
  CONTRAST: "STRIKE_THROUGH",
  COMPARE: "SLIDE_IN",
  QUANTIFY: "SCALE",
  REVEAL: "REVEAL",
  EMPHASIZE: "EMPHASIZE",
  TRANSFORM: "REPLACE",
  RESOLVE: "SCALE",
};

/** A short supporting clause from the sentence, never more than five words. */
function secondary(text, emphasis) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const at = words.findIndex((w) => w.toUpperCase().replace(/[^A-Z0-9$%]/g, "") === emphasis);
  const from = at > -1 ? Math.max(0, at - 2) : 0;
  return words.slice(from, from + 5).join(" ").replace(/[,.;:]$/, "");
}

export function kineticFor({ intent, emphasis, text, previous }) {
  const same = previous && previous.primary_text === emphasis;
  return {
    primary_text: emphasis,
    secondary_text: secondary(text, emphasis),
    primary_emphasis: emphasis,
    // Rule 4: an unchanged word holds rather than re-entering.
    action: same ? "EMPHASIZE" : (ACTION_FOR[intent] || "APPEAR"),
    replaces: previous && !same ? previous.primary_text : null,
  };
}
