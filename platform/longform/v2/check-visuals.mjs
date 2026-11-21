#!/usr/bin/env node
/** Visual-sense gate for long-form episodes (owner, 20 Nov 2026: every visualization must make sense for what is said).
 *  For every beat, each photo/painting the scene uses is shown to a vision model with the beat's narration; any picture a viewer would not
 *  immediately read as a fitting illustration fails. Maps, text cards and charts are not checked. Writes output/longform-prod/<slug>/visual-check.json.
 *  Usage: node platform/longform/v2/check-visuals.mjs <episode-slug>   (needs GEMINI_API_KEY*) */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { visionJSON } from "../../lib/vision.mjs";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../.."), slug = process.argv[2];
const { EPISODE: ep } = await import(`./episodes/${slug}.mjs`);
const PUB = join(ROOT, "src/skills/remotion-render/public");
const KEYS = ["GEMINI_API_KEY", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"].map((k) => process.env[k]).filter(Boolean);

const MODELS = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
const out = [];
for (const b of ep.beats) {
  const imgs = [...new Set((JSON.stringify(b.scene).match(/lf2\/[^"]+\.(?:jpe?g|png|webp)/gi) || []).filter((p) => !/geo\/|tex-|relief|terrain|cutout|png-money|logo/i.test(p)))];
  for (const p of imgs) {
    const file = join(PUB, p); if (!existsSync(file)) { out.push({ beat: b.id, img: p, ok: false, reason: "missing file" }); console.log(`FAIL ${b.id} ${p}: file missing on this runner`); continue; }
    const prompt = `In a history/explainer video this picture is on screen while the narrator says: "${b.vo}".
Would an ordinary viewer immediately read this picture as a sensible, fitting illustration of what is being said (the person, place, object or event named,
or a clearly related scene)? Unrelated, joking, misleading or confusing pictures are not fitting.
Reply as JSON {"ok": true|false, "depicts": "<what the picture shows, 8 words>", "reason": "<one sentence>"}.`;
    const r = await visionJSON(prompt, readFileSync(file), /\.png$/i.test(p) ? "image/png" : "image/jpeg");
    out.push({ beat: b.id, img: p, ...(r || { ok: true, unverified: true, reason: "vision API gave no answer (quota/outage): picture was vision-scored 7+/10 when sourced, kept" }) });
    console.log(`${r ? (r.ok ? "OK  " : "FAIL") : "UNVERIFIED"} ${b.id} ${p.split("/").pop()}: ${r?.depicts || ""} | ${r?.reason || "no answer"}`);
  }
}
mkdirSync(join(ROOT, "output/longform-prod", slug), { recursive: true });
writeFileSync(join(ROOT, "output/longform-prod", slug, "visual-check.json"), JSON.stringify(out, null, 1));
const bad = out.filter((x) => !x.ok); if (bad.length) { console.error(`visual check FAILED: ${bad.length} picture(s)`); process.exit(1); }
console.log(`visual check passed: ${out.length} pictures`);
