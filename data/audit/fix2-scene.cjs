const fs = require("fs");
const p = "C:/Users/user/YOUTUBE/src/skills/remotion-render/visual-engine/directed-scene.jsx";
const c = fs.readFileSync(p, "utf8");
const lines = c.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("function cameraTransform")) {
    let end = i + 1;
    while (end < lines.length && !lines[end].includes("}")) end++;
    const q = String.fromCharCode(34);
    lines.splice(i, end - i + 1, "function cameraTransform(camera, progress) {", "  return " + q + "none" + q + ";", "}");
    break;
  }
}
fs.writeFileSync(p, lines.join("\n"), "utf8");
console.log("Scene: cameraTransform simplified");
