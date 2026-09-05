#!/usr/bin/env node
/**
 * Step 4 — the plan generator. Stage B of section 3, and the producer of the
 * section-5 plan document.
 *
 *   node scripts/build-visual-plan.js --channel ch-01 \
 *     --script data/research/1/debt-snowball-vs-debt-avalanche-shorts-script.json \
 *     --out data/plans/ch-01-debt-snowball.plan.txt
 *
 * WHAT IT IS ALLOWED TO DO, AND THE LINE IT DOES NOT CROSS
 *
 * Section 3, Stage B: parse the script for facts and data points, select the
 * template for the beat's semantic strategy, fill the template's declared
 * parameters, and stop. It may not choose an environment, an object, a camera
 * move, a transition or a typeface — those were decided at design time and are
 * read straight off the template. Every one of those is already enforced
 * upstream by `gate-scene-templates.js`, so by the time a template reaches this
 * file it is guaranteed to be inside its channel's declared identity.
 *
 * SECTION 3'S ABORT IS REAL HERE. A beat whose strategy has no template for
 * this channel stops the run. There is no generic template, no nearest match
 * and no fallback: with 48 of 51 (channel, strategy) pairs currently
 * untemplated, a fallback would quietly become the whole system, which is
 * exactly the monoculture this architecture exists to end.
 *
 * EXTRACTION IS GROUNDED OR IT DOES NOT HAPPEN. Every parameter declares a
 * `from` naming which extractor may supply it. Each extractor reads the
 * script's own sentences and records the sentence index it took the value
 * from, which is what the plan's DATA FILLED section prints. Nothing is
 * inferred, rounded, prettified or supplied from general knowledge; a required
 * parameter with no match in the script is an abort, not a default.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { paletteRoles } from "../src/skills/remotion-render/visual/palette-roles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FPS = 30;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=").slice(1).join("=") : fallback;
}

const die = (msg) => { console.error(`\nplan generation ABORTED\n  ${msg}\n`); process.exit(1); };

function loadTemplates(channelId) {
  const dir = join(ROOT, "config", "templates");
  if (!existsSync(dir)) return new Map();
  const m = new Map();
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const doc = JSON.parse(readFileSync(join(dir, f), "utf-8"));
    if (doc.channel_id === channelId) m.set(doc.strategy, doc);
  }
  return m;
}

/**
 * Sentences, with their index, because every extracted value has to name where
 * it came from. Splitting on sentence-final punctuation followed by a space is
 * crude but auditable: the plan prints the sentence number, so a wrong split
 * is visible rather than silent.
 */
function sentencesOf(script) {
  const out = [];
  const sections = Array.isArray(script.sections) ? script.sections : [];
  for (const s of sections) {
    const vo = String(s.voiceover || "").trim();
    if (!vo) continue;
    for (const part of vo.split(/(?<=[.!?])\s+/)) {
      const t = part.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

/**
 * The extractors. One per `from` value in the template schema. Each returns
 * `{ value, sentence }` or null — never a guess.
 */
const EXTRACTORS = {
  "script-number": (sents) => {
    for (let i = 0; i < sents.length; i++) {
      const m = /(?:[$£€]\s?)?\d[\d,]*(?:\.\d+)?%?/.exec(sents[i]);
      if (m) return { value: m[0], sentence: i + 1 };
    }
    return null;
  },
  "script-date": (sents) => {
    for (let i = 0; i < sents.length; i++) {
      const m = /\b(1[5-9]\d{2}|20\d{2})\b/.exec(sents[i]);
      if (m) return { value: m[0], sentence: i + 1 };
    }
    return null;
  },
  "script-entity": (sents) => {
    for (let i = 0; i < sents.length; i++) {
      // A capitalised word that is not the sentence's first word.
      const m = /(?:^|[^.!?]\s)([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})*)/.exec(" " + sents[i]);
      if (m && m[1]) return { value: m[1], sentence: i + 1 };
    }
    return null;
  },
  "script-phrase": (sents) => (sents.length ? { value: sents[0], sentence: 1 } : null),
  /**
   * A list is only a list if the script actually enumerates. Either an
   * "a, b and c" run inside one sentence, or consecutive sentences opened by an
   * ordinal connective. Anything else returns null and, for a required
   * parameter, aborts — a template that repeats an object over a list must not
   * be handed a list this script never stated.
   */
  "script-list": (sents, max) => {
    for (let i = 0; i < sents.length; i++) {
      const m = /([^,.]+(?:,\s*[^,.]+){1,}(?:,?\s+(?:and|or)\s+[^,.]+))/.exec(sents[i]);
      if (m) {
        const items = m[1].split(/,\s*|\s+(?:and|or)\s+/).map((x) => x.trim()).filter(Boolean);
        if (items.length >= 2) return { value: items.slice(0, max || items.length), sentence: i + 1 };
      }
    }
    const ordinal = /^(first|second|third|fourth|fifth|next|then|finally|lastly)\b/i;
    const run = [];
    let start = 0;
    for (let i = 0; i < sents.length; i++) {
      if (ordinal.test(sents[i])) { if (!run.length) start = i + 1; run.push(sents[i].replace(ordinal, "").replace(/^[,\s]+/, "")); }
      else if (run.length >= 2) break;
      else run.length = 0;
    }
    if (run.length >= 2) return { value: run.slice(0, max || run.length), sentence: start };
    return null;
  },
};

function fillTemplate(tpl, sents) {
  const filled = {};
  for (const [name, decl] of Object.entries(tpl.parameters || {})) {
    const ex = EXTRACTORS[decl.from];
    if (!ex) die(`template ${tpl.name} declares parameter "${name}" from unknown extractor "${decl.from}"`);
    const got = ex(sents, decl.max_items);
    if (!got) {
      if (decl.required !== false) {
        die(`template ${tpl.name} requires parameter "${name}" (${decl.from}) and the script contains no value for it.\n` +
            `  Section 4.5's rule applies to data as well as assets: stop and report, do not substitute.`);
      }
      continue;
    }
    filled[name] = got;
  }
  return filled;
}


/**
 * How many copies of a repeating object to draw.
 *
 * A list repeats once per item. A NUMBER does not: the first version of this
 * took `.length` of the extracted value, so `total = "$215"` drew four bank
 * statements — the character count of the string, presented as a quantity.
 * A count read off a total is capped by the template's own `max_items` and is
 * always accompanied by `repeat_note`, because N drawn objects otherwise reads
 * as a claim that there are N of them.
 */
function repeatCount(obj, tpl, filled) {
  if (!obj.repeats || !filled[obj.repeats]) return 1;
  const decl = tpl.parameters[obj.repeats] || {};
  const got = filled[obj.repeats].value;
  if (decl.type === "list") return Array.isArray(got) ? got.length : 1;
  const n = Number(String(got).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.min(decl.max_items || 6, Math.round(n)));
}


/**
 * The same resolved template, in the shape the renderer consumes. Every value
 * here also appears in the section-5 text; neither is derived from the other,
 * both are derived from the template plus the extracted data, so a discrepancy
 * between them is impossible by construction rather than by discipline.
 */
function structurePlan({ cid, channel, tpl, filled, beat }) {
  const at = (f) => Math.round(beat.startFrame + f * beat.durationInFrames);
  return {
    version: 1,
    channel_id: cid,
    template: tpl.name,
    strategy: tpl.strategy,
    intent: tpl.intent,
    beat,
    palette: { primary: channel.primary_palette, secondary: channel.secondary_palette },
    fonts: { primary: channel.typography_primary, secondary: channel.typography_secondary },
    environment: tpl.environment,
    motion_curve: channel.motion_curve,
    framing: channel.framing_default,
    negative_space: channel.use_of_negative_space,
    objects: tpl.objects.map((o) => ({
      object: o.object,
      role: o.role,
      anchor: o.anchor,
      count: repeatCount(o, tpl, filled),
      repeat_note: o.repeat_note || null,
    })),
    camera: tpl.camera_path.map((k) => ({ frame: at(k.at), move: k.move, target: k.target || null, reason: k.reason })),
    typography: tpl.typography.map((t) => {
      const m = /^\{([a-z0-9_]+)\}$/i.exec(t.slot);
      const v = m ? (filled[m[1]] ? filled[m[1]].value : null) : t.slot;
      return v == null ? null : {
        text: Array.isArray(v) ? v.join(", ") : String(v),
        face: t.face, placement: t.placement,
        from: at(t.in_at), to: at(t.out_at),
      };
    }).filter(Boolean),
    transitions: tpl.transitions.map((t) => ({ to: t.to, type: t.type, duration_frames: t.duration_frames })),
    data: Object.fromEntries(Object.entries(filled).map(([k, v]) => [k, { value: v.value, from_sentence: v.sentence }])),
  };
}

function renderPlan({ channel, tpl, filled, beat }) {
  const dur = beat.durationInFrames;
  const at = (f) => Math.round(beat.startFrame + f * dur);
  const L = [];
  L.push("TEMPLATE SELECTED");
  L.push(`  ${tpl.name}   (channel ${tpl.channel_id}, strategy ${tpl.strategy})`);
  L.push(`  intent: ${tpl.intent}`);
  L.push("");

  L.push("DATA FILLED");
  if (!Object.keys(filled).length) L.push("  (none — this template declares no parameters that the script supplied)");
  for (const [k, v] of Object.entries(filled)) {
    const shown = Array.isArray(v.value) ? v.value.join(" | ") : v.value;
    L.push(`  ${k} = ${shown}   from script sentence ${v.sentence}`);
  }
  L.push("");

  L.push("ASSET REFERENCES");
  L.push("  (none — this template draws its own environment and objects; no external media is referenced)");
  L.push("");

  L.push("TIMING AND DURATION");
  L.push(`  beat: start frame ${beat.startFrame}, duration ${dur} frames at ${FPS} fps`);
  for (const o of tpl.objects) {
    L.push(`  ${o.object} (${o.role}) x${repeatCount(o, tpl, filled)}  anchor ${o.anchor.x},${o.anchor.y} scale ${o.anchor.scale ?? 1}`);
    if (o.repeat_note) L.push(`     ${o.repeat_note}`);
  }
  L.push("");

  L.push("TEXT CONTENT");
  if (!tpl.typography.length) L.push("  (none)");
  for (const t of tpl.typography) {
    const m = /^\{([a-z0-9_]+)\}$/i.exec(t.slot);
    const text = m ? (filled[m[1]] ? filled[m[1]].value : null) : t.slot;
    if (text == null) { L.push(`  ${t.slot}: omitted, the optional parameter was not present in the script`); continue; }
    const face = t.face === "primary" ? channel.typography_primary : channel.typography_secondary;
    const shown = Array.isArray(text) ? text.join(", ") : String(text);
    L.push(`  "${shown}"`);
    if (shown.split(/\s+/).length > 8) {
      L.push(`     NOTE: ${shown.split(/\s+/).length} words. The repo already measures this as`);
      L.push(`     textNarrationRatio; a slot this long is the picture reciting the narration.`);
    }
    // The renderer DERIVES the caption colour from the palette rather than
    // reading an index, so the plan asks it the same question instead of
    // guessing. See src/skills/remotion-render/visual/palette-roles.js.
    const roles = paletteRoles({ primary: channel.primary_palette, secondary: channel.secondary_palette });
    L.push(`     face ${face} (${t.face}), placement ${t.placement}, colour ${roles.onGround} (mark on the ${roles.ground} ground)`);
    L.push(`     frames ${at(t.in_at)} to ${at(t.out_at)}`);
  }
  L.push("");

  L.push("TRANSITION SCHEDULE");
  if (!tpl.transitions.length) L.push("  (none)");
  for (const t of tpl.transitions) {
    L.push(`  -> ${t.to}: ${t.type}, ${t.duration_frames} frames, ending at frame ${beat.startFrame + dur}`);
  }
  L.push("");

  L.push("CAMERA MOTION SCRIPT");
  for (const k of tpl.camera_path) {
    L.push(`  frame ${at(k.at)}: ${k.move}${k.target ? ` toward ${k.target}` : ""}`);
    L.push(`     ${k.reason}`);
  }
  L.push("");
  return L.join("\n");
}

function main() {
  const cid = arg("channel");
  const scriptPath = arg("script");
  const out = arg("out");
  const strategy = arg("strategy", "ACCUMULATION");
  const startFrame = Number(arg("start", "0"));
  const durationInFrames = Number(arg("duration", "150"));
  if (!cid || !scriptPath) {
    console.error("usage: build-visual-plan.js --channel ch-01 --script <path> [--strategy ACCUMULATION] [--out <path>]");
    process.exit(1);
  }

  const identity = JSON.parse(readFileSync(join(ROOT, "config", "visual-identity.json"), "utf-8")).channels || {};
  const channel = identity[cid];
  if (!channel) die(`channel ${cid} has no visual identity specification — nothing can be planned for it`);

  const templates = loadTemplates(cid);
  const tpl = templates.get(strategy);
  if (!tpl) {
    die(`no template for (${cid}, ${strategy}).\n` +
        `  Section 3: "If a script contains a semantic concept that does not have a corresponding\n` +
        `  template, the render must abort and notify the operator -- no fallback or generic\n` +
        `  template may be used."\n` +
        `  Templates present for ${cid}: ${[...templates.keys()].join(", ") || "(none)"}`);
  }

  const script = JSON.parse(readFileSync(join(ROOT, scriptPath), "utf-8"));
  const sents = sentencesOf(script);
  if (!sents.length) die(`${scriptPath} has no voiceover sentences to extract from`);

  const filled = fillTemplate(tpl, sents);
  const beat = { startFrame, durationInFrames };
  const structured = structurePlan({ cid, channel, tpl, filled, beat });
  const plan = renderPlan({ channel, tpl, filled, beat });

  if (out) {
    mkdirSync(dirname(join(ROOT, out)), { recursive: true });
    writeFileSync(join(ROOT, out), plan);
    // The renderer is a pure function of the plan (section 6) and parsing the
    // section-5 prose to drive pixels would be fragile. Both serialisations come
    // from ONE resolution of the template, so they cannot disagree: the .txt is
    // the human artefact section 5 mandates, the .json is the same content in the
    // shape the renderer consumes.
    const jsonPath = join(ROOT, out).replace(/\.txt$/, "") + ".json";
    writeFileSync(jsonPath, JSON.stringify(structured, null, 2) + "\n");
    console.log(`wrote ${out}`);
    console.log(`wrote ${jsonPath.replace(ROOT + "/", "")}`);
  } else {
    console.log(plan);
  }
}

main();
