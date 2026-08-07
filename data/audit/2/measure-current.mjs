// audit-type Stage 2 — measurement probe, CURRENT repo state (post AST-01/001 re-vendor).
//
// Questions answered empirically in the real render engine (Remotion headless-shell):
//   A. Loader <-> disk consistency: which loader families have no .woff2 (broken rules
//      in production = silent 404) and which disk families the loader omits.
//   B. document.fonts.check per mg family — does the family ACTUALLY load in the browser?
//   C. Canvas measureText widths at 400/700/800 for the 5 mg-present families + the
//      Fira Sans fallback + real disk Fira Sans ("FiraSansDisk").
//   D. tabular-nums A/B via real DOM layout (getBoundingClientRect): does font-variant-numeric
//      change digit widths? (GSUB-independent ground truth.)
//   E. Headline measurement exactly like motion-graphics.jsx (fontWeight 800): magnitude of
//      the silent fallback error for the 4 Fira Sans channels vs real disk Fira Sans.
//
// Font fidelity: production-faithful @font-face descriptors (family, weight 400/700 single
// value, font-display swap) pointing at base64 data URLs of the CURRENT vendored statics.
// URL form does not affect matching/shaping. The loader's stale rules are modeled exactly:
// Fira Sans / Comic Neue / Noto Serif are NOT registered (matches committed fonts-loader.js).
//
// Evidence: every measurement is console.log'd from the page and captured by the renderer's
// onBrowserLog callback into a text file — no reliance on reading the PNG.
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, openBrowser } from "@remotion/renderer";
import { createHash } from "crypto";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FONT_FAMILIES } from "../../../src/skills/remotion-render/fonts-loader.js";

const here = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(here, "..", "..", "..", "src", "skills", "remotion-render");
const FONT_DIR = join(RENDER_DIR, "public", "fonts");
const OUT = join(here, "out");

const DISK_FAMILY_MAP = {
  BebasNeue: "Bebas Neue", ComicNeue: "Comic Neue", CormorantGaramond: "Cormorant Garamond",
  DMSans: "DM Sans", FiraSans: "Fira Sans", Inter: "Inter", JetBrainsMono: "JetBrains Mono",
  NotoSerif: "Noto Serif", Nunito: "Nunito", Oswald: "Oswald", PlayfairDisplay: "Playfair Display",
  RobotoCondensed: "Roboto Condensed", SpaceGrotesk: "Space Grotesk",
};

const toDataUrl = (p) => "data:font/woff2;base64," + readFileSync(p).toString("base64");

// ── A. loader <-> disk consistency ─────────────────────────────────────────
const diskBase = Object.keys(DISK_FAMILY_MAP);
const diskFamilies = new Set(Object.values(DISK_FAMILY_MAP));
const loaderMissingOnDisk = FONT_FAMILIES.filter((f) => !diskFamilies.has(f));
const diskNotInLoader = Object.values(DISK_FAMILY_MAP).filter((f) => !FONT_FAMILIES.includes(f));
console.log("PROBE loader family count (committed fonts-loader.js):", FONT_FAMILIES.length);
console.log("PROBE disk family count:", diskFamilies.size);
console.log("PROBE loader refs with NO file on disk (404 in production):", loaderMissingOnDisk.join(", "));
console.log("PROBE disk families NOT registered by loader:", diskNotInLoader.join(", "));

// ── @font-face rules: exactly the loader's descriptors, only for families with files ──
const cssRules = [];
const embedded = [];
for (const family of FONT_FAMILIES) {
  const fileBase = family.replace(/\s+/g, "");
  for (const weight of [400, 700]) {
    const file = join(FONT_DIR, `${fileBase}-${weight}.woff2`);
    try {
      readFileSync(file);
      cssRules.push(
        `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url("${toDataUrl(file)}") format("woff2");}`
      );
      embedded.push(`${family}@${weight}`);
    } catch {
      // single-face families (Bebas Neue) have no -700 file
    }
  }
}
const FONT_CSS = cssRules.join("\n");
console.log("PROBE embedded @font-face rules:", cssRules.length, "->", embedded.join(", "));

const fira400 = toDataUrl(join(FONT_DIR, "FiraSans-400.woff2"));
const fira700 = toDataUrl(join(FONT_DIR, "FiraSans-700.woff2"));

const MG_PRESENT = ["Inter", "DM Sans", "Nunito", "JetBrains Mono", "Roboto Condensed"];
const TNUMSET = ["Inter", "DM Sans", "Nunito", "JetBrains Mono", "Roboto Condensed", "Fira Sans", "FiraSansDisk"];
const ALLFAMILIES = [...MG_PRESENT, "Fira Sans", "Arial", "FiraSansDisk"];
const HEADLINE = "THE QUICK BROWN FOX JUMPS OVER 0123456789";

const entry = [
  'import React, { useEffect } from "react";',
  'import { AbsoluteFill, Composition, delayRender, continueRender, registerRoot } from "remotion";',
  "",
  "const FONT_CSS = " + JSON.stringify(FONT_CSS) + ";",
  'const FS = { w400: "' + fira400 + '", w700: "' + fira700 + '" };',
  "const MG_PRESENT = " + JSON.stringify(MG_PRESENT) + ";",
  "const TNUMSET = " + JSON.stringify(TNUMSET) + ";",
  "const ALLFAMILIES = " + JSON.stringify(ALLFAMILIES) + ";",
  'const HEADLINE = "THE QUICK BROWN FOX JUMPS OVER 0123456789";',
  "",
  "function domW(family, weight, tnum) {",
  '  const s = document.createElement("span");',
  '  s.style.fontFamily = \'"\' + family + \'"\';',
  "  s.style.fontWeight = weight;",
  '  s.style.fontSize = "48px";',
  '  s.style.fontVariantNumeric = tnum ? "tabular-nums" : "normal";',
  '  s.style.position = "absolute";',
  '  s.style.whiteSpace = "pre";',
  '  s.style.lineHeight = "48px";',
  '  s.textContent = "1234567890";',
  "  document.body.appendChild(s);",
  "  const w = s.getBoundingClientRect().width;",
  "  s.remove();",
  "  return w;",
  "}",
  "",
  "function Probe() {",
  "  useEffect(() => {",
  '    const handle = delayRender("measure-current");',
  "    (async () => {",
  "      try {",
  '        const style = document.createElement("style");',
  "        style.textContent = FONT_CSS;",
  "        document.head.appendChild(style);",
  '        const ff400 = new FontFace("FiraSansDisk", "url(" + FS.w400 + ")");',
  '        const ff700 = new FontFace("FiraSansDisk", "url(" + FS.w700 + ")", { weight: "700" });',
  "        const r = await Promise.allSettled([ff400.load(), ff700.load()]);",
  '        r.forEach((x) => { if (x.status === "fulfilled") { document.fonts.add(x.value); } else { console.log("PROBE FiraSansDisk load FAILED: " + x.reason); } });',
  "        await Promise.allSettled([...ALLFAMILIES].flatMap((f) => [400, 700, 800].map((w) => document.fonts.load(w + ' 48px \"' + f + '\"'))));",
  "        await document.fonts.ready;",
  "        console.log(\"=====PROBE-BEGIN=====\");",
  '        console.log("UA: " + navigator.userAgent);',
  "        console.log(\"--- A. document.fonts.check (1=face loaded, 0=not) ---\");",
  "        ALLFAMILIES.forEach((f) => {",
  "          const row = [400, 700, 800].map((w) => (document.fonts.check(w + ' 48px \"' + f + '\"') ? \"1\" : \"0\"));",
  "          console.log((f + \".padEnd(20)\") && f.padEnd(20) + \" check 400/700/800: \" + row.join(\" \"));",
  "        });",
  "        console.log(\"--- B. canvas measureText '0123456789' 48px ---\");",
  '        const canvas = document.createElement("canvas");',
  '        const ctx = canvas.getContext("2d");',
  "        ALLFAMILIES.forEach((f) => {",
  "          const row = [400, 700, 800].map((w) => {",
  "            ctx.font = w + ' 48px \"' + f + '\"';",
  "            return w + \":\" + ctx.measureText(\"0123456789\").width.toFixed(1);",
  "          });",
  "          console.log(f.padEnd(20) + \" \" + row.join(\"  \"));",
  "        });",
  "        console.log(\"--- C. tabular-nums A/B, DOM width '1234567890' 48px ---\");",
  "        TNUMSET.forEach((f) => {",
  "          const n = domW(f, 400, false);",
  "          const t = domW(f, 400, true);",
  "          console.log(f.padEnd(20) + \" normal=\" + n.toFixed(1) + \" tabular=\" + t.toFixed(1) + \" delta=\" + (t - n).toFixed(1));",
  "        });",
  "        console.log(\"--- D. headline @800 (mg measureText use), DOM width ---\");",
  "        console.log(\"Fira Sans (prod fallback)\".padEnd(26) + \" \" + domW(\"Fira Sans\", 800, false).toFixed(1));",
  "        console.log(\"FiraSansDisk (real vendored)\".padEnd(26) + \" \" + domW(\"FiraSansDisk\", 800, false).toFixed(1));",
  "        console.log(\"Arial\".padEnd(26) + \" \" + domW(\"Arial\", 800, false).toFixed(1));",
  '        ["Inter", "DM Sans", "Nunito", "JetBrains Mono", "Roboto Condensed"].forEach((f) => {',
  "          console.log((f + \" (loader-registered)\").padEnd(26) + \" \" + domW(f, 800, false).toFixed(1));",
  "        });",
  "        console.log(\"=====PROBE-END=====\");",
  "        continueRender(handle);",
  "      } catch (e) {",
  "        console.log(\"PROBE ERROR: \" + String(e && e.message ? e.message : e));",
  "        continueRender(handle);",
  "      }",
  "    })();",
  "  }, []);",
  "  return (",
  '    <AbsoluteFill style={{ backgroundColor: "#000", color: "#fff", padding: 48, fontFamily: "monospace", fontSize: 14, whiteSpace: "pre", overflow: "hidden" }}>',
  '      <div>measure-current probe - see browser console log for results</div>',
  "    </AbsoluteFill>",
  "  );",
  "}",
  "",
  "const Root = () => (",
  '  <Composition id="MeasureCurrent" component={Probe} durationInFrames={1} fps={30} width={1080} height={1920} />',
  ");",
  "registerRoot(Root);",
  "",
].join("\n");

const ENTRY = join(here, "_probe-current-entry.jsx");
writeFileSync(ENTRY, entry, "utf8");
console.log("PROBE entry bytes:", entry.length);

mkdirSync(OUT, { recursive: true });

const serveUrl = await bundle({ entryPoint: ENTRY, onProgress: () => {} });
console.log("PROBE bundled:", serveUrl);

// Launch configs tried in rotation. This box's DevTools endpoint is flaky for
// BOTH chrome-for-testing 151 and headless-shell (see data/audit/2 launch-*.txt
// and node_modules/.remotion/.../debug.log "no connection"). 16:55 runs succeeded,
// 18:33+ runs failed with identical inputs — so we rotate flags and watchdog each
// attempt instead of assuming any single config is reliable.
const LAUNCH_CONFIGS = [
  { gl: "swangle", switches: ["--enable-unsafe-swiftshader"] },
  {},
  { gl: "swangle" },
];

async function openBrowserWithRetry() {
  let lastErr;
  for (let i = 0; i < 6; i++) {
    const opts = LAUNCH_CONFIGS[i % LAUNCH_CONFIGS.length];
    console.log("PROBE openBrowser attempt", i + 1, "config", JSON.stringify(opts));
    const launchPromise = openBrowser({
      chromiumOptions: opts,
      dumpio: true,
    });
    const withWatchdog = Promise.race([
      launchPromise,
      new Promise((_, rej) => setTimeout(() => rej(new Error("launch watchdog 60s")), 60000)),
    ]);
    try {
      const b = await withWatchdog;
      console.log("PROBE openBrowser attempt", i + 1, "SUCCESS");
      return b;
    } catch (err) {
      lastErr = err;
      console.log("PROBE openBrowser attempt", i + 1, "failed:", err.message);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  throw lastErr;
}

const browserInstance = await openBrowserWithRetry();

const browserLogs = [];
const composition = await selectComposition({
  serveUrl,
  id: "MeasureCurrent",
  puppeteerInstance: browserInstance,
  timeoutInMilliseconds: 120000,
});
const outPath = join(OUT, "measure-current.png");
await renderStill({
  composition,
  serveUrl,
  output: outPath,
  frame: 0,
  puppeteerInstance: browserInstance,
  timeoutInMilliseconds: 120000,
  onBrowserLog: (l) => browserLogs.push(l),
});
await browserInstance.close({ silent: true });

const logFile = join(OUT, "measure-current.log");
writeFileSync(logFile, browserLogs.map((l) => `[${l.type}] ${l.text}`).join("\n"), "utf8");
console.log("PROBE browser log lines:", browserLogs.length, "->", logFile);

const h = createHash("sha256").update(readFileSync(outPath)).digest("hex");
console.log("PROBE frame sha256:", h);
