// Builds out/publish.json and out/publish.md for a "realm" episode from packaging.json, script.json (sources_used) and images.json (credits).
// usage: node build-realm-publish.mjs <episode_dir>
import fs from "node:fs";
import path from "node:path";

const ep = path.resolve(process.argv[2]);
const rj = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const pkg = rj(path.join(ep, "packaging.json"));
const script = rj(path.join(ep, "script.json"));
const props = rj(path.join(ep, "out", "props.json"));
const used = new Set();
const collect = (v) => {
  if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === "object") for (const [k, val] of Object.entries(v)) {
    if (k === "img" && typeof val === "string") used.add(val);
    else if (k === "imgs" && Array.isArray(val)) val.forEach((x) => used.add(x));
    else collect(val);
  }
};
props.scenes.forEach((s) => collect(s.visual));
const thumbPath = path.join(ep, "thumbnails.json");
if (fs.existsSync(thumbPath)) rj(thumbPath).variants.forEach(collect);

const fails = [];
for (const k of ["a", "b"]) if (!pkg.titles[k] || pkg.titles[k].length > 100) fails.push(`title ${k} missing or over 100 characters`);
if (pkg.tags.length < 15 || pkg.tags.length > 25) fails.push(`tags: ${pkg.tags.length} (want 15 to 25)`);
if (pkg.tags.join(",").length > 450) fails.push("tags over 450 characters");
if (fails.length) { console.log(fails.join("\n")); process.exit(1); }

const credits = [...new Set([...used].map((i) => `${props.images[i].credit} (${props.images[i].page})`))];
const clips = Object.values(props.footage || {}).map((c) => `${c.credit}, "${c.label}" (${c.page})`);
const stPath = path.join(ep, "out", "soundtrack.json");
const music = fs.existsSync(stPath) ? rj(stPath).beds.map((b) => `${b.attribution} ${b.landing_url}`) : [];
const src = script.sources_used.map((u) => `- ${u}`);
const description = [pkg.intro, "", pkg.disclaimer, "", "Sources:", ...src, "", "Photos (Wikimedia Commons, with background removed; credit and licence as listed):", ...credits.map((c) => `- ${c}`), "", ...(clips.length ? ["Video clips (Wikimedia Commons, trimmed, sound removed):", ...clips.map((c) => `- ${c}`), ""] : []), ...(music.length ? ["Music:", ...music.map((c) => `- ${c}`), "Sound effects: CC0 recordings (Remotion SFX library).", ""] : []), "Narration is a computer-generated voice. Facts as of " + (script.as_of || "the date of writing") + "."].join("\n");
fs.mkdirSync(path.join(ep, "out"), { recursive: true });
fs.writeFileSync(path.join(ep, "out", "publish.json"), JSON.stringify({ titles: pkg.titles, description, tags: pkg.tags }, null, 1));
fs.writeFileSync(path.join(ep, "out", "publish.md"), [`# A: ${pkg.titles.a}`, `# B: ${pkg.titles.b}`, "", description, "", "Tags: " + pkg.tags.join(", ")].join("\n"));
console.log(`publish: ${pkg.tags.length} tags, ${description.length} description chars, ${credits.length} credits`);
