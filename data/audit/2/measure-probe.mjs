// audit-type Stage 2 — measurement probe builder + runner.
// Empirically answers, in the real render engine (headless Chrome via @remotion/renderer):
//   (1) Do the vendored variable fonts honor the CSS font-weight axis at all weights
//       (100..900) when registered with SINGLE-VALUE @font-face descriptors (400, 700)
//       pointing at the same file? -> canvas measureText widths per weight.
//   (2) Families whose file default instance != 400 (Nunito 200, Rubik 300, ...):
//       does text at weight 400 render at wght 400 or at the file default?
//   (3) For the 4 mg channels whose font (Fira Sans) is missing, the production
//       fallback is "Helvetica Neue", sans-serif -> on Windows Chrome that is Arial.
//       Quantify the measurement error vs the REAL Fira Sans (upstream build loaded
//       in the probe as "FiraSansUpstream").
// Font fidelity: the probe registers @font-face rules with EXACTLY the descriptors the
// production fonts-loader emits (family, font-weight 400/700 single values, font-display
// swap), but points them at base64 data URLs of the vendored woff2 files instead of
// staticFile() URLs (which 404 under this bundler's publicDir mapping). The URL form
// does not affect font matching or text shaping, so measurement is production-faithful.
// Browser: Remotion default chromeMode "headless-shell" (dedicated automation build,
// software rendering) — the installed Chrome 151 is unreliable here (see launch-*.txt).
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, openBrowser } from "@remotion/renderer";
import { createHash } from "crypto";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FONT_FAMILIES } from "../../../src/skills/remotion-render/fonts-loader.js";

const here = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(here, "..", "..", "..", "src", "skills", "remotion-render");
const OUT = join(here, "out");
const UPSTREAM = process.env.TEMP_AUDIT_FONTS || "C:\\Users\\Chile\\AppData\\Local\\Temp\\opencode\\fonts-upstream";

const FONT_DIR = join(RENDER_DIR, "public", "fonts");
const toDataUrl = (p) => "data:font/woff2;base64," + readFileSync(p).toString("base64");

// Build @font-face CSS mirroring fonts-loader.js descriptors, from vendored files.
const cssRules = [];
for (const family of FONT_FAMILIES) {
  const fileBase = family.replace(/\s+/g, "");
  for (const weight of [400, 700]) {
    const file = join(FONT_DIR, `${fileBase}-${weight}.woff2`);
    try {
      readFileSync(file); // existence probe
      cssRules.push(
        `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url("${toDataUrl(file)}") format("woff2");}`
      );
    } catch {
      // e.g. Archivo Black / Bebas Neue have no -700 file; loader emits one rule only.
    }
  }
}
const FONT_CSS = cssRules.join("\n");
console.log("embedding", cssRules.length, "@font-face rules from", FONT_DIR);

// Upstream Fira Sans (not vendored) as an extra family for the fallback comparison.
const fira400 = toDataUrl(join(UPSTREAM, "FiraSans-400.woff2"));
const fira700 = toDataUrl(join(UPSTREAM, "FiraSans-700.woff2"));

const entry = [
  'import React, { useEffect, useState } from "react";',
  'import { AbsoluteFill, Composition, delayRender, continueRender, registerRoot } from "remotion";',
  "",
  "const UPSTREAM = {",
  '  w400: "' + fira400 + '",',
  '  w700: "' + fira700 + '",',
  "};",
  "",
  "const FONT_CSS = " + JSON.stringify(FONT_CSS) + ";",
  "",
  'const FAMILIES = ["Inter","Nunito","Rubik","Barlow","Space Grotesk","Archivo Black","Fira Sans","Arial","FiraSansUpstream"];',
  "const WEIGHTS = [100,200,300,400,500,600,700,800,900];",
  'const PROBE_TEXT = "0123456789";',
  'const LONG_TEXT = "THE QUICK BROWN FOX JUMPS OVER 0123456789";',
  "",
  "function Probe() {",
  "  const [lines, setLines] = useState(null);",
  "  useEffect(() => {",
  '    const handle = delayRender("measure-probe");',
  "    (async () => {",
  "      try {",
  "        const style = document.createElement(\"style\");",
  "        style.textContent = FONT_CSS;",
  "        document.head.appendChild(style);",
  "        const uf400 = new FontFace(\"FiraSansUpstream\", \"url(\" + UPSTREAM.w400 + \")\");",
  '        const uf700 = new FontFace("FiraSansUpstream", "url(" + UPSTREAM.w700 + ")", { weight: "700" });',
  "        const loaded = await Promise.allSettled([uf400.load(), uf700.load()]);",
  '        loaded.forEach((r) => { if (r.status === "fulfilled") { document.fonts.add(r.value); } });',
  "        const loadP = [];",
  '        FAMILIES.forEach((f) => WEIGHTS.forEach((w) => { try { loadP.push(document.fonts.load(w + \' 48px "\' + f + \'"\')); } catch (e) {} }));',
  "        await Promise.allSettled(loadP);",
  "        await document.fonts.ready;",
  "        const canvas = document.createElement(\"canvas\");",
  "        const ctx = canvas.getContext(\"2d\");",
  "        const rows = [];",
  "        FAMILIES.forEach((f) => {",
  "          const r = [];",
  "          WEIGHTS.forEach((w) => {",
  '            ctx.font = w + \' 48px "\' + f + \'"\';',
  "            r.push(w + \":\" + ctx.measureText(PROBE_TEXT).width.toFixed(1));",
  "          });",
  '          rows.push(f.padEnd(22) + " " + r.join("  "));',
  "        });",
  "        const cmp = (w) => {",
  '          const m = (f) => { ctx.font = w + \' 48px "\' + f + \'"\'; return ctx.measureText(LONG_TEXT).width.toFixed(1); };',
  '          return "W" + w + "  FiraSans(fallback)=" + m("Fira Sans") + "  Arial=" + m("Arial") + "  FiraSansUpstream=" + m("FiraSansUpstream");',
  "        };",
  '        const out = [];',
  '        out.push("UA: " + navigator.userAgent);',
  '        out.push("PROBE_TEXT(48px): " + PROBE_TEXT + "  LONG: " + LONG_TEXT);',
  '        out.push("");',
  '        out.push("canvas measureText width per CSS weight (48px):");',
  "        rows.forEach((r) => out.push(r));",
  '        out.push("");',
  '        out.push("long-text compare (fallback vs real Fira Sans):");',
  "        out.push(cmp(400));",
  "        out.push(cmp(700));",
  "        setLines(out);",
  "        continueRender(handle);",
  "      } catch (e) {",
  "        setLines([\"PROBE ERROR: \" + String(e && e.message ? e.message : e)]);",
  "        continueRender(handle);",
  "      }",
  "    })();",
  "  }, []);",
  "  return (",
  "    <AbsoluteFill style={{ backgroundColor: \"#000\", color: \"#fff\", padding: 48, fontFamily: \"monospace\", fontSize: 15, lineHeight: \"19px\", whiteSpace: \"pre\", overflow: \"hidden\" }}>",
  "      <div>{(lines || []).join(\"\\n\")}</div>",
  '      <div style={{ marginTop: 26 }}>',
  '        <div style={{ fontSize: 14, color: "#888" }}>glyph weight sweep (real rendered text, 56px):</div>',
  '        {["Inter","Nunito","Rubik","FiraSansUpstream"].map((f) => (',
  "          <div key={f} style={{ fontFamily: \"\\\"\" + f + \"\\\"\", fontSize: 50, marginTop: 10, whiteSpace: \"pre\" }}>",
  "            {[100,400,700,900].map((w) => (",
  '              <span key={w} style={{ fontWeight: w, color: w === 700 ? "#ffd166" : w === 900 ? "#ff6b6b" : "#ffffff", marginRight: 26 }}>',
  '                {"W" + w + " 0123"}',
  "              </span>",
  "            ))}",
  "          </div>",
  "        ))}",
  '        <div style={{ fontSize: 50, marginTop: 22, whiteSpace: "pre" }}>',
  '          <span style={{ fontFamily: \'"Fira Sans"\' }}>FALLBACK 0123456789</span>',
  "        </div>",
  '        <div style={{ fontSize: 50, whiteSpace: "pre" }}>',
  '          <span style={{ fontFamily: \'"FiraSansUpstream"\' }}>UPSTREAM 0123456789</span>',
  "        </div>",
  "      </div>",
  "    </AbsoluteFill>",
  "  );",
  "}",
  "",
  "const Root = () => (",
  '  <Composition id="MeasureProbe" component={Probe} durationInFrames={1} fps={30} width={1080} height={1920} />',
  ");",
  "registerRoot(Root);",
  "",
].join("\n");

const ENTRY = join(here, "_probe-entry.jsx");
writeFileSync(ENTRY, entry, "utf8");
console.log("wrote", ENTRY, "(" + entry.length + " bytes)");

mkdirSync(OUT, { recursive: true });

const serveUrl = await bundle({ entryPoint: ENTRY, onProgress: () => {} });
console.log("bundled:", serveUrl);

// Open the browser with retries. Installed Chrome 151 is unreliable on this
// machine (see data/audit/2/launch-*.txt: DevTools endpoint never comes up;
// flaky GPU-init). The full binary also lost --headless=old support (removed at
// Chrome 135). Remotion's default chromeMode "headless-shell" downloads the
// dedicated chrome-headless-shell build (software rendering, no GPU) which is
// the battle-tested automation path for this Remotion version.
async function openBrowserWithRetry(retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await openBrowser({
        chromiumOptions: { gl: "swangle" },
      });
    } catch (err) {
      lastErr = err;
      console.log("openBrowser attempt", i + 1, "failed:", err.message);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  throw lastErr;
}

const browserInstance = await openBrowserWithRetry();

const composition = await selectComposition({
  serveUrl,
  id: "MeasureProbe",
  puppeteerInstance: browserInstance,
  timeoutInMilliseconds: 120000,
});
const outPath = join(OUT, "measure-probe.png");
await renderStill({
  composition,
  serveUrl,
  output: outPath,
  frame: 0,
  puppeteerInstance: browserInstance,
  timeoutInMilliseconds: 120000,
});
await browserInstance.close({ silent: true });

const h = createHash("sha256").update(readFileSync(outPath)).digest("hex");
console.log("frame:", outPath);
console.log("sha256:", h);
