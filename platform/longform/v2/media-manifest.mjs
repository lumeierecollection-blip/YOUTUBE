#!/usr/bin/env node
/**
 * Media manifest + footage gap check for every long-form sample episode. Run BEFORE production: an episode is not ready while any beat that
 * needs a picture points to an asset whose `usable` is not "yes".
 * Writes docs/longform/episodes/<channel>-<slug>/MEDIA-MANIFEST.json and prints a summary.
 * Rights are decided from the recorded licence, never from the fact that a file could be downloaded:
 *   Public domain, CC0, CC BY, CC BY-SA, Open Government Licence  -> usable, commercial and editing allowed (BY-SA: adaptations share-alike)
 *   "Attribution" (Commons tag used for e.g. La Moncloa press photos) -> usable with attribution; publisher terms to be re-read before upload
 *   page screenshots of third-party sites                           -> "owner decision": commentary/quotation use, not a licence
 *   CC BY-NC / ND / unknown                                           -> refused at download (platform/production/commons.mjs)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";

const PUB = join(ROOT, "src/skills/remotion-render/public/lf2");
const today = new Date().toISOString().slice(0, 10);
function rights(lic = "", kind = "") {
  const l = lic.toLowerCase();
  if (kind === "page-capture-gov") return { commercial: "yes", editing: "yes (crop/highlight)", attribution: "Contains public sector information licensed under the Open Government Licence v3.0", usable: "yes" };
  if (kind === "page-capture") return { commercial: "unclear", editing: "screenshot only", attribution: "name the site and date", usable: "owner decision (quotation/commentary of a third-party web page; not licensed)" };
  if (kind === "pdf-capture") return { commercial: "yes", editing: "yes (crop/highlight)", attribution: "Crown copyright; reuse terms on judiciary.uk to be re-read before upload (expected: Open Government Licence)", usable: "yes, pending a check of judiciary.uk terms" };
  if (/public domain|^pd|cc0/.test(l)) return { commercial: "yes", editing: "yes", attribution: "credit requested by NASA/agency; not legally required", usable: "yes" };
  if (/cc by-sa/.test(l)) return { commercial: "yes", editing: "yes; adapted versions must be shared under the same licence", attribution: "required: author, licence, link", usable: "yes" };
  if (/cc by /.test(l) || /^cc by$/.test(l) || /cc by \d/.test(l)) return { commercial: "yes", editing: "yes", attribution: "required: author, licence, link", usable: "yes" };
  if (/^attribution$/.test(l)) return { commercial: "yes (per Commons tag)", editing: "yes", attribution: "required: publisher name", usable: "yes, after re-reading the publisher's terms" };
  return { commercial: "unknown", editing: "unknown", attribution: "unknown", usable: "no (licence not recorded)" };
}
function assetsOf(ch) {
  const dir = join(PUB, ch), out = [];
  if (!existsSync(dir)) return out;
  const att = existsSync(join(dir, "ATTRIBUTIONS.json")) ? JSON.parse(readFileSync(join(dir, "ATTRIBUTIONS.json"), "utf8")) : {};
  for (const [id, a] of Object.entries(att)) out.push({ asset: `lf2/${ch}/${a.file}`, kind: a.authenticity || "authentic photograph", description: a.description, source_url: a.source_url || a.page, creator: a.author, licence: a.licence, licence_url: a.licence_url || "", downloaded: a.retrieved || today, ...rights(a.licence) });
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json") && x !== "ATTRIBUTIONS.json")) {
    const m = JSON.parse(readFileSync(join(dir, f), "utf8"));
    if (m.pdf) { for (const pg of Object.values(m.pages)) out.push({ asset: `lf2/${ch}/${pg.file.replace(".png", ".jpg")}`, kind: "court document page (rendered from the official PDF)", description: m.pdf, source_url: "https://www.judiciary.uk/judgments/sentencing-remarks-r-v-boris-becker/", creator: "Judiciary of England and Wales", licence: "Open Government Licence v3.0", downloaded: today, ...rights("", "pdf-capture") }); continue; }
    if (!m.url) continue;
    const gov = /gov\.uk|judiciary\.uk/.test(m.url);
    for (const s of m.shots || []) out.push({ asset: `lf2/${ch}/${s.file.replace(".png", ".jpg")}`, kind: `web page capture (Playwright, ${m.captured?.slice(0, 10)})`, description: m.title, source_url: m.url, creator: new URL(m.final_url || m.url).hostname, licence: gov ? "Open Government Licence v3.0" : "none (third-party page)", downloaded: m.captured?.slice(0, 10) || today, ...rights("", gov ? "page-capture-gov" : "page-capture") });
    if (m.video) out.push({ asset: `lf2/${ch}/${m.video}`, kind: "screen recording of a real browser session", description: m.title, source_url: m.url, creator: "our capture", licence: "our recording of a third-party page", downloaded: m.captured?.slice(0, 10) || today, ...rights("", "page-capture") });
  }
  return out;
}
// What the reference technique would use, beat by beat, versus what we can use (filled from the scene type).
const NEEDS = {
  footage: "archival or news video in the reference", photo: "broadcast clip in the reference", sequence: "broadcast match clip in the reference (we animate event data instead)",
  cover: "red-carpet or performance video in a magazine package", post: "the original post or video statement", image: "mission imagery (we have it)",
};
const CH = { "hidden-past": "hidden-past", "ai-tested": "ai-tested", "court-and-spotlight": "court-and-spotlight", "rival-lines": "rival-lines", "red-space-facts": "red-space-facts", psychology: "psychology", "celebrity-news": "celebrity-news" };
for (const ch of Object.keys(CH)) {
  const { EPISODE: e, SOURCES } = await import(`./episodes/${ch}.mjs`);
  const assets = assetsOf(ch), used = new Map();
  const json = JSON.stringify(e.beats);
  for (const a of assets) { const beats = e.beats.filter((b) => JSON.stringify(b.scene).includes(a.asset.split("/").pop().replace(/\.(jpg|png|webm)$/, ""))).map((b) => b.id); used.set(a.asset, beats); }
  const manifest = assets.map((a) => ({ ...a, intended_channel: ch, intended_episode: e.title, used_in_beats: used.get(a.asset) }));
  const gaps = e.beats.filter((b) => NEEDS[b.scene.type]).map((b) => ({ beat: b.id, scene: b.scene.type, reference_used: NEEDS[b.scene.type], we_use: b.scene.image || b.scene.photo || (b.scene.type === "sequence" ? "StatsBomb event + 360 animation" : "graphic"), licensed_video_available: ch === "red-space-facts" ? "yes: NASA SVS 4666 (public domain), frames used" : "no" }));
  const missing = [...new Set((json.match(/lf2\/[a-z-]+\/[^"]+\.(jpg|png)/g) || []))].filter((p) => !existsSync(join(ROOT, "src/skills/remotion-render/public", p)));
  const dir = join(ROOT, "docs/longform/episodes", `${ch}-${e.slug}`); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "MEDIA-MANIFEST.json"), JSON.stringify({ episode: e.title, channel: ch, generated: today, rule: "usable is decided from the recorded licence, never from downloadability", assets: manifest, footage_gaps: gaps, missing_files: missing, sources: SOURCES }, null, 1));
  const counts = manifest.reduce((m, a) => { const k = a.usable.split(" ")[0]; m[k] = (m[k] || 0) + 1; return m; }, {});
  console.log(ch.padEnd(22), "assets", String(manifest.length).padStart(3), JSON.stringify(counts), "unused", manifest.filter((a) => !a.used_in_beats.length).length, "footage gaps", gaps.filter((g) => g.licensed_video_available === "no").length, "missing files", missing.length);
}
