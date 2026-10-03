import { readFileSync, writeFileSync } from "node:fs";
const p = "src/skills/remotion-render/visual-engine/directed-scene.jsx";
const lines = readFileSync(p, "utf8").split("\n");

// Find the pattern: ");" followed by blank line followed by "function ConsumptionScene"
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === ");" && 
      lines[i+1] && lines[i+1].trim() === "" && 
      lines[i+2] && lines[i+2].includes("function ConsumptionScene(")) {
    // Insert closing brace after ");"
    lines.splice(i + 1, 0, "}");
    console.log("Added closing brace at line", i + 2, "(after line", i+1, ")");
    break;
  }
}

writeFileSync(p, lines.join("\n"), "utf8");
console.log("Lines now:", lines.length);