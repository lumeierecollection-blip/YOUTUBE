// Drafts the YouTube packaging for a Rival Lines episode: title, description, tags and chapter list.
// usage: node build-publish.mjs <episode_dir>   (needs out/props.json; uses out/soundtrack.json for the music credit when present)
//   -> <episode_dir>/out/publish.md
// Everything factual is lifted from the episode's own files: the hook and the closing question are the script's own sentences, the
// chapter list is the on-screen chapter cards with their real times, the sources and image credits are the ones the gate checked.
// Shape follows data/rival-lines/paperpitch-footballrealm-reference-study.md sections 5 and 7. A draft for a person to read: not uploaded anywhere.
import fs from "node:fs";
import path from "node:path";

const ep = path.resolve(process.argv[2] || "");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const script = readJson(path.join(ep, "script.json"));
const props = readJson(path.join(ep, "out", "props.json"));
const stPath = path.join(ep, "out", "soundtrack.json");
const st = fs.existsSync(stPath) ? readJson(stPath) : null;

const titleCase = (s) => s.replace(/\b([a-z])([a-z']*)/g, (m, a, b, off) => (off > 0 && /^(of|the|a|to|and|in|on|at|for)$/.test(m) ? m : a.toUpperCase() + b));
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const sentences = (t) => t.match(/[^.?!]+[.?!]+/g)?.map((x) => x.trim()) || [t];
const beat = (id) => script.beats.find((b) => b.id === id);

const chapters = props.scenes.filter((s) => s.chapter).map((s) => ({ t: s.t0, title: titleCase(s.chapter.title) }));
chapters[0].t = 0;
if (chapters[0].t !== 0 || chapters.length < 3) throw new Error("YouTube needs the first chapter at 0:00 and at least three chapters");
for (let i = 1; i < chapters.length; i++) if (chapters[i].t - chapters[i - 1].t < 10) throw new Error("chapters must be at least 10 s long");

const last = script.beats[script.beats.length - 1];
const closing = sentences(last.text).find((s) => s.includes("?")) || sentences(last.text)[0];
const b03 = sentences(beat("b03").text);
const hook = [...sentences(beat("b01").text), ...sentences(beat("b02").text).slice(0, 2), b03[b03.length - 1]].join(" ");

const usedKeys = new Set(JSON.stringify(props.scenes).match(/"img":"(c\d+)"/g)?.map((m) => m.slice(7, -1)) || []);
const usedImages = Object.entries(props.images).filter(([k]) => usedKeys.has(k)).map(([, im]) => im);
const credits = [...new Set(usedImages.map((im) => im.credit))];

const pkg = readJson(path.join(ep, "packaging.json"));
const titles = pkg.titles;
const tags = pkg.tags;
const channelTag = "Rival Lines";
if (tags.length < 17 || tags.length > 21) throw new Error("study section 7: 17 to 21 tags");
if (tags.join(",").length > 480) throw new Error("YouTube tag field limit is 500 characters");
for (const [k, t] of Object.entries(titles)) { const n = t.split(/\s+/).length; if (!t.endsWith("?") || n < 6 || n > 9) throw new Error(`title ${k}: needs a question of 6 to 9 words`); }

const L = [];
L.push(`# Packaging draft: ${path.basename(ep)}`, "", "Draft for a person to read. Nothing here has been uploaded. Upload as private first (CLAUDE.md hard rule), then auto-public after the channel's delay.", "");
L.push("## Titles (A/B)", "", ...Object.entries(titles).map(([k, t]) => `${k.toUpperCase()}: ${t} (${t.split(/\s+/).length} words)`), "", "Both are questions in Title Case, the Paper Pitch shape. Thumbnail a goes with title a, thumbnail b with title b.", "");
L.push("## Description", "");
L.push(hook, "");
L.push(closing, "");
L.push(`Numbers are correct to ${script.as_of}. The tally of official goals differs by source, and the video shows each.`, "");
L.push("Chapters", ...chapters.map((c) => `${mmss(c.t)} ${c.title}`), "");
L.push("Not affiliated with or endorsed by any club, league or competition.", "");
L.push("Data", ...script.sources_used.map((u) => `- ${u} (fetched ${script.as_of})`), "- The model, its assumptions and its output file are kept with the video.", "");
L.push("Images", ...credits.map((c) => `- ${c}`), "");
if (st) L.push("Music", ...st.credits.map((c) => `- ${c}`), "");
L.push("## Tags", "", tags.join(", "), "", `${tags.length} tags, entities first, the four fixed tags last (football analysis, football data, football explained, ${channelTag}). Hashtags: none, as in the reference.`, "");
L.push("## Not drafted here", "", "- The thumbnail, the avatar and the banner (formulas are in the study, sections 6 and 8; they need artwork, not text).", "- Any claim about views or growth.", "- Match footage: this episode uses none, so no footage line is written.", "");
fs.writeFileSync(path.join(ep, "out", "publish.md"), L.join("\n"));
const descStart = L.indexOf("## Description") + 2;
const description = L.slice(descStart, L.indexOf("## Tags") - 1).join("\n").trim();
fs.writeFileSync(path.join(ep, "out", "publish.json"), JSON.stringify({ titles, description, tags, chapters: chapters.map((c) => ({ t: c.t, title: c.title })) }, null, 1));
console.log(`publish draft: ${chapters.length} chapters, ${credits.length} image credits, ${tags.length} tags`);
