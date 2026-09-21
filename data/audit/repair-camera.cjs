const fs = require("fs");
const p = "C:/Users/user/YOUTUBE/src/skills/remotion-render/visual-engine/directed-scene.jsx";
const c = fs.readFileSync(p, "utf8");
const start = c.indexOf("function cameraTransform(camera, progress) {");
const end = c.indexOf("function shotPhase(shots, p) {", start);
if (start < 0 || end < 0) throw new Error("cameraTransform block not found");
const replacement = 'function cameraTransform(camera, progress) {\n  return "none";\n}\n\n';
fs.writeFileSync(p, c.slice(0, start) + replacement + c.slice(end), "utf8");
console.log("cameraTransform repaired");
