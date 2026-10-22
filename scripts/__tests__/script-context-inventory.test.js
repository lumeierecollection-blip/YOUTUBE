import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SLUG = "__test-inventory-fixture";

// Shape of run 39611317543 ch-48's research (university-of-utah-walking-...).
const RESEARCH = {
  topic_slug: SLUG,
  strongest_angle: "Gait retraining reduced knee pain.",
  key_facts: [
    { fact: "Participants in a year-long randomized controlled trial at Stanford University and the University of Utah experienced pain relief equivalent to medication through gait retraining.", source_url: "https://example.org/a" },
    { fact: "The researchers said retraining is promising.", source_url: "https://example.org/b" },
  ],
  numbers: [],
  quotes: [],
  named_entities: [],
};

function context(channelId) {
  const dir = join(ROOT, "data", "research", String(channelId));
  mkdirSync(dir, { recursive: true });
  const f = join(dir, `${SLUG}.json`);
  writeFileSync(f, JSON.stringify(RESEARCH));
  try {
    // stdout must be pure JSON even though strict-visual.mjs logs at import.
    return JSON.parse(execFileSync(process.execPath, [join(ROOT, "scripts", "build-script-context.js"), String(channelId), SLUG], { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString());
  } finally {
    rmSync(f, { force: true });
  }
}

test("a strict channel's context lists only the research items the gate can draw", () => {
  const c = context(48);
  const inv = c.visual_rule.drawable_inventory;
  assert.ok(Array.isArray(inv));
  assert.equal(inv.length, 1, JSON.stringify(inv));
  assert.equal(inv[0].from, "key_facts[0]");
  assert.ok(inv[0].draws);
});

test("a non-strict channel gets no visual rule or inventory", () => {
  const c = context(1);
  assert.equal(c.visual_rule, null);
});
