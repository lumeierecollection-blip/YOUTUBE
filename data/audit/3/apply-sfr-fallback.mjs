import { readFileSync, writeFileSync } from "fs";

const f = "src/skills/remotion-render/compositions/mg-style.js";
let c = readFileSync(f, "utf8");

const from = [
  '  if (Array.isArray(palette) && palette.length >= 3) {',
  "    return paletteFromHues(deriveHuesFromHexes(palette));",
  "  }",
  '  throw new Error("rolesFromPalette: no valid palette (needs baseHue/accentHue, roles object, or 3-hex array)");',
  "}",
].join("\n");

const to = [
  "  if (Array.isArray(palette) && palette.length >= 3) {",
  "    return paletteFromHues(deriveHuesFromHexes(palette));",
  "  }",
  "  // No palette / invalid shape: neutral dark default through the same token",
  "  // path, so verifyPalette(null) reports rather than throwing.",
  "  return paletteFromHues(deriveHuesFromHexes(FALLBACK_HEXES));",
  "}",
].join("\n");

if (!c.includes(from)) throw new Error("rolesFromPalette tail pattern not found");
c = c.replace(from, to);

const constBlock =
  "// A2.4 — contrast floor (AAA large text, see manual table).\nexport const CONTRAST_FLOOR = {";
if (!c.includes(constBlock)) throw new Error("CONTRAST_FLOOR anchor not found");
c = c.replace(
  constBlock,
  '// Fallback 3-hex palette for null/malformed input (motion-graphics FALLBACK_PALETTE).\nconst FALLBACK_HEXES = ["#0F0F1A", "#E94560", "#F8FAFC"];\n\n' +
    constBlock
);

writeFileSync(f, c, "utf8");
console.log("mg-style.js fallback wiring applied");
