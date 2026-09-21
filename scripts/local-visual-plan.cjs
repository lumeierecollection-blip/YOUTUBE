#!/usr/bin/env node
/**
 * Local Visual Plan Generator — rule-based fallback when Gemini is unavailable.
 *
 * Reads an SRT file, splits into sentences (one per cue), and produces
 * one beat per sentence using only rule-based logic. No API calls.
 *
 * Usage:
 *   node scripts/local-visual-plan.cjs --srt <path> --channel <id> --out <plan.json>
 *
 * Output matches the visual-plan.json schema consumed by render.js and
 * the visual director.
 */

const { readFileSync, writeFileSync, mkdirSync, existsSync } = require("node:fs");
const { join, dirname, basename } = require("node:path");

/* ── SRT Parsing ─────────────────────────────────────────────────── */

function parseSrt(srtText) {
  const blocks = srtText.replace(/\r\n/g, "\n").split(/\n\n+/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;
    const [a, b] = lines[1].split(" --> ");
    if (!a || !b) continue;
    const toMs = (t) => {
      const [h, m, rest] = t.trim().split(":");
      const [s, ms] = rest.split(",");
      return (+h * 3600 + +m * 60 + +s) * 1000 + +ms;
    };
    cues.push({
      index: cues.length,
      text: lines.slice(2).join(" ").trim(),
      startMs: toMs(a),
      endMs: toMs(b),
    });
  }
  return cues;
}

/* ── POS-lite Heuristics ─────────────────────────────────────────── */

const ARTICLES = /^(the|a|an)$/i;
const STOPWORDS = /^(is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|shall|should|may|might|can|could|must|need|dare|ought|used|to|of|in|for|on|with|at|by|from|as|into|through|during|before|after|above|below|between|under|again|further|then|once|here|there|when|where|why|how|all|each|every|both|few|more|most|other|some|such|no|not|only|own|same|so|than|too|very|just|because|but|and|or|if|while|that|this|these|those|it|its|they|them|their|what|which|who|whom|when|where|how)$/i;
const VERBS = /^(think|say|save|spend|earn|pay|buy|sell|lose|find|keep|make|take|give|get|go|come|see|know|tell|ask|help|try|start|stop|need|want|use|look|put|mean|become|leave|call|set|move|turn|show|run|grow|shrink|break|fail|collapse|crack|shatter|compare|versus|lead|result|cause|trigger|reveal|expose|prove|change|transform|wipe|disappear|add|recommend|support|freelance|search)$/i;

function extractSubject(text) {
  const words = text.split(/\s+/);
  // Look for noun phrase: article + words, or capitalized words
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/[^a-zA-Z'-]/g, "");
    if (!w) continue;
    if (ARTICLES.test(w) && i + 1 < words.length) {
      // Collect the noun phrase after article
      const phrase = [];
      for (let j = i + 1; j < Math.min(i + 5, words.length); j++) {
        const ww = words[j].replace(/[^a-zA-Z'-]/g, "");
        if (!ww || STOPWORDS.test(ww) || VERBS.test(ww)) break;
        phrase.push(ww);
      }
      if (phrase.length > 0) return phrase.join(" ");
    }
    // Capitalized word that isn't first word (proper noun)
    if (i > 0 && /^[A-Z]/.test(w) && !STOPWORDS.test(w) && !VERBS.test(w)) {
      return w;
    }
  }
  // Fallback: first non-stopword, non-verb
  for (const w of words) {
    const clean = w.replace(/[^a-zA-Z'-]/g, "");
    if (clean && !STOPWORDS.test(clean) && !VERBS.test(clean) && clean.length > 2) {
      return clean;
    }
  }
  return words[0] || "subject";
}

function extractAction(text) {
  const words = text.toLowerCase().split(/\s+/);
  for (const w of words) {
    const clean = w.replace(/[^a-z'-]/g, "");
    if (VERBS.test(clean)) return clean;
  }
  return null;
}

function extractNumber(text) {
  // Look for digits, ordinals, percentages
  const match = text.match(/\b(\d[\d,.]*%?|\d+(?:st|nd|rd|th)?)\b/);
  return match ? match[1] : null;
}

/* ── Mechanism Lookup ─────────────────────────────────────────────── */

const ACTION_MAP = [
  [/grow|increase|rise|accumulate|build/i, "PHYSICAL_GROWTH"],
  [/shrink|decrease|fall|drop|deplete|drain|wipe|disappear/i, "VISIBLE_CONSUMPTION"],
  [/break|fail|shatter|collapse|crack/i, "SURFACE_AND_BENEATH"],
  [/compare|versus|vs|than|difference|more|less/i, "PROPORTIONAL_OBJECTS"],
  [/cause|lead|result|because|trigger|make|add/i, "ACTION_CONSEQUENCE"],
  [/show|reveal|expose|display|prove/i, "EVIDENCE_FIGURE"],
  [/change|become|turn|transform/i, "STATE_CHANGE"],
];

const SUBJECT_MAP = [
  [/person|worker|seeker|family|professional|host|expert|freelancer|individual|someone|people/i, "EVIDENCE_FIGURE"],
  [/chart|graph|data|statistic|number|percent|survey|report|figure/i, "PROPORTIONAL_OBJECTS"],
  [/money|dollar|savings|fund|balance|cost|price|expense|budget|rent|income/i, "PHYSICAL_GROWTH"],
  [/month|week|year|day|time|job|search/i, "STATE_CHANGE"],
];

function assignMechanism(text, index, totalBeats) {
  const lower = text.toLowerCase();

  // Action-based matching (first match wins)
  for (const [re, mech] of ACTION_MAP) {
    if (re.test(lower)) return mech;
  }

  // Subject-based matching
  for (const [re, mech] of SUBJECT_MAP) {
    if (re.test(lower)) return mech;
  }

  // Default: ACTION_CONSEQUENCE (TYPOGRAPHY is assigned deliberately, not as default)
  return "ACTION_CONSEQUENCE";
}

/* ── Visual Headline Generator ────────────────────────────────────── */

function generateHeadline(text, mechanism, number, subject) {
  const words = text.split(/\s+/);
  const maxLen = 8;

  switch (mechanism) {
    case "PHYSICAL_GROWTH":
      return number ? `${number} ${subject}`.slice(0, 60) : `Growing ${subject}`.slice(0, 60);
    case "VISIBLE_CONSUMPTION":
      return number ? `${number} gone` : `${subject} depleting`;
    case "SURFACE_AND_BENEATH":
      return `${subject}: surface vs reality`.slice(0, 60);
    case "PROPORTIONAL_OBJECTS":
      return number ? `${number} ${subject}`.slice(0, 60) : `Comparing ${subject}`.slice(0, 60);
    case "ACTION_CONSEQUENCE":
      return words.slice(0, maxLen).join(" ");
    case "EVIDENCE_FIGURE":
      return number ? `${number}` : `${subject}`.slice(0, 60);
    case "STATE_CHANGE":
      return words.slice(0, maxLen).join(" ");
    case "TYPOGRAPHY":
      return words.slice(0, maxLen).join(" ");
    default:
      return words.slice(0, maxLen).join(" ");
  }
}

/* ── Mechanism Distribution Cap ───────────────────────────────────── */

function capMechanisms(beats) {
  const total = beats.length;
  const maxPct = 0.40;

  // Count current distribution (excluding TYPOGRAPHY which is handled separately)
  const counts = {};
  for (const b of beats) {
    if (b.mechanism !== "TYPOGRAPHY") {
      counts[b.mechanism] = (counts[b.mechanism] || 0) + 1;
    }
  }

  // Check if any non-TYPOGRAPHY mechanism exceeds 40% cap
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 10) {
    changed = false;
    iterations++;
    for (const [mech, count] of Object.entries(counts)) {
      const pct = count / total;
      if (pct > maxPct) {
        const excess = Math.ceil(count - total * maxPct);
        let reassigned = 0;
        for (const b of beats) {
          if (reassigned >= excess) break;
          if (b.mechanism === mech) {
            b.mechanism = "ACTION_CONSEQUENCE";
            b.reason = `Reassigned from ${mech} (cap exceeded)`;
            reassigned++;
          }
        }
        counts[mech] -= reassigned;
        counts["ACTION_CONSEQUENCE"] = (counts["ACTION_CONSEQUENCE"] || 0) + reassigned;
        changed = true;
      }
    }
  }

  return beats;
}

/* ── Typography Rules ────────────────────────────────────────────── */

function applyTypographyRules(beats) {
  const total = beats.length;
  const TYPO_MAX = 2;

  // Rule A: Hook (beat 0) is always TYPOGRAPHY
  if (total > 0) {
    beats[0].mechanism = "TYPOGRAPHY";
    beats[0].reason = "Rule A: hook is always TYPOGRAPHY";
  }

  // Rule B: CTA (last beat) is always TYPOGRAPHY
  if (total > 1) {
    beats[total - 1].mechanism = "TYPOGRAPHY";
    beats[total - 1].reason = "Rule B: CTA is always TYPOGRAPHY";
  }

  // Count TYPOGRAPHY beats
  let typoCount = beats.filter(b => b.mechanism === "TYPOGRAPHY").length;

  // Rule D: TYPOGRAPHY never exceeds 2 regardless of length
  if (typoCount > TYPO_MAX) {
    // Reassign extras (keep hook and CTA, reassign middle ones)
    let reassigned = 0;
    for (let i = 1; i < total - 1 && typoCount > TYPO_MAX; i++) {
      if (beats[i].mechanism === "TYPOGRAPHY") {
        beats[i].mechanism = "ACTION_CONSEQUENCE";
        beats[i].reason = "Reassigned from TYPOGRAPHY (max 2 allowed)";
        typoCount--;
        reassigned++;
      }
    }
  }

  // Rule C: If only 1 TYPOGRAPHY beat (short video), one additional may become TYPOGRAPHY
  // only if the sentence has no concrete subject and no action — pure abstract claim
  if (typoCount < 2 && total > 2) {
    for (let i = 1; i < total - 1; i++) {
      if (typoCount >= 2) break;
      if (beats[i].mechanism !== "TYPOGRAPHY") {
        // Check if this beat has no concrete subject and no action
        const text = beats[i].original_text || beats[i].visual_headline || "";
        const subject = extractSubject(text);
        const action = extractAction(text);
        // Pure abstract claim: no action, and subject is generic
        if (!action && /^(difference|result|recommendation|advice|standard|number|amount)$/i.test(subject)) {
          beats[i].mechanism = "TYPOGRAPHY";
          beats[i].reason = "Rule C: pure abstract claim — no concrete subject/action";
          typoCount++;
        }
      }
    }
  }

  return beats;
}

/* ── Beat-to-Plan Conversion ──────────────────────────────────────── */

function buildBeat(cue, mechanism, headline, reason, number) {
  // Map mechanism to visual_event type
  const eventMap = {
    "PHYSICAL_GROWTH": "growth",
    "VISIBLE_CONSUMPTION": "depletion",
    "SURFACE_AND_BENEATH": "revelation",
    "PROPORTIONAL_OBJECTS": "comparison",
    "ACTION_CONSEQUENCE": "causation",
    "EVIDENCE_FIGURE": "evidence",
    "STATE_CHANGE": "contrast",
    "TYPOGRAPHY": "evidence",
  };

  const capMap = {
    "PHYSICAL_GROWTH": ["growth"],
    "VISIBLE_CONSUMPTION": ["depletion"],
    "SURFACE_AND_BENEATH": ["structure_break", "revelation"],
    "PROPORTIONAL_OBJECTS": ["comparison", "population"],
    "ACTION_CONSEQUENCE": ["causation"],
    "EVIDENCE_FIGURE": ["evidence", "accumulation"],
    "STATE_CHANGE": ["contrast"],
    "TYPOGRAPHY": ["evidence"],
  };

  const objects = [];
  const compositionObjects = [];

  switch (mechanism) {
    case "STATE_CHANGE":
      objects.push(
        { label_a: "EXPECTED", label_b: "ACTUAL" },
      );
      compositionObjects.push(
        { kind: "field", anchor: "center", motion: "static", label: "EXPECTED", emphasis: false },
        { kind: "field", anchor: "center", motion: "fade_in", label: "ACTUAL", emphasis: true },
      );
      break;
    case "EVIDENCE_FIGURE":
      objects.push({ figure: number || headline });
      compositionObjects.push(
        { kind: "field", anchor: "center", motion: "grow", label: number || headline, count: number ? parseInt(number) || 1 : 1, emphasis: true },
      );
      break;
    case "ACTION_CONSEQUENCE":
      objects.push({ cause: "CAUSE", effect: "EFFECT" });
      compositionObjects.push(
        { kind: "block", anchor: "upper", motion: "static", label: "CAUSE", emphasis: false },
        { kind: "block", anchor: "lower", motion: "slide_in", label: "EFFECT", emphasis: true },
      );
      break;
    case "PHYSICAL_GROWTH":
      objects.push({ figure: number || headline });
      compositionObjects.push(
        { kind: "block", anchor: "center", motion: "grow", label: headline, emphasis: true },
        { kind: "field", anchor: "beside_subject", motion: "fade_in", label: number || "", emphasis: false },
      );
      break;
    case "VISIBLE_CONSUMPTION":
      objects.push({ figure: number || headline });
      compositionObjects.push(
        { kind: "stack", anchor: "center", motion: "static", label: "total", emphasis: false },
        { kind: "block", anchor: "overlay", motion: "shrink", label: number || headline, emphasis: true },
      );
      break;
    case "SURFACE_AND_BENEATH":
      objects.push({ label_a: "CLAIM", label_b: "REALITY" });
      compositionObjects.push(
        { kind: "field", anchor: "top", motion: "static", label: "CLAIM", emphasis: false },
        { kind: "field", anchor: "center", motion: "slide_in", label: "REALITY", emphasis: true },
      );
      break;
    case "PROPORTIONAL_OBJECTS":
      objects.push({ label_a: "A", label_b: "B" });
      compositionObjects.push(
        { kind: "bar", anchor: "left", motion: "grow", label: "A", emphasis: false },
        { kind: "bar", anchor: "right", motion: "grow", label: "B", emphasis: true },
      );
      break;
    default: // TYPOGRAPHY
      compositionObjects.push(
        { kind: "field", anchor: "center", motion: "fade_in", label: headline, emphasis: true },
      );
      break;
  }

  const emphasisWords = headline.split(/\s+/).slice(0, 3);

  return {
    index: cue.index,
    mechanism,
    visual_headline: headline,
    reason,
    emphasis_words: emphasisWords,
    visual_events: [{ type: eventMap[mechanism] || "evidence", label: headline }],
    capabilities: capMap[mechanism] || ["evidence"],
    objects: objects[0] || {},
    composition: { objects: compositionObjects },
    carries_forward: null,
    emotional_weight: "calm",
    typography_direction: {
      phrase: headline,
      why: reason,
      moment: cue.index === 0 ? "hook" : "statement",
      single_line: true,
      not_a_headline: true,
      not_a_transcript: true,
      relation_to_visual: "Text reinforces the narration",
    },
    direction: {
      narrative_purpose: reason,
      subject: headline,
      environment: "clean data void",
      action_start: "empty",
      action_end: "populated",
      camera: "hold",
      motion: "fade_in",
      typography: headline,
      sound: "silence",
      consequence: reason,
      muted_read: headline,
      why_visual: `Visualizes: ${reason}`,
      graph_justified: false,
    },
  };
}

/* ── Main ─────────────────────────────────────────────────────────── */

function main() {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };

  const srtPath = flag("--srt");
  const channelId = flag("--channel");
  const outPath = flag("--out");

  if (!srtPath || !channelId || !outPath) {
    console.error("Usage: node local-visual-plan.cjs --srt <path> --channel <id> --out <plan.json>");
    process.exit(1);
  }

  if (!existsSync(srtPath)) {
    console.error(`SRT not found: ${srtPath}`);
    process.exit(1);
  }

  const srtText = readFileSync(srtPath, "utf-8");
  const cues = parseSrt(srtText);

  if (cues.length === 0) {
    console.error("No cues found in SRT.");
    process.exit(1);
  }

  console.log(`Local plan: ${cues.length} cues from ${basename(srtPath)}`);

  // Build beats with mechanism assignment
  let beats = cues.map((cue) => {
    const text = cue.text;
    const subject = extractSubject(text);
    const action = extractAction(text);
    const number = extractNumber(text);
    const mechanism = assignMechanism(text, cue.index, cues.length);
    const headline = generateHeadline(text, mechanism, number, subject);
    const reason = `Rule-based: subject="${subject}", action="${action || "none"}", number=${number || "none"} → ${mechanism}`;

    return buildBeat(cue, mechanism, headline, reason, number);
  });

  // Apply typography rules (hook/CTA always TYPOGRAPHY, max 2)
  beats = applyTypographyRules(beats);

  // Cap non-TYPOGRAPHY mechanisms at 40%
  beats = capMechanisms(beats);

  // Log distribution in specified format
  const dist = {};
  for (const b of beats) dist[b.mechanism] = (dist[b.mechanism] || 0) + 1;
  const distStr = Object.entries(dist)
    .sort((a, b) => b[1] - a[1])
    .map(([mech, count]) => `${mech}:${count}`)
    .join(" ");
  console.log(`[local-plan] ${beats.length} beats: ${distStr}`);

  // Validate TYPOGRAPHY count (must be 1–2)
  const typoCount = dist.TYPOGRAPHY || 0;
  if (typoCount < 1 || typoCount > 2) {
    console.warn(`WARNING: TYPOGRAPHY count ${typoCount} violates rule (must be 1–2) — adjusting.`);
    // If 0, force hook to TYPOGRAPHY
    if (typoCount === 0 && beats.length > 0) {
      beats[0].mechanism = "TYPOGRAPHY";
      beats[0].reason = "Forced TYPOGRAPHY on hook (was 0)";
      dist.TYPOGRAPHY = 1;
      dist[beats[0].mechanism === "TYPOGRAPHY" ? "ACTION_CONSEQUENCE" : beats[0].mechanism] =
        (dist[beats[0].mechanism === "TYPOGRAPHY" ? "ACTION_CONSEQUENCE" : beats[0].mechanism] || 1) - 1;
    }
    // If >2, reassign extras
    if (typoCount > 2) {
      let toReassign = typoCount - 2;
      for (let i = 1; i < beats.length - 1 && toReassign > 0; i++) {
        if (beats[i].mechanism === "TYPOGRAPHY") {
          beats[i].mechanism = "ACTION_CONSEQUENCE";
          beats[i].reason = "Adjusted: TYPOGRAPHY exceeded max 2";
          toReassign--;
        }
      }
    }
  }

  // Final validation: no mechanism over 40%
  for (const [mech, count] of Object.entries(dist)) {
    const pct = ((count / beats.length) * 100).toFixed(0);
    if (+pct > 40) {
      console.warn(`WARNING: ${mech} at ${pct}% exceeds 40% cap.`);
    }
  }

  const plan = {
    generatedAt: new Date().toISOString(),
    source: "local",
    totalBeats: beats.length,
    iteration: 1,
    beats,
  };

  // Ensure output directory exists
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(plan, null, 2));
  console.log(`Local plan written: ${outPath} (${beats.length} beats)`);
}

main();
