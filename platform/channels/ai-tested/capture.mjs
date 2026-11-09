// Annotated capture of a real public page: headless Chrome loads it, finds the table row for a flag,
// screenshots a crop of the real pixels, and reports where the flag cell sits so the annotation lands on it.
import { createRequire } from "node:module";
import { join } from "node:path";
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
    for (const [name, { match, before = 90, after = 70 }] of Object.entries(rows)) {
      const found = await page.evaluate((m) => {
        const row = [...document.querySelectorAll("tr")].find((r) => r.cells[0] && r.cells[0].textContent.trim().startsWith(m));
        if (!row) return null;
        const t = row.closest("table").getBoundingClientRect(), r = row.getBoundingClientRect(), c = row.cells[0].getBoundingClientRect();
        return { table: { x: t.x + scrollX, w: t.width }, row: { y: r.y + scrollY, h: r.height }, cell: { x: c.x + scrollX, y: c.y + scrollY, w: c.width, h: c.height }, cellText: row.cells[0].textContent.trim(), rowText: row.textContent.replace(/\s+/g, " ").trim() };
      }, match);
      if (!found) throw new Error(`no table row starting "${match}" on ${url}`);
      const clip = { x: found.table.x, y: Math.max(0, found.row.y - before), width: found.table.w, height: found.row.h + before + after };
      const buf = await page.screenshot({ type: "jpeg", quality: 88, clip });
      out[name] = { src: `data:image/jpeg;base64,${buf.toString("base64")}`, w: Math.round(clip.width), h: Math.round(clip.height), hl: { x: found.cell.x - clip.x, y: found.cell.y - clip.y, w: found.cell.w, h: found.cell.h }, cellText: found.cellText, rowText: found.rowText };
    }
    return { title, captures: out };
  } finally { await browser.close(); }
}
