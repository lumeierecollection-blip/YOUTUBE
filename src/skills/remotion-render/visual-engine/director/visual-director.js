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

  cues.forEach((cue, i) => {
    const text = (cue.text || "").trim();
    if (!text) return;

    const scene = randomizeScene(buildScene(text, i, cues.length, prevScene), rng);

    const transition = i === 0
      ? "CUT"
      : TRANSITIONS[Math.floor(rng() * TRANSITIONS.length)];

    beats.push({
      beat_id: `d${i}`,
      start_frame: cue.startFrame,
      duration_frames: cue.durationInFrames,
      text,
      treatment: scene.mechanism,
      reason: scene.reason,
      visual_goal: scene.reason,
      typography_role: scene.typography.role,
      scene,
      words: wordTimings(text, cue.durationInFrames),
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
