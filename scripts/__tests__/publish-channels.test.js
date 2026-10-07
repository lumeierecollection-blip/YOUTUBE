import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RUN = join(ROOT, "src", "skills", "youtube-publish", "run.js");
const priority = JSON.parse(readFileSync(join(ROOT, "config", "priority-channels.json"), "utf8")).channels.map(String);

// `--dry-run` validates the allowlist and credentials and uploads nothing.
function dry(channel) {
  const r = spawnSync(process.execPath, [RUN, channel, "--dry-run"], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
  return { out: `${r.stdout}\n${r.stderr}`, code: r.status };
}
const REFUSED = /is not a publish channel/;

describe("youtube-publish approves exactly config/priority-channels.json", () => {
  for (const ch of priority) {
    it(`ch ${ch} is not refused by the allowlist`, () => {
      assert.doesNotMatch(dry(ch).out, REFUSED);
    });
  }

  // 48 and 30 are in channels.json but are not approved; 48 was on the old hardcoded list.
  for (const ch of ["48", "30", "3"]) {
    it(`ch ${ch} is refused`, () => {
      const r = dry(ch);
      assert.match(r.out, REFUSED);
      assert.notEqual(r.code, 0);
    });
  }

  it("names the config file as the source of truth in the refusal", () => {
    assert.match(dry("48").out, /config\/priority-channels\.json/);
  });

  it("the ch- form is accepted exactly like the bare form", () => {
    assert.doesNotMatch(dry("ch-05").out, REFUSED);
  });
});
