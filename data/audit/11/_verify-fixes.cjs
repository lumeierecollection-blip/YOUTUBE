const fs = require("fs");
const s = fs.readFileSync("data/audit/11/motion-probe.mjs", "utf8");
const checks = [
  ["C17 list pair", 'a: 41, b: 42'],
  ["C17 image pair", 'a: 66, b: 67'],
  ["Measure compId", "function Measure({ compId, frame })"],
  ["log keyed", 'compId + "@f" + frame'],
  ["Measure call", "<Measure compId={beat.id} frame={frame} />"],
  ["parseMeasures key", "function parseMeasures(logs, key)"],
  ["runGate key", "parseMeasures(logs, id + \"@f\" + frame)"],
  ["D6 stripped", "const stripped = src.replace(/\\/\\*[\\s\\S]*?\\*\\//g"],
  ["role parens", 'el.getAttribute("data-role") || (el.getAttribute("data-bar-group")'],
  ["fixture 47%", 'p: { headline: "47%" }'],
  ["old pair gone", 'a: 40, b: 41'],
  ["old image pair gone", 'a: 65, b: 66'],
];
const out = checks.map(([name, pat]) => (s.includes(pat) ? "OK   " : "MISS ") + name);
// Also: the old role line (unparenthesized) must be gone
out.push(s.includes('data-role") || el.getAttribute("data-bar-group") ? "bar-group"') ? "MISS  unparenthesized role line STILL PRESENT" : "OK   unparenthesized role line removed");
out.push("lines: " + s.split("\n").length);
fs.writeFileSync("data/audit/11/_verify.txt", out.join("\n"), "utf8");
console.log("wrote");
