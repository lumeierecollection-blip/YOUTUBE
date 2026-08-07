// Orchestrator-applied shared-file requests R-1/R-4-companion (Stage 3 gate wiring).
// Applies the palette-contract changes from data/audit/3/audit-color.ledger.md.
import { readFileSync, writeFileSync } from "fs";

const edits = [
  {
    file: "src/skills/remotion-render/render.js",
    ops: [
      {
        from: 'import { buildMgPackage } from "./compositions/mg-package.js";',
        to: 'import { buildMgPackage } from "./compositions/mg-package.js";\nimport { paletteFromHues } from "./styles/tokens.js";',
      },
      {
        from: "    palette: channel.thumbnail_spec?.color_palette || null,",
        to: [
          "    palette:",
          "      typeof channel.thumbnail_spec?.baseHue === \"number\" &&",
          "      typeof channel.thumbnail_spec?.accentHue === \"number\"",
          "        ? paletteFromHues({",
          "            baseHue: channel.thumbnail_spec.baseHue,",
          "            accentHue: channel.thumbnail_spec.accentHue,",
          "          })",
          "        : null,",
        ].join("\n"),
      },
    ],
  },
  {
    file: "src/skills/remotion-render/compositions/visual.js",
    ops: [
      {
        from: [
          "export function resolveColors(palette, fallback) {",
          "  if (Array.isArray(palette) && palette.length >= 3) {",
        ].join("\n"),
        to: [
          "export function resolveColors(palette, fallback) {",
          "  if (",
          "    palette &&",
          '    typeof palette === "object" &&',
          "    !Array.isArray(palette) &&",
          '    typeof palette.bg === "string" &&',
          '    typeof palette.accent === "string"',
          "  ) {",
          "    // Stage-3 derived roles object (styles/tokens.js paletteFromHues).",
          "    return {",
          "      ...fallback,",
          "      bgDark: palette.bg,",
          "      bgMid: palette.bg,",
          "      bg: palette.bg,",
          "      accent: palette.accent,",
          "      accent2: palette.accent,",
          "      textAccent: palette.accent,",
          "      textPrimary: palette.textPrimary,",
          "      text: palette.textPrimary,",
          "      textDim: palette.textDim ?? fallback.textDim,",
          "      stroke: palette.stroke ?? fallback.stroke,",
          "      surface: palette.surface ?? fallback.surface,",
          "      raised: palette.raised ?? fallback.raised,",
          "    };",
          "  }",
          "  if (Array.isArray(palette) && palette.length >= 3) {",
        ].join("\n"),
      },
    ],
  },
  {
    file: "src/skills/remotion-render/compositions/mg-style.js",
    ops: [
      {
        from: [
          "/**",
          " * A2.1 — map a channel palette [bg, accent, textPrimary] onto the fixed role",
          " * map. textDim / stroke / surface are derived by the manual's mix formulas.",
          " */",
          "export function rolesFromPalette(palette) {",
          "  const bg = palette[0];",
          "  const accent = palette[1];",
          "  const textPrimary = palette[2];",
          "  return {",
          "    bg,",
          "    accent,",
          "    textPrimary,",
          "    textDim: mixColor(textPrimary, bg, 0.45),",
          "    stroke: mixColor(textPrimary, bg, 0.22),",
          "    surface: mixColor(bg, textPrimary, 0.06),",
          "  };",
          "}",
        ].join("\n"),
        to: [
          "import { paletteFromHues, deriveHuesFromHexes } from \"../styles/tokens.js\";",
          "",
          "/**",
          " * A2.1 — map a channel's hue pair (or legacy 3-hex palette) onto the fixed",
          " * role map. Stage 3 moved role derivation into styles/tokens.js",
          " * (paletteFromHues); the A2.1 mix formulas for textDim/stroke/surface are",
          " * superseded by OKLCH-derived roles (see audit-color ledger A-2). The legacy",
          " * hex-array form is still accepted so existing verify fixtures and fallback",
          " * palettes keep working: it is converted via deriveHuesFromHexes.",
          " */",
          "export function rolesFromPalette(palette) {",
          "  if (palette && typeof palette === \"object\" && !Array.isArray(palette)) {",
          "    if (typeof palette.baseHue === \"number\" && typeof palette.accentHue === \"number\") {",
          "      return paletteFromHues({ baseHue: palette.baseHue, accentHue: palette.accentHue });",
          "    }",
          "    if (typeof palette.bg === \"string\" && typeof palette.accent === \"string\") {",
          "      return palette; // already derived roles",
          "    }",
          "  }",
          "  if (Array.isArray(palette) && palette.length >= 3) {",
          "    return paletteFromHues(deriveHuesFromHexes(palette));",
          "  }",
          "  throw new Error(\"rolesFromPalette: no valid palette (needs baseHue/accentHue, roles object, or 3-hex array)\");",
          "}",
        ].join("\n"),
      },
    ],
  },
  {
    file: "src/skills/remotion-render/compositions/motion-graphics.jsx",
    ops: [
      {
        from: [
          "  const colors = rolesFromPalette(Array.isArray(palette) && palette.length >= 3 ? palette : FALLBACK_PALETTE);",
        ].join("\n"),
        to: [
          "  const colors = rolesFromPalette(",
          "    palette && typeof palette === \"object\" && !Array.isArray(palette)",
          "      ? palette",
          "      : Array.isArray(palette) && palette.length >= 3",
          "        ? palette",
          "        : FALLBACK_PALETTE",
          "  );",
        ].join("\n"),
      },
    ],
  },
  {
    file: "src/skills/remotion-render/verify-compositions.js",
    ops: [
      {
        from: 'import { verifyPalette } from "./compositions/mg-style.js";',
        to: 'import { verifyPalette } from "./compositions/mg-style.js";\nimport { paletteFromHues, deriveHuesFromHexes } from "./styles/tokens.js";',
      },
      {
        from: "  palette: verifyPalette(mgChannel.thumbnail_spec?.color_palette || null),",
        to: [
          "  palette: verifyPalette(",
          "    typeof mgChannel.thumbnail_spec?.baseHue === \"number\" &&",
          "    typeof mgChannel.thumbnail_spec?.accentHue === \"number\"",
          "      ? { baseHue: mgChannel.thumbnail_spec.baseHue, accentHue: mgChannel.thumbnail_spec.accentHue }",
          "      : null",
          "  ),",
        ].join("\n"),
      },
      {
        from: 'const mgPalette = mgChannel.thumbnail_spec?.color_palette || ["#1A1A2E", "#F5536B", "#FFFFFF"];',
        to: [
          "const mgPalette =",
          "  typeof mgChannel.thumbnail_spec?.baseHue === \"number\" &&",
          "  typeof mgChannel.thumbnail_spec?.accentHue === \"number\"",
          "    ? paletteFromHues({",
          "        baseHue: mgChannel.thumbnail_spec.baseHue,",
          "        accentHue: mgChannel.thumbnail_spec.accentHue,",
          "      })",
          "    : paletteFromHues(deriveHuesFromHexes([\"#1A1A2E\", \"#F5536B\", \"#FFFFFF\"]));",
        ].join("\n"),
      },
    ],
  },
];

for (const e of edits) {
  let c = readFileSync(e.file, "utf8");
  for (const op of e.ops) {
    const before = c;
    if (op.from === op.to) throw new Error(`noop in ${e.file}`);
    c = c.split(op.from).join(op.to);
    if (c === before) {
      throw new Error(`NOT FOUND in ${e.file}: ${JSON.stringify(op.from.slice(0, 80))}`);
    }
  }
  writeFileSync(e.file, c, "utf8");
  console.log(`OK ${e.file}`);
}
console.log("All shared-file palette-contract edits applied.");
