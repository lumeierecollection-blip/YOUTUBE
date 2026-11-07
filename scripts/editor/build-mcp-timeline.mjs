/**
 * Build the editor timeline for the AI Tested MCP Short.
 * Topic: Model Context Protocol (MCP) — connecting AI assistants to your data.
 * All visuals are original motion graphics labelled illustrative where they
 * represent a concept rather than a photograph of a specific product.
 *
 *   node scripts/editor/build-mcp-timeline.mjs
 *
 * Writes data/editor/auto/model-context-protocol-mcp/timeline.json (+ plan.json,
 * transcript.json) consumed by render-editor.js and video-qa.js.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { FPS, CANVAS_W, CANVAS_H } from "../../src/skills/remotion-render/editor/layer-math.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "../..");

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith("--")) a.push([x.slice(2), arr[i + 1]]); return a; }, []),
);
const need = (k) => { if (!args[k]) throw new Error(`missing --${k}`); return args[k]; };

const channelId = need("channel");
const scriptPath = need("script");
const topicSlug = need("topic");
const productionId = need("production-id");
const audioPath = need("audio");
const wordsPath = need("words");
const outDir = need("out-dir");
mkdirSync(join(ROOT, outDir), { recursive: true });

const script = JSON.parse(readFileSync(join(ROOT, scriptPath), "utf8"));
const OUT = join(ROOT, outDir);

const sec = (t) => Math.max(0, Math.round(Number(t) * FPS));
const W = CANVAS_W, H = CANVAS_H;
const DURATION_S = 26;
const DURATION_F = sec(DURATION_S);

// ── Palette (channel ch-02 AI Tested, motion-graphics skill) ────────────────
const P = {
  bg: "#050510",
  accent: "#8B5CF6",
  text: "#FFFFFF",
  muted: "#9CA3AF",
  surface: "#13131E",
  stroke: "#C8C8CB",
};

const FONT_SANS = "Space Grotesk";
const FONT_MONO = "JetBrains Mono";

const X = 90;      // text left margin (inside safe rect left=48)
const TEXT_W = W - 180;

/** Text layer with a slide-up + opacity reveal kinetic entrance. */
function textLayer(id, text, { y, w = TEXT_W, size = 72, weight = 700, color = P.text,
  align = "center", valign = "top", inF, outF, z, revealFrames = 12, slide = 34,
  lineHeight = 1.1, tracking = 0, font = FONT_SANS, upper = false }) {
  const span = Math.max(1, outF - inF);
  const reveal = Math.min(revealFrames, Math.max(4, Math.floor(span / 3)));
  return {
    id, type: "text", text,
    rect: { x: X, y, w, h: Math.max(64, size * 2) },
    in: inF, out: outF, z,
    style: { font, size, weight, color, align, valign, lineHeight, tracking, upper, pad: 0 },
    props: { opacity: 1, ty: slide },
    keyframes: {
      opacity: [{ f: 0, v: 0, e: "outCubic" }, { f: reveal, v: 1 }, { f: span, v: 1 }],
      reveal: [{ f: 0, v: 0, e: "outCubic" }, { f: reveal, v: 1 }, { f: span, v: 1 }],
      ty: [{ f: 0, v: slide, e: "outCubic" }, { f: reveal, v: 0 }, { f: span, v: 0 }],
    },
  };
}

/** Solid colour block. */
function solidLayer(id, { x, y, w, h, background, inF, outF, z, opacity = 1, radius = 0 }) {
  return {
    id, type: "solid", rect: { x, y, w, h }, in: inF, out: outF, z,
    style: { background, borderRadius: radius },
    props: { opacity },
    keyframes: { opacity: [{ f: 0, v: 0, e: "outCubic" }, { f: 10, v: opacity }, { f: Math.max(1, outF - inF), v: opacity }] },
  };
}

/** SVG path layer with draw-on animation and optional scale (camera push-in). */
function svgLayer(id, d, { x, y, w, h, stroke = P.accent, strokeWidth = 4, fill = "none",
  inF, outF, z, drawFrames = 16, drawStart = 0, viewBox, scaleKfs }) {
  const span = Math.max(1, outF - inF);
  const endDraw = Math.min(drawStart + drawFrames, span);
  const kfs = {
    opacity: [{ f: 0, v: 0, e: "outCubic" }, { f: 8, v: 1 }, { f: span, v: 1 }],
    draw: [{ f: 0, v: 0, e: "linear" }, { f: Math.max(1, drawStart), v: 0 },
      { f: endDraw, v: 1 }, { f: span, v: 1 }],
  };
  if (scaleKfs) kfs.scale = scaleKfs;
  return {
    id, type: "svg", rect: { x, y, w, h }, in: inF, out: outF, z,
    viewBox: viewBox || [0, 0, w, h],
    props: { opacity: 1, draw: 0, scale: 1 },
    paths: [{ d, fill, stroke, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" }],
    keyframes: kfs,
  };
}

const scenes = [
  { id: "hook", start: 0, end: 3.5 },
  { id: "setup", start: 3.5, end: 9.5 },
  { id: "how", start: 9.5, end: 15.0 },
  { id: "servers", start: 15.0, end: 21.5 },
  { id: "close", start: 21.5, end: 25.5 },
];

const layers = [];
let z = 10;

// ── Background (whole video) ──────────────────────────────────────────────
layers.push(solidLayer("bg", { x: 0, y: 0, w: W, h: H, background: P.bg, inF: 0, outF: DURATION_F, z: z++ }));

// ── Progress bar (accent, bottom edge, depletes with the narration) ───────
{
  const prog = {
    id: "progress", type: "solid", rect: { x: 0, y: H - 8, w: W, h: 8 },
    in: 0, out: DURATION_F, z: z++,
    style: { background: P.accent, borderRadius: 0 },
    props: { opacity: 0.9, clipR: 100 },
    keyframes: { clipR: [{ f: 0, v: 100, e: "linear" }, { f: DURATION_F, v: 0, e: "linear" }] },
  };
  layers.push(prog);
}

// ── Kicker (channel) ──────────────────────────────────────────────────────
layers.push(textLayer("kicker", "AI TESTED  ·  MCP", {
  y: 150, w: TEXT_W, size: 30, weight: 700, color: P.accent, align: "center",
  tracking: 0.24, upper: true, inF: 0, outF: DURATION_F, z: z++, revealFrames: 10, slide: 0,
}));

// ── Scene: hook ───────────────────────────────────────────────────────────
{
  const s = scenes[0]; const inF = sec(s.start), outF = sec(s.end);
  layers.push(textLayer("hook-line-1", "AI ASSISTANTS ARE TRAPPED", {
    y: 760, size: 150, weight: 800, color: P.text, inF, outF: outF, z: z++, revealFrames: 14, slide: 40,
  }));
  layers.push(textLayer("hook-line-2", "BEHIND INFORMATION SILOS", {
    y: 940, size: 150, weight: 800, color: P.accent, inF: inF + 10, outF: outF, z: z++, revealFrames: 14, slide: 40,
  }));
}

// ── Scene: setup (article highlight) ──────────────────────────────────────
{
  const s = scenes[1]; const inF = sec(s.start), outF = sec(s.end);
  const cardY = 1080, cardH = 420;
  // Highlight card surface panel
  layers.push(solidLayer("setup-card", {
    x: 60, y: cardY, w: W - 120, h: cardH, background: P.surface,
    inF, outF, z: z++, opacity: 1, radius: 20,
  }));
  // Card border stroke (svg rect)
  layers.push(svgLayer("setup-card-border", `M14 14 H${W - 74} V${cardY + cardH - 14} H14 Z`, {
    x: 60, y: cardY, w: W - 120, h: cardH, stroke: P.stroke, strokeWidth: 2, fill: "none",
    inF, outF, z: z++, drawFrames: 12,
  }));
  // Headline above card
  layers.push(textLayer("setup-head", "ANTHROPIC'S MODEL CONTEXT PROTOCOL", {
    y: 860, size: 56, weight: 800, color: P.muted, inF, outF, z: z++, revealFrames: 10, slide: 20,
  }));
  // Highlight phrase inside card
  layers.push(textLayer("setup-phrase", "ONE OPEN STANDARD", {
    y: cardY + 110, w: W - 240, size: 84, weight: 800, color: P.accent, align: "center",
    inF: inF + 8, outF, z: z++, revealFrames: 14, slide: 30,
  }));
  // Body text inside card
  layers.push(textLayer("setup-body", "Connecting AI to your data — one open standard instead of a custom connector per source.", {
    y: cardY + 250, w: W - 260, size: 44, weight: 400, color: P.text, align: "center", lineHeight: 1.3,
    inF: inF + 16, outF, z: z++, revealFrames: 12, slide: 20,
  }));
  // Marker stroke: draws across "ONE OPEN STANDARD"
  layers.push(svgLayer("setup-marker", `M250 ${cardY + 110 + 52} H${W - 250}`, {
    x: 0, y: 0, w: W, h: 1, stroke: P.accent, strokeWidth: 7, fill: "none",
    inF: inF + 8, outF: inF + 24, z: z + 5, drawFrames: 14, drawStart: 0,
  }));
  // Source citation on card
  layers.push(textLayer("setup-cite", "Source: anthropic.com/news/model-context-protocol (Nov 25, 2024)", {
    y: cardY + 340, w: W - 260, size: 28, weight: 400, color: P.muted, align: "center",
    inF: inF + 20, outF, z: z++, revealFrames: 10, slide: 10,
  }));
}

// ── Scene: how (animated diagram) ─────────────────────────────────────────
{
  const s = scenes[2]; const inF = sec(s.start), outF = sec(s.end);
  const cx = W / 2;
  // Labels
  layers.push(textLayer("how-head", "HOW MCP WORKS", { y: 430, size: 44, weight: 800, color: P.muted, inF, outF, z: z++, revealFrames: 10, slide: 15 }));
  // Three data-source nodes (right)
  const nodeR = 42;
  const sources = [
    { name: "Google Drive", x: cx + 330, y: 820 },
    { name: "Slack", x: cx + 330, y: 1020 },
    { name: "GitHub", x: cx + 330, y: 1220 },
  ];
  const server = { x: cx, y: 1020 };
  const client = { x: cx - 380, y: 1020 };
  // connectors: client -> server -> sources
  const connCS = `M${client.x + nodeR} ${client.y} L${server.x - nodeR} ${server.y}`;
  layers.push(svgLayer("conn-client-server", connCS, { x: 0, y: 0, w: W, h: H, stroke: P.stroke, strokeWidth: 5, inF: inF + 4, outF, z: z++, drawFrames: 18, drawStart: 0, viewBox: [0, 0, W, H] }));
  for (let i = 0; i < sources.length; i++) {
    const so = sources[i];
    const conn = `M${server.x + nodeR} ${server.y} L${so.x - nodeR} ${so.y}`;
    layers.push(svgLayer(`conn-server-${i}`, conn, { x: 0, y: 0, w: W, h: H, stroke: P.stroke, strokeWidth: 5, inF: inF + 4 + i * 6, outF, z: z++, drawFrames: 16, drawStart: 0, viewBox: [0, 0, W, H] }));
    // source node
    layers.push(svgLayer(`node-source-${i}`, `M${so.x} ${so.y - nodeR} A${nodeR} ${nodeR} 0 1 1 ${so.x} ${so.y + nodeR} A${nodeR} ${nodeR} 0 1 1 ${so.x} ${so.y - nodeR} Z`, {
      x: 0, y: 0, w: W, h: H, stroke: P.muted, strokeWidth: 3, fill: P.surface,
      inF: inF + 8 + i * 6, outF, z: z++, drawFrames: 10,
    }));
    layers.push(textLayer(`label-source-${i}`, so.name, { x: so.x - 110, y: so.y + nodeR + 18, w: 220, size: 26, weight: 700, color: P.muted, align: "center", inF: inF + 10 + i * 6, outF, z: z++, revealFrames: 8, slide: 0 }));
  }
  // server node
  layers.push(svgLayer("node-server", `M${server.x} ${server.y - nodeR} A${nodeR} ${nodeR} 0 1 1 ${server.x} ${server.y + nodeR} A${nodeR} ${nodeR} 0 1 1 ${server.x} ${server.y - nodeR} Z`, {
    x: 0, y: 0, w: W, h: H, stroke: P.accent, strokeWidth: 4, fill: P.surface,
    inF: inF + 4, outF, z: z++, drawFrames: 12,
  }));
  layers.push(textLayer("label-server", "MCP SERVER", { x: cx - 100, y: server.y + nodeR + 18, w: 200, size: 26, weight: 800, color: P.accent, align: "center", inF: inF + 10, outF, z: z++, revealFrames: 8, slide: 0 }));
  // client node with a cinematic push-in (emphasise the MCP client)
  const clientSpan = outF - inF;
  layers.push(svgLayer("node-client", `M${client.x} ${client.y - nodeR} A${nodeR} ${nodeR} 0 1 1 ${client.x} ${client.y + nodeR} A${nodeR} ${nodeR} 0 1 1 ${client.x} ${client.y - nodeR} Z`, {
    x: 0, y: 0, w: W, h: H, stroke: P.text, strokeWidth: 3, fill: P.surface,
    inF: inF, outF, z: z++, drawFrames: 12,
    scaleKfs: [
      { f: 0, v: 1 },
      { f: Math.floor(clientSpan * 0.25), v: 1 },
      { f: Math.floor(clientSpan * 0.45), v: 1.2, e: "outCubic" },
      { f: Math.floor(clientSpan * 0.65), v: 1, e: "inOutCubic" },
      { f: clientSpan, v: 1 },
    ],
  }));
  layers.push(textLayer("label-client", "CLAUDE (MCP CLIENT)", { x: client.x - 130, y: client.y + nodeR + 18, w: 260, size: 24, weight: 700, color: P.text, align: "center", inF: inF + 6, outF, z: z++, revealFrames: 8, slide: 0 }));
  // client push-in emphasis (scale keyframes handled via image-like scale — here we scale the client group by animating nothing; instead pulse opacity)
  // Explainer text
  layers.push(textLayer("how-body", "An MCP server exposes your data; an MCP client like Claude connects to it.", {
    y: 1460, w: W - 260, size: 40, weight: 400, color: P.text, align: "center", lineHeight: 1.25,
    inF: inF + 22, outF, z: z++, revealFrames: 12, slide: 25,
  }));
}

// ── Scene: servers (terminal insert) ──────────────────────────────────────
{
  const s = scenes[3]; const inF = sec(s.start), outF = sec(s.end);
  const tx = 110, ty = 800, tw = W - 220;
  // Terminal chrome
  layers.push(solidLayer("term-bg", { x: tx, y: ty, w: tw, h: 560, background: "#0A0A1A", inF, outF, z: z++, opacity: 1, radius: 14 }));
  layers.push(solidLayer("term-header", { x: tx, y: ty, w: tw, h: 44, background: "#12122A", inF, outF, z: z + 1, opacity: 1, radius: 0 }));
  // traffic lights
  const lights = ["#FF5F56", "#FFBD2E", "#27C93F"];
  lights.forEach((c, i) => {
    layers.push(solidLayer(`term-light-${i}`, { x: tx + 18 + i * 24, y: ty + 10, w: 12, h: 12, background: c, inF, outF, z: z + 2, opacity: 1, radius: 6 }));
  });
  layers.push(textLayer("term-title", "mcp-server.json", { x: tx + 110, y: ty + 8, w: 300, size: 18, weight: 700, color: P.muted, align: "left", inF, outF, z: z + 3, revealFrames: 6, slide: 0 }));
  const lines = [
    "{",
    "  \"mcpServers\": {",
    "    \"github\": {",
    "      \"command\": \"npx\",",
    "      \"args\": [\"-y\", \"@modelcontextprotocol/server-github\"]",
    "    }",
    "  }",
    "}",
  ];
  let lineF = inF + 20;
  lines.forEach((t, i) => {
    const showF = lineF + i * 14;
    const hideF = outF - 4;
    layers.push(textLayer(`term-line-${i}`, t, {
      x: tx + 44, y: ty + 66 + i * 40, w: tw - 80, size: 28, weight: i === 3 ? 700 : 400,
      color: i === 3 ? P.accent : P.text, font: FONT_MONO, align: "left", valign: "top",
      inF: showF, outF: hideF, z: z + 10 + i, revealFrames: 10, slide: 20, lineHeight: 1.0,
    }));
  });
  // blinking cursor at end of highlighted line (line index 3)
  const curLine = 3;
  const cy = ty + 66 + curLine * 40 + 8;
  layers.push(solidLayer("term-cursor", { x: tx + 44 + (tw - 80) - 22, y: cy, w: 16, h: 32, background: P.text, inF: inF + 20 + curLine * 14, outF, z: z + 30, opacity: 1,
    keyframes: { opacity: [{ f: 0, v: 1, e: "linear" }, { f: 15, v: 0 }, { f: 30, v: 1 }, { f: 45, v: 0 }, { f: 60, v: 1 }, { f: Math.max(1, outF - inF), v: 1 }] } }));
  layers.push(textLayer("servers-head", "PRE-BUILT MCP SERVERS", { y: 1460, size: 40, weight: 800, color: P.muted, inF, outF, z: z++, revealFrames: 10, slide: 15 }));
  layers.push(textLayer("servers-list", "GOOGLE DRIVE  ·  SLACK  ·  GITHUB  ·  POSTGRES  ·  PUPPETEER", {
    y: 1560, size: 40, weight: 800, color: P.accent, align: "center", tracking: 0.12, inF: inF + 10, outF, z: z++, revealFrames: 14, slide: 30,
  }));
}

// ── Scene: close (summary) ────────────────────────────────────────────────
{
  const s = scenes[4]; const inF = sec(s.start), outF = sec(s.end);
  layers.push(textLayer("close-big", "BUILD ONCE · INTEGRATE EVERYWHERE", {
    y: 760, size: 110, weight: 800, color: P.text, align: "center", tracking: 0.08, inF, outF, z: z++, revealFrames: 14, slide: 40,
  }));
  layers.push(textLayer("close-small", "AI finally reaches your data.", {
    y: 940, size: 64, weight: 700, color: P.accent, align: "center", inF: inF + 10, outF, z: z++, revealFrames: 12, slide: 30,
  }));
  // Credits
  layers.push(textLayer("credits", "Sources: anthropic.com/news/model-context-protocol · modelcontextprotocol.io", {
    y: H - 120, w: W - 120, size: 24, weight: 400, color: P.muted, align: "center",
    inF: inF + 8, outF, z: z++, revealFrames: 10, slide: 10,
  }));
}

// ── Captions from the narration SRT (per-word, synchronised) ──────────────
const words = JSON.parse(readFileSync(join(ROOT, wordsPath), "utf8"));
const cues = (words.sentences || []).map((c, i) => {
  const cws = (words.words || []).filter((w) => w.sentence == null ? false : w.sentence === i);
  // fallback: group words by order if sentence index missing
  const wordCues = cws.map((w) => ({ text: w.text, start_f: sec(w.start), end_f: Math.max(sec(w.end), sec(w.start) + 1) }));
  return {
    start_f: sec(c.start),
    end_f: Math.max(sec(c.end), sec(c.start) + 1),
    text: c.text,
    words: wordCues.length ? wordCues : [{ text: c.text, start_f: sec(c.start), end_f: Math.max(sec(c.end), sec(c.start) + 1) }],
  };
});

const timeline = {
  version: 1,
  id: topicSlug,
  title: `AI Tested — ${script.topic || topicSlug}`,
  production_id: productionId,
  channel_id: `ch-${String(channelId).padStart(2, "0")}`,
  width: W, height: H, fps: FPS,
  durationInFrames: DURATION_F,
  palette: P,
  fonts: { primary: FONT_SANS, mono: FONT_MONO },
  assets: {},
  layers,
  captions: cues,
  caption_style: { x: 90, y: 1560, w: W - 180, h: 200, size: 48 },
  scenes,
  metadata: {
    generated_at: new Date().toISOString(),
    topic_slug: topicSlug,
    topic: script.topic || topicSlug,
    source_script: scriptPath,
    source_audio: audioPath,
    scene_count: scenes.length,
    duration_s: DURATION_S,
  },
};

writeFileSync(join(OUT, "timeline.json"), JSON.stringify(timeline, null, 2));

// plan.json + transcript.json for the QA/review pipeline
const plan = {
  id: timeline.id,
  production_id: timeline.production_id,
  channel_id: timeline.channel_id,
  title: timeline.title,
  topic_slug: timeline.metadata.topic_slug,
  topic: timeline.metadata.topic,
  duration: DURATION_S,
  fps: FPS,
  width: W, height: H,
  palette: P,
  fonts: timeline.fonts,
  scenes: scenes.map((s, i) => ({ ...s, start_f: sec(s.start), end_f: sec(s.end), asset: null })),
  script: timeline.metadata.source_script,
  audio: timeline.metadata.source_audio,
};
writeFileSync(join(OUT, "plan.json"), JSON.stringify(plan, null, 2));

const transcript = {
  text: words.words ? words.words.map((w) => w.text).join(" ") : "",
  segments: cues.map((c, i) => ({ id: i, start: c.start_f / FPS, end: c.end_f / FPS, text: c.text, words: c.words.map(w => ({ word: w.text, start: w.start_f / FPS, end: w.end_f / FPS })) })),
  language: "en",
  source: "edge-tts WordBoundary + sentence SRT",
};
writeFileSync(join(OUT, "transcript.json"), JSON.stringify(transcript, null, 2));

console.log(`[build-mcp-timeline] Wrote timeline.json: ${DURATION_F} frames (${DURATION_S}s), ${layers.length} layers, ${cues.length} caption cues`);
console.log(`[build-mcp-timeline] Output dir: ${OUT}`);
