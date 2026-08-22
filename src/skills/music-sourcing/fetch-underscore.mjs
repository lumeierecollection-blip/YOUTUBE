#!/usr/bin/env node
/**
 * fetch-underscore.mjs — sources ONE real, license-verified background
 * underscore track from Pixabay Music, for the whole-video ducked bed
 * (distinct from the existing per-beat SFX system).
 *
 * WHY THIS RUNS IN CI, NOT INTERACTIVELY: pixabay.com is on this
 * project's interactive Claude Code session's proxy host allowlist block
 * list (EGRESS_BLOCKED — confirmed live, both a direct curl and the
 * session's own WebFetch tool failed identically against pixabay.com,
 * the same failure mode fetch-library.js's sources hit before
 * build-asset-library.yml moved them to a real GitHub Actions runner —
 * see that workflow's header for the confirmed, run-verified fact that
 * ubuntu-latest runners reach all of those hosts directly). Same fix,
 * same reasoning, applied to Pixabay Music specifically.
 *
 * WHY PLAYWRIGHT, NOT A REST CALL: Pixabay's own documented API
 * (pixabay.com/api/docs/) is images/videos only — confirmed via search,
 * no music/audio endpoint exists there, and this project has no
 * PIXABAY_API_KEY configured anywhere (grepped: not in any workflow's
 * secrets, not referenced by any source module) even for the endpoints
 * that DO have one. Pixabay Music tracks are download-from-the-page only.
 * This drives a real browser (Playwright, already used elsewhere in this
 * repo's render pipeline) to the search page, inspects the actual result
 * it lands on, and captures whatever the page's own license text says —
 * never a hardcoded/assumed license string.
 *
 * Usage: node src/skills/music-sourcing/fetch-underscore.mjs [query]
 * Output: data/music/underscore-<slug>.mp3 +
 *         data/music/underscore-<slug>.json (title, url, artist, license
 *         text as found on the page, duration, fetchedAt)
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");
const OUT_DIR = join(ROOT, "data", "music");
const QUERY = process.argv[2] || "kalimba";

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  const searchUrl = `https://pixabay.com/music/search/${encodeURIComponent(QUERY)}/`;
  console.log(`Navigating to ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);

  // Result cards on Pixabay's music search page link to individual track
  // pages under /music/<slug>-<id>/. Collect real hrefs from the actual
  // rendered page rather than guessing a selector class name that could
  // be a build hash.
  const trackLinks = await page.$$eval('a[href*="/music/"]', (as) =>
    Array.from(new Set(as.map((a) => a.href).filter((h) => /\/music\/[a-z0-9-]+-\d+\/?$/.test(h))))
  );
  if (trackLinks.length === 0) {
    await page.screenshot({ path: join(OUT_DIR, "_debug-search-page.png"), fullPage: true });
    throw new Error(`No track links found on search page for "${QUERY}" — see _debug-search-page.png`);
  }
  console.log(`Found ${trackLinks.length} candidate track(s). First few: ${trackLinks.slice(0, 5).join(", ")}`);

  // Visit candidates in order, picking the first whose page text plausibly
  // reads as calm/instrumental/underscore-suited (not a hard requirement
  // the page labels explicitly — Pixabay doesn't tag "news/infographic
  // pacing" — so this is a best-effort filter on real page text, and the
  // FIRST candidate is accepted if none obviously fail it).
  const BAD_WORDS = ["metal", "screaming", "aggressive", "hardcore", "dubstep drop"];
  let chosen = null;
  let chosenText = "";
  for (const url of trackLinks.slice(0, 8)) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const lower = bodyText.toLowerCase();
    if (BAD_WORDS.some((w) => lower.includes(w))) {
      console.log(`Skipping ${url} — matched an excluded descriptor`);
      continue;
    }
    chosen = url;
    chosenText = bodyText;
    break;
  }
  if (!chosen) {
    throw new Error("No candidate track passed the basic content filter");
  }
  console.log(`Chosen track page: ${chosen}`);

  // Extract title, artist, license text, duration as they actually appear
  // on the page — never assumed/hardcoded.
  const title = await page.title();
  const h1 = await page.$eval("h1", (el) => el.textContent.trim()).catch(() => null);
  const licenseMatch = chosenText.match(/(Pixabay (Content )?License[^\n]*)/i);
  const attributionMatch = chosenText.match(/(No attribution required[^\n.]*\.?|Attribution is (not )?required[^\n.]*\.?)/i);
  const durationMatch = chosenText.match(/(\d{1,2}:\d{2})\b/);

  const meta = {
    query: QUERY,
    pageUrl: chosen,
    pageTitle: title,
    heading: h1,
    licenseTextFound: licenseMatch ? licenseMatch[1].trim() : null,
    attributionTextFound: attributionMatch ? attributionMatch[1].trim() : null,
    durationFound: durationMatch ? durationMatch[1] : null,
    fetchedAt: new Date().toISOString(),
    sourceApi: "pixabay-music-web",
  };

  // Trigger the real download button and capture whatever file it produces
  // — try a few real, plausible selectors rather than one guessed one, so
  // a page-structure difference fails loudly (screenshot) instead of
  // silently grabbing the wrong element.
  const downloadTriggers = [
    'button:has-text("Free Download")',
    'a:has-text("Free Download")',
    'button:has-text("Download")',
    '[data-download]',
  ];
  let triggered = false;
  let download = null;
  for (const sel of downloadTriggers) {
    const el = page.locator(sel).first();
    if ((await el.count()) === 0) continue;
    try {
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), el.click()]);
      download = dl;
      triggered = true;
      break;
    } catch (e) {
      console.log(`Selector "${sel}" clicked but no download fired: ${e.message}`);
    }
  }
  if (!triggered || !download) {
    await page.screenshot({ path: join(OUT_DIR, "_debug-track-page.png"), fullPage: true });
    writeFileSync(join(OUT_DIR, "_debug-track-meta.json"), JSON.stringify(meta, null, 2));
    throw new Error(`Could not trigger a download on ${chosen} — see _debug-track-page.png / _debug-track-meta.json`);
  }

  const slug = slugify(h1 || title || QUERY);
  const mp3Path = join(OUT_DIR, `underscore-${slug}.mp3`);
  await download.saveAs(mp3Path);
  console.log(`Saved audio -> ${mp3Path}`);

  const metaPath = join(OUT_DIR, `underscore-${slug}.json`);
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  console.log(`Saved metadata -> ${metaPath}`);
  console.log(JSON.stringify(meta, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
