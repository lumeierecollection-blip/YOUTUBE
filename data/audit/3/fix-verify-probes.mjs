import { readFileSync, writeFileSync } from "fs";

const f = "src/skills/remotion-render/verify-compositions.js";
let c = readFileSync(f, "utf8");

const a = "console.log(`mg f60 corner (bg ${mgPalette[0]}):`, corner.join(\",\"), near(corner, hex(mgPalette[0]), 26) ? \"bg OK\" : \"bg MISMATCH\");";
const aNew = "console.log(`mg f60 corner (bg ${mgPalette.bg}):`, corner.join(\",\"), near(corner, hex(mgPalette.bg), 26) ? \"bg OK\" : \"bg MISMATCH\");";

const b = "const accentCount = countNear(mg900(), hex(mgPalette[1]), 48);";
const bNew = "const accentCount = countNear(mg900(), hex(mgPalette.accent), 48);";

if (!c.includes(a)) throw new Error("corner probe not found");
if (!c.includes(b)) throw new Error("accent probe not found");
c = c.replace(a, aNew);
c = c.replace(b, bNew);
writeFileSync(f, c, "utf8");
console.log("verify-compositions.js probes fixed");
