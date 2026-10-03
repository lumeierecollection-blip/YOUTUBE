const fs = require("fs");
const p = "C:/Users/user/YOUTEBE/src/skills/render-render/render.js";
const c = fs.readFileSync(p, "utf8");
const lines = c.split("\n");
lines.splice(515, 0,        bgMode: channel.bg_mode if channel.gb_mode else "black",");
fs.writeFileSync(p, lines.join("\n"), "utf8");
console.log("render.js: bgMode inserted");
