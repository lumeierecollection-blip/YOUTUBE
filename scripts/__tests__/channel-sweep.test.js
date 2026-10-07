import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveChannel, loadChannels } from "../lib/channel-lookup.mjs";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const channels = loadChannels();

// The ten dispatched keys: config/priority-channels.json, as the workflow normalises them.
const EXPECTED = {
  1: "Money Mind", 2: "Legal Brief", 5: "Broadsheet", 6: "Archive Room", 8: "Ledger",
  9: "Border Lines", 10: "Margin Note", 26: "Fraud Files", 44: "Skill Stack", 49: "Picture House",
};

describe("every dispatched key resolves to its OWN channel", () => {
  const priority = JSON.parse(readFileSync(join(ROOT, "config", "priority-channels.json"), "utf8")).channels.map(String);

  it("the expectation table covers exactly the priority channels", () => {
    assert.deepEqual(Object.keys(EXPECTED).sort(), [...priority].sort());
  });

  for (const [key, name] of Object.entries(EXPECTED)) {
    it(`key ${key} -> ${name}`, () => {
      const r = resolveChannel(key, channels);
      assert.equal(r.channel_name, name);
      // both namespaces agree with the key: the rule the module encodes
      assert.equal(String(r.id), key);
      assert.equal(r.channel_id.replace(/^ch-0*/, ""), key);
    });
  }

  it("the .mjs entry point is the same implementation as the .cjs", () => {
    const cjs = require("../lib/channel-lookup.cjs");
    assert.equal(resolveChannel, cjs.resolveChannel);
  });
});

// Static guard: the id-first first-match lookup must not come back. This is what turned
// ch-05 into Harmony in render.js, build-script-context.js, publish and ~10 others.
describe("no source file resolves a channel by the ambiguous id", () => {
  const SKIP_DIRS = new Set(["node_modules", "__tests__", ".git", "data", "public", "asset-library", "vendor", "ci-artifacts"]);
  // Files that legitimately compare c.id and are NOT dispatch-key -> channel resolution.
  const ALLOW = new Map([
    ["scripts/lib/channel-lookup.cjs", "the resolver itself"],
    ["src/skills/remotion-render/visual/run-visual-tests.js", "fixture lookup of ids 1 and 2"],
    ["scripts/rename-youtube-channels.js", "one-off admin tool, explicit numeric ids from argv"],
  ]);
  const BAD = /(?:\.find|\.filter)\(\s*\(?\s*c(?:h)?\s*\)?\s*=>[^;\n]*\bc(?:h)?\.id\s*===?|\bc(?:h)?\.id\s*===\s*(?:numId|Number|String|\d)|String\(c\.id\)\s*===/;

  function* walk(dir) {
    for (const e of readdirSync(dir)) {
      if (SKIP_DIRS.has(e)) continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) yield* walk(p);
      else if (/\.(c?js|mjs|jsx)$/.test(e) && !/^test-/.test(e)) yield p;
    }
  }

  it("scripts/ and src/ contain no id-first channel lookup", () => {
    const offenders = [];
    for (const top of ["scripts", "src"]) {
      for (const f of walk(join(ROOT, top))) {
        const rel = relative(ROOT, f).replace(/\\/g, "/");
        if (ALLOW.has(rel)) continue;
        readFileSync(f, "utf8").split(/\r?\n/).forEach((line, i) => {
          if (/^\s*(\/\/|\*)/.test(line)) return;
          if (BAD.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
        });
      }
    }
    assert.deepEqual(offenders, [], `id-first lookups remain:\n${offenders.join("\n")}`);
  });
});
