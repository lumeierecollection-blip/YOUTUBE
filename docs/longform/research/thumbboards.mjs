// Thumbnail boards + measured colour stats for every enriched channel.
// boards/t/<cid>.jpg: row 1 = top 5 by views (of the newest 250 long videos), row 2 = the 5 newest; each labelled with views, x channel median, date.
// thumb-stats.json: per thumbnail mean brightness, saturation, share of very dark / very bright pixels, 3 dominant colours (k-means on 32x18).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
const sharp = createRequire("C:/Users/info/YOUTUBE/package.json")("sharp");
mkdirSync("boards/t", { recursive: true });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const f = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : Math.round(v / 1e3) + "k");
const stats = existsSync("thumb-stats.json") ? JSON.parse(readFileSync("thumb-stats.json", "utf8")) : {};
async function measure(file) {
  const { data } = await sharp(file).resize(32, 18, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = []; for (let i = 0; i < data.length; i += 3) px.push([data[i], data[i + 1], data[i + 2]]);
  const hsv = px.map(([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return { v: mx / 255, s: mx ? (mx - mn) / mx : 0 }; });
  let cent = [px[0], px[200], px[400]];
  for (let it = 0; it < 8; it++) { const groups = cent.map(() => []); for (const p of px) { let bi = 0, bd = 1e9; cent.forEach((c, i) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; bi = i; } }); groups[bi].push(p); } cent = groups.map((g, i) => (g.length ? [0, 1, 2].map((k) => Math.round(g.reduce((s, p) => s + p[k], 0) / g.length)) : cent[i])); cent.counts = groups.map((g) => g.length); }
  const hex = (c) => "#" + c.map((x) => x.toString(16).padStart(2, "0")).join("");
  return { brightness: +(hsv.reduce((s, x) => s + x.v, 0) / hsv.length).toFixed(2), saturation: +(hsv.reduce((s, x) => s + x.s, 0) / hsv.length).toFixed(2), dark_share: +(hsv.filter((x) => x.v < 0.18).length / hsv.length).toFixed(2), bright_share: +(hsv.filter((x) => x.v > 0.9 && x.s < 0.15).length / hsv.length).toFixed(2), palette: cent.map(hex) };
}
for (const fn of readdirSync("cat").filter((x) => x.endsWith(".json"))) {
  const c = JSON.parse(readFileSync(`cat/${fn}`, "utf8")), dir = `thumbs/${c.cid}`, cells = [];
  for (const [row, list] of [[0, c.top], [1, c.recent]]) list.slice(0, 5).forEach((v, i) => cells.push({ row, i, v }));
  const tiles = [];
  for (const { row, i, v } of cells) {
    const file = `${dir}/${v.id}.jpg`; if (!existsSync(file)) continue;
    try { stats[v.id] = { cid: c.cid, channel: c.channel, title: v.title, views: v.views, x_median: v.x_median, date: v.date, kind: row ? "recent" : "top", ...(await measure(file)) }; } catch { continue; }
    const img = await sharp(file).resize(480, 270, { fit: "cover" }).toBuffer();
    const lab = Buffer.from(`<svg width="480" height="44"><rect width="480" height="44" fill="#111"/><text x="8" y="18" font-family="sans-serif" font-size="15" font-weight="700" fill="#ffd34d">${esc(f(v.views))} · ${v.x_median}x median · ${esc(v.date || "?")}</text><text x="8" y="37" font-family="sans-serif" font-size="13" fill="#ddd">${esc(v.title.slice(0, 62))}</text></svg>`);
    tiles.push({ input: img, left: i * 486, top: row * 320 }, { input: lab, left: i * 486, top: row * 320 + 272 });
  }
  const head = Buffer.from(`<svg width="2430" height="40"><rect width="2430" height="40" fill="#000"/><text x="10" y="28" font-family="sans-serif" font-size="24" font-weight="700" fill="#fff">${esc(c.channel || c.cid)} · ${c.niche} · subs ${c.subs ? f(c.subs) : "?"} · median of newest 30: ${f(c.median_views_recent30)} · ${c.uploads_per_month ?? "?"} uploads/month · median ${c.median_duration_min} min · collected ${c.collected} · row 1 top 5, row 2 newest 5</text></svg>`);
  await sharp({ create: { width: 2430, height: 40 + 640, channels: 3, background: "#222" } }).composite([{ input: head, left: 0, top: 0 }, ...tiles.map((t) => ({ ...t, top: t.top + 40 }))]).jpeg({ quality: 78 }).toFile(`boards/t/${c.cid}.jpg`);
  console.log("board", c.channel, tiles.length / 2);
}
writeFileSync("thumb-stats.json", JSON.stringify(stats, null, 1));
