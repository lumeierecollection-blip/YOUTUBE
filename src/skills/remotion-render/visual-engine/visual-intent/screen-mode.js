/**
 * SCREEN OWNERSHIP — who owns the frame in this beat, the type or the visual.
 *
 * The previous engine gave every beat a display line, a supporting line, a
 * caption AND a stage of objects, all at once. Rendered, that is an animated
 * infographic: four things asking for the eye at the same time, none of them
 * large enough to be the subject. This decides ONE owner per beat and the
 * renderer draws only that.
 *
 *   TYPE  — the words are the picture. Set large enough to fill the frame.
 *   HERO  — one object is the picture, at a size that makes it the subject.
 *
 * WHICH ONE, FROM THE SENTENCE. Concrete things, processes, quantities and
 * relationships are shown; abstractions, contrasts, emphasis and conclusions
 * are said. A sentence naming something this channel can actually draw goes
 * HERO; one whose weight is in a claim goes TYPE.
 *
 * AND THEN ALTERNATION IS ENFORCED. Left to the sentences alone a script that
 * lists five concrete things would give five HERO beats in a row, which is the
 * old problem wearing different clothes. Three of a kind is the ceiling: the
 * fourth flips, whatever the sentence says.
 */

/** Intents whose weight is in the claim, not in a thing that can be drawn. */
const SAYS = new Set(["CONTRAST", "EMPHASIZE", "RESOLVE", "REVEAL"]);
/** Intents that are about a thing, an amount, or a relation between things. */
const SHOWS = new Set(["QUANTIFY", "CONNECT", "BUILD", "COMPARE", "TRANSFORM", "INTRODUCE"]);

const MAX_RUN = 3;

/** Words too weak to be set at 200px. */
const WEAK = new Set(`a an the and or but of to in on at for with from by is are was were be been
  it its this that these those as if then than so not no you your they them their we our us i do
  does did have has had will would can could should may might must about into over under`.split(/\s+/));

/**
 * THE PHRASE A TYPE BEAT SETS, not a single word.
 *
 * One word fills the width and leaves nine-tenths of a 9:16 frame empty, which
 * is why the first render read as a caption in a large size rather than as
 * typography owning the screen. Two or three strong words, stacked, fill it
 * vertically as well. The words are the SENTENCE'S OWN and their order is
 * preserved — this selects, it never writes.
 */
function typePhrase(text, emphasis) {
  const words = String(text || "").split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z0-9$]+|[^A-Za-z0-9%]+$/g, ""))
    .filter(Boolean);
  const strong = words.filter((w) => w.length > 2 && !WEAK.has(w.toLowerCase()));
  if (!strong.length) return emphasis;
  const at = strong.findIndex((w) => w.toUpperCase() === emphasis);
  const from = at > -1 ? Math.max(0, at - 1) : 0;
  return strong.slice(from, from + 3).join(" ").toUpperCase();
}

/**
 * @param {Array} beats   [{ text, intent }]
 * @param {Array} objects the channel's core_objects, so HERO can name a focal asset
 * @returns {Array} [{ screenMode, focalElement }]
 */
export function screenModes(beats, objects) {
  const out = [];
  let run = 0, last = null;

  beats.forEach((b, i) => {
    const intent = b.intent;
    let mode = SAYS.has(intent) ? "TYPE" : SHOWS.has(intent) ? "HERO" : (i % 2 ? "HERO" : "TYPE");

    // A run of three is the most the eye tolerates before the format itself
    // becomes the thing being noticed.
    if (mode === last) run++; else run = 1;
    if (run > MAX_RUN) { mode = mode === "TYPE" ? "HERO" : "TYPE"; run = 1; }
    last = mode;

    out.push({
      screenMode: mode,
      // The focal element is the ONE thing this beat is: a phrase, or an object.
      focalElement: mode === "TYPE" ? typePhrase(b.text, b.emphasis) : objects[i % objects.length],
    });
  });
  return out;
}
