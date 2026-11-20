#!/usr/bin/env node
/** Automatic picture sourcing (owner, 20 Nov 2026: "everything sourced and made at once", every named thing must be shown, and the pictures must make sense).
 *  Input: a jobs file [{ id, q, desc }] and a target dir. For each item: Openverse search (Flickr, museums, NASA, archives; Wikimedia hits are skipped here),
 *  download up to N candidates from their own hosts, a vision model scores each against `desc` (0-10: is this clearly that person/place/object, sharp, no text clutter),
 *  the best one scoring >= MIN is saved as <dir>/<id>.jpg with its credit in ATTRIBUTIONS.json. Items with no good candidate are listed as MISSING (never faked).
 *  Usage: node auto-source.mjs <jobs.json> <channel-dir under public/lf2>   (needs GEMINI_API_KEY*) */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../.."), [jobsFile, chDir] = process.argv.slice(2);
const jobs = JSON.parse(readFileSync(jobsFile, "utf8")), DIR = join(ROOT, "src/skills/remotion-render/public/lf2", chDir), MIN = 7, N = 6, MODEL = "gemini-3.5-flash";
mkdirSync(DIR, { recursive: true }); const attP = join(DIR, "ATTRIBUTIONS.json"), att = existsSync(attP) ? JSON.parse(readFileSync(attP, "utf8")) : {};
const KEYS = ["GEMINI_API_KEY", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"].map((k) => process.env[k]).filter(Boolean);
if (!KEYS.length) { console.error("no GEMINI key"); process.exit(2); }
const UA = { "User-Agent": "research-client/1.0" }, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u) => { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(40000) }); if (!r.ok) throw new Error(r.status); return Buffer.from(await r.arrayBuffer()); };
async function score(buf, desc) {
  const prompt = `Rate this picture 0-10 for use in a documentary video as a literal illustration of: "${desc}". 10 = clearly exactly that (the named person looks like a portrait of them, the place is recognisable), sharp, no big text or watermark.
0-3 = unrelated, a different person/place, a joke, a costume, or confusing. Reply JSON {"score": number, "depicts": "<8 words>"}.`;
  for (let pass = 0; pass < 3; pass++) {
    for (const key of KEYS) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: buf.toString("base64") } }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }) });
        if (!res.ok) continue; const r = JSON.parse((await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || "null"); if (r) return r;
      } catch { /* next key */ }
    }
    await sleep(6000 * (pass + 1));
  }
  return null;
}
const missing = [];
for (const j of jobs) {
  if (att[j.id] && existsSync(join(DIR, att[j.id].file))) { console.log("have", j.id); continue; }
  let best = null;
  try {
    const res = (await (await fetch("https://api.openverse.org/v1/images/?" + new URLSearchParams({ q: j.q, page_size: "20" }), { headers: UA })).json()).results || [];
    let tried = 0;
    for (const r of res) {
      if (tried >= N) break; const u = r.url || ""; if (/wikimedia\.org|wikipedia\.org/.test(u)) continue;
      try {
        const buf = await get(u); if (buf.length < 30000 || buf.length > 6e6) continue; tried++;
        const s = await score(buf, j.desc || j.q); console.log(`  ${j.id} cand ${tried}: ${s?.score ?? "?"} ${s?.depicts || ""}`);
        if (s && s.score >= MIN && (!best || s.score > best.s)) best = { s: s.score, buf, r, depicts: s.depicts };
      } catch { /* next */ }
    }
  } catch (e) { console.log("search failed", j.id, String(e).slice(0, 60)); }
  if (!best) { missing.push(j.id); console.log("MISSING", j.id); continue; }
  writeFileSync(join(DIR, j.id + ".jpg"), best.buf);
  att[j.id] = { id: j.id, file: j.id + ".jpg", description: j.desc || j.q, depicts: best.depicts, score: best.s, source: best.r.source, source_url: best.r.foreign_landing_url, licence: `${best.r.license} ${best.r.license_version || ""}`.trim(), author: best.r.creator || "", credit_line: `${best.r.creator || "Unknown"}, ${String(best.r.license || "").toUpperCase()}, via ${best.r.source}`, authenticity: "authentic" };
  writeFileSync(attP, JSON.stringify(att, null, 1)); console.log("OK", j.id, best.s);
  await sleep(1500);
}
writeFileSync(join(DIR, "_missing.json"), JSON.stringify(missing)); console.log("missing:", missing.join(", ") || "none");
