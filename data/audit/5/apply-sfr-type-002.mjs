// Orchestrator applies SFR-type-002 / SFR-LAY-5-1 (identical wiring request from
// both Stage-5 lanes): rewire motion-graphics.jsx measurement call sites through
// layout/measure.js gated wrappers + shared fontStyle.
// Line-ending aware; idempotent; exact-match replacements.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/skills/remotion-render/compositions/motion-graphics.jsx";
let src = readFileSync(FILE, "utf8");

const eol = src.includes("\r\n") ? "\r\n" : "\n";
console.log(`EOL detected: ${JSON.stringify(eol)}`);
let changed = 0;

function replaceOne(oldStr, newStr, label) {
  const n = src.split(oldStr).length - 1;
  if (n === 0) {
    console.log(`SKIP (not found): ${label}`);
    return;
  }
  if (n > 1) {
    console.log(`WARN multiple (${n}) for: ${label} — applying all`);
  }
  src = src.split(oldStr).join(newStr);
  changed += n;
  console.log(`APPLIED ${n}x: ${label}`);
}

// 1) import swap
replaceOne(
  'import { measureText, fitTextOnNLines } from "@remotion/layout-utils";',
  'import { measureText, fitTextOnNLines, HEADLINE_FONT, fontStyleFor } from "../layout/measure.js";',
  "import line 18"
);

// 2) HeadlineBox: inject fontStyle memo + rewire fitTextOnNLines
replaceOne(
  [
    "  const fit = useMemo(",
    "    () =>",
    "      fitTextOnNLines({",
    "        text: scene.headline,",
    "        maxLines: 2,",
    "        maxBoxWidth: 780,",
    "        fontFamily,",
    "        fontWeight: 800,",
    "        maxFontSize: TYPE.headline,",
    "      }),",
    "    [scene.headline, fontFamily]",
    "  );",
  ].join(eol),
  [
    "  const fontStyle = useMemo(",
    "    () => fontStyleFor(fontFamily, HEADLINE_FONT),",
    "    [fontFamily]",
    "  );",
    "  const fit = useMemo(",
    "    () =>",
    "      fitTextOnNLines({",
    "        text: scene.headline,",
    "        maxLines: 2,",
    "        maxBoxWidth: 780,",
    "        ...fontStyle,",
    "        maxFontSize: TYPE.headline,",
    "      }),",
    "    [scene.headline, fontStyle]",
    "  );",
  ].join(eol),
  "HeadlineBox fontStyle memo + fitTextOnNLines rewire"
);

// 3) ruleWidth measureText rewire
replaceOne(
  '    () => measureText({ text: scene.headline, fontFamily, fontSize, fontWeight: 800 }).width,',
  '    () => measureText({ text: scene.headline, ...fontStyle, fontSize }).width,',
  "ruleWidth measureText rewire"
);
replaceOne(
  "    [scene.headline, fontFamily, fontSize]",
  "    [scene.headline, fontStyle, fontSize]",
  "ruleWidth deps"
);

// 4) render div shares the same fontStyle
replaceOne(
  'style={{ textAlign: "center", fontFamily, fontWeight: 800, fontSize, color: colors.textPrimary, whiteSpace: "nowrap" }}',
  'style={{ textAlign: "center", ...fontStyle, fontSize, color: colors.textPrimary, whiteSpace: "nowrap" }}',
  "render div fontStyle spread"
);

writeFileSync(FILE, src, "utf8");
console.log(`Total replacements applied: ${changed}`);
