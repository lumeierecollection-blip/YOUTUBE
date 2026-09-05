import { readFileSync, readdirSync, existsSync } from "fs";

const channels = JSON.parse(readFileSync("config/channels.json", "utf-8"));
const list = channels.channels || channels;

// ---- icon_map union vs public/icons ----
const icons = new Set(readdirSync("src/skills/remotion-render/public/icons").map((f) => f.replace(/\.svg$/, "")));
const required = new Set();
const channelIconMaps = list.filter((c) => c.icon_map && c.style === "motion-graphics");
for (const c of channelIconMaps) {
  required.add(c.icon_map.default);
  for (const v of Object.values(c.icon_map.terms || {})) required.add(v);
}
const missingIcons = [...required].filter((n) => !icons.has(n));
const unusedIcons = [...icons].filter((n) => !required.has(n));
console.log("mg channels with icon_map:", channelIconMaps.length);
console.log("required icon names (union):", required.size);
console.log("vendored icons:", icons.size);
console.log("required but NOT vendored:", missingIcons.length ? missingIcons.join(", ") : "none");
console.log("vendored but NOT required (unused):", unusedIcons.length ? unusedIcons.join(", ") : "none");

// lucide-static has them?
const lucide = new Set(readdirSync("node_modules/lucide-static/icons").map((f) => f.replace(/\.svg$/, "")));
const notInLucide = [...required].filter((n) => !lucide.has(n));
console.log("required but NOT in lucide-static:", notInLucide.length ? notInLucide.join(", ") : "none");

// ---- b-roll manifest ch-01 local paths vs actual files ----
const manifest = JSON.parse(readFileSync("src/skills/remotion-render/b-roll-manifest-ch-01.json", "utf-8"));
const missingBroll = (manifest.files || []).filter((f) => !existsSync("src/skills/remotion-render/" + f.local));
console.log("b-roll manifest entries:", (manifest.files || []).length, "missing on disk:", missingBroll.length ? missingBroll.map((f) => f.local).join(", ") : "none");

// ---- unused-by-any-channel fonts (A0.1 note) ----
const loader = readFileSync("src/skills/remotion-render/fonts-loader.js", "utf-8");
const loaderFamilies = [...new Set([...loader.matchAll(/font-family:"([^"]+)"/g)].map((m) => m[1]))];
const usedAny = new Set(list.filter((c) => c.font).map((c) => c.font));
console.log("--- fonts referenced by ANY channel but not vendored ---");
for (const c of list) {
  if (c.font && !loaderFamilies.includes(c.font)) {
    console.log("  MISSING:", c.font, "<-", c.channel_name || c.channel_id, "(" + c.style + ")");
  }
}
const unusedAny = loaderFamilies.filter((f) => !usedAny.has(f));
console.log("vendored families used by NO channel at all (" + unusedAny.length + "):", unusedAny.join(", "));

// ---- fonts-loader family count ----
console.log("loader families total:", loaderFamilies.length, "=", loaderFamilies.join(", "));

const lines = readFileSync("config/channels.json", "utf-8").split(/\r?\n/);
for (const c of list) {
  if (["Fira Sans", "Comic Neue", "Noto Serif"].includes(c.font)) {
    const nameLine = lines.findIndex((l) => l.includes('"' + c.channel_name + '"'));
    const fontLine = lines.findIndex((l) => l.includes('"font": "' + c.font + '"'));
    console.log("line-ref", c.id, c.channel_name, "(" + c.style + ")", "name@line", nameLine + 1, "font@line", fontLine + 1);
  }
}

console.log("--- precise font line refs ---");
let curName = null;
lines.forEach((l, i) => {
  const nm = l.match(/"channel_name":\s*"([^"]+)"/);
  if (nm) curName = nm[1];
  const fm = l.match(/"font":\s*"([^"]+)"/);
  if (fm && ["Fira Sans", "Comic Neue", "Noto Serif"].includes(fm[1])) {
    console.log("font@line", i + 1, fm[1], "<- channel:", curName);
  }
});
