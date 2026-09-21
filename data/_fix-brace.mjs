import { readFileSync, writeFileSync } from "node:fs";
const p = "src/skills/remotion-render/visual-engine/directed-scene.jsx";
const lines = readFileSync(p, "utf8").split("\n");

// Find "  );" before "function ConsumptionScene" in ActionConsequenceScene
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === ");" && lines[i+1] && lines[i+1].includes("function ConsumptionScene(")) {
    // Insert closing brace after this line
    lines.splice(i + 1, 0, "}");
    console.log("Added closing brace at line", i + 2);
    break;
  }
}

writeFileSync(p, lines.join("\n"), "utf8");
console.log("Lines now:", lines.length);