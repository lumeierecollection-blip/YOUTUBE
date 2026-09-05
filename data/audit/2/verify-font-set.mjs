// AUDIT-TYPE — Stage 2, claim-type-001: precise 1:1 cross-check of
// fonts-manifest.json <-> fonts-loader.js (FONT_FAMILIES + FONT_FACES) <->
// public/fonts/*.woff2. Independent of audit-assets' measure script: this one
// checks exact-string set equality and weight-level correspondence, not
// normalised-name containment.
// Lane: audit-type (data/audit/** owned). Run: node data/audit/2/verify-font-set.mjs
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PKG = join(ROOT, "src", "skills", "remotion-render");
const FONTS = join(PKG, "public", "fonts");

const manifest = JSON.parse(readFileSync(join(PKG, "fonts-manifest.json"), "utf8"));
const loader = readFileSync(join(PKG, "fonts-loader.js"), "utf8");
const disk = readdirSync(FONTS).filter((f) => f.endsWith(".woff2")).sort();

const famList = [...loader.matchAll(/FONT_FAMILIES = (\[[^\]]*\])/g)]
  .map((m) => JSON.parse(m[1]))[0];
const faceBlocks = [...loader.matchAll(/@font-face\{font-family:"([^"]+)";font-style:normal;font-weight:(\d+);font-display:swap;src:url\("\$\{staticFile\("fonts\/([^"]+)"\)\}"\) format\("woff2"\);\}/g)]
  .map((m) => ({ family: m[1], weight: m[2], file: m[3] }));

const manifestFamilies = Object.keys(manifest);
const manifestFiles = Object.values(manifest).flatMap((w) => Object.values(w)).sort();

const setEq = (a, b) => a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
const fail = (k, v) => { failures.push({ k, v }); };

const failures = [];

// 1. FONT_FAMILIES == manifest keys, exact
if (!setEq(famList, manifestFamilies)) fail("FONT_FAMILIES vs manifest keys", { famList, manifestFamilies });
// 2. @font-face family multiset == manifest keys x weights (13 families, weights per manifest)
const faceCounts = {};
for (const f of faceBlocks) faceCounts[f.family] = (faceCounts[f.family] || 0) + 1;
for (const fam of manifestFamilies) {
  const want = Object.keys(manifest[fam]).length;
  if (faceCounts[fam] !== want) fail(`@font-face rule count for ${fam}`, { want, got: faceCounts[fam] });
}
for (const fam of Object.keys(faceCounts)) {
  if (!manifestFamilies.includes(fam)) fail("family in @font-face not in manifest", fam);
}
// 3. every @font-face src file exists on disk, exact name
const missingFiles = faceBlocks.map((f) => f.file).filter((f) => !existsSync(join(FONTS, f)));
if (missingFiles.length) fail("@font-face src files missing on disk", missingFiles);
// 4. manifest files == disk files, exact bijection
if (!setEq(manifestFiles, disk)) fail("manifest files vs disk files (bijection)", { manifestFiles, disk });
// 5. @font-face src file set == disk files
if (!setEq(faceBlocks.map((f) => f.file), disk)) fail("@font-face src files vs disk files", { face: faceBlocks.map((f) => f.file), disk });
// 6. per-family weight alignment across manifest and loader
for (const fam of manifestFamilies) {
  const wantWeights = Object.keys(manifest[fam]).sort();
  const gotWeights = faceBlocks.filter((f) => f.family === fam).map((f) => f.weight).sort();
  if (wantWeights.join() !== gotWeights.join()) fail(`weight alignment ${fam}`, { wantWeights, gotWeights });
}

console.log(JSON.stringify({
  manifest_families: manifestFamilies.length,
  font_families_list: famList.length,
  face_rules: faceBlocks.length,
  manifest_files: manifestFiles.length,
  disk_files: disk.length,
  families_match: setEq(famList, manifestFamilies),
  files_bijection: setEq(manifestFiles, disk),
  all_face_src_exist: missingFiles.length === 0,
  failures,
}, null, 2));
process.exit(failures.length ? 1 : 0);
