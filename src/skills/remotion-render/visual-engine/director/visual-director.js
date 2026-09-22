/**
 * VISUAL DIRECTOR — scene-based decision engine.
 *
 * Does NOT select from a vocabulary of graphic components.
 * Instead, for each sentence it asks:
 *   - What SUBJECT physically exists?
 *   - What STATE is it in?
 *   - What ACTION happens?
 *   - What RELATIONSHIP exists?
 *   - What CHANGES over time?
 *   - What should the viewer SEE first, second, third?
 *
 * Then it constructs a SCENE — a sequence of shots where objects
 * with material identity change state to communicate the argument.
 *
 * The test: mute the audio. Can you still understand the idea?
 */

import { condenseToPhrase, TYPO_TARGET_MAX_WORDS } from "../../visual/narrative-typography.js";
import { validateScene } from "../../visual/scene-primitives.js";
import { narrativeObjectIds } from "../../visual/scene-text.js";
import { compileScene, isMechanismBased, mechanismToCapability } from "../../visual/capability-compiler.js";

const STOP = new Set(`a an the and or but of to in on at for with from by is are was were be been being
  it its this that these those as if then than so not no you your they them their he she his her we our us i
  do does did done have has had will would can could should may might must about into over under after before
  just only very more most much many some any all every each other another such same own here there when where
  how what which who whom whose why now then still yet also too even ever never always often`.split(/\s+/));

const contentWords = (text) =>
  String(text || "").toLowerCase().split(/[^a-z0-9.%$]+/).filter((w) => w.length > 2 && !STOP.has(w));

/* ── Number extraction ─────────────────────────────────────────────── */

function extractNumber(text) {
  const t = String(text || "");
  const m = /\b(\$?\d[\d,.]*)\s*(%|percent|billion|million|thousand|dollars|cents|times|x)?\b/i.exec(t);
  if (!m) return null;
  const raw = m[1].replace(/,/g, "");
  const value = parseFloat(raw.replace(/^\$/, ""));
  const unit = m[2] || "";
  if (!unit && value >= 1900 && value <= 2099 && /\b\d{4}\b/.test(raw)) return null;
  return { raw: m[0].trim(), value, unit };
}

function extractAllNumbers(text) {
  const t = String(text || "");
  const nums = [];
  const re = /\b(\$?\d[\d,.]*)\s*(%|percent|billion|million|thousand|dollars|cents|times|x)?\b/gi;
  let m;
  while ((m = re.exec(t))) {
    const raw = m[1].replace(/,/g, "");
    const value = parseFloat(raw.replace(/^\$/, ""));
    const unit = m[2] || "";
    if (!unit && value >= 1900 && value <= 2099) continue;
    nums.push({ raw: m[0].trim(), value, unit, pos: m.index });
  }
  return nums;
}

/* ── Subject/object extraction ─────────────────────────────────────── */

const MATERIAL_DOMAINS = {
  fuel: /\b(gas(?:oline)?|fuel|oil|petrol|diesel|energy|barrel|gallon|pump)\b/i,
  food: /\b(grocer\w*|food|meal|eat|bread|milk|egg|meat|produce|kitchen|restaurant|supermarket|store)\b/i,
  housing: /\b(house|home|rent|mortgage|apartment|property|real\s+estate|housing|room|shelter)\b/i,
  money: /\b(dollar|cent|money|cash|cost|price|spend|income|wage|salary|budget|debt|loan|savings?|tax|fee|bill|payment|afford|financial|economy|inflation|interest\s+rate|purchasing\s+power|wealth)\b/i,
  document: /\b(report|formula|rule|law|regulation|policy|budget|plan|cpi|index|rate|statistic|data|number|figure|headline)\b/i,
  market: /\b(market|stock|trade|exchange|invest|portfolio|asset|equity|bond|fund|return)\b/i,
};

function detectMaterial(text) {
  const t = String(text || "");
  for (const [domain, re] of Object.entries(MATERIAL_DOMAINS)) {
    if (re.test(t)) return domain;
  }
  return "abstract";
}

function primarySubject(text) {
  const words = contentWords(text);
  return words[0] || "";
}

function extractSubjectPhrase(text) {
  const t = String(text || "");
  const m = /(?:the|a|an|this|that|those|these)\s+(.{3,40?}?)(?:\s+(?:is|are|was|were|has|have|had|will|would|can|could|should|may|might|must)\b)/i.exec(t);
  if (m) return m[1].trim();
  const words = contentWords(t);
  return words.slice(0, 2).join(" ");
}

/* ── Narrative role detection ──────────────────────────────────────── */

const OPENING_RE = /\b(think\s+.{0,15}\??|did\s+you\s+know|imagine|picture\s+this|here'?s?\s+(?:the|what)|what\s+if)\b/i;
const EMPHASIS_RE = /\b(the\s+(?:key|point|bottom\s+line|takeaway|real\s+(?:problem|issue|question))|this\s+(?:is|means)|remember|never\s+forget|most\s+important(?:ly)?)\b/i;
const REVEAL_RE = /\b(actually|in\s+fact|turns?\s+out|discover\w*|hidden|secret|reveal\w*|the\s+(?:truth|reality|real\s+(?:number|story))|mislead\w*|lie|lying|decepti\w*)\b/i;
const CONTRAST_RE = /\b(but|however|instead|not|unlike|whereas|yet|despite|although)\b/i;
const CAUSAL_RE = /\b(because|therefore|so\s+that|which\s+means|leads?\s+to|caus(?:e[sd]?|ing)|result(?:s|ing)?\s+in|due\s+to|driving|driven\s+by|forcing|forces)\b/i;
const GROWTH_RE = /\b(surge[ds]?|increas\w+|grow[sn]?|ris(?:e[sd]?|ing)|expand\w*|spike[ds]?|jump\w*|soar\w*|climb\w*|double[ds]?|triple[ds]?|skyrocket\w*|balloon\w*)\b/i;
const EROSION_RE = /\b(erodes?|destroys?|diminish\w*|shrink\w*|declin\w*|deteriorat\w*|weaken\w*|loses?\b|lost|losing|strip\w*|broken|breaks?)\b/i;
const DEPLETION_RE = /\b(deplet\w*|exhaust\w*|drain\w*|run(?:s|ning)?\s+out|consum\w*|empty|empties|nothing\s+(?:left|for)|swallow\w*|leaving\s+(?:almost\s+)?nothing)\b/i;
const ACTION_RE = /\b(recalculat\w*|adjust\w*|stop\s+\w+|must\s+\w+|need\s+to|subscrib\w*|start\s+\w+)\b/i;
const COMPARE_RE = /\b(higher\s+than|lower\s+than|more\s+than|less\s+than|compared\s+to|versus|vs\.?|while\b.*\b(?:down|up)\b|instead\s+of)\b/i;

/* ── Scene construction ────────────────────────────────────────────── */

/**
 * Build a scene description for one sentence.
 * A scene is NOT a component selection. It describes:
 *   - What objects exist and what they look like
 *   - What state they start and end in
 *   - What the camera does and why
 *   - What the viewer should understand at each moment
 */
function buildScene(text, index, totalBeats, prevScene) {
  const t = String(text || "");
  const material = detectMaterial(t);
  const subject = extractSubjectPhrase(t);
  const nums = extractAllNumbers(t);
  const cw = contentWords(t);

  const scene = {
    narrative_role: "statement",
    mechanism: "TYPOGRAPHY",
    reason: "",
    subject,
    material,

    objects: [],

    shots: [{
      phase: 0, phaseDuration: 1,
      camera: "hold",
      focus: "text",
    }],

    typography: {
      role: "primary",
      style: "kinetic",
      emphasis_words: [],
    },
  };

  // Determine the narrative purpose of this sentence.
  // This is NOT keyword-matching to components. It asks:
  // "What is this sentence DOING in the argument?"

  if (index === 0 && OPENING_RE.test(t)) {
    scene.narrative_role = "hook";
    scene.mechanism = "TYPOGRAPHY";
    scene.reason = "opening question — the words themselves create tension";
    scene.typography.style = "question";
    scene.typography.emphasis_words = cw.slice(0, 2);
    return scene;
  }

  // REVEAL: the sentence says something is hidden, misleading, or not what it seems.
  // Visual mechanism: show the surface, then reveal what's underneath.
  // But if the sentence ALSO has an explicit growth verb + number, prefer PHYSICAL_GROWTH
  // (e.g. "gasoline actually surged by 24.6%" → fuel gauge, not generic reveal).
  if (REVEAL_RE.test(t) && nums.length > 0 && !GROWTH_RE.test(t)) {
    const revealMatch = REVEAL_RE.exec(t);
    scene.narrative_role = "reveal";
    scene.mechanism = "SURFACE_AND_BENEATH";
    scene.reason = `"${revealMatch[1]}" — the ${nums[0].raw} is presented as official truth, then its inadequacy is exposed`;

    const realityLabel = {
      money: "REAL COSTS", food: "REAL PRICES", fuel: "REAL FUEL COSTS",
      housing: "REAL HOUSING COSTS", document: "THE REAL NUMBERS",
      market: "REAL RETURNS", abstract: "THE REALITY",
    }[material] || "THE REALITY";

    scene.objects = [
      {
        id: "surface",
        label: nums[0].raw,
        material: "document",
        role: "the official figure",
        appearance: "statistic_callout",
        source: "OFFICIAL",
        initial_state: { scale: 1, opacity: 1, position: "center" },
        final_state: { scale: 0.6, opacity: 0.5, position: "top" },
      },
      {
        id: "beneath",
        label: realityLabel,
        material,
        role: "the hidden reality",
        appearance: "category_breakdown",
        categories: material === "fuel" ? ["GASOLINE", "ENERGY", "TRANSPORT"]
          : material === "food" ? ["GROCERIES", "ESSENTIALS", "PRODUCE"]
          : material === "housing" ? ["RENT", "UTILITIES", "INSURANCE"]
          : ["FOOD", "FUEL", "HOUSING"],
        initial_state: { scale: 0, opacity: 0, position: "behind_surface" },
        final_state: { scale: 1, opacity: 1, position: "center" },
      },
    ];

    scene.shots = [
      { phase: 0, phaseDuration: 0.4, camera: "hold", focus: "surface", action: "establish the official figure" },
      { phase: 0.4, phaseDuration: 0.35, camera: "push_past", focus: "beneath", action: "surface recedes, reality emerges" },
      { phase: 0.75, phaseDuration: 0.25, camera: "hold", focus: "both", action: "viewer sees both — headline vs reality" },
    ];

    scene.typography = { role: "label", style: "annotation", emphasis_words: [] };
    return scene;
  }

  // COMPARATIVE PROPORTION: two quantities in the same sentence.
  // Visual mechanism: two physical amounts in the same space, at honest scale.
  if (nums.length >= 2 && COMPARE_RE.test(t)) {
    scene.narrative_role = "comparison";
    scene.mechanism = "PROPORTIONAL_OBJECTS";
    scene.reason = `comparing ${nums[0].raw} against ${nums[1].raw} — showing actual relative scale`;

    const maxVal = Math.max(nums[0].value, nums[1].value);
    scene.objects = [
      {
        id: "amount_a",
        label: nums[0].raw,
        material,
        role: "first quantity",
        appearance: "filled_area",
        initial_state: { scale: 0, opacity: 0 },
        final_state: { scale: nums[0].value / maxVal, opacity: 1, position: "left" },
      },
      {
        id: "amount_b",
        label: nums[1].raw,
        material,
        role: "second quantity",
        appearance: "filled_area",
        initial_state: { scale: 0, opacity: 0 },
        final_state: { scale: nums[1].value / maxVal, opacity: 1, position: "right" },
      },
    ];

    scene.shots = [
      { phase: 0, phaseDuration: 0.35, camera: "hold", focus: "amount_a", action: "first quantity materializes" },
      { phase: 0.35, phaseDuration: 0.35, camera: "widen", focus: "amount_b", action: "second quantity appears alongside" },
      { phase: 0.7, phaseDuration: 0.3, camera: "hold", focus: "both", action: "viewer sees the gap" },
    ];

    // Extract context labels: use content words before each number, not raw sentence fragments
    const cwBefore0 = contentWords(t.slice(Math.max(0, nums[0].pos - 50), nums[0].pos)).slice(-2).join(" ");
    const cwBefore1 = contentWords(t.slice(Math.max(0, nums[1].pos - 50), nums[1].pos)).slice(-2).join(" ");
    scene.objects[0].context = cwBefore0 || "HEADLINE";
    scene.objects[1].context = cwBefore1 || "CORE";

    scene.typography = { role: "label", style: "annotation", emphasis_words: [] };
    return scene;
  }

  // GROWTH with evidence: something surges/increases with a number attached.
  // Visual mechanism: an object physically expands/fills — not a bar chart,
  // but the THING ITSELF growing.
  if (GROWTH_RE.test(t) && nums.length > 0) {
    const growthMatch = GROWTH_RE.exec(t);
    scene.narrative_role = "escalation";
    scene.mechanism = "PHYSICAL_GROWTH";
    scene.reason = `"${growthMatch[1]}" — ${subject} physically expands to show ${nums[0].raw} increase`;

    const domainLabel = {
      fuel: "GASOLINE", food: "GROCERIES", money: "COST",
      housing: "HOUSING", market: "MARKET", document: "INDEX",
    }[material] || subject.toUpperCase().slice(0, 16);

    scene.objects = [
      {
        id: "growing_thing",
        label: domainLabel,
        material,
        role: "the thing that grows",
        appearance: material === "fuel" ? "fuel_gauge" : material === "food" ? "receipt" : material === "money" ? "price_tag" : "mass",
        initial_state: { scale: 0.2, opacity: 1, position: "center" },
        final_state: { scale: 1, opacity: 1, position: "center" },
      },
      {
        id: "magnitude",
        label: nums[0].raw,
        material: "text",
        role: "the amount of growth",
        appearance: "value_label",
        initial_state: { scale: 0, opacity: 0 },
        final_state: { scale: 1, opacity: 1, position: "beside_subject" },
      },
    ];

    scene.shots = [
      { phase: 0, phaseDuration: 0.25, camera: "hold", focus: "growing_thing", action: "establish the subject at initial size" },
      { phase: 0.25, phaseDuration: 0.45, camera: "pull_back", focus: "growing_thing", action: "subject physically grows — camera pulls back to contain it" },
      { phase: 0.7, phaseDuration: 0.3, camera: "hold", focus: "magnitude", action: "final magnitude appears" },
    ];

    scene.typography = { role: "caption", style: "annotation", emphasis_words: [growthMatch[1]] };
    return scene;
  }

  // DEPLETION: something is consumed, swallowed, leaves nothing.
  // Visual mechanism: a container visibly empties or its contents disappear.
  if (DEPLETION_RE.test(t) && nums.length > 0) {
    const deplMatch = DEPLETION_RE.exec(t);
    scene.narrative_role = "consequence";
    scene.mechanism = "VISIBLE_CONSUMPTION";
    scene.reason = `"${deplMatch[1]}" — showing ${nums[0].raw} being consumed, leaving the remainder visibly insufficient`;

    scene.objects = [
      {
        id: "total",
        label: "income",
        material: "money",
        role: "the total available",
        appearance: "stack",
        initial_state: { fill: 1, opacity: 1, position: "center" },
        final_state: { fill: 1, opacity: 1, position: "center" },
      },
      {
        id: "consumed",
        label: nums[0].raw,
        material: "money",
        role: "the portion consumed",
        appearance: "consumed_region",
        initial_state: { fill: 0, opacity: 0.8 },
        final_state: { fill: nums[0].value / 100, opacity: 0.8, position: "overlay" },
      },
      {
        id: "remainder",
        label: "remaining",
        material: "money",
        role: "what is left",
        appearance: "thin_sliver",
        initial_state: { scale: 1, opacity: 0 },
        final_state: { scale: 1 - (nums[0].value / 100), opacity: 1, position: "bottom" },
      },
    ];

    scene.shots = [
      { phase: 0, phaseDuration: 0.25, camera: "hold", focus: "total", action: "show the full amount" },
      { phase: 0.25, phaseDuration: 0.45, camera: "hold", focus: "consumed", action: "consumed portion fills — eating the total" },
      { phase: 0.7, phaseDuration: 0.3, camera: "push_in", focus: "remainder", action: "camera pushes in on the sliver that remains" },
    ];

    scene.typography = { role: "label", style: "annotation", emphasis_words: [deplMatch[1]] };
    return scene;
  }

  // EROSION: an existing system/rule breaks down.
  // Visual mechanism: a structure visibly fractures or loses integrity.
  if (EROSION_RE.test(t)) {
    const erosionMatch = EROSION_RE.exec(t);
    scene.narrative_role = "destruction";
    scene.mechanism = "STRUCTURAL_BREAKDOWN";
    scene.reason = `"${erosionMatch[1]}" — ${subject} loses structural integrity`;

    scene.objects = [
      {
        id: "structure",
        label: subject,
        material: material === "document" ? "document" : material,
        role: "the thing that breaks",
        appearance: material === "document" ? "ruled_page" : "solid_block",
        initial_state: { integrity: 1, opacity: 1, position: "center" },
        final_state: { integrity: 0.2, opacity: 0.7, position: "center" },
      },
    ];

    scene.shots = [
      { phase: 0, phaseDuration: 0.3, camera: "hold", focus: "structure", action: "establish the intact structure" },
      { phase: 0.3, phaseDuration: 0.5, camera: "hold", focus: "structure", action: "fractures appear — structure loses integrity" },
      { phase: 0.8, phaseDuration: 0.2, camera: "hold", focus: "structure", action: "the broken state" },
    ];

    scene.typography = { role: "caption", style: "kinetic", emphasis_words: [erosionMatch[1]] };
    return scene;
  }

  // CAUSAL CHAIN: A forces/causes B.
  // Visual mechanism: an action visibly produces a consequence.
  if (CAUSAL_RE.test(t)) {
    const causalMatch = CAUSAL_RE.exec(t);
    const before = t.slice(0, causalMatch.index).trim();
    const after = t.slice(causalMatch.index + causalMatch[0].length).trim();
    const cw_before = contentWords(before).slice(0, 4).join(" ");
    const cw_after = contentWords(after).slice(0, 4).join(" ");
    const domainCauseLabel = {
      money: "RISING COSTS", food: "FOOD PRICES", fuel: "FUEL COSTS",
      housing: "HOUSING COSTS", document: "THE DATA", market: "MARKET SHIFT",
    }[material] || "THE CAUSE";
    const rawCause = cw_before || before.replace(/^(this|that|it)\s*/i, "").trim().split(/\s+/).slice(0, 5).join(" ");
    const causePhrase = rawCause || domainCauseLabel;
    const effectPhrase = cw_after || after.trim().split(/\s+/).slice(0, 5).join(" ");

    scene.narrative_role = "causation";
    scene.mechanism = "ACTION_CONSEQUENCE";
    scene.reason = `"${causalMatch[1]}" — showing ${causePhrase || "cause"} visibly producing ${effectPhrase || "effect"}`;

    scene.objects = [
      {
        id: "cause",
        label: causePhrase || before.trim(),
        material,
        role: "the cause",
        appearance: "solid_block",
        initial_state: { scale: 1, opacity: 1, position: "upper" },
        final_state: { scale: 1, opacity: 0.6, position: "upper" },
      },
      {
        id: "effect",
        label: effectPhrase || after.trim().split(/\s+/).slice(0, 5).join(" "),
        material,
        role: "the consequence",
        appearance: "emergent",
        initial_state: { scale: 0, opacity: 0, position: "lower" },
        final_state: { scale: 1, opacity: 1, position: "lower" },
      },
    ];

    scene.shots = [
      { phase: 0, phaseDuration: 0.35, camera: "hold", focus: "cause", action: "establish the cause" },
      { phase: 0.35, phaseDuration: 0.3, camera: "tilt_down", focus: "effect", action: "consequence emerges below" },
      { phase: 0.65, phaseDuration: 0.35, camera: "hold", focus: "both", action: "viewer sees cause and effect together" },
    ];

    scene.typography = { role: "label", style: "annotation", emphasis_words: [causalMatch[1]] };
    return scene;
  }

  // CONTRAST: but/however/instead — two states in opposition.
  // Visual mechanism: one state transforms into another in the same space.
  if (CONTRAST_RE.test(t) && !OPENING_RE.test(t)) {
    const contrastMatch = CONTRAST_RE.exec(t);
    let before = t.slice(0, contrastMatch.index).trim();
    let after = t.slice(contrastMatch.index + contrastMatch[0].length).trim();

    // "instead of X" means X is the rejected state and what precedes is the
    // replacement — swap so expected=X (struck) and actual=replacement.
    const isInsteadOf = /^instead\s+of\b/i.test(contrastMatch[0] + " " + after);
    if (isInsteadOf) {
      after = after.replace(/^of\s+/i, "");
      [before, after] = [after, before];
    }

    if (before.length > 5 && after.length > 5) {
      scene.narrative_role = "contrast";
      scene.mechanism = "STATE_CHANGE";
      scene.reason = `"${contrastMatch[1]}" — showing what was expected vs what is actually true`;

      const beforeLabel = contentWords(before).slice(0, 3).join(" ") || before.slice(0, 30);
      const afterLabel = contentWords(after).slice(0, 3).join(" ") || after.slice(0, 30);

      scene.objects = [
        {
          id: "expected",
          label: beforeLabel,
          material,
          role: "the expected state",
          appearance: "clean_text",
          initial_state: { scale: 1, opacity: 1, position: "center" },
          final_state: { scale: 0.7, opacity: 0.3, position: "top", struck: true },
        },
        {
          id: "actual",
          label: afterLabel,
          material,
          role: "the actual state",
          appearance: "emphasized_text",
          initial_state: { scale: 0, opacity: 0, position: "center" },
          final_state: { scale: 1, opacity: 1, position: "center" },
        },
      ];

      scene.shots = [
        { phase: 0, phaseDuration: 0.4, camera: "hold", focus: "expected", action: "present the expected/claimed state" },
        { phase: 0.4, phaseDuration: 0.3, camera: "hold", focus: "expected", action: "strike through / fade the expectation" },
        { phase: 0.7, phaseDuration: 0.3, camera: "hold", focus: "actual", action: "the actual truth replaces it" },
      ];

      scene.typography = { role: "secondary", style: "annotation", emphasis_words: [contrastMatch[1]] };
      return scene;
    }
  }

  // ACTION/CTA: the sentence tells the viewer to DO something.
  if (ACTION_RE.test(t) && index >= totalBeats - 3) {
    scene.narrative_role = "action";
    scene.mechanism = "TYPOGRAPHY";
    scene.reason = "call-to-action — the imperative verb carries the weight";
    scene.typography = { role: "primary", style: "imperative", emphasis_words: cw.slice(0, 2) };
    return scene;
  }

  // EMPHASIS: key point, bottom line, conclusion.
  if (EMPHASIS_RE.test(t)) {
    scene.narrative_role = "conclusion";
    scene.mechanism = "TYPOGRAPHY";
    scene.reason = "emphasis/conclusion — the claim itself is what must land";
    scene.typography = { role: "primary", style: "emphasis", emphasis_words: cw.slice(0, 3) };
    return scene;
  }

  // SINGLE NUMBER as evidence (not a reveal, not a comparison).
  if (nums.length === 1) {
    scene.narrative_role = "evidence";
    scene.mechanism = "EVIDENCE_FIGURE";
    scene.reason = `${nums[0].raw} is presented as evidence — shown as a figure within its material context`;

    scene.objects = [
      {
        id: "figure",
        label: nums[0].raw,
        material,
        role: "the evidential figure",
        appearance: material === "money" ? "price_tag" : material === "document" ? "statistic_in_context" : "figure",
        initial_state: { scale: 0, opacity: 0 },
        final_state: { scale: 1, opacity: 1, position: "center" },
      },
    ];

    scene.shots = [
      { phase: 0, phaseDuration: 0.3, camera: "hold", focus: "context", action: "establish context" },
      { phase: 0.3, phaseDuration: 0.4, camera: "push_in", focus: "figure", action: "the figure materializes within its context" },
      { phase: 0.7, phaseDuration: 0.3, camera: "hold", focus: "figure", action: "the figure holds — viewer absorbs it" },
    ];

    scene.typography = { role: "caption", style: "kinetic", emphasis_words: [] };
    return scene;
  }

  // FALLBACK: the words are the visual. No objects, no pretend-graphics.
  scene.narrative_role = index === 0 ? "hook" : "statement";
  scene.mechanism = "TYPOGRAPHY";
  scene.reason = "no physical mechanism detected — the sentence itself communicates the idea";
  scene.typography = { role: "primary", style: "kinetic", emphasis_words: cw.slice(0, 2) };
  return scene;
}

/* ── Gemini directive → scene ─────────────────────────────────────── */

function applyDirective(directive, originalText, index, totalBeats, prevScene) {
  const headline = directive.visual_headline;
  const mechanism = directive.mechanism;
  const material = detectMaterial(originalText);
  const subject = extractSubjectPhrase(originalText);
  const emphWords = directive.emphasis_words || contentWords(headline).slice(0, 3);
  const objs = directive.objects || {};

  const scene = {
    narrative_role: "directed",
    mechanism,
    reason: directive.reason || `Gemini-directed: ${mechanism}`,
    subject,
    material,
    carries_forward: directive.carries_forward || null,
    emotional_weight: directive.emotional_weight || "calm",
    objects: [],
    shots: [],
    typography: { role: "primary", style: "kinetic", emphasis_words: emphWords },
  };

  switch (mechanism) {
    case "STATE_CHANGE":
      scene.objects = [
        // NO "EXPECTED"/"ACTUAL"/"CAUSE"/"EFFECT" FALLBACKS.
        //
        // These || defaults resurrected the exact engine vocabulary deleted
        // from directed-scene.jsx, and they defeated enforcement:
        // REMOVE_TYPOGRAPHY clears label_a/label_b to "", the fallback put a
        // banned word back, and the manifest counted it as narrative text.
        // So runs 35293642808 and 35317469026 applied and VERIFIED the
        // directives while the auditor measured an identical text-beat share
        // on every attempt — 57/57/57 on ch1, 44/44/44 on ch44. An empty
        // label now stays empty and the scene renders unlabelled.
        { id: "expected", label: objs.label_a || "", material, role: "the expected state", appearance: "clean_text",
          initial_state: { scale: 1, opacity: 1, position: "center" }, final_state: { scale: 0.7, opacity: 0.3, position: "top", struck: true } },
        { id: "actual", label: objs.label_b || "", material, role: "the actual state", appearance: "emphasized_text",
          initial_state: { scale: 0, opacity: 0, position: "center" }, final_state: { scale: 1, opacity: 1, position: "center" } },
      ];
      scene.shots = [
        { phase: 0, phaseDuration: 0.4, camera: "hold", focus: "expected", action: "present expected state" },
        { phase: 0.4, phaseDuration: 0.3, camera: "hold", focus: "expected", action: "strike through" },
        { phase: 0.7, phaseDuration: 0.3, camera: "hold", focus: "actual", action: "actual truth replaces it" },
      ];
      scene.typography = { role: "secondary", style: "annotation", emphasis_words: emphWords };
      break;

    case "EVIDENCE_FIGURE":
      scene.objects = [
        { id: "figure", label: objs.figure || headline, material, role: "the evidential figure", appearance: "figure",
          initial_state: { scale: 0, opacity: 0 }, final_state: { scale: 1, opacity: 1, position: "center" } },
      ];
      scene.shots = [
        { phase: 0, phaseDuration: 0.3, camera: "hold", focus: "context", action: "establish context" },
        { phase: 0.3, phaseDuration: 0.4, camera: "push_in", focus: "figure", action: "figure materializes" },
        { phase: 0.7, phaseDuration: 0.3, camera: "hold", focus: "figure", action: "figure holds" },
      ];
      scene.typography = { role: "caption", style: "kinetic", emphasis_words: [] };
      break;

    case "ACTION_CONSEQUENCE":
      scene.objects = [
        { id: "cause", label: objs.cause || "", material, role: "the cause", appearance: "solid_block",
          initial_state: { scale: 1, opacity: 1, position: "upper" }, final_state: { scale: 1, opacity: 0.6, position: "upper" } },
        { id: "effect", label: objs.effect || "", material, role: "the consequence", appearance: "emergent",
          initial_state: { scale: 0, opacity: 0, position: "lower" }, final_state: { scale: 1, opacity: 1, position: "lower" } },
      ];
      scene.shots = [
        { phase: 0, phaseDuration: 0.35, camera: "hold", focus: "cause", action: "establish cause" },
        { phase: 0.35, phaseDuration: 0.3, camera: "tilt_down", focus: "effect", action: "consequence emerges" },
        { phase: 0.65, phaseDuration: 0.35, camera: "hold", focus: "both", action: "cause and effect together" },
      ];
      scene.typography = { role: "label", style: "annotation", emphasis_words: emphWords };
      break;

    case "PHYSICAL_GROWTH": {
      const domainLabel = { fuel: "GASOLINE", food: "GROCERIES", money: "COST", housing: "HOUSING", market: "MARKET", document: "INDEX" }[material] || subject.toUpperCase().slice(0, 16);
      scene.objects = [
        { id: "growing_thing", label: domainLabel, material, role: "the thing that grows", appearance: "mass",
          initial_state: { scale: 0.2, opacity: 1, position: "center" }, final_state: { scale: 1, opacity: 1, position: "center" } },
        { id: "magnitude", label: objs.figure || headline, material: "text", role: "growth amount", appearance: "value_label",
          initial_state: { scale: 0, opacity: 0 }, final_state: { scale: 1, opacity: 1, position: "beside_subject" } },
      ];
      scene.shots = [
        { phase: 0, phaseDuration: 0.25, camera: "hold", focus: "growing_thing", action: "establish subject" },
        { phase: 0.25, phaseDuration: 0.45, camera: "pull_back", focus: "growing_thing", action: "subject grows" },
        { phase: 0.7, phaseDuration: 0.3, camera: "hold", focus: "magnitude", action: "magnitude appears" },
      ];
      scene.typography = { role: "caption", style: "annotation", emphasis_words: emphWords };
      break;
    }

    case "VISIBLE_CONSUMPTION":
      scene.objects = [
        { id: "total", label: "total", material: "money", role: "the total", appearance: "stack",
          initial_state: { fill: 1, opacity: 1, position: "center" }, final_state: { fill: 1, opacity: 1, position: "center" } },
        { id: "consumed", label: objs.figure || headline, material: "money", role: "consumed portion", appearance: "consumed_region",
          initial_state: { fill: 0, opacity: 0.8 }, final_state: { fill: 0.7, opacity: 0.8, position: "overlay" } },
      ];
      scene.shots = [
        { phase: 0, phaseDuration: 0.25, camera: "hold", focus: "total", action: "show full amount" },
        { phase: 0.25, phaseDuration: 0.45, camera: "hold", focus: "consumed", action: "consumed portion fills" },
        { phase: 0.7, phaseDuration: 0.3, camera: "push_in", focus: "consumed", action: "viewer sees what remains" },
      ];
      scene.typography = { role: "label", style: "annotation", emphasis_words: emphWords };
      break;

    case "SURFACE_AND_BENEATH": {
      const surfHeadlineParts = headline.split(/\bvs\.?\b|\bbut\b|\bhides?\b|\bbeneath\b/i);
      // Splitting the headline is a legitimate derivation — it is the
      // director's own phrase. The FINAL fallbacks were not: a
      // subject.toUpperCase().slice(0, 20) manufactures shouted, mid-word
      // text (TYP-09), and "REALITY" is engine vocabulary. Both also
      // defeated REMOVE_TYPOGRAPHY by refilling a label the enforcement had
      // just cleared. An empty label stays empty.
      const surfLabel = objs.label_a || (surfHeadlineParts[0] || "").trim();
      const beneathLabel = objs.label_b || (surfHeadlineParts[1] || "").trim();
      scene.objects = [
        { id: "surface", label: surfLabel, context: subject, material: "document", role: "the surface claim", appearance: "statistic_callout",
          initial_state: { scale: 1, opacity: 1, position: "center" }, final_state: { scale: 0.6, opacity: 0.5, position: "top" } },
        { id: "beneath", label: beneathLabel, context: subject, material, role: "the hidden truth", appearance: "category_breakdown",
          initial_state: { scale: 0, opacity: 0, position: "behind_surface" }, final_state: { scale: 1, opacity: 1, position: "center" } },
      ];
      scene.shots = [
        { phase: 0, phaseDuration: 0.4, camera: "hold", focus: "surface", action: "establish official claim" },
        { phase: 0.4, phaseDuration: 0.35, camera: "push_past", focus: "beneath", action: "reality emerges" },
        { phase: 0.75, phaseDuration: 0.25, camera: "hold", focus: "both", action: "headline vs reality" },
      ];
      scene.typography = { role: "label", style: "annotation", emphasis_words: [] };
      break;
    }

    case "PROPORTIONAL_OBJECTS": {
      const headlineParts = headline.split(/\bvs\.?\b/i);
      // No "A"/"B" placeholders: a bar labelled "A" tells the viewer
      // nothing, and it refilled labels that REMOVE_TYPOGRAPHY had cleared,
      // keeping the beat counted as a text beat.
      const labelA = objs.label_a || (headlineParts[0] || "").trim();
      const labelB = objs.label_b || (headlineParts[1] || "").trim();
      scene.objects = [
        { id: "amount_a", label: labelA, context: labelA, material, role: "first quantity", appearance: "filled_area",
          initial_state: { scale: 0, opacity: 0 }, final_state: { scale: 1, opacity: 1, position: "left" } },
        { id: "amount_b", label: labelB, context: labelB, material, role: "second quantity", appearance: "filled_area",
          initial_state: { scale: 0, opacity: 0 }, final_state: { scale: 0.4, opacity: 1, position: "right" } },
      ];
      scene.shots = [
        { phase: 0, phaseDuration: 0.35, camera: "hold", focus: "amount_a", action: "first quantity appears" },
        { phase: 0.35, phaseDuration: 0.35, camera: "widen", focus: "amount_b", action: "second appears alongside" },
        { phase: 0.7, phaseDuration: 0.3, camera: "hold", focus: "both", action: "viewer sees the gap" },
      ];
      scene.typography = { role: "label", style: "annotation", emphasis_words: [] };
      break;
    }

    case "STRUCTURAL_BREAKDOWN":
      scene.objects = [
        { id: "structure", label: subject, material, role: "the thing that breaks", appearance: "solid_block",
          initial_state: { integrity: 1, opacity: 1, position: "center" }, final_state: { integrity: 0.2, opacity: 0.7, position: "center" } },
      ];
      scene.shots = [
        { phase: 0, phaseDuration: 0.3, camera: "hold", focus: "structure", action: "establish intact structure" },
        { phase: 0.3, phaseDuration: 0.5, camera: "hold", focus: "structure", action: "fractures appear" },
        { phase: 0.8, phaseDuration: 0.2, camera: "hold", focus: "structure", action: "broken state" },
      ];
      scene.typography = { role: "caption", style: "kinetic", emphasis_words: emphWords };
      break;

    default:
      scene.shots = [{ phase: 0, phaseDuration: 1, camera: "hold", focus: "text" }];
      break;
  }

  return scene;
}

/* ── Word timings ──────────────────────────────────────────────────── */

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

/* ── Render uniqueness ─────────────────────────────────────────────── */

function makeRng(seed) {
  let s = seed | 0 || (Date.now() ^ (Math.random() * 0x100000000));
  return () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
}

const TRANSITIONS = ["CUT", "DISSOLVE", "WIPE_LEFT", "WIPE_RIGHT", "PUSH_UP", "FADE"];
const CAMERA_ALTS = {
  hold: ["hold", "slow_drift", "micro_pull"],
  push_in: ["push_in", "slow_zoom", "drift_in"],
  pull_back: ["pull_back", "slow_zoom_out", "drift_out"],
  widen: ["widen", "pull_back", "expand"],
  tilt_down: ["tilt_down", "pan_down", "drift_down"],
  push_past: ["push_past", "dolly_through", "push_in"],
};

function randomizeScene(scene, rng) {
  for (const shot of scene.shots) {
    const jitter = (rng() - 0.5) * 0.08;
    shot.phaseDuration = Math.max(0.1, Math.min(0.9, shot.phaseDuration + jitter));
    const alts = CAMERA_ALTS[shot.camera];
    if (alts) shot.camera = alts[Math.floor(rng() * alts.length)];
  }
  for (const obj of scene.objects || []) {
    if (obj.initial_state?.position === "center") {
      const offX = (rng() - 0.5) * 0.06;
      const offY = (rng() - 0.5) * 0.04;
      obj.initial_state.offsetX = offX;
      obj.initial_state.offsetY = offY;
    }
    if (obj.final_state?.position === "center") {
      obj.final_state.offsetX = (rng() - 0.5) * 0.04;
      obj.final_state.offsetY = (rng() - 0.5) * 0.03;
    }
  }
  return scene;
}

/* ── Public API ────────────────────────────────────────────────────── */

export function analyzeSentence(text) {
  return buildScene(text, 0, 1, null);
}

export function direct(cues, options) {
  const rng = makeRng(options?.seed);
  const beats = [];
  const warnings = [];
  let prevScene = null;
  const plan = options?.visualPlan?.beats || null;

  cues.forEach((cue, i) => {
    const text = (cue.text || "").trim();
    if (!text) return;

    let scene;
    const directive = plan?.[i];

    // A directed beat is honoured on its MECHANISM alone. It must NOT also
    // require a visual_headline: under narrative typography a beat is often
    // deliberately text-free (pure visual storytelling), and the old
    // `&& directive.visual_headline` guard silently dropped exactly those
    // beats into the deterministic classifier — which could then re-label
    // them as typography. That made typography the fallback for text-free
    // direction, the opposite of the intent (Bible TYP-10).
    if (directive && directive.mechanism) {
      scene = applyDirective(directive, text, i, cues.length, prevScene);
      scene = randomizeScene(scene, rng);
    } else if (directive && directive.visual_events) {
      // CAPABILITY-BASED DIRECTIVE: compile into a scene
      const { scene: compiledScene, warnings: compileWarnings } = compileScene(
        directive, text, i, cues.length
      );
      if (!compiledScene) {
        throw new Error(
          `Beat ${i} has no mechanism: its capability directive did not compile` +
          `${compileWarnings.length ? ` (${compileWarnings.join("; ")})` : ""}. Plan: ${JSON.stringify(directive)}`
        );
      }
      scene = randomizeScene(compiledScene, rng);
    } else {
      // No directive for this beat. There is no regex classifier to fall back
      // to: TYPOGRAPHY or any other mechanism is only rendered when the plan
      // sets it. The planners (scripts/*-visual-plan.*) must cover every cue.
      throw new Error(
        `Beat ${i} has no mechanism. Plan: ${JSON.stringify(directive ?? null)} ` +
        `(${plan ? `plan has ${plan.length} beats for ${cues.length} cues` : "no visual plan loaded"})`
      );
    }

    // COMPOSITION — what the viewer literally sees, when Gemini declared it.
    //
    // A valid composition is carried onto the beat and ComposedScene draws
    // it instead of one of the nine hardcoded mechanism scenes. Those nine
    // were the entire visual language and all drew text plus a shape on a
    // flat ground, which is why sixteen of sixteen Gemini verdicts blamed
    // RENDER_TECHNICAL for "template monoculture".
    //
    // Validated HERE as well as at plan time, not because the planner is
    // untrusted but because this is the last point before pixels: an
    // unbuildable declaration must fall back to the old mechanism scene
    // rather than render nothing. Silently rendering nothing is how the
    // silent-video defect happened.
    if (directive && directive.composition) {
      const v = validateScene(directive.composition);
      if (v.ok) {
        scene.composition = directive.composition;
        scene.compositionCoverage = v.coverage;
      } else {
        warnings.push(
          `beat ${i}: composition rejected (${v.errors[0]}) — falling back to mechanism ${scene.mechanism}`
        );
      }
    }

    // NARRATIVE TYPOGRAPHY, not a caption. The on-screen phrase is never the
    // raw voiceover sentence (that is a word-for-word subtitle — Bible TYP-04
    // — and it overflows the safe width). Gemini's directed phrase is the
    // intent; both it and the no-directive fallback are normalised through
    // the shared narrative-typography budget so the phrase recorded on the
    // beat (and therefore in the render manifest the auditor reads) is the
    // same single-line phrase the renderer will actually draw.
    // A DIRECTED beat with no phrase is deliberately TEXT-FREE.
    //
    // The old fallback ran condenseToPhrase(text) whenever no phrase was
    // directed, which substituted the narration sentence. That silently
    // defeated the whole enforcement path: run 35290591724 applied and
    // verified "at most 2 beats carry text" three times and the auditor kept
    // measuring 4/6, because clearing typography_direction made this line
    // put the transcript back on screen. A directive that the render undoes
    // is not enforcement.
    //
    // The fallback is still correct for an UNDIRECTED beat — no plan at all
    // means the deterministic classifier chose the scene and a condensed
    // phrase is the best available text. The distinction is whether Gemini
    // directed this beat, not whether a phrase happens to be present.
    const directed = directive?.typography_direction?.phrase || directive?.visual_headline;
    const deliberatelyTextFree = !!directive && !directed;
    const displayText = directed
      ? condenseToPhrase(directed, TYPO_TARGET_MAX_WORDS)
      : deliberatelyTextFree
        ? ""
        : condenseToPhrase(text, TYPO_TARGET_MAX_WORDS);

    // TEXT-FREE MEANS THE SCENE DRAWS NO NARRATIVE STRING.
    //
    // Clearing only the typography phrase was not enough. A beat directed
    // text-free still had its mechanism draw expected/actual (or
    // cause/effect) labels, because those live on scene.objects rather than
    // in typography_direction. Gemini saw the result and reported "text
    // incorrectly inserted into intermediate beats that specifically
    // directed no on-screen text" with headline=4 (run 35356611503) — it
    // asked for silence on those beats and the renderer talked over it.
    //
    // Value-role labels (a figure, a magnitude) are left alone: they are
    // data, not a phrase, and a chart may still label its bar.
    if (deliberatelyTextFree && Array.isArray(scene.objects)) {
      const narrativeIds = new Set(narrativeObjectIds(scene.mechanism));
      for (const o of scene.objects) {
        if (o && narrativeIds.has(o.id) && o.label) o.label = "";
      }
    }

    const transition = i === 0
      ? "CUT"
      : TRANSITIONS[Math.floor(rng() * TRANSITIONS.length)];

    beats.push({
      beat_id: `d${i}`,
      start_frame: cue.startFrame,
      duration_frames: cue.durationInFrames,
      text: displayText,
      original_text: text,
      treatment: scene.mechanism,
      reason: scene.reason,
      visual_goal: directive?.reason || scene.reason,
      typography_role: scene.typography.role,
      carries_forward: scene.carries_forward || directive?.carries_forward || null,
      emotional_weight: scene.emotional_weight || directive?.emotional_weight || "calm",
      scene,
      words: wordTimings(displayText, cue.durationInFrames),
      transition_in: transition,
    });

    prevScene = scene;
  });

  const dist = {};
  for (const b of beats) dist[b.treatment] = (dist[b.treatment] || 0) + 1;
  const total = beats.length;
  const typoPct = ((dist.TYPOGRAPHY || 0) / Math.max(1, total) * 100).toFixed(0);
  if (+typoPct > 70) {
    warnings.push(`${typoPct}% of beats are typography-only — the script may lack visual narrative structure`);
  }

  return { beats, warnings, distribution: dist };
}
