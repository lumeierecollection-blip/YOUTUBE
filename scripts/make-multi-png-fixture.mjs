#!/usr/bin/env node
/**
 * make-multi-png-fixture.mjs — writes the synthetic multi-PNG fixture for the render regression
 * (scripts/lib/multi-png-fixture.mjs): the PNGs under <public>/qa-synth/, the beats for
 * qa-canvas-render.mjs --extra-beats, and the fixture metadata the checker reads.
 *
 *   node scripts/make-multi-png-fixture.mjs --beats-out out/multi-beats.json --meta-out out/multi-meta.json
 *        [--plain-beats-out out/multi-beats-plain.json] [--public src/skills/remotion-render/public]
 *
 * Nothing here touches the network or any credential; the PNGs are generated, not downloaded.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFixture, plainBeats } from "./lib/multi-png-fixture.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const publicDir = arg("public", join(ROOT, "src", "skills", "remotion-render", "public"));
const beatsOut = arg("beats-out");
const metaOut = arg("meta-out");
const plainOut = arg("plain-beats-out");
if (!beatsOut || !metaOut) {
  console.error("usage: make-multi-png-fixture.mjs --beats-out <file> --meta-out <file> [--plain-beats-out <file>] [--public <dir>]");
  process.exit(2);
}

const fx = writeFixture(publicDir);
for (const f of [beatsOut, metaOut, ...(plainOut ? [plainOut] : [])]) mkdirSync(dirname(f), { recursive: true });
if (plainOut) writeFileSync(plainOut, JSON.stringify(plainBeats(fx.beats), null, 2) + "\n");
writeFileSync(beatsOut, JSON.stringify(fx.beats.map(({ text, c }) => ({ text, c })), null, 2) + "\n");
writeFileSync(metaOut, JSON.stringify(fx, null, 2) + "\n");
console.log(`fixture: ${fx.images.length} PNGs in ${join(publicDir, "qa-synth")}, ${fx.beats.length} beats -> ${beatsOut}`);
for (const im of fx.images) console.log(`  ${im.file}  ${im.w}x${im.h}${im.alpha ? "  alpha" : ""}`);
