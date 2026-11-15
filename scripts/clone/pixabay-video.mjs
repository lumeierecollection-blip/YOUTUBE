// Free moving footage for long-form: Pixabay video search (Pixabay Content License: free commercial use, no attribution required;
// we still record id, page URL and uploader in footage.json). Used where a reference's main visual is real footage we cannot licence
// (Football Made Simple's broadcast clips -> generic real pitch, stadium and crowd footage; never presented as the match being discussed).
// Usage: PIXABAY_API_KEY=... node scripts/clone/pixabay-video.mjs <outDir> <perQuery> "query one" "query two" ...
import fs from "node:fs";
import path from "node:path";

const [outDir, per, ...queries] = process.argv.slice(2);
const KEY = process.env.PIXABAY_API_KEY;
if (!KEY) throw new Error("PIXABAY_API_KEY missing");
fs.mkdirSync(outDir, { recursive: true });
const list = [];
for (const q of queries) {
  const u = `https://pixabay.com/api/videos/?key=${KEY}&q=${encodeURIComponent(q)}&per_page=${Math.max(3, +per)}&safesearch=true&order=popular`;
  const r = await fetch(u);
  if (!r.ok) { console.log("search failed", q, r.status); continue; }
  // AI-generated clips are out: the owner rejects AI-render looks, and they are not real footage
  for (const h of (await r.json()).hits.filter((h) => !/ai generated|animation|3d|green screen/i.test(h.tags)).slice(0, +per)) {
    const v = h.videos.medium?.url ? h.videos.medium : h.videos.small;
    const file = `px-${h.id}.mp4`;
    if (!fs.existsSync(path.join(outDir, file))) {
      const d = await fetch(v.url);
      if (!d.ok) continue;
      fs.writeFileSync(path.join(outDir, file), Buffer.from(await d.arrayBuffer()));
    }
    list.push({ query: q, file, id: h.id, page: h.pageURL, user: h.user, tags: h.tags, duration: h.duration, w: v.width, h: v.height, licence: "Pixabay Content License" });
    console.log(q, "->", file, h.tags);
  }
}
fs.writeFileSync(path.join(outDir, "footage.json"), JSON.stringify(list, null, 1));
