import { readFileSync, writeFileSync } from "node:fs";
const p = "src/skills/remotion-render/visual-engine/directed-scene.jsx";
const lines = readFileSync(p, "utf8").split("\n");

// Find beatAt function
let fnLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("function beatAt(")) { fnLine = i; break; }
}

// Find "const p = clamp01" line inside beatAt
let pLine = -1;
for (let i = fnLine; i < fnLine + 10; i++) {
  if (lines[i].includes("const p = clamp01")) { pLine = i; break; }
}

// Replace the p calculation to start beat 0 at 0.35
lines[pLine] = '  const rawP = clamp01((frame - b.start_frame) / Math.max(1, b.duration_frames));';
// Insert after: for beat 0, start at 0.35 so the hook is fully composed from frame 0
lines.splice(pLine + 1, 0, '  const p = (i === 0) ? Math.max(rawP, 0.35) : rawP;');

writeFileSync(p, lines.join("\n"), "utf8");
console.log("beatAt: beat 0 starts at p=0.35 for fully composed frame 0");