import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { createHash } from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { resolveBrollFiles } from "./broll.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT_DIR = join(__dirname, "verify-out");

const styles = {
  "cinematic-documentary": {
    comp: "CinematicDocumentaryShorts",
    file: "cinematic-documentary.jsx",
    font: "Space Grotesk",
    palette: ["#0A0A1A", "#6366F1", "#FFFFFF"],
  },
  minimal: {
    comp: "MinimalShorts",
    file: "minimal.jsx",
    font: "Inter",
    palette: ["#0F172A", "#38BDF8", "#F5F5DC"],
  },
  "motion-graphics": {
    comp: "MotionGraphicsShorts",
    file: "motion-graphics.jsx",
    font: "Oswald",
    palette: ["#0A1020", "#22D3EE", "#F8FAFC"],
  },
};

function chunkVoiceover(text, maxWords = 7) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) chunks.push(words.slice(i, i + maxWords).join(" "));
  return chunks;
}

// Real ch-01 script, mapped exactly like render.js toContentSections.
const script = JSON.parse(
  readFileSync(join(dirname(__dirname), "..", "..", "data", "scripts", "ch-01", "movile-cave-shorts-script.json"), "utf-8")
);
const sections = (script.sections || [])
  .filter((s) => s.voiceover && s.voiceover.trim())
  .map((s) => ({
    id: s.id,
    timing: s.timing,
    voiceover: s.voiceover,
    content: chunkVoiceover(s.voiceover),
    visualCue: s.visual_cue || null,
    sfxCue: s.sfx_cue || null,
    bRoll: Array.isArray(s.b_roll) ? s.b_roll : null,
    textOverlay: s.text_overlay || null,
    transitionOut: s.transition_out || null,
  }));
for (const section of sections) {
  section.bRollFiles = resolveBrollFiles(section.bRoll || [], "ch-01");
}
for (const section of sections) {
  console.log(`b-roll [${section.id}]:`, JSON.stringify(section.bRollFiles));
}

const DEFAULTS = {
  channelId: "ch-verify",
  style: "verify",
  format: "shorts",
  sections,
  ttsAudioPath: null,
  thumbnailStyle: "dramatic-visual",
  tone: "investigative-dramatic",
};

const entry = `import React from "react";
import { Composition, registerRoot } from "remotion";
import { CinematicDocumentaryShorts } from "./compositions/cinematic-documentary.jsx";
import { MinimalShorts } from "./compositions/minimal.jsx";
import { MotionGraphicsShorts } from "./compositions/motion-graphics.jsx";

const SECTIONS = ${JSON.stringify(sections)};

const Root = () => (
  <>
    <Composition id="V-Cinematic" component={CinematicDocumentaryShorts} durationInFrames={1800} fps={30} width={1080} height={1920} defaultProps={{ ...${JSON.stringify(DEFAULTS)}, sections: SECTIONS, font: "Space Grotesk", palette: ["#0A0A1A", "#6366F1", "#FFFFFF"] }} />
    <Composition id="V-CinematicAlt" component={CinematicDocumentaryShorts} durationInFrames={1800} fps={30} width={1080} height={1920} defaultProps={{ ...${JSON.stringify(DEFAULTS)}, sections: SECTIONS, font: "Space Grotesk", palette: ["#0D1117", "#C9A227", "#FFFFFF"] }} />
    <Composition id="V-Minimal" component={MinimalShorts} durationInFrames={1800} fps={30} width={1080} height={1920} defaultProps={{ ...${JSON.stringify(DEFAULTS)}, sections: SECTIONS, font: "Inter", palette: ["#0F172A", "#38BDF8", "#F5F5DC"] }} />
    <Composition id="V-Motion" component={MotionGraphicsShorts} durationInFrames={1800} fps={30} width={1080} height={1920} defaultProps={{ ...${JSON.stringify(DEFAULTS)}, sections: SECTIONS, font: "Oswald", palette: ["#0A1020", "#22D3EE", "#F8FAFC"] }} />
  </>
);

registerRoot(Root);
`;

const entryPath = join(__dirname, "verify-entry.jsx");
writeFileSync(entryPath, entry, "utf-8");
mkdirSync(OUT_DIR, { recursive: true });

const serveUrl = await bundle({ entryPoint: entryPath, onProgress: () => {} });

const renderStillSafe = async (id, out, frame) => {
  const composition = await selectComposition({ serveUrl, id, browserExecutable: CHROME });
  await renderStill({ composition, serveUrl, output: out, frame, browserExecutable: CHROME });
};

for (const [name, id, frame] of [
  ["cinematic-documentary", "V-Cinematic", 60],
  ["cinematic-documentary", "V-Cinematic", 90],
  ["cinematic-documentary", "V-Cinematic", 200],
  ["cinematic-documentary", "V-Cinematic", 600],
  ["cinematic-documentary", "V-Cinematic", 900],
  ["cinematic-documentary", "V-Cinematic", 1200],
  ["cinematic-documentary", "V-Cinematic", 1500],
  ["cinematic-documentary", "V-Cinematic", 1790],
  ["cinematic-leak", "V-Cinematic", 415],
  ["cinematic-alt", "V-CinematicAlt", 60],
  ["minimal", "V-Minimal", 60],
]) {
  await renderStillSafe(id, join(OUT_DIR, `${name}-f${frame}.png`), frame);
  console.log("rendered:", join(OUT_DIR, `${name}-f${frame}.png`));
}

const { decodePNG, meanColor } = await import("./decode-png.js");
const hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

const hA = hash(join(OUT_DIR, "cinematic-documentary-f60.png"));
const hAlt = hash(join(OUT_DIR, "cinematic-alt-f60.png"));
console.log("cinematic vs alt-palette:", hA === hAlt ? "IDENTICAL -> palette NOT applied" : "DIFFERENT -> palette applied");

for (const f of ["cinematic-documentary-f60", "cinematic-documentary-f600", "cinematic-documentary-f900", "cinematic-documentary-f1200", "cinematic-documentary-f1500", "minimal-f60"]) {
  const png = decodePNG(join(OUT_DIR, `${f}.png`));
  const c = meanColor(png, Math.round(png.width * 0.3), Math.round(png.height * 0.3), Math.round(png.width * 0.7), Math.round(png.height * 0.7));
  console.log(`${f}: mean RGB(${c.join(",")})`);
}

// B-roll presence: hook shots 1 and 2 (frames 60 / 200) are DIFFERENT photos,
// so their top strip (no text there) must differ; Ken Burns motion means frame
// 60 vs 90 of the SAME shot must also differ.
const topStrip = (png) => meanColor(png, 0, 0, png.width - 1, Math.round(png.height * 0.22));
const strip60 = topStrip(decodePNG(join(OUT_DIR, "cinematic-documentary-f60.png")));
const strip90 = topStrip(decodePNG(join(OUT_DIR, "cinematic-documentary-f90.png")));
const strip200 = topStrip(decodePNG(join(OUT_DIR, "cinematic-documentary-f200.png")));
const diff = (a, b) => a.map((v, i) => Math.abs(v - b[i]));
console.log("b-roll top strip f60:", strip60.join(","));
console.log("b-roll top strip f90:", strip90.join(","));
console.log("b-roll top strip f200:", strip200.join(","));
console.log("Ken Burns motion f60->f90 diff:", diff(strip60, strip90).join(","));
console.log("shot change f60->f200 diff:", diff(strip60, strip200).join(","));

const cin1790 = decodePNG(join(OUT_DIR, "cinematic-documentary-f1790.png"));
console.log("cinematic f1790 (fade-to-black): corner", sampleAtRaw(cin1790, 40, 40).join(","), "center", sampleAtRaw(cin1790, 540, 960).join(","));

const leak = decodePNG(join(OUT_DIR, "cinematic-leak-f415.png"));
console.log("cinematic leak f415 region (78%,18%):", sampleAtRaw(leak, Math.round(leak.width * 0.78), Math.round(leak.height * 0.18)).join(","));
console.log("ALL STYLES OK");

function sampleAtRaw(png, x, y) {
  const i = (y * png.width + x) * png.channels;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}
