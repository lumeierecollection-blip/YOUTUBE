import { readFileSync, writeFileSync } from "node:fs";
const p = "src/skills/remotion-render/visual-engine/directed-scene.jsx";
const lines = readFileSync(p, "utf8").split("\n");

// Find TypographyScene's enterP line: const enterP = ease(clamp01(local / 14));
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("const enterP = ease(clamp01(local / 14))")) {
    lines[i] = "  const enterP = ease(clamp01(p / 0.2));";
    console.log("Fixed TypographyScene enterP at line", i + 1);
    break;
  }
}

writeFileSync(p, lines.join("\n"), "utf8");