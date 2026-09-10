/**
 * VISUAL DIRECTOR — semantic decision engine.
 *
 * Reads the MEANING of each sentence and selects a visual treatment that
 * communicates that meaning. The treatment is chosen for what the sentence
 * SAYS, not for what assets exist, what beat position it occupies, or what
 * the previous beat showed.
 *
 * The test: "If the audio were muted, can I understand what this scene
 * is communicating?"
 *
 * Every beat carries a `reason` field that answers: "Why was THIS visual
 * treatment selected for THIS sentence?"
 */

import { DETECTION_RULES, TREATMENTS } from "./treatments.js";

const STOP = new Set(`a an the and or but of to in on at for with from by is are was were be been being
  it its this that these those as if then than so not no you your they them their he she his her we our us i
  do does did done have has had will would can could should may might must about into over under after before
  just only very more most much many some any all every each other another such same own here there when where
  how what which who whom whose why now then still yet also too even ever never always often`.split(/\s+/));

const contentWords = (text) =>
  String(text || "").toLowerCase().split(/[^a-z0-9.%$]+/).filter((w) => w.length > 2 && !STOP.has(w));

/**
 * Extract a number from text. Returns { raw, value, unit, isSubject } or null.
 * "isSubject" means the number is the central claim, not incidental context.
 */
function extractNumber(text) {
  const t = String(text || "");
  // Explicit digits with optional unit
  const digitMatch = /\b(\$?\d[\d,.]*)\s*(%|percent|billion|million|thousand|dollars|cents|times|x)?\b/i.exec(t);
  if (digitMatch) {
    const raw = digitMatch[1].replace(/,/g, "");
    const value = parseFloat(raw.replace(/^\$/, ""));
    const unit = digitMatch[2] || "";
    // Bare 4-digit years (1900–2099) are not quantities — they're dates.
    if (!unit && value >= 1900 && value <= 2099 && /\b\d{4}\b/.test(raw)) return null;
    const pos = digitMatch.index / t.length;
    const words = t.split(/\s+/).length;
    const isSubject = pos < 0.4 || words <= 8;
    return { raw: digitMatch[0].trim(), value, unit, isSubject };
  }
  return null;
}

/**
 * Extract what two things are being compared, if any.
 */
function extractComparison(text) {
  const t = String(text || "");
  const patterns = [
    /\b(.{3,30}?)\s+(?:versus|vs\.?|compared (?:to|with))\s+(.{3,30})\b/i,
    /\b(.{3,30}?)\s+(?:while|but|whereas|unlike)\s+(.{3,30})\b/i,
    /\b(.{3,30}?)\s+(?:more|less|higher|lower|faster|slower|bigger|smaller)\s+than\s+(.{3,30})\b/i,
  ];
  for (const re of patterns) {
    const m = re.exec(t);
    if (m) return [m[1].trim(), m[2].trim()];
  }
  return null;
}

/**
 * Extract contrast sides (for VERSUS treatment).
 */
function extractContrast(text) {
  const t = String(text || "");
  const m = /\b(.{3,40}?)\s+(?:but|however|instead|not|unlike|whereas|yet)\s+(.{3,40})\b/i.exec(t);
  if (m) return { a: m[1].trim(), b: m[2].trim() };
  return null;
}

/** Regex matchers for semantic features. */
const EROSION_RE = /\b(erodes?|destroys?|diminish\w*|shrink\w*|declin\w*|deteriorat\w*|weaken\w*|loses?\s+(?:value|power|strength|ground)|eats?\s+(?:away|into))\b/i;
const GROWTH_RE = /\b(surge[ds]?|increas\w+|grow[sn]?|ris(?:e[sd]?|ing)|expand\w*|balloon\w*|spike[ds]?|jump\w*|soar\w*|climb\w*|double[ds]?|triple[ds]?)\b/i;
const DEPLETION_RE = /\b(deplet\w*|exhaust\w*|drain\w*|run(?:s|ning)?\s+out|consum\w*|empty|empties|dried?\s+up|gone)\b/i;
const CAUSAL_RE = /\b(because|therefore|so\s+that|which\s+means|leads?\s+to|caus(?:e[sd]?|ing)|result(?:s|ing)?\s+in|due\s+to|driving|driven\s+by|forcing)\b/i;
const CONTRAST_RE = /\b(but|however|instead|not|unlike|whereas|yet|despite|although|while\b.{0,20}\b(?:actually|really))\b/i;
const SEQUENCE_RE = /\b(first(?:ly)?|second(?:ly)?|third(?:ly)?|then|next|finally|step\s+\d|stage\s+\d|phase\s+\d)\b/i;
const REVEAL_RE = /\b(actually|in\s+fact|turns?\s+out|discover\w*|hidden|secret|reveal\w*|the\s+(?:truth|reality|real\s+(?:number|story)))\b/i;
const CONSTRAINT_RE = /\b(can(?:no|'?)t|limit\w*|cap(?:ped|s)?|maximum|ceiling|block\w*|prevent\w*|restrict\w*|stuck|trapped|frozen)\b/i;
const TRADEOFF_RE = /\b(sacrifice\w*|at\s+the\s+(?:cost|expense)\s+of|trade(?:-|\s*)off|exchange|give\s+up|in\s+(?:exchange|return)\s+for)\b/i;
const TRANSFORM_RE = /\b(becomes?|turn(?:s|ed|ing)?\s+into|chang(?:e[ds]?|ing)\s+(?:to|from)|convert\w*|went\s+from|shift\w+\s+(?:from|to))\b/i;

const EMPHASIS_RE = /\b(the\s+(?:key|point|bottom\s+line|takeaway|real\s+(?:problem|issue|question))|this\s+(?:is|means)|remember|never\s+forget|most\s+important(?:ly)?)\b/i;
const OPENING_RE = /\b(think\s+.{0,15}\??|did\s+you\s+know|imagine|picture\s+this|here'?s?\s+(?:the|what))\b/i;

/**
 * The first non-stop word of sufficient length, as a subject proxy.
 */
function primarySubject(text) {
  const words = contentWords(text);
  return words[0] || "";
}

/**
 * Analyze a single sentence and produce a feature bag for treatment detection.
 */
export function analyzeSentence(text) {
  const t = String(text || "");
  const num = extractNumber(t);
  const comp = extractComparison(t);
  const contrast = extractContrast(t);
  const subject = primarySubject(t);

  const erosionMatch = EROSION_RE.exec(t);
  const growthMatch = GROWTH_RE.exec(t);
  const depletionMatch = DEPLETION_RE.exec(t);
  const causalMatch = CAUSAL_RE.exec(t);
  const sequenceMatch = SEQUENCE_RE.exec(t);
  const revealMatch = REVEAL_RE.exec(t);
  const constraintMatch = CONSTRAINT_RE.exec(t);
  const tradeoffMatch = TRADEOFF_RE.exec(t);
  const transformMatch = TRANSFORM_RE.exec(t);

  // STATEMENT sub-reasons
  let statementReason = "no visual mechanism — the words are the visual";
  if (EMPHASIS_RE.test(t)) statementReason = "emphasis/conclusion — typography communicates the weight";
  else if (OPENING_RE.test(t)) statementReason = "opening/hook — the question itself is the visual";

  return {
    text: t,
    subject,
    contentWords: contentWords(t),

    hasExplicitNumber: !!num,
    number: num ? num.raw : null,
    numberValue: num ? num.value : null,
    numberUnit: num ? num.unit : "",
    numberIsSubject: num ? num.isSubject : false,

    hasComparison: !!comp,
    comparedTerms: comp || [],
    hasTransformation: !!transformMatch,
    changeDescription: transformMatch ? t.slice(Math.max(0, transformMatch.index - 20), transformMatch.index + transformMatch[0].length + 20).trim() : "",

    hasErosion: !!erosionMatch,
    erosionVerb: erosionMatch ? erosionMatch[1] : "",
    erosionSubject: erosionMatch ? subject : "",

    hasGrowth: !!growthMatch,
    growthVerb: growthMatch ? growthMatch[1] : "",
    growthSubject: growthMatch ? subject : "",

    hasDepletion: !!depletionMatch,
    depletionVerb: depletionMatch ? depletionMatch[1] : "",
    depletionSubject: depletionMatch ? subject : "",

    hasCausation: !!causalMatch,
    causalWord: causalMatch ? causalMatch[1] : "",
    causeDescription: causalMatch ? t.slice(Math.max(0, causalMatch.index - 15), causalMatch.index + causalMatch[0].length + 30).trim() : "",

    hasContrast: !!contrast || CONTRAST_RE.test(t),
    contrastA: contrast ? contrast.a : "",
    contrastB: contrast ? contrast.b : "",

    hasSequence: !!sequenceMatch,
    sequenceWord: sequenceMatch ? sequenceMatch[1] : "",

    hasReveal: !!revealMatch,
    revealWord: revealMatch ? revealMatch[1] : "",

    hasConstraint: !!constraintMatch,
    constraintVerb: constraintMatch ? constraintMatch[1] : "",
    constraintSubject: constraintMatch ? subject : "",

    hasTradeoff: !!tradeoffMatch,
    tradeoffDescription: tradeoffMatch ? t.slice(Math.max(0, tradeoffMatch.index - 15), tradeoffMatch.index + tradeoffMatch[0].length + 30).trim() : "",

    statementReason,
  };
}

/**
 * Select a treatment for one sentence.
 * Returns { treatment, reason, analysis }.
 */
function selectTreatment(analysis) {
  for (const rule of DETECTION_RULES) {
    if (rule.test(analysis)) {
      return {
        treatment: rule.treatment,
        reason: rule.reason(analysis),
      };
    }
  }
  return { treatment: "STATEMENT", reason: "fallback — no mechanism detected" };
}

/**
 * Build treatment-specific element data for the renderer.
 */
function buildElements(treatment, analysis) {
  switch (treatment) {
    case "QUANTITY":
      return {
        type: "quantity",
        number: analysis.numberValue,
        raw: analysis.number,
        unit: analysis.numberUnit,
        context: analysis.subject,
      };
    case "PROPORTION":
      return {
        type: "proportion",
        left: { label: analysis.comparedTerms[0] || "", scale: 1 },
        right: { label: analysis.comparedTerms[1] || "", scale: 0.6 },
        number: analysis.number,
      };
    case "CHANGE":
      return {
        type: "change",
        description: analysis.changeDescription,
        number: analysis.number,
        direction: analysis.hasGrowth ? "up" : "down",
      };
    case "EROSION":
      return {
        type: "erosion",
        subject: analysis.erosionSubject || analysis.subject,
        verb: analysis.erosionVerb,
      };
    case "GROWTH":
      return {
        type: "growth",
        subject: analysis.growthSubject || analysis.subject,
        verb: analysis.growthVerb,
        number: analysis.number,
      };
    case "DEPLETION":
      return {
        type: "depletion",
        subject: analysis.depletionSubject || analysis.subject,
        verb: analysis.depletionVerb,
      };
    case "VERSUS":
      return {
        type: "versus",
        left: analysis.contrastA || analysis.comparedTerms?.[0] || "",
        right: analysis.contrastB || analysis.comparedTerms?.[1] || "",
      };
    case "CAUSE_EFFECT":
      return {
        type: "cause_effect",
        causal_word: analysis.causalWord,
        description: analysis.causeDescription,
        subject: analysis.subject,
      };
    case "SEQUENCE":
      return {
        type: "sequence",
        ordinal: analysis.sequenceWord,
        subject: analysis.subject,
      };
    case "REVEAL":
      return {
        type: "reveal",
        trigger: analysis.revealWord,
        subject: analysis.subject,
      };
    case "CONSTRAINT":
      return {
        type: "constraint",
        verb: analysis.constraintVerb,
        subject: analysis.constraintSubject || analysis.subject,
      };
    case "TRADEOFF":
      return {
        type: "tradeoff",
        description: analysis.tradeoffDescription,
        subject: analysis.subject,
      };
    case "STATEMENT":
    default:
      return {
        type: "statement",
        emphasis: emphasisPhrase(analysis.text),
        reason: analysis.statementReason,
      };
  }
}

/**
 * The 2-3 word phrase this sentence turns on, for STATEMENT treatment.
 */
function emphasisPhrase(text) {
  const words = String(text || "").split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z0-9$]+|[^A-Za-z0-9%]+$/g, ""))
    .filter(Boolean);
  const strong = words.filter((w) => w.length > 3 && !STOP.has(w.toLowerCase()));
  if (!strong.length) return words.slice(0, 3).join(" ").toUpperCase();
  return strong.slice(0, 3).join(" ").toUpperCase();
}

/**
 * Word timings — distributes words across the cue duration.
 * Kept from sentence-beats.js: word timing is a rendering concern, not a
 * semantic one, so it belongs in the director's output.
 */
function wordTimings(text, durationFrames) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const weights = words.map((w) =>
    w.replace(/[^A-Za-z0-9]/g, "").length + 2 + (/[,:;.!?]$/.test(w) ? 4 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return words.map((w, i) => {
    const at = acc / total;
    acc += weights[i];
    return { word: w, at, frame: Math.round(at * durationFrames) };
  });
}

/**
 * THE VISUAL DIRECTOR.
 *
 * Takes SRT cues and produces a directed plan. Each beat carries:
 *   - treatment:    which visual mechanism to render
 *   - reason:       WHY this treatment was selected for THIS sentence
 *   - visual_goal:  what the viewer should understand with audio muted
 *   - elements:     treatment-specific data for the renderer
 *   - words:        word timings for captioning
 *
 * @param {Array} cues [{ startFrame, durationInFrames, text }]
 * @returns {{ beats: Array, warnings: string[] }}
 */
export function direct(cues) {
  const beats = [];
  const warnings = [];

  cues.forEach((cue, i) => {
    const text = (cue.text || "").trim();
    if (!text) return;

    const analysis = analyzeSentence(text);
    const { treatment, reason } = selectTreatment(analysis);
    const elements = buildElements(treatment, analysis);
    const treatmentDef = TREATMENTS[treatment] || TREATMENTS.STATEMENT;

    beats.push({
      beat_id: `d${i}`,
      start_frame: cue.startFrame,
      duration_frames: cue.durationInFrames,
      text,
      treatment,
      reason,
      visual_goal: treatmentDef.communicates,
      typography_role: treatmentDef.typography_role,
      elements,
      words: wordTimings(text, cue.durationInFrames),
      transition_in: i === 0 ? "CUT" : "DISSOLVE",
    });
  });

  // Log treatment distribution for diagnostics
  const dist = {};
  for (const b of beats) dist[b.treatment] = (dist[b.treatment] || 0) + 1;
  const total = beats.length;
  const statementPct = ((dist.STATEMENT || 0) / Math.max(1, total) * 100).toFixed(0);
  if (+statementPct > 70) {
    warnings.push(`${statementPct}% of beats fell to STATEMENT — the vocabulary may need expansion for this script's topic`);
  }

  return { beats, warnings, distribution: dist };
}
