// audit-type Stage 5 — font-gate probe, run in the real render engine.
//
// Proves, empirically in Chrome (via bundle + renderStill + onBrowserLog,
// the pattern data/audit/2/measure-current.mjs established):
//   A. raw measureText() with validateFontIsLoaded: true on an UNLOADED
//      font family THROWS (gate leg 1).
//   B. my gated wrapper in layout/measure.js THROWS on the same call —
//      proves the wrapper forces the flag even when the caller omits it.
//   C. raw measureText() WITHOUT the flag returns silently (fallback
//      metrics) — the failure mode the gate exists to prevent.
//   D. cache-key trap: an un-gated call caches fallback width under a key
//      that omits validateFontIsLoaded, so a LATER gated call with the same
//      options hits the cache and does NOT throw (index.mjs:63-66) — the
//      §5.1 "cached wrong for the whole render" mechanism, live.
//   E. gated wrapper with a genuinely LOADED font (vendored Inter-400,
//      embedded via FontFace + data URL) does NOT throw — the gate is a
//      detector, not a blanket blocker.
//   F. gated fitTextOnNLines() on an unloaded font THROWS (Rule 5.1 covers
//      every measurement function).
//   G. fontStyleFor() + HEADLINE_FONT produce the one shared object with
//      exactly {fontFamily, fontWeight, letterSpacing} — Rule 5.2.
//
// Evidence: every result console.log'd from the page and captured by the
// renderer's onBrowserLog callback into a text file — no PNG reading.
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, openBrowser } from "@remotion/renderer";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(here, "..", "..", "..", "src", "skills", "remotion-render");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = join(here, "out");

const inter400 = readFileSync(join(RENDER_DIR, "public", "fonts", "Inter-400.woff2")).toString("base64");
const INTER_CSS = `@font-face{font-family:"ProbeInter";font-style:normal;font-weight:400;font-display:swap;src:url("data:font/woff2;base64,${inter400}") format("woff2");}`;

// UNLOADED font + a text with >4 unique characters (the source's throw
// guard index.mjs:92). GATED_OPTS and UNGATED_OPTS differ ONLY in the flag
// so they hit the same cache key in case D.
const UNLOADED = "ProbeFontNotLoaded";
const TEXT = "measureText gate probe 0123";
const COMMON = JSON.stringify({ text: TEXT, fontFamily: UNLOADED, fontSize: 32, fontWeight: "400" });

const entry = [
  'import React, { useEffect } from "react";',
  'import { AbsoluteFill, Composition, delayRender, continueRender, registerRoot } from "remotion";',
  'import { measureText as rawMeasureText, fitTextOnNLines as rawFitTextOnNLines } from "@remotion/layout-utils";',
  'import { measureText as gatedMeasureText, fitTextOnNLines as gatedFitTextOnNLines, fontStyleFor, HEADLINE_FONT } from "../../../src/skills/remotion-render/layout/measure.js";',
  "",
  'const INTER_CSS = ' + JSON.stringify(INTER_CSS) + ";",
  'const UNLOADED = ' + JSON.stringify(UNLOADED) + ";",
  'const TEXT = ' + JSON.stringify(TEXT) + ";",
  "const first = (e) => String(e && e.message ? e.message : e).split(String.fromCharCode(10))[0].slice(0, 140);",
  "",
  "function Probe() {",
  "  useEffect(() => {",
  '    const handle = delayRender("font-gate-probe");',
  "    (async () => {",
  "      try {",
  '        console.log("=====PROBE-BEGIN=====");',
  "",
  "        // A. raw + gate on UNLOADED font -> expect THROW",
  "        try {",
  '          rawMeasureText({ text: TEXT, fontFamily: UNLOADED, fontSize: 32, fontWeight: "400", validateFontIsLoaded: true });',
  '          console.log("A raw+gate unloaded: NO THROW (gate FAILED)");',
  "        } catch (e) {",
  '          console.log("A raw+gate unloaded: THREW -> " + first(e));',
  "        }",
  "",
  "        // B. my wrapper (forces the gate) on UNLOADED font -> expect THROW",
  "        try {",
  '          gatedMeasureText({ text: TEXT, fontFamily: UNLOADED, fontSize: 32, fontWeight: "400" });',
  '          console.log("B wrapper unloaded: NO THROW (gate FAILED)");',
  "        } catch (e) {",
  '          console.log("B wrapper unloaded: THREW -> " + first(e));',
  "        }",
  "",
  "        // C. raw WITHOUT the flag -> silent fallback (no throw)",
  "        try {",
  '          const w = rawMeasureText({ text: TEXT, fontFamily: UNLOADED, fontSize: 32, fontWeight: "400" });',
  '          console.log("C raw no-gate unloaded: returned width " + w.width.toFixed(1) + " (no throw)");',
  "        } catch (e) {",
  '          console.log("C raw no-gate unloaded: THREW -> " + first(e));',
  "        }",
  "",
  "        // D. cache-key trap: gated call, SAME options as C -> cache hit, no throw",
  "        try {",
  '          const w = rawMeasureText({ text: TEXT, fontFamily: UNLOADED, fontSize: 32, fontWeight: "400", validateFontIsLoaded: true });',
  '          console.log("D gated-after-cached: returned cached width " + w.width.toFixed(1) + " (NO THROW — cache key omits the flag)");',
  "        } catch (e) {",
  '          console.log("D gated-after-cached: THREW -> " + first(e));',
  "        }",
  "",
  "        // E. gated wrapper with a LOADED font -> no throw, real metrics",
  "        try {",
  '          const style = document.createElement("style");',
  "          style.textContent = INTER_CSS;",
  "          document.head.appendChild(style);",
  '          await document.fonts.load(\'400 32px "ProbeInter"\');',
  "          await document.fonts.ready;",
  '          const loaded = gatedMeasureText({ text: TEXT, fontFamily: "ProbeInter", fontSize: 32, fontWeight: "400" });',
  '          console.log("E wrapper loaded: width " + loaded.width.toFixed(1) + " (no throw — font loaded)");',
  "        } catch (e) {",
  '          console.log("E wrapper loaded: THREW -> " + first(e));',
  "        }",
  "",
  "        // F. gated fitTextOnNLines on UNLOADED font -> expect THROW",
  "        try {",
  '          gatedFitTextOnNLines({ text: TEXT, maxLines: 2, maxBoxWidth: 780, fontFamily: UNLOADED, fontWeight: "400", maxFontSize: 84 });',
  '          console.log("F wrapper fitTextOnNLines unloaded: NO THROW (gate FAILED)");',
  "        } catch (e) {",
  '          console.log("F wrapper fitTextOnNLines unloaded: THREW -> " + first(e));',
  "        }",
  "",
  "        // G. shared fontStyle object — Rule 5.2",
  '        const fs = fontStyleFor("ProbeInter", HEADLINE_FONT);',
  '        console.log("G fontStyleFor keys: " + JSON.stringify(Object.keys(fs).sort()));',
  '        console.log("G HEADLINE_FONT: " + JSON.stringify(HEADLINE_FONT));',
  "",
  '        console.log("=====PROBE-END=====");',
  "        continueRender(handle);",
  "      } catch (e) {",
  '        console.log("PROBE ERROR: " + first(e));',
  "        continueRender(handle);",
  "      }",
  "    })();",
  "  }, []);",
  "  return (",
  '    <AbsoluteFill style={{ backgroundColor: "#000", color: "#fff", padding: 48, fontFamily: "monospace", fontSize: 14, whiteSpace: "pre", overflow: "hidden" }}>',
  "      <div>font-gate probe - see browser console log for results</div>",
  "    </AbsoluteFill>",
  "  );",
  "}",
  "",
  'const Root = () => <Composition id="FontGateProbe" component={Probe} durationInFrames={1} fps={30} width={1080} height={1920} />;',
  "registerRoot(Root);",
  "",
].join("\n");

const ENTRY = join(here, "_font-gate-entry.jsx");
writeFileSync(ENTRY, entry, "utf8");
console.log("PROBE entry bytes:", entry.length);
console.log("PROBE common options (cache-key pair):", COMMON);

mkdirSync(OUT, { recursive: true });
const serveUrl = await bundle({ entryPoint: ENTRY, onProgress: () => {} });
console.log("PROBE bundled:", serveUrl);

// Stage-2 finding: this box's DevTools endpoint is flaky; rotate flags and
// watchdog each attempt.
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
      browserExecutable: CHROME,
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
  id: "FontGateProbe",
  puppeteerInstance: browserInstance,
  timeoutInMilliseconds: 120000,
});
await renderStill({
  composition,
  serveUrl,
  output: join(OUT, "font-gate.png"),
  frame: 0,
  puppeteerInstance: browserInstance,
  timeoutInMilliseconds: 120000,
  onBrowserLog: (l) => browserLogs.push(l),
});
await browserInstance.close({ silent: true });

const logFile = join(OUT, "font-gate.log");
writeFileSync(logFile, browserLogs.map((l) => `[${l.type}] ${l.text}`).join("\n"), "utf8");
console.log("PROBE browser log lines:", browserLogs.length, "->", logFile);
