/**
 * VISUAL TREATMENTS — semantic mechanisms, not UI components.
 *
 * Each treatment communicates a specific kind of meaning. The Visual Director
 * selects one per beat based on what the sentence SAYS, not on what assets
 * exist or where the beat falls in the sequence. The test for every treatment:
 *
 *   "If the audio were muted, can I understand what this scene is communicating?"
 *
 * If removing the visual would communicate exactly the same thing, the visual
 * should not exist. That is why STATEMENT (typography-only) is a treatment
 * too — some sentences ARE best communicated as words.
 */

export const TREATMENTS = {
  EROSION: {
    id: "EROSION",
    communicates: "Something progressively loses value, size, or strength",
    typography_role: "caption",
  },
  GROWTH: {
    id: "GROWTH",
    communicates: "Something progressively increases in value, size, or strength",
    typography_role: "caption",
  },
  DEPLETION: {
    id: "DEPLETION",
    communicates: "A finite quantity is being consumed or exhausted",
    typography_role: "caption",
  },
  PROPORTION: {
    id: "PROPORTION",
    communicates: "Two quantities in a measurable relationship",
    typography_role: "label",
  },
  VERSUS: {
    id: "VERSUS",
    communicates: "Two concepts or things in opposition or contrast",
    typography_role: "label",
  },
  CAUSE_EFFECT: {
    id: "CAUSE_EFFECT",
    communicates: "One thing leads to or produces another",
    typography_role: "label",
  },
  QUANTITY: {
    id: "QUANTITY",
    communicates: "A specific number is the point — it IS the information",
    typography_role: "context",
  },
  CHANGE: {
    id: "CHANGE",
    communicates: "A value moves from one state to another",
    typography_role: "label",
  },
  SEQUENCE: {
    id: "SEQUENCE",
    communicates: "Ordered steps or a progression of events",
    typography_role: "label",
  },
  REVEAL: {
    id: "REVEAL",
    communicates: "Hidden or surprising information is being uncovered",
    typography_role: "secondary",
  },
  CONSTRAINT: {
    id: "CONSTRAINT",
    communicates: "Something is limited, capped, or blocked",
    typography_role: "caption",
  },
  TRADEOFF: {
    id: "TRADEOFF",
    communicates: "Gaining one thing requires sacrificing another",
    typography_role: "label",
  },
  STATEMENT: {
    id: "STATEMENT",
    communicates: "The words themselves are the visual — a claim, emphasis, or conclusion",
    typography_role: "primary",
  },
};

/**
 * Detection rules, ordered from most specific to least.
 *
 * Each rule tests the sentence's own text and extracted features.
 * The first match wins. A sentence that matches nothing gets STATEMENT,
 * because a sentence with no visual mechanism to show is best shown as
 * words — not as a random icon.
 */
export const DETECTION_RULES = [
  {
    treatment: "QUANTITY",
    test: (a) => a.hasExplicitNumber && a.numberIsSubject,
    reason: (a) => `the sentence states "${a.number}" as its central claim`,
  },
  {
    treatment: "PROPORTION",
    test: (a) => a.hasExplicitNumber && a.hasComparison,
    reason: (a) => `the sentence compares quantities: ${a.comparedTerms.join(" vs ")}`,
  },
  {
    treatment: "CHANGE",
    test: (a) => a.hasExplicitNumber && a.hasTransformation,
    reason: (a) => `the sentence describes a change: ${a.changeDescription}`,
  },
  {
    treatment: "EROSION",
    test: (a) => a.hasErosion,
    reason: (a) => `"${a.erosionVerb}" describes progressive loss of ${a.erosionSubject}`,
  },
  {
    treatment: "GROWTH",
    test: (a) => a.hasGrowth,
    reason: (a) => `"${a.growthVerb}" describes progressive increase in ${a.growthSubject}`,
  },
  {
    treatment: "DEPLETION",
    test: (a) => a.hasDepletion,
    reason: (a) => `"${a.depletionVerb}" describes ${a.depletionSubject} being consumed`,
  },
  {
    treatment: "TRADEOFF",
    test: (a) => a.hasTradeoff,
    reason: (a) => `the sentence describes a tradeoff: ${a.tradeoffDescription}`,
  },
  {
    treatment: "CONSTRAINT",
    test: (a) => a.hasConstraint,
    reason: (a) => `"${a.constraintVerb}" describes a limitation on ${a.constraintSubject}`,
  },
  {
    treatment: "VERSUS",
    test: (a) => a.contrastA && a.contrastB && !a.hasExplicitNumber,
    reason: (a) => `the sentence contrasts "${a.contrastA}" with "${a.contrastB}"`,
  },
  {
    treatment: "CAUSE_EFFECT",
    test: (a) => a.hasCausation,
    reason: (a) => `"${a.causalWord}" connects cause to effect: ${a.causeDescription}`,
  },
  {
    treatment: "SEQUENCE",
    test: (a) => a.hasSequence,
    reason: (a) => `ordinal/sequence language: "${a.sequenceWord}"`,
  },
  {
    treatment: "REVEAL",
    test: (a) => a.hasReveal,
    reason: (a) => `"${a.revealWord}" signals new information being uncovered`,
  },
  {
    treatment: "STATEMENT",
    test: () => true,
    reason: (a) => a.statementReason || "no visual mechanism — the words are the visual",
  },
];
