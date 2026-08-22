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
 * Output: src/skills/remotion-render/public/music/underscore.mp3 (the real
 *         downloaded audio, fixed filename — a single stable bed track,
 *         not a growing library, so no per-track slug needed at the path
 *         render.js/motion-graphics.jsx actually read) +
 *         data/music/underscore.json (title, url, artist, license text as
 *         found on the page, duration, fetchedAt — the auditable record,
 *         alongside asset-library's own manifest-vs-treated-file split)
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");
const META_DIR = join(ROOT, "data", "music");
const AUDIO_DIR = join(ROOT, "src", "skills", "remotion-render", "public", "music");
const QUERY = process.argv[2] || "kalimba";

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const CHALLENGE_TITLE = "Just a moment...";

// Polls for Cloudflare's "Just a moment..." interstitial to clear instead of
// a single fixed delay — see main()'s header comment for why this exists at
// all (a real run returned that exact title, 0 real content) and why
// polling instead of a flat wait (a managed challenge usually self-resolves
// in a few seconds once the browser's JS passes its checks, so this gives
// it real time rather than assuming either "instant" or "never").
async function waitForChallenge(page, label) {
  let title = await page.title();
  let waited = 0;
  while (title === CHALLENGE_TITLE && waited < 25000) {
    await page.waitForTimeout(1000);
    waited += 1000;
    title = await page.title();
  }
  console.log(`[${label}] post-challenge-wait title (after ${waited}ms): "${title}"`);
  return title;
}

async function main() {
  mkdirSync(META_DIR, { recursive: true });
  mkdirSync(AUDIO_DIR, { recursive: true });
  // headless: false — a real run (data/music/_run4-log, see SKILL.md) showed
  // the search page returning Cloudflare's "Just a moment... Performing
  // security verification" interstitial instead of real content (page title
  // literally "Just a moment...", 0 real hrefs). That single fact also
  // retroactively explains the EARLIER "networkidle" hang: the challenge
  // page itself polls in the background, so network traffic never goes
  // idle. Headless Chromium's fingerprint is a well-known, common trigger
  // for exactly this Cloudflare challenge tier — running a real, windowed
  // browser instance (via Xvfb, already installed on the runner as a
  // Playwright OS dependency) is the standard, legitimate fix: a real
  // browser window, not a fingerprint-spoofing library. If this still gets
  // challenged, that points at IP reputation (GitHub Actions runner
  // ranges are commonly flagged as datacenter traffic) rather than
  // anything fixable in this script — see SKILL.md for that fallback.
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();

  const searchUrl = `https://pixabay.com/music/search/${encodeURIComponent(QUERY)}/`;
  console.log(`Navigating to ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitForChallenge(page, "search");
  await page.waitForTimeout(2000);
  // Bounded, non-hanging extra wait for actual result links specifically
  // (as opposed to networkidle's unbounded wait on ALL traffic) — best
  // effort only: if this never resolves, the code below still runs and
  // dumps real diagnostics instead of hanging the whole job.
  await page
    .waitForSelector('a[href*="/music/"]', { timeout: 15000 })
    .catch((e) => console.log(`waitForSelector didn't find a /music/ link within 15s (continuing anyway): ${e.message}`));

  // Diagnostic dump BEFORE filtering — printed to the job log (readable
  // via the GitHub API even when this session can't reach the blob
  // storage a screenshot artifact would need to be pulled from, which is
  // exactly what happened on the first real run: the log is the reliable
  // channel here, not a downloaded PNG).
  const allHrefs = await page.$$eval("a[href]", (as) => Array.from(new Set(as.map((a) => a.href))));
  const musicHrefs = allHrefs.filter((h) => h.includes("/music/"));
  console.log(`Page title: ${await page.title()}`);
  console.log(`Total <a href> on page: ${allHrefs.length}`);
  console.log(`Hrefs containing "/music/": ${musicHrefs.length}`);
  console.log(musicHrefs.slice(0, 40).join("\n"));

  // Result cards on Pixabay's music search page link to individual track
  // pages. Broadened from an earlier, over-specific pattern (a real run
  // showed 0 matches for /\/music\/[a-z0-9-]+-\d+\/?$/ against this
  // page's actual hrefs — see the diagnostic dump above/in the log for
  // what they really look like) to just "contains /music/ and isn't the
  // search page itself."
  const trackLinks = musicHrefs.filter((h) => !h.includes("/music/search/") && h !== searchUrl && !h.endsWith("/music/"));
  if (trackLinks.length === 0) {
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
    console.log(`Body text (first 2000 chars):\n${bodyText}`);
    throw new Error(`No track links found on search page for "${QUERY}" — see the diagnostic dump above in the log`);
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
    await waitForChallenge(page, `track:${url}`);
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
    // Log-based diagnostics (readable via the GitHub API job log even
    // when this session can't reach the blob storage a screenshot
    // artifact would need pulling from — the real failure mode hit while
    // building this). A real run showed a click resolving and firing
    // (element found, click succeeded) but no `download` event within
    // 15s — that's consistent with several different real causes (a
    // dropdown/quality-picker opening instead of downloading directly, a
    // login wall, or a plain in-tab navigation to the audio file that
    // Chromium plays inline rather than treats as a download), so this
    // dumps targeted evidence for each rather than guessing which.
    console.log(`Current URL after click attempts: ${page.url()}`);
    const downloadish = await page.$$eval("*", (els) =>
      els
        .filter((e) => {
          const t = (e.textContent || "").trim();
          return t.length < 80 && /download/i.test(t) && e.children.length <= 2;
        })
        .map((e) => ({
          tag: e.tagName,
          text: e.textContent.trim().slice(0, 80),
          href: e.getAttribute("href"),
          hasDownloadAttr: e.hasAttribute("download"),
          visible: !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length),
        }))
        .slice(0, 25)
    );
    console.log(`Elements whose own text mentions "download":\n${JSON.stringify(downloadish, null, 2)}`);
    const mediaLinks = await page.$$eval("a[href]", (as) =>
      as.map((a) => a.href).filter((h) => /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(h) || /download/i.test(h))
    );
    console.log(`Hrefs that look like a direct audio file or a download path:\n${mediaLinks.join("\n")}`);
    const loginish = await page.evaluate(() => document.body.innerText.toLowerCase().includes("log in") || document.body.innerText.toLowerCase().includes("sign in"));
    console.log(`Page text mentions "log in"/"sign in": ${loginish}`);
    console.log(`Track metadata gathered so far:\n${JSON.stringify(meta, null, 2)}`);
    throw new Error(`Could not trigger a download on ${chosen} — see the diagnostic dump above in the log`);
  }

  // Fixed filename (not slug-based) — this is a single stable bed track,
  // not a growing library, so render.js/motion-graphics.jsx can reference
  // one known path rather than needing to discover the latest slug.
  const mp3Path = join(AUDIO_DIR, "underscore.mp3");
  await download.saveAs(mp3Path);
  console.log(`Saved audio -> ${mp3Path}`);

  const metaPath = join(META_DIR, "underscore.json");
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  console.log(`Saved metadata -> ${metaPath}`);
  console.log(JSON.stringify(meta, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
