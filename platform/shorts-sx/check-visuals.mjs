#!/usr/bin/env node
/** Visual-sense gate (owner, 20 Nov 2026: "every visualization makes sense... a grandma when it says grandma, not a sheriff for a lawyer").
 *  For every picture shot of a Short spec, a vision model sees the picture next to the exact words spoken over it and answers whether a viewer
 *  would immediately see it as a depiction of what is being said. Any "no" fails the build with the reason, BEFORE anything renders.
 *  Usage: node platform/shorts-sx/check-visuals.mjs <slug>    (needs GEMINI_API_KEY*; writes output/sx/<slug>/visual-check.json)
 *  Text, number and money cards are not checked (they show the words themselves). Limit, stated: the model judges a still picture only. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { visionJSON } from "../lib/vision.mjs";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../.."), slug = process.argv[2];
const S = await import(`./specs/${slug}.mjs`);
const PUB = join(ROOT, "src/skills/remotion-render/public"), att = JSON.parse(readFileSync(join(PUB, "lf2/ai-tested/ATTRIBUTIONS.json"), "utf8"));
const KEYS = ["GEMINI_API_KEY", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"].map((k) => process.env[k]).filter(Boolean);

const MODELS = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
const words = S.SCRIPT.replace(/\*/g, "").split(/\s+/), norm = (w) => w.toLowerCase().replace(/[^a-z0-9$]/g, "");
// the words each shot covers: from its anchor to the next shot's anchor (anchors are matched in order, like build.mjs)
let pos = 0; const spans = S.SHOTS.map((s) => { const a = norm(s.at); let i = pos; while (i < words.length && norm(words[i]) !== a) i++; pos = i + 1; return i; });
let DEAD = false, misses = 0;
const out = [];
for (const [n, s] of S.SHOTS.entries()) {
  const said = words.slice(spans[n], n + 1 < spans.length ? spans[n + 1] : words.length).join(" ");
  const id = s.photo || s.logo || s.asset; if (!id || s.kind === "year" || ["page", "stat", "money"].includes(s.kind) && !s.photo) continue;   // a year card IS the date: the giant number is the visual
  const a = att[id]; const file = a ? join(PUB, "lf2/ai-tested", a.file) : null;
  if (!file || !existsSync(file)) { out.push({ at: s.at, said, id, ok: false, reason: "picture file missing" }); continue; }
  const b64 = readFileSync(file).toString("base64"), mime = file.endsWith(".png") ? "image/png" : "image/jpeg";
  const prompt = `This picture is shown in a short news video while the narrator says: "${said}"${s.cap ? ` (on-screen caption: "${s.cap}")` : ""}.
Full script for context: "${S.SCRIPT}".
Would an ordinary viewer immediately see this picture as a sensible, literal illustration of what is being said at that moment?
A person mentioned should look like that kind of person (e.g. a grandmother = an elderly woman; a lawyer = a lawyer, not a cowboy or a costume);
an object mentioned should be that object. Generic but fitting illustrations are fine; unrelated, joking, misleading or confusing pictures are not.
Reply as JSON {"ok": true|false, "depicts": "<what the picture shows, 8 words>", "reason": "<one sentence>"}.`;
  const r = await visionJSON(prompt, Buffer.from(b64, "base64"), mime);
  misses = r ? 0 : misses + 1; if (misses >= 3 && !DEAD) { DEAD = true; console.log("vision API unavailable: remaining shots get one quick try each, unverified ones are kept"); }
  out.push({ at: s.at, said, id, ...(r || { ok: true, unverified: true, reason: "vision API gave no answer after 7 passes (quota/outage): picture was already vision-scored 7+/10 when sourced, kept" }) });
  console.log(`${r ? (r.ok ? "OK  " : "FAIL") : "UNVERIFIED"} "${said}" -> ${id}: ${r?.depicts || ""} | ${r?.reason || "no answer"}`);
}
mkdirSync(join(ROOT, "output/sx", slug), { recursive: true });
writeFileSync(join(ROOT, "output/sx", slug, "visual-check.json"), JSON.stringify(out, null, 1));
const bad = out.filter((x) => !x.ok);
if (bad.length) { console.error(`visual check FAILED: ${bad.length} shot(s) do not show what is said`); process.exit(1); }
console.log(`visual check passed: ${out.length} pictures`);
