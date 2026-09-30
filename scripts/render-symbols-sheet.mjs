// node scripts/render-symbols-sheet.mjs <out.png> [--accent "#1B7A4D"] — the 8 drawn symbols on the studio ground (server-rendered SVG -> PNG), to look at.
import sharp from "sharp";
import { build } from "esbuild";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] || "symbols.png";
const accent = process.argv.includes("--accent") ? process.argv[process.argv.indexOf("--accent") + 1] : "#1B7A4D";
// Bundle the symbols with react + react-dom/server into one self-contained module, then server-render each to SVG.
const file = join(tmpdir(), `symbols-${process.pid}.cjs`);
await build({
  stdin: { contents: `import React from "react"; import { renderToStaticMarkup } from "react-dom/server"; import { SYMBOL_COMPONENTS } from "./index.jsx";
export const render = (accent, size) => Object.fromEntries(Object.entries(SYMBOL_COMPONENTS).map(([n, C]) => [n, renderToStaticMarkup(React.createElement(C, { size, color: accent }))]));`,
    resolveDir: join(ROOT, "src/skills/remotion-render/visual/symbols"), loader: "jsx" },
  bundle: true, format: "cjs", platform: "node", jsx: "automatic", outfile: file, absWorkingDir: ROOT, logLevel: "error",
});
const { render } = createRequire(import.meta.url)(file);
const T0 = 300, svgs = render(accent, T0 - 60);
const names = Object.keys(svgs), T = T0, G = 24;
const tiles = names.map((n, i) => {
  const svg = svgs[n];
  return { input: Buffer.from(svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')), left: G + (i % 4) * (T + G) + 30, top: G + Math.floor(i / 4) * (T + G) + 30 };
});
await sharp({ create: { width: 4 * (T + G) + G, height: 2 * (T + G) + G, channels: 3, background: "#F6F4F0" } }).composite(tiles).png().toFile(out);
console.log(`${names.length} symbols -> ${out}`);
