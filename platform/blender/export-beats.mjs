#!/usr/bin/env node
/**
 * Exports a long-form episode (platform/longform/v2/episodes/<slug>.mjs) to the Blender Edit Machine's input: data/blender/<slug>/beats.json.
 * Every face shows only what the episode already shows (its sourced numbers, quotes, places and credited pictures); nothing is added here.
 * Each beat becomes { id, vo, sentences, kind, data }: kind is one of stat | bars | rows | text | quote | image | flow | sketch | cta.
 * Usage: node platform/blender/export-beats.mjs <slug>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const slug = process.argv[2];
const { EPISODE: ep } = await import(`../longform/v2/episodes/${slug}.mjs`);
const sentences = (vo) => (vo.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [vo]).map((s) => s.trim()).filter(Boolean);
const short = (s, n = 34) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const pct = (v, d = 1, u = "%") => `${Number(v).toFixed(d)}${u}`;
const COL = { home: "VIOLET", away: "BLUE", draw: "MUTED", accent: "GREEN", england: "RED", normandy: "BLUE", norway: "ORANGE", cavalry: "BLUE" };
const strip = (s) => String(s || "").replace(/\[\[|\]\]/g, "");

function face(sc, beat, i, all) {
  const t = sc.type;
  if (t === "ixstat") return { kind: "stat", data: { value: `${Number(sc.value).toFixed(sc.decimals || 0)}${sc.suffix || ""}`, label: sc.label, chip: sc.sub ? `${sc.sub.value} ${sc.sub.caption}` : null, image: sc.cut?.src } };
  if (t === "ixdots") return { kind: "bars", data: { title: sc.title, items: sc.groups.map((g) => ({ label: g.label, value: g.n, max: 100, shown: `${g.n}`, color: COL[g.color] || "BLUE" })) } };
  if (t === "ixbars") return { kind: "bars", data: { title: sc.title, items: sc.items.map((it) => ({ label: `${it.label}${it.sub ? ` · ${it.sub}` : ""}`, value: it.value, max: sc.max || 100, shown: pct(it.value, sc.decimals ?? 1, sc.unit ?? "%"), color: COL[it.color] || "BLUE" })) } };
  if (t === "ixline") { const s0 = sc.series[0], step = 4, idx = sc.xs.map((_, k) => k).filter((k) => k % step === 0 || k === sc.xs.length - 1); return { kind: "bars", data: { title: sc.title, items: idx.map((k) => ({ label: sc.xs[k], value: s0.vals[k], max: 60, shown: pct(s0.vals[k]), color: k === sc.mark?.from ? "GREEN" : "VIOLET" })) } }; }
  if (t === "ixscatter") { const pts = [...sc.points].sort((a, b) => (b.x - b.y) - (a.x - a.y)); const pick = [...pts.slice(0, 3), ...pts.slice(-2)]; return { kind: "rows", data: { title: sc.title, rows: pick.map((p) => [sc.hi?.includes(p.label) ? "VIOLET" : "BLUE", p.label, `home ${p.x.toFixed(2)} · away ${p.y.toFixed(2)}`]) } }; }
  if (t === "ixcard") return { kind: "text", data: { title: short(sc.journal, 40), lines: [sc.title, "", strip(sc.abstract).replace(/^\[\.\.\.\]\s*/, "")], hl: true } };
  if (t === "ixquote") return { kind: "quote", data: { title: sc.text, sub: sc.sub } };
  if (t === "ixclip") return { kind: "image", data: { image: sc.image || null, title: sc.head || "", video: sc.video || null } };
  if (t === "montage") return { kind: "image", data: { image: null, title: beat.part } };
  if (t === "eptitle") return { kind: "quote", data: { title: sc.lines[0]?.text || "", sub: sc.lines.slice(1).map((l) => l.text).join(" · ") } };
  if (t === "eppaint") return { kind: "image", data: { image: sc.image, title: sc.plates?.[0]?.name || "", sub: sc.plates?.[0]?.role || "", credit: sc.credit } };
  if (t === "eppmap") return { kind: "flow", data: { title: beat.part, steps: (sc.labels || []).filter((l) => l.kind === "place" || l.kind === "country").map((l) => short(l.text, 26)).slice(0, 4), plate: sc.plates?.[0] || null, image: sc.figures?.[0]?.src || null } };
  if (t === "epbattle") return { kind: "sketch", data: { title: (sc.armies || []).map((a) => a.title).find(Boolean) || "the battle", armies: (sc.armies || []).map((a) => `${a.title}${a.sub ? ` · ${a.sub}` : ""}`), arrows: (sc.arrows || []).length, schematic: true } };
  if (t === "eporder") return { kind: "rows", data: { title: sc.title, rows: sc.sides.flatMap((s) => s.rows.map((r) => [COL[s.color] || "BLUE", `${s.name.split(" ·")[0]}: ${r.label}`, r.value])) } };
  if (t === "epcasualty") return { kind: "rows", data: { title: sc.title || "Casualty estimates", rows: sc.rows.map((r) => ["RED", r.label, r.value]) } };
  if (t === "epcredits") return { kind: "text", data: { title: "Sources", lines: sc.lines } };
  return { kind: "quote", data: { title: beat.part, sub: "" } };
}

const beats = ep.beats.map((b, i, all) => ({ id: b.id, part: b.part, vo: b.vo, sentences: sentences(b.vo), ...face(b.scene, b, i, all) }));
beats[beats.length - 1].cta = true;
const out = join(ROOT, "data/blender", slug); mkdirSync(out, { recursive: true });
writeFileSync(join(out, "beats.json"), JSON.stringify({ slug, title: ep.title, channel: ep.channel, beats }, null, 1));
console.log(slug, beats.length, "beats ->", join(out, "beats.json"));
