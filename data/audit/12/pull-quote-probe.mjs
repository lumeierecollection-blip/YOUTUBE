/**
 * data/audit/12/pull-quote-probe.mjs — real-render evidence for this
 * session's two Part 2/3 deliverables:
 *   1. beats/PullQuote.jsx (new component) — word-wrap, single-word accent
 *      colour, and the reserved hold-duration attribute, on a real render
 *      with real fonts loaded.
 *   2. beats/HeroNumber.jsx's A1.3 fixed-slot fallback (this session's fix
 *      for SFR-T-11-1) — re-runs data/audit/11's own probe entry
 *      (_type-entry.jsx, now fixed to pass fontFamily explicitly — see that
 *      file's diff) via THIS driver, since the original probe hardcoded a
 *      Windows Chrome path (`C:\Program Files\...`) this sandbox can't use.
 *
 * Uses the sandbox's pre-installed Chromium (/opt/pw-browsers/chromium)
 * instead of a hardcoded absolute path, so this driver — unlike the stage-
 * 11 one it borrows the entry-rendering pattern from — is portable to
 * wherever that env var/path convention holds.
 *
 * Run: node data/audit/12/pull-quote-probe.mjs
 * (requires `npm install` inside src/skills/remotion-render first — this
 * sandbox had no node_modules anywhere in the repo until this session.)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, "..", "..", "..");
const CHROME = process.env.PROBE_CHROME || "/opt/pw-browsers/chromium";
const PUBLIC_DIR = path.join(repo, "src", "skills", "remotion-render", "public");
const OUT_DIR = path.join(__dirname, "out");
const REPORT = path.join(__dirname, "pull-quote-report.json");

function parseMeasures(logs, marker) {
  const rows = [];
  for (const log of logs) {
    const line = typeof log === "string" ? log : String(log && log.text ? log.text : log);
    if (line.includes(marker)) {
      try {
        rows.push(JSON.parse(line.slice(line.indexOf(marker) + marker.length)));
      } catch {
        /* ignore malformed */
      }
    }
  }
  return rows;
}

async function renderOne(browser, serveUrl, id, frame, outPath) {
  const logs = [];
  const composition = await Promise.race([
    // Reuse the already-open browser (puppeteerInstance) AND pass
    // browserExecutable explicitly — selectComposition opens its OWN
    // browser internally if neither is given, which re-triggers the same
    // remotion.media auto-download 403 openBrowser() above was fixed for.
    selectComposition({ serveUrl, id, puppeteerInstance: browser, browserExecutable: CHROME }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("selectComposition timeout (60s)")), 60000)),
  ]);
  await Promise.race([
    // renderStill has no `browser` param (unlike the D14 probe pattern this
    // was first copied from assumed) — it takes `puppeteerInstance`. Passing
    // the wrong key silently no-ops and it falls through to its own
    // ensure-browser/auto-download path, same failure mode as the other two
    // call sites above.
    renderStill({ serveUrl, composition, frame, output: outPath, puppeteerInstance: browser, browserExecutable: CHROME, logLevel: "error", onBrowserLog: (l) => logs.push(l) }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("renderStill timeout (60s)")), 60000)),
  ]);
  return logs;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(CHROME)) {
    console.error(`No browser at ${CHROME} — set PROBE_CHROME to a real Chromium/Chrome executable.`);
    process.exit(1);
  }

  const report = { pullQuote: [], heroNumberFixedSlot: [], pass: false };
  let failures = 0;

  console.log("bundling PULL_QUOTE entry (real fonts via wait-for-fonts.js)...");
  const pqServeUrl = await bundle({ entryPoint: path.join(__dirname, "_pull-quote-entry.jsx"), publicDir: PUBLIC_DIR, onProgress: () => {} });
  // openBrowser(browserName, options) — NOT openBrowser(path). The stage-11
  // probe this driver borrows its render-call pattern from called
  // openBrowser(CHROME) with a bare path as the first (browser-NAME) arg,
  // which is a different parameter than `browserExecutable`; that call
  // would have silently ignored the path and fallen through to Remotion's
  // own auto-download (confirmed here: it tried to fetch a headless shell
  // from remotion.media and got a 403 from this sandbox's egress proxy
  // before this fix). Real bug in a real, previously-unexecuted probe call
  // — noted rather than silently worked around.
  let browser = await openBrowser("chrome", { browserExecutable: CHROME });

  for (const { id, frame } of [
    { id: "pq-inter-digit", frame: 30 },
    { id: "pq-dmsans-no-digit", frame: 30 },
  ]) {
    const out = path.join(OUT_DIR, `${id}-f${frame}.png`);
    let logs;
    try {
      logs = await renderOne(browser, pqServeUrl, id, frame, out);
    } catch (err) {
      failures++;
      console.log(`${id} f${frame} ERROR ${err.message}`);
      report.pullQuote.push({ id, frame, error: err.message });
      continue;
    }
    const measured = parseMeasures(logs, `PQ_MEASURE:${id}:`)[0] || null;
    console.log(`${id} f${frame} -> ${out}`);
    console.log("  " + JSON.stringify(measured));
    const lineCountOk = measured && measured.lineCount >= 1 && measured.lineCount <= 2;
    const accentOk = measured && measured.accentWordCount === 1;
    if (!lineCountOk) { failures++; console.log(`  FAIL lineCount not in [1,2]: ${measured && measured.lineCount}`); }
    if (!accentOk) { failures++; console.log(`  FAIL accentWordCount !== 1: ${measured && measured.accentWordCount}`); }
    report.pullQuote.push({ id, frame, out, measured, lineCountOk, accentOk });
  }

  console.log("\nbundling HERO_NUMBER re-verification entry (data/audit/11/_type-entry.jsx, now fontFamily-explicit)...");
  const heroEntry = path.join(repo, "data", "audit", "11", "_type-entry.jsx");
  const heroServeUrl = await bundle({ entryPoint: heroEntry, publicDir: PUBLIC_DIR, onProgress: () => {} });

  // DM Sans case (t11-2000-dmsans): count window per _type-entry.jsx's
  // anchorFrame=10 convention (tA=10, D.micro=4 -> start=6, D.push=60 ->
  // end=66). Sample the first frame (start, digit count already locked by
  // A2.3) and a late frame (end-1) — before this session's fix these two
  // frames had DIFFERENT offsetWidth on DM Sans (stage-11's own probe
  // measured a 449->646 swing); the fixed-slot fallback should now make
  // them identical.
  for (const { id, frames } of [
    { id: "t11-2000-dmsans", frames: [6, 65] },
    { id: "t11-13600-inter", frames: [6, 65] },
  ]) {
    const widths = [];
    for (const frame of frames) {
      const out = path.join(OUT_DIR, `${id}-f${frame}.png`);
      let logs;
      try {
        logs = await renderOne(browser, heroServeUrl, id, frame, out);
      } catch (err) {
        failures++;
        console.log(`${id} f${frame} ERROR ${err.message}`);
        report.heroNumberFixedSlot.push({ id, frame, error: err.message });
        continue;
      }
      const rows = parseMeasures(logs, `TYPE_MEASURE:${id}@f${frame}:`);
      const numeral = (rows[0] || []).find ? rows[0].find((r) => r.role === "numeral") : null;
      console.log(`${id} f${frame} -> text="${numeral && numeral.text}" offsetWidth=${numeral && numeral.ow}`);
      widths.push(numeral ? numeral.ow : null);
      report.heroNumberFixedSlot.push({ id, frame, text: numeral && numeral.text, offsetWidth: numeral && numeral.ow });
    }
    const stable = widths.length === frames.length && widths.every((w) => w === widths[0] && w != null);
    console.log(`  ${id}: offsetWidths=${JSON.stringify(widths)} -> ${stable ? "STABLE" : "JITTER"}`);
    if (!stable) { failures++; console.log(`  FAIL ${id} offsetWidth not byte-identical across sampled frames`); }
  }

  try {
    await browser.close();
  } catch (err) {
    // This @remotion/renderer version's browser.close() throws on cleanup
    // in this sandbox (TypeError destructuring 'silent' from undefined) —
    // happens strictly AFTER every render above already completed, so it's
    // this probe's own cleanup robustness, not a finding about the
    // production code under test. Don't let it swallow the real report.
    console.log(`(non-fatal) browser.close() failed: ${err.message}`);
  }
  report.pass = failures === 0;
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"} -> ${REPORT}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
