/**
 * data/audit/3/patch-channels.mjs
 * Replace every `thumbnail_spec.color_palette` hex block in config/channels.json
 * with the per-channel numeric `baseHue` / `accentHue` from data/audit/3/hues.json.
 *
 * Strategy: textual replacement of the color_palette blocks (so all other
 * formatting, including the legacy `.colors` hex field, is byte-identical),
 * with the occurrence order matched to the parsed channel order. Assertions
 * run before any write; pass `--write` to persist.
 */
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("config/channels.json", "utf8");
const json = JSON.parse(src);
const hues = JSON.parse(readFileSync("data/audit/3/hues.json", "utf8"));

const channels = json.channels;
if (channels.length !== 50) throw new Error(`expected 50 channels, got ${channels.length}`);
for (const c of channels) {
  if (!hues[String(c.id)]) throw new Error(`hues.json missing channel id ${c.id}`);
}

// occurrence order must equal array order
const inFile = [];
const re = /"color_palette":\s*\[\s*"#[0-9A-Fa-f]{6}"\s*,\s*"#[0-9A-Fa-f]{6}"\s*,\s*"#[0-9A-Fa-f]{6}"\s*\]/g;
for (const m of src.matchAll(re)) inFile.push(m[0]);
if (inFile.length !== 50) throw new Error(`expected 50 color_palette blocks, found ${inFile.length}`);

// cross-check: parsed color_palette of channel[i] must equal block text of occurrence[i]
for (let i = 0; i < channels.length; i++) {
  const p = channels[i].thumbnail_spec?.color_palette;
  if (!p || p.length !== 3) throw new Error(`channel ${channels[i].id} missing 3-hex color_palette`);
  const text = `"color_palette": [\n          "#${p[0].slice(1)}",\n          "#${p[1].slice(1)}",\n          "#${p[2].slice(1)}"\n        ]`;
  if (!inFile[i].includes(`"#${p[0].slice(1)}"`) || !inFile[i].includes(`"#${p[1].slice(1)}"`) || !inFile[i].includes(`"#${p[2].slice(1)}"`)) {
    throw new Error(`occurrence ${i} (ch ${channels[i].id}) does not match parsed palette ${JSON.stringify(p)}`);
  }
  if (!inFile[i].replace(/\s+/g, " ").startsWith('"color_palette"')) {
    throw new Error(`occurrence ${i} not a color_palette block`);
  }
}

const round1 = (v) => Math.round(v * 10) / 10;
const out = src.replace(re, (() => {
  let i = 0;
  return () => {
    const c = channels[i++];
    const { baseHue, accentHue } = hues[String(c.id)];
    return `"baseHue": ${round1(baseHue)},\n        "accentHue": ${round1(accentHue)}`;
  };
})());

// assertions on the result
const outJson = JSON.parse(out);
if (outJson.channels.length !== 50) throw new Error("post-write channel count changed");
for (const c of outJson.channels) {
  if (c.thumbnail_spec.color_palette) throw new Error(`ch ${c.id}: color_palette still present`);
  const h = hues[String(c.id)];
  if (c.thumbnail_spec.baseHue !== round1(h.baseHue)) throw new Error(`ch ${c.id}: baseHue mismatch`);
  if (c.thumbnail_spec.accentHue !== round1(h.accentHue)) throw new Error(`ch ${c.id}: accentHue mismatch`);
  if (!("colors" in c)) throw new Error(`ch ${c.id}: colors field vanished`);
}
if (out.includes('"color_palette"')) throw new Error("color_palette literal still in file");
if (!out.endsWith("\n")) throw new Error("file no longer ends with newline");

const touched = out.split("\n").length - src.split("\n").length;
console.log(`OK: 50/50 blocks replaced; line delta ${touched}; colors field intact on all channels; no color_palette remains.`);
if (process.argv.includes("--write")) {
  writeFileSync("config/channels.json", out);
  console.log("wrote config/channels.json");
} else {
  console.log("dry-run (pass --write to persist)");
}
