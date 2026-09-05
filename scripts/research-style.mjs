#!/usr/bin/env node
/**
 * Section 1 — the pre-render research phase, as tooling.
 *
 *   node scripts/research-style.mjs query   --channel ch-01 --style motion-graphics
 *   node scripts/research-style.mjs scaffold --channel ch-01 --style motion-graphics
 *   node scripts/research-style.mjs build    --channel ch-01 --style motion-graphics
 *   node scripts/research-style.mjs verify   --channel ch-01 --style motion-graphics
 *
 * WHAT THIS TOOL DOES, AND THE ONE THING IT REFUSES TO DO
 *
 * Section 1.4 asks for nine attributes per reference, among them "the exact
 * hex codes used most frequently" and the motion curves. Those are
 * MEASUREMENTS of a video. Nothing in this repo may fill a gap like that from
 * general knowledge and call it researched (CLAUDE.md, hard rules), so this
 * tool never authors an attribute. It builds the query, holds the worksheet,
 * enforces section 1.3's floor of ten professional references, consolidates by
 * section 1.5's rule, and freezes the result per 1.6.
 *
 * WHO FILLS IT IN. Whoever can actually see the references. Measured on this
 * machine: curl to behance.net, vimeo.com, awwwards.com and elements.envato.com
 * all return 000 — a script here has no egress at all, so `build` cannot fetch
 * and will not pretend to. The worksheet is designed to be filled by a human,
 * or by an agent that does have both network and vision, and every attribute
 * carries the source it came from so the Style Reference Document can be
 * audited back to a real page or frame.
 *
 * THE FOUR VERBS
 *
 *   query     prints the section-1.2 query string, verbatim, for the channel's
 *             real topic and the given style. Nothing else. Run it, search it.
 *   scaffold  writes an empty worksheet with one block per reference slot and
 *             every 1.4 attribute set to null. Never overwrites.
 *   build     reads the filled worksheet and writes the Style Reference
 *             Document: the most common value per attribute (1.5), ties broken
 *             toward the highest-rated source, attributes with too little
 *             evidence left explicitly UNRESOLVED rather than guessed.
 *   verify    re-hashes a built document against its worksheet. Section 1.6
 *             makes the document immutable; this is how an edit is detected.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "docs", "style-reference");

/** Section 1.3 — "at least 10 distinct reference videos or design portfolios". */
const MIN_REFERENCES = 10;
/**
 * An attribute is only consolidated if at least this many references supplied
 * it. Section 1.5 says take the most common value; a "most common" drawn from
 * one reference out of ten is not a consensus, it is that one reference.
 */
const MIN_EVIDENCE = 3;

/** Section 1.4, verbatim, in order. */
const ATTRIBUTES = [
  "dominant_colour_palette",
  "typography_family_and_weight",
  "camera_movement_patterns",
  "transition_styles",
  "framing_conventions",
  "negative_space_ratio",
  "on_screen_text_frequency_and_placement",
  "iconography_and_graphical_elements",
  "motion_curves_and_easing",
];

/**
 * Section 1.3 — "professional sources ... Exclude amateur content." Recorded
 * per reference so the 1.5 tie-break ("the attribute that appears most
 * authoritative, i.e. from the highest-quality source") has something real to
 * sort on instead of an opinion formed at consolidation time.
 */
const SOURCE_TIERS = ["design-award", "agency-showreel", "recognised-creator"];

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=").slice(1).join("=") : fallback;
}

function channelOf(cid) {
  const all = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8")).channels;
  const c = all.find((x) => x.channel_id === cid);
  if (!c) {
    console.error(`no such channel: ${cid}`);
    process.exit(1);
  }
  return c;
}

/**
 * Section 1.2's pattern, exactly:
 *   "[current year] [channel topic] [visual style] video design trends professional editors"
 * The topic is the channel's own `niche`, reduced to its head phrase — the
 * parenthetical qualifier in "Personal Finance (Budgeting for Beginners)" is
 * the channel's editorial angle, not the subject a design search wants.
 */
function buildQuery(channel, style) {
  const topic = String(channel.niche || "").replace(/\s*\(.*?\)\s*/g, " ").trim();
  const year = new Date().getFullYear();
  return `${year} ${topic} ${style} video design trends professional editors`;
}

const slug = (cid, style) => `${cid}-${style}`;
const worksheetPath = (cid, style) => join(OUT_DIR, `${slug(cid, style)}.worksheet.json`);
const documentPath = (cid, style) => join(OUT_DIR, `${slug(cid, style)}.md`);

const hashOf = (obj) => createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 16);

function cmdQuery(channel, style) {
  console.log(buildQuery(channel, style));
}

function cmdScaffold(channel, style) {
  const p = worksheetPath(channel.channel_id, style);
  if (existsSync(p)) {
    console.error(`worksheet already exists: ${p}\nSection 1.6 makes research immutable — delete it deliberately if you mean to redo it.`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const blank = Object.fromEntries(ATTRIBUTES.map((a) => [a, { value: null, source: null }]));
  const sheet = {
    channel_id: channel.channel_id,
    channel_name: channel.channel_name,
    style,
    query: buildQuery(channel, style),
    searched_on: null,
    references: Array.from({ length: MIN_REFERENCES }, (_, i) => ({
      n: i + 1,
      url: null,
      title: null,
      source_tier: null,
      _source_tier_options: SOURCE_TIERS,
      attributes: JSON.parse(JSON.stringify(blank)),
    })),
    _howto: [
      `1. Run: node scripts/research-style.mjs query --channel ${channel.channel_id} --style ${style}`,
      "2. Search that exact string. Fill in >=10 references from professional sources only (1.3).",
      "3. For each reference, fill each attribute's `value` AND its `source` (a URL, a timestamp, a quote).",
      "4. Leave `value` null where you could not observe it. Null is a valid answer; a guess is not.",
      `5. Run: node scripts/research-style.mjs build --channel ${channel.channel_id} --style ${style}`,
    ],
  };
  writeFileSync(p, JSON.stringify(sheet, null, 2) + "\n");
  console.log(`wrote ${p}`);
  console.log(`query: ${sheet.query}`);
}

function cmdBuild(channel, style) {
  const wp = worksheetPath(channel.channel_id, style);
  if (!existsSync(wp)) {
    console.error(`no worksheet at ${wp} — run \`scaffold\` first.`);
    process.exit(1);
  }
  const sheet = JSON.parse(readFileSync(wp, "utf-8"));
  const filled = (sheet.references || []).filter((r) => r.url && r.source_tier);

  const problems = [];
  if (filled.length < MIN_REFERENCES) {
    problems.push(`only ${filled.length} references with a url and a source_tier — section 1.3 requires at least ${MIN_REFERENCES}`);
  }
  for (const r of filled) {
    if (!SOURCE_TIERS.includes(r.source_tier)) {
      problems.push(`reference ${r.n}: source_tier "${r.source_tier}" is not one of ${SOURCE_TIERS.join(", ")}`);
    }
    for (const a of ATTRIBUTES) {
      const cell = (r.attributes || {})[a];
      if (cell && cell.value != null && !cell.source) {
        problems.push(`reference ${r.n}: ${a} has a value with no source — every attribute must trace to something observed`);
      }
    }
  }
  if (problems.length) {
    console.error(`\ncannot build the Style Reference Document:\n`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error("");
    process.exit(1);
  }

  // Section 1.5 — most common value per attribute; ties toward the most
  // authoritative source tier, which is why the tier is recorded per reference.
  const tierRank = (t) => SOURCE_TIERS.indexOf(t);
  const consolidated = {};
  const unresolved = [];
  for (const a of ATTRIBUTES) {
    const votes = new Map();
    for (const r of filled) {
      const cell = (r.attributes || {})[a];
      if (!cell || cell.value == null) continue;
      const key = JSON.stringify(cell.value);
      const cur = votes.get(key) || { value: cell.value, n: 0, bestTier: 99, sources: [] };
      cur.n += 1;
      cur.bestTier = Math.min(cur.bestTier, tierRank(r.source_tier));
      cur.sources.push(`ref ${r.n}: ${cell.source}`);
      votes.set(key, cur);
    }
    const ranked = [...votes.values()].sort((x, y) => (y.n - x.n) || (x.bestTier - y.bestTier));
    const top = ranked[0];
    if (!top || top.n < MIN_EVIDENCE) {
      consolidated[a] = null;
      unresolved.push(`${a} — ${top ? `${top.n} reference(s)` : "no references"} supplied it, below the ${MIN_EVIDENCE} needed`);
    } else {
      const tied = ranked.filter((r) => r.n === top.n).length > 1;
      consolidated[a] = { value: top.value, references: top.n, tie_broken_by_source_tier: tied, sources: top.sources };
    }
  }

  const frozen = { channel_id: channel.channel_id, style, query: sheet.query, consolidated };
  const digest = hashOf(frozen);

  const md = [
    `# Style Reference Document — ${channel.channel_name} (${channel.channel_id}), ${style}`,
    ``,
    `> Section 1.6: this document is IMMUTABLE for this channel/style pair. Do not`,
    `> edit it. If the channel or the style changes, repeat the research phase from`,
    `> scratch. \`research-style.mjs verify\` re-derives the digest below.`,
    ``,
    `- Query (section 1.2): \`${sheet.query}\``,
    `- Searched on: ${sheet.searched_on || "(not recorded)"}`,
    `- References: ${filled.length} (section 1.3 floor is ${MIN_REFERENCES})`,
    `- Worksheet: \`docs/style-reference/${slug(channel.channel_id, style)}.worksheet.json\``,
    `- Digest: \`${digest}\``,
    ``,
    `## Consolidated attributes (section 1.5)`,
    ``,
    `| Attribute | Value | References | Tie-broken |`,
    `|---|---|---|---|`,
    ...ATTRIBUTES.map((a) => {
      const c = consolidated[a];
      if (!c) return `| ${a} | **UNRESOLVED** | — | — |`;
      const v = typeof c.value === "string" ? c.value : JSON.stringify(c.value);
      return `| ${a} | ${v.replace(/\|/g, "\\|")} | ${c.references} | ${c.tie_broken_by_source_tier ? "yes" : "no"} |`;
    }),
    ``,
    ...(unresolved.length
      ? [
          `## Unresolved`, ``,
          `These attributes had too little evidence to consolidate. They are left`,
          `unresolved on purpose: filling them from general knowledge is exactly what`,
          `this repo's grounding rule forbids. Add references and rebuild.`, ``,
          ...unresolved.map((u) => `- ${u}`), ``,
        ]
      : []),
    `## Provenance`,
    ``,
    ...ATTRIBUTES.flatMap((a) => {
      const c = consolidated[a];
      if (!c) return [];
      return [`**${a}**`, ``, ...c.sources.map((s) => `- ${s}`), ``];
    }),
    `## References`,
    ``,
    ...filled.map((r) => `${r.n}. [${r.title || r.url}](${r.url}) — ${r.source_tier}`),
    ``,
  ].join("\n");

  const dp = documentPath(channel.channel_id, style);
  writeFileSync(dp, md);
  writeFileSync(dp.replace(/\.md$/, ".digest"), digest + "\n");
  console.log(`wrote ${dp}`);
  console.log(`digest ${digest}`);
  if (unresolved.length) {
    console.log(`\n${unresolved.length} attribute(s) UNRESOLVED — the document is written but incomplete:`);
    for (const u of unresolved) console.log(`  - ${u}`);
    process.exit(2);
  }
}

function cmdVerify(channel, style) {
  const wp = worksheetPath(channel.channel_id, style);
  const dp = documentPath(channel.channel_id, style);
  const digp = dp.replace(/\.md$/, ".digest");
  if (!existsSync(dp) || !existsSync(digp)) {
    console.error(`no built document for ${slug(channel.channel_id, style)}`);
    process.exit(1);
  }
  const recorded = readFileSync(digp, "utf-8").trim();
  const inDoc = (/^- Digest: `([0-9a-f]+)`$/m.exec(readFileSync(dp, "utf-8")) || [])[1];
  if (recorded !== inDoc) {
    console.error(`digest mismatch: document says ${inDoc}, sidecar says ${recorded} — the document has been edited (section 1.6 forbids this)`);
    process.exit(1);
  }
  console.log(`${slug(channel.channel_id, style)}: digest ${recorded} intact (worksheet ${existsSync(wp) ? "present" : "MISSING"})`);
}

const verb = process.argv[2];
const cid = arg("channel");
const style = arg("style");
if (!verb || !cid || !style) {
  console.error("usage: research-style.mjs <query|scaffold|build|verify> --channel ch-01 --style motion-graphics");
  process.exit(1);
}
const channel = channelOf(cid);
const verbs = { query: cmdQuery, scaffold: cmdScaffold, build: cmdBuild, verify: cmdVerify };
if (!verbs[verb]) {
  console.error(`unknown verb: ${verb}`);
  process.exit(1);
}
verbs[verb](channel, style);
