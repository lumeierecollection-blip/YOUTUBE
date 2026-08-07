// AUDIT-TYPE — Stage 2 independent font-inventory cross-check.
// Lane: audit-type (captions/**, layout/measure.js, data/audit/**)
// Deliberate independent double-measure vs audit-assets' data/audit/1/audit-assets-measure.mjs.
// Computes the 5-number baseline: channels count, missing families,
// unused families, loader refs missing, icon set status.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PKG = join(ROOT, "src", "skills", "remotion-render");

// ---------- 1. channels.json ----------
const raw = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf8"));
const channels = Array.isArray(raw) ? raw : raw.channels;
const mg = channels.filter((c) => String(c.style) === "motion-graphics");

// Baseline methodology (mirrors audit-assets CLAIM-assets-002): the primary
// video font field `font` only. thumbnail_spec.text_font feeds a SEPARATE
// thumbnail pipeline (thumbnail-maker skill), not the video render — reported
// separately with weight suffixes normalised ("X Bold" -> "X").
const usedFamilies = new Set();
const fontRefs = [];
for (const ch of mg) {
  if (ch.font) {
    usedFamilies.add(String(ch.font));
    fontRefs.push({ id: ch.id, name: ch.channel_name, field: "font", value: String(ch.font) });
  }
}
// thumbnail fonts — normalise the weight-suffix naming convention
const stripWeight = (s) => String(s).replace(/\s+(Bold|Black|Light|Regular|Medium|Semibold|SemiBold|Italic)$/i, "");
const thumbFamilies = new Set();
const thumbRefs = [];
for (const ch of mg) {
  const tf = ch.thumbnail_spec && ch.thumbnail_spec.text_font;
  if (tf) {
    const fam = stripWeight(tf);
    thumbFamilies.add(fam);
    thumbRefs.push({ id: ch.id, name: ch.channel_name, value: String(tf), normalised: fam });
  }
}

// ---------- 2. fonts on disk ----------
const fontsDir = join(PKG, "public", "fonts");
const filesOnDisk = readdirSync(fontsDir).filter((f) => f.toLowerCase().endsWith(".woff2"));

// ---------- 3. fonts-loader.js @font-face rules ----------
const loaderSrc = readFileSync(join(PKG, "fonts-loader.js"), "utf8");
const fontFaceFamilies = [...loaderSrc.matchAll(/font-family:"([^"]+)"/g)].map((m) => m[1]);
const loaderRefs = [...loaderSrc.matchAll(/staticFile\("fonts\/([^"]+)"\)/g)].map((m) => m[1]);
const loaderFamilyList = [...loaderSrc.matchAll(/FONT_FAMILIES = (\[[^\]]*\])/g)].map((m) => JSON.parse(m[1].replace(/"/g, '"')))[0] || [];

// Canonical family names = the @font-face font-family values (what CSS matches
// against at render time). Filenames are compacted (no spaces), so compare
// space/case-normalised: "DM Sans" == "DMSans" == "dmsans".
const norm = (s) => String(s).replace(/\s+/g, "").toLowerCase();
const faceSet = new Set(fontFaceFamilies);
const famListSet = new Set(loaderFamilyList);
const familiesOnlyInFaces = [...faceSet].filter((f) => !famListSet.has(f));
const familiesOnlyInList = [...famListSet].filter((f) => !faceSet.has(f));
// every @font-face family must have >=1 woff2 on disk (normalised name match)
const diskNorms = new Set(filesOnDisk.map((f) => norm(f.replace(/-\d+\.woff2$/i, ""))));
const familiesWithNoFile = [...faceSet].filter((f) => !diskNorms.has(norm(f)));

// loader refs missing on disk
const missingLoaderRefs = loaderRefs.filter((f) => !existsSync(join(fontsDir, f)));

// ---------- 4. cross-reference ----------
const usedArr = [...usedFamilies].sort();
// a channel font is "present" if it matches an @font-face family name
const missing = usedArr.filter((f) => ![...faceSet].some((fam) => norm(fam) === norm(f)));
const presentRefs = fontRefs.filter((r) => [...faceSet].some((fam) => norm(fam) === norm(r.value)));
const unused = [...faceSet].sort().filter((fam) => ![...usedFamilies].some((f) => norm(f) === norm(fam)));
const thumbMissing = [...thumbFamilies].filter((f) => ![...faceSet].some((fam) => norm(fam) === norm(f)));

// ---- same cross-reference over ALL 50 channels (audit-assets AST-03 scope) ----
const usedAll = new Set();
for (const ch of channels) if (ch.font) usedAll.add(String(ch.font));
const unusedAll = [...faceSet].sort().filter((fam) => ![...usedAll].some((f) => norm(f) === norm(fam)));
const missingAll = [...usedAll].filter((f) => ![...faceSet].some((fam) => norm(fam) === norm(f)));

// ---------- 5. icons ----------
const iconsDir = join(PKG, "public", "icons");
const iconsOnDisk = existsSync(iconsDir) ? readdirSync(iconsDir).filter((f) => f.endsWith(".svg")).map((f) => f.replace(/\.svg$/i, "")) : [];
const iconMapNames = new Set();
for (const ch of mg) {
  const im = ch.icon_map || {};
  if (im.default) iconMapNames.add(String(im.default));
  const terms = im.terms || {};
  for (const k of Object.keys(terms)) {
    const v = terms[k];
    if (v) iconMapNames.add(String(v));
  }
}
const iconSet = [...iconMapNames].sort();
const iconsMissing = iconSet.filter((n) => !iconsOnDisk.includes(n));
const iconsUnused = iconsOnDisk.filter((n) => !iconMapNames.has(n));

// ---------- report ----------
const out = {
  baseline: {
    mg_channel_count: mg.length,
    mg_channel_ids: mg.map((c) => c.id).sort((a, b) => a - b),
    missing_families: missing,
    missing_family_refs: missing ? fontRefs.filter((r) => missing.some((m) => norm(m) === norm(r.value))) : [],
    present_family_refs: presentRefs,
    families_with_no_file_on_disk: familiesWithNoFile,
    thumbnail_fonts: {
      refs: thumbRefs,
      families_after_normalisation: [...thumbFamilies].sort(),
      missing_after_normalisation: thumbMissing,
    },
    unused_families: unused,
    unused_families_mg_scope: unused,
    unused_families_all_channels_scope: unusedAll,
    missing_families_all_channels_scope: missingAll,
    used_families: usedArr,
    loader_refs_missing: missingLoaderRefs,
    loader_ref_total: loaderRefs.length,
    loader_face_family_count: faceSet.size,
    loader_family_list_count: famListSet.size,
    families_only_in_faces: familiesOnlyInFaces,
    families_only_in_list: familiesOnlyInList,
    icons: {
      on_disk: iconsOnDisk.length,
      required_union: iconSet.length,
      missing: iconsMissing,
      unused: iconsUnused,
    },
  },
};
console.log(JSON.stringify(out, null, 2));
