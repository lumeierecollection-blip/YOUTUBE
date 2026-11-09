// Annotated capture of a real public page: headless Chrome loads it, finds the table row for a flag,
// screenshots a crop of the real pixels, and reports where the flag cell sits so the annotation lands on it.
import { createRequire } from "node:module";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REMOTION = join(fileURLToPath(new URL("../../..", import.meta.url)), "src/skills/remotion-render");

export async function captureRows({ url, rows, viewportWidth = 1000 }) {
  const puppeteer = createRequire(join(REMOTION, "package.json"))("puppeteer-core");
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || process.env.REMOTION_CHROME_PATH, headless: "new", args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: viewportWidth, height: 1400, deviceScaleFactor: 1.5 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const title = await page.title();
    const out = {};
    for (const [name, { match, context = true }] of Object.entries(rows)) {
      const found = await page.evaluate((m) => {
        const row = [...document.querySelectorAll("tr")].find((r) => r.cells[0] && r.cells[0].textContent.trim().startsWith(m));
        if (!row) return null;
        // Crop at the column boundary: flag + description only, so nothing is cut mid-sentence and the text stays large.
        const third = row.cells[2] ? row.cells[2].getBoundingClientRect().x + scrollX : null;
        const t = row.closest("table").getBoundingClientRect(), r = row.getBoundingClientRect(), c = row.cells[0].getBoundingClientRect();
        return { table: { x: t.x + scrollX, w: third ? third - (t.x + scrollX) : t.width }, row: { y: r.y + scrollY, h: r.height }, prevH: row.previousElementSibling ? row.previousElementSibling.getBoundingClientRect().height : 0, nextH: row.nextElementSibling ? row.nextElementSibling.getBoundingClientRect().height : 0, cell: { x: c.x + scrollX, y: c.y + scrollY, w: c.width, h: c.height }, cellText: row.cells[0].textContent.trim(), rowText: row.textContent.replace(/\s+/g, " ").trim() };
      }, match);
      if (!found) throw new Error(`no table row starting "${match}" on ${url}`);
      // The row plus the whole row above and below it: real context, with clean row edges. `context` limits neighbours.
      const pv = context ? found.prevH : 0, nx = context ? found.nextH : 0;
      const clip = { x: found.table.x, y: found.row.y - pv, width: found.table.w, height: found.row.h + pv + nx };
      const buf = await page.screenshot({ type: "jpeg", quality: 88, clip });
      mkdirSync(join(REMOTION, "public/ai-tested"), { recursive: true });
      writeFileSync(join(REMOTION, `public/ai-tested/${name}.jpg`), buf);
      out[name] = { file: `ai-tested/${name}.jpg`, w: Math.round(clip.width), h: Math.round(clip.height), hl: { x: found.cell.x - clip.x, y: found.cell.y - clip.y, w: found.cell.w, h: found.cell.h }, cellText: found.cellText, rowText: found.rowText };
    }
    return { title, captures: out };
  } finally { await browser.close(); }
}
