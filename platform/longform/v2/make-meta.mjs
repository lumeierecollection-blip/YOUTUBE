#!/usr/bin/env node
/**
 * Long-form publishing metadata from a rendered episode: title, description with real chapters (from the measured beat lengths), sources, image and sound
 * credits, tags and hashtags. Usage: node platform/longform/v2/make-meta.mjs <channel>. Output: output/longform-prod/<channel>/episode-meta.json. Nothing uploads.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";

const ch = process.argv[2], XF = 0.4, PAD = 0.55;
const BASE = join(ROOT, "output/longform-prod", ch), VOICE = join(BASE, "voice");
const { EPISODE: ep, SOURCES } = await import(`./episodes/${ch}.mjs`);
const dur = (f) => Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout.trim());
const attrib = (() => { try { return JSON.parse(readFileSync(join(ROOT, `src/skills/remotion-render/public/lf2/${ch}/ATTRIBUTIONS.json`), "utf8")); } catch { return {}; } })();
const images = [...new Set(ep.beats.flatMap((b) => { const img = b.scene.image || b.scene.photo; const k = img && basename(String(img)).replace(/\.\w+$/, ""); return k && attrib[k] ? [`${attrib[k].credit_line} (${attrib[k].source_url})`] : []; }))];
const log = existsSync(join(BASE, "render-log.json")) ? JSON.parse(readFileSync(join(BASE, "render-log.json"), "utf8")) : {};
const lib = Object.fromEntries(JSON.parse(readFileSync(join(ROOT, "config/longform-audio-library.json"), "utf8")).assets.map((a) => [a.slot, a]));
const sounds = [...new Set((log.sfx || []).map((e) => e.asset))].map((k) => { const a = lib[k]; return a ? `Sound effect: "${a.title}" by ${a.creator}, ${a.license.toUpperCase().replace("BY 3.0", "CC BY 3.0")} (${a.source_page})` : null; }).filter(Boolean);
let t = 0, last = null; const chapters = [];
for (const b of ep.beats) { const f = join(VOICE, `${b.id}.mp3`); if (!existsSync(f)) continue; if (b.part !== last) { chapters.push([t, b.part]); last = b.part; } t += dur(f) + PAD - XF; }
const fmt = (s) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const hashtags = ch === "ai-tested" ? "#AITested #AI #Gemini" : "#HiddenPast #History #SuezCanal";
const meta = {
  channel: ch, format: "long-form", title: ep.title, privacy: "private", upload_status: "NOT UPLOADED", seconds: +t.toFixed(1),
  description: [ep.title, "", "Chapters:", ...chapters.map(([s, p]) => `${fmt(s)} ${cap(p)}`), "", "Sources:", ...Object.values(SOURCES).map((s) => `- ${s.title}: ${s.url}`), "", "Image credits:", ...(images.length ? images : ["(graphics and captures made for this video)"]), ...(sounds.length ? ["", ...sounds] : []), "", hashtags].join("\n"),
  tags: ch === "ai-tested" ? ["AI test", "AI multiplication", "Gemini", "Faith and Fate", "chain of thought"] : ["Suez Canal", "Yellow Fleet", "Great Bitter Lake", "Six Day War", "history"],
};
writeFileSync(join(BASE, "episode-meta.json"), JSON.stringify(meta, null, 2));
console.log(`${meta.title}: ${chapters.length} chapters, ${meta.seconds}s, ${sounds.length} sound credit(s)`);
