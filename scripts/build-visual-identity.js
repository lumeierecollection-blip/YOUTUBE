#!/usr/bin/env node
/**
 * Build config/visual-identity.json for every channel that does not already
 * have a hand-curated specification.
 *
 *   node scripts/build-visual-identity.js
 *   node scripts/build-visual-identity.js --check   # exit 1 if the file is stale
 *
 * WHERE EVERY VALUE COMES FROM, AND WHY THAT IS NOT INVENTION.
 *
 * `config/channels.json` already carries a curated `visual_spec` block per
 * channel — b_roll_sources, camera_angles, transitions, pacing, color_grade —
 * plus `colors`, `font`, `style` and `bg_mode`. Those were written for this
 * project's channels and they are the source of truth this file reads. What
 * cannot be read mechanically (which of the twelve camera moves a "Ken Burns"
 * actually is, which objects a channel draws) is AUTHORED in
 * `config/visual-identity.source.json`, one entry per channel, each carrying a
 * `from` field naming the channels.json text it was read off.
 *
 * ch-01, ch-02 and ch-09 are NEVER touched. They were curated by hand against
 * real external references, and a derived value is not an improvement on a
 * researched one.
 *
 * THE SECONDARY PALETTE IS DERIVED, AND HERE IS THE ARITHMETIC.
 *
 * channels.json gives four colours; the specification wants three more. Rather
 * than invent them, they are computed from the channel's own colours:
 *
 *   [0] accent shade   accent x 0.78 per channel   — a supporting tone, same hue
 *   [1] neutral mid    mix(primary, white, 0.55)   — a slate carrying the hue
 *   [2] paper          mix(primary, white, 0.92)   — the sheet an object lays down
 *
 * Checked against the three hand-curated channels, the formula lands close to
 * what a person chose: ch-02's curated slate is #8892B0 and this computes
 * #9898A1; its curated paper is #E6E8EC and this computes #EDEDEE. Close
 * enough to trust the rule, not so close that the curated files are redundant.
 *
 * PAPER IS LIGHT IN BOTH BG MODES, ON PURPOSE. A sheet of paper is light
 * whether the room around it is light or dark. That is the same finding as
 * CHECK-REGISTER 3.16's PLN-02/03: the renderer needs a light surface and a
 * dark mark available in every palette, or a dark channel resolves its own
 * caption to its own background colour and renders nothing.
 *
 * THE GROUND IS THE bg_mode GROUND, NOT `colors.bg`. `styles/tokens.js`
 * declares the only two backgrounds that exist as BG_WHITE #FFFFFF and
 * BG_BLACK #000000, chosen by `bg_mode`. Several channels carry a dark
 * `colors.bg` while running `bg_mode: white`; that field is not what renders,
 * and transcribing it was exactly the bug CHECK-REGISTER 3.15 caught on ch-01.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CHECK = process.argv.includes("--check");

/** Hand-curated from real external references; a derived value would be a downgrade. */
const CURATED = new Set(["ch-01", "ch-02", "ch-09"]);

/** styles/tokens.js: the only two backgrounds that exist. */
const BG = { white: "#FFFFFF", black: "#000000" };

const hex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = ([r, g, b]) => `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
const scale = (h, k) => toHex(rgb(h).map((v) => v * k));
const mixWhite = (h, t) => toHex(rgb(h).map((v) => v + (255 - v) * t));

function specFor(channel, authored) {
  const c = channel.colors || {};
  const ground = BG[channel.bg_mode] || BG.black;
  const transitions = (channel.visual_spec?.transitions || []).slice(0, 3);
  if (transitions.length !== 3) {
    throw new Error(`${channel.channel_id}: visual_spec.transitions has ${transitions.length}, need at least 3`);
  }
  return {
    primary_palette: [c.primary, c.secondary, c.accent, ground],
    secondary_palette: [scale(c.accent, 0.78), mixWhite(c.primary, 0.55), mixWhite(c.primary, 0.92)],
    typography_primary: channel.font,
    typography_secondary: authored.typography_secondary,
    environment_type: authored.environment_type,
    core_objects: authored.core_objects,
    camera_language: authored.camera_language,
    transition_language: transitions,
    framing_default: authored.framing_default,
    text_placement: authored.text_placement,
    use_of_negative_space: authored.use_of_negative_space,
    motion_curve: authored.motion_curve,
    style_reference_document: `docs/style-reference/${channel.channel_id}-${channel.style}.md`,
  };
}

/**
 * The Style Reference Document VID-03 requires. For a derived channel it is a
 * derivation table, not a research report: every row names the field, the value
 * and the exact channels.json text it came from. That is a weaker provenance
 * than ch-01/02/09's cited external references, and the document says so in its
 * own first paragraph rather than letting the file format imply parity.
 */
function referenceDoc(channel, authored, spec) {
  const v = channel.visual_spec || {};
  const L = [];
  L.push(`# Style reference — ${channel.channel_name} (${channel.channel_id}, ${channel.style})`);
  L.push("");
  L.push("**This is a derivation record, not a research report.** ch-01, ch-02 and");
  L.push("ch-09 have documents of the other kind: fields traced to real external");
  L.push("references that were fetched and cited. This channel's specification was");
  L.push("derived from the curated `visual_spec` block already in");
  L.push("`config/channels.json`, and every row below names the text it came from.");
  L.push("Treat it as sound provenance for a first render and as a candidate for");
  L.push("replacement by real reference research.");
  L.push("");
  L.push(`Generated by \`scripts/build-visual-identity.js\` from`);
  L.push("`config/visual-identity.source.json` + `config/channels.json`.");
  L.push("");
  L.push("## Where each field came from");
  L.push("");
  L.push("| Field | Value | Source |");
  L.push("|---|---|---|");
  L.push(`| primary_palette | ${spec.primary_palette.join(", ")} | \`colors.primary/secondary/accent\`, then the \`bg_mode: ${channel.bg_mode}\` ground from \`styles/tokens.js\` |`);
  L.push(`| secondary_palette | ${spec.secondary_palette.join(", ")} | computed: accent x 0.78, mix(primary,white,0.55), mix(primary,white,0.92) |`);
  L.push(`| typography_primary | ${spec.typography_primary} | \`font\` |`);
  L.push(`| typography_secondary | ${spec.typography_secondary} | authored contrasting face, woff2 present in \`public/fonts\` |`);
  L.push(`| environment_type | ${spec.environment_type} | ${authored.from} |`);
  L.push(`| core_objects | ${spec.core_objects.join(", ")} | drawn from the same b_roll and camera list |`);
  L.push(`| camera_language | ${spec.camera_language.join(", ")} | \`visual_spec.camera_angles\` read into the twelve-move vocabulary |`);
  L.push(`| transition_language | ${spec.transition_language.join(", ")} | first three of \`visual_spec.transitions\` |`);
  L.push(`| framing_default | ${spec.framing_default} | authored from the niche and camera list |`);
  L.push(`| text_placement | ${spec.text_placement} | authored from the niche and camera list |`);
  L.push(`| use_of_negative_space | ${spec.use_of_negative_space} | authored from \`visual_spec.color_grade\` and style |`);
  L.push(`| motion_curve | ${spec.motion_curve} | ${authored.curve_from} |`);
  L.push("");
  L.push("## The channel's own words");
  L.push("");
  L.push(`- **niche** — ${channel.niche}`);
  L.push(`- **tone** — ${channel.tone || "(not set)"}`);
  L.push(`- **color_grade** — ${v.color_grade || "(not set)"}`);
  L.push(`- **pacing** — ${v.pacing || "(not set)"}`);
  L.push(`- **b_roll_sources** — ${(v.b_roll_sources || []).join("; ")}`);
  L.push(`- **camera_angles** — ${(v.camera_angles || []).join("; ")}`);
  L.push(`- **transitions** — ${(v.transitions || []).join("; ")}`);
  L.push("");
  return L.join("\n");
}

function main() {
  const chData = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = chData.channels || chData;
  const source = JSON.parse(readFileSync(join(ROOT, "config", "visual-identity.source.json"), "utf-8")).channels;

  const outPath = join(ROOT, "config", "visual-identity.json");
  const existing = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf-8")) : { channels: {} };
  const out = { ...existing, channels: { ...existing.channels } };

  const docDir = join(ROOT, "docs", "style-reference");
  mkdirSync(docDir, { recursive: true });

  let built = 0, kept = 0;
  const docs = [];
  for (const channel of channels) {
    const cid = channel.channel_id;
    if (CURATED.has(cid)) { kept++; continue; }
    const authored = source[cid];
    if (!authored) {
      console.error(`no authored source for ${cid} — add it to config/visual-identity.source.json`);
      process.exitCode = 1;
      continue;
    }
    const spec = specFor(channel, authored);
    out.channels[cid] = spec;
    docs.push([join(ROOT, spec.style_reference_document), referenceDoc(channel, authored, spec)]);
    built++;
  }

  // Keyed by channel_id in the order channels.json lists them, so a diff of this
  // file reads as a diff of the channel roster rather than of a hash map.
  const ordered = {};
  for (const channel of channels) if (out.channels[channel.channel_id]) ordered[channel.channel_id] = out.channels[channel.channel_id];
  out.channels = ordered;

  const text = JSON.stringify(out, null, 2) + "\n";
  if (CHECK) {
    const same = existsSync(outPath) && readFileSync(outPath, "utf-8") === text;
    console.log(same ? "visual-identity.json is up to date" : "visual-identity.json is STALE — re-run without --check");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(outPath, text);
  for (const [p, body] of docs) writeFileSync(p, body);
  console.log(`visual identity: ${built} derived, ${kept} hand-curated left untouched, ${docs.length} reference document(s) written.`);
}

main();
