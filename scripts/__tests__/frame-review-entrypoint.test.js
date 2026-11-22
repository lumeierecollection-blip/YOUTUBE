// The CLI guard in scripts/gemini-frame-review.js must run main() for every way the production
// workflow / render-and-qa.js / a1-discrimination.yml can spell the path, and must NOT run on import.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isMainModule } from "../gemini-frame-review.js";

const SCRIPT = resolve(fileURLToPath(new URL("../gemini-frame-review.js", import.meta.url)));
const ROOT = resolve(SCRIPT, "..", "..");

// With no arguments main() prints a usage line and exits 2; if the guard wrongly skips main(),
// the process exits 0 silently - exactly the failure this test exists to catch.
function runCli(path, cwd = ROOT) {
  return spawnSync(process.execPath, [path], { cwd, encoding: "utf8", timeout: 60000 });
}

describe("gemini-frame-review.js entry-point guard", () => {
  it("is false when imported (argv[1] is another file)", () => {
    assert.equal(isMainModule(fileURLToPath(import.meta.url)), false);
    assert.equal(isMainModule(undefined, pathToFileURL(SCRIPT).href), false);
  });
  it("is true for the absolute path", () => {
    assert.equal(isMainModule(SCRIPT, pathToFileURL(SCRIPT).href), true);
  });
  it("is true for a relative path and for ./ and .. spellings", () => {
    const rel = relative(process.cwd(), SCRIPT);
    assert.equal(isMainModule(rel, pathToFileURL(SCRIPT).href), true);
    assert.equal(isMainModule(join(rel, "..", "gemini-frame-review.js"), pathToFileURL(SCRIPT).href), true);
  });
  it("is true when argv[1] is a symlink to the script (Node realpaths import.meta.url only)", (t) => {
    const dir = mkdtempSync(join(tmpdir(), "gfr-"));
    const link = join(dir, "link.js");
    try { symlinkSync(SCRIPT, link); } catch (e) { rmSync(dir, { recursive: true, force: true }); return t.skip(`cannot create symlink here: ${e.code}`); }
    try {
      assert.equal(isMainModule(link, pathToFileURL(SCRIPT).href), true);
      const r = runCli(link);
      assert.equal(r.status, 2, `symlinked CLI must reach main() (usage, exit 2); got ${r.status}\n${r.stderr}`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("real CLI runs main() via relative and absolute paths (usage + exit 2, not a silent exit 0)", () => {
    for (const p of ["scripts/gemini-frame-review.js", "./scripts/gemini-frame-review.js", SCRIPT]) {
      const r = runCli(p);
      assert.equal(r.status, 2, `${p}: expected usage exit 2, got ${r.status}\n${r.stderr}`);
      assert.match(r.stderr + r.stdout, /Usage: gemini-frame-review\.js/);
    }
  });
});
