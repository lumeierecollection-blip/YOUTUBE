#!/usr/bin/env node
/**
 * Copies chosen motions from opus-motion-library (MIT) at one pinned commit, plus every source file
 * they import, into this channel's own render folder. Run by hand when the pin or the list changes;
 * the copied files are committed so a render needs no network access to the library and no Claude
 * session. Needs only the GitHub CLI: no clone and no install.
 *
 * Usage: node platform/channels/court-and-spotlight/vendor-opus.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "GovinduSasanka/opus-motion-library";
const COMMIT = "8f1b78a25d0cf310c9bf904d434285046c4ed25a";
const MOTIONS = [
  "src/motions/document/doc-highlight-evidence.tsx",
  "src/motions/data/timeline-ruler.tsx",
  "src/motions/text/number-counter.tsx",
];

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../../../src/skills/remotion-render/channels/court-and-spotlight/vendor/opus");

const raw = (path) => execFileSync("gh", ["api", `repos/${REPO}/contents/${path}?ref=${COMMIT}`, "-H", "Accept: application/vnd.github.raw"], { encoding: "utf8", maxBuffer: 32e6 });
const fetchFirst = (candidates) => {
  for (const c of candidates) { try { return { path: c, text: raw(c) }; } catch { /* try the next extension */ } }
  throw new Error(`none of ${candidates.join(", ")} exists at ${COMMIT}`);
};

const seen = new Map();
const queue = [...MOTIONS];
while (queue.length) {
  const p = queue.shift();
  if (seen.has(p)) continue;
  const bare = p.replace(/\.(tsx?|jsx?)$/, "");
  const got = /\.(tsx?|jsx?)$/.test(p) ? fetchFirst([p]) : fetchFirst([`${bare}.ts`, `${bare}.tsx`, `${bare}/index.ts`, `${bare}/index.tsx`]);
  if (seen.has(got.path)) continue;
  seen.set(got.path, got.text);
  for (const m of got.text.matchAll(/(?:from\s+|import\s+|import\()['"](\.{1,2}\/[^'"]+)['"]/g)) {
    queue.push(posix.normalize(posix.join(posix.dirname(got.path), m[1])));
  }
}

let bytes = 0;
for (const [p, text] of seen) {
  const f = join(OUT, p.replace(/^src\//, ""));
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, text);
  bytes += text.length;
}
writeFileSync(join(OUT, "LICENSE"), raw("LICENSE"));
writeFileSync(join(OUT, "THIRD_PARTY_NOTICES.md"), raw("THIRD_PARTY_NOTICES.md"));
writeFileSync(join(OUT, "PIN.json"), JSON.stringify({ repo: REPO, commit: COMMIT, motions: MOTIONS, files: [...seen.keys()].sort() }, null, 2) + "\n");
console.log(`vendored ${seen.size} files, ${bytes} bytes`);
for (const p of [...seen.keys()].sort()) console.log(`${String(seen.get(p).length).padStart(8)}  ${p}`);
