/**
 * AI Tested visual track: the MCP Short's motion-graphics language (kinetic type, diagrams,
 * terminal inserts, article highlights, data bars) generalised to any topic.
 * A real screenshot of a cited page is the article highlight. Illustrative panels say so on screen.
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROOT, StageError, askJson, askVision, log, must, readJson, run, sha256File, writeJson } from "./lib.mjs";
import { FPS, H, W, captions, channelStyle, fit, layoutCheck, scenesFromWords, sec, solid, stripForRender, stroke, text } from "./visual-common.mjs";

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const SANS = "Space Grotesk", MONO = "JetBrains Mono";

function chromeBin() {
  return process.env.CHROME_BIN || process.env.REMOTION_CHROME_PATH || "google-chrome";
}

async function screenshotSources(urls, topic, dir) {
  const shots = [];
  for (const [i, url] of urls.slice(0, 8).entries()) {
    if (shots.length >= 2) break;
    const out = join(dir, `shot-${i}.jpg`);
    const png = join(dir, `shot-${i}.png`);
    const r = run(chromeBin(), ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--window-size=1000,1100", "--virtual-time-budget=9000", `--screenshot=${png}`, url], { timeoutS: 60, capture: true });
    if (r.status !== 0) { log("assets", `screenshot failed: ${url}`); continue; }
    must("assets", "ffmpeg", ["-y", "-v", "error", "-i", png, "-q:v", "3", out]);
    const v = await askVision(`This is a browser screenshot of ${url}, cited as a source for a video about "${topic}".
Answer as JSON {"ok":boolean,"why":"..."}. ok=true only if it visibly shows a readable article or product page about this subject. ok=false for cookie walls, consent popups covering the content, paywalls, captchas, error pages, blank pages, or unrelated content.`, readFileSync(out), "autopilot-screenshot");
    log("assets", `${url}: ${v?.ok ? "usable" : "rejected"} (${v?.why || "no answer"})`);
    if (v?.ok) shots.push({ file: out, url, domain: hostOf(url) });
  }
  return shots;
}

const NUM = /\d[\d,.]*/g;
/** On-screen numbers must exist in the script or research; anything else is removed, not displayed. */
const groundedNumbers = (s, corpus) => (String(s).match(NUM) || []).every((n) => corpus.includes(n.replace(/[.,]$/, "")));

function planPrompt(scenes, script, research, hasShots) {
  return `You are the motion-graphics director for a 30-second YouTube Short. Choose how each narration sentence is shown.
Explain visually; do not just repeat the narration as text. Viewers are not developers.

Sentences:
${scenes.map((s) => `${s.index}. (${(s.end - s.start).toFixed(1)}s) ${s.text}`).join("\n")}

Facts available (do not use any number or name that is not here or in the sentences):
${JSON.stringify((research.key_facts || []).map((f) => f.fact || f.claim || f.text || f), null, 0).slice(0, 3500)}

Templates:
- kinetic: {"headline":"max 6 words","accent":"one word from the headline"}
- diagram: {"headline":"max 5 words","nodes":["A","B","C"]} three short labels showing how something flows, each max 2 words
- compare: {"headline":"max 5 words","left":{"title":"max 2 words","points":["max 3 words"]},"right":{"title":"max 2 words","points":["max 3 words"]}} 1-2 points each side
- bars: {"headline":"max 5 words","bars":[{"label":"max 3 words","value":number}]} 2-4 bars, only numbers stated in the facts
- terminal: {"headline":"max 5 words","lines":["short text lines"]} 3-5 lines, max 30 characters, an illustration of the idea
${hasShots ? '- article: {"headline":"max 5 words"} shows a real screenshot of the source article. Use it once or twice, on a sentence about reporting or an announcement.\n' : ""}
Use at least 3 different templates. The first sentence is the hook: use kinetic. At least one scene must be diagram, compare, bars or terminal.

Return JSON: {"scenes":[{"index":0,"template":"kinetic","headline":"...","accent":"..."}]} with one object per sentence.`;
}

function buildLayers(plan, scenes, durationF, P, shots, corpus) {
  const layers = [], assets = {};
  let z = 10;
  const sectionF = (s) => ({ inF: sec(s.from), outF: s.to === null ? durationF : sec(s.to) });
  layers.push(solid("bg", { x: 0, y: 0, w: W, h: H, background: P.bg, inF: 0, outF: durationF, z: z++, keyframes: { opacity: [{ f: 0, v: 1 }, { f: durationF, v: 1 }] } }));
  layers.push({ id: "progress", type: "solid", rect: { x: 0, y: H - 8, w: W, h: 8 }, in: 0, out: durationF, z: z++, style: { background: P.accent }, props: { opacity: 0.9, clipR: 100 }, keyframes: { clipR: [{ f: 0, v: 100, e: "linear" }, { f: durationF, v: 0, e: "linear" }] } });
  layers.push(text("kicker", "AI  TESTED", { y: 150, size: 30, color: P.accent, inF: 0, outF: durationF, z: z++, tracking: 0.24, font: SANS, slide: 0 }));

  let shotIdx = 0;
  for (const scene of scenes) {
    const p = plan.find((x) => Number(x.index) === scene.index) || {};
    let template = p.template || "kinetic";
    const { inF, outF } = sectionF(scene);
    const id = `s${scene.index}`;
    if (template === "bars" && !(p.bars?.length >= 2 && p.bars.every((b) => Number.isFinite(Number(b.value)) && groundedNumbers(String(b.value), corpus)))) template = "kinetic";
    if (template === "article" && !shots[shotIdx]) template = "kinetic";
    let headlineText = p.headline && groundedNumbers(p.headline, corpus) ? p.headline : scene.text.split(/\s+/).slice(0, 5).join(" ");
    headlineText = headlineText.toUpperCase();

    const heroFit = fit(headlineText, { maxW: 900, maxLines: template === "kinetic" ? 4 : 2, max: template === "kinetic" ? 120 : 64, min: 44, tracking: 0.02 });
    if (!heroFit) throw new StageError("visual-plan", `headline will not fit: ${headlineText}`);
    if (template === "kinetic") {
      const h = heroFit.lines.length * heroFit.size * 1.12;
      const y = Math.round(820 - h / 2);
      layers.push(text(`${id}-headline`, heroFit.text, { y, size: heroFit.size, weight: 800, color: P.text, inF, outF, z: z++, font: SANS, slide: 40, tracking: 0.02 }));
      const uy = Math.round(y + h + 28);
      layers.push(stroke(`${id}-underline`, `M250 ${uy} L830 ${uy}`, { color: P.accent, width: 9, inF, outF, z: z++, delay: 6 }));
      continue;
    }
    layers.push(text(`${id}-headline`, heroFit.text, { y: 330, size: heroFit.size, weight: 800, color: P.text, inF, outF, z: z++, font: SANS, slide: 24, tracking: 0.02 }));
    const top = 330 + heroFit.lines.length * heroFit.size * 1.12 + 50;

    if (template === "article") {
      const shot = shots[shotIdx++];
      const aid = `shot-${shotIdx}`;
      assets[aid] = { file: shot.file.replace(ROOT + "\\", "").replace(ROOT + "/", "").replace(/\\/g, "/"), width: 1000, height: 1100, credit: `Screenshot: ${shot.domain}`, source_url: shot.url, license: "editorial screenshot of a cited source" };
      const span = Math.max(1, outF - inF);
      const rect = { x: 170, y: Math.round(top), w: 740, h: 814 };
      layers.push({ id: `scene-${scene.index}-image`, type: "image", asset_id: aid, rect, in: inF, out: outF, z: z++, props: { opacity: 1, scale: 1 }, keyframes: { opacity: [{ f: 0, v: 0, e: "outCubic" }, { f: 8, v: 1 }, { f: span, v: 1 }], scale: [{ f: 0, v: 1, e: "linear" }, { f: span, v: 1.09 }] } });
      layers.push(stroke(`${id}-frame`, `M${rect.x} ${rect.y} L${rect.x + rect.w} ${rect.y} L${rect.x + rect.w} ${rect.y + rect.h} L${rect.x} ${rect.y + rect.h} Z`, { color: P.accent, width: 4, inF, outF, z: z++ }));
      layers.push(text(`${id}-domain`, `SOURCE: ${shot.domain.toUpperCase()}`, { y: rect.y + rect.h + 24, size: 30, color: P.muted, inF, outF, z: z++, font: SANS, slide: 10 }));
    } else if (template === "diagram") {
      const nodes = (p.nodes || []).slice(0, 3).map((n) => String(n).toUpperCase());
      while (nodes.length < 3) nodes.push("");
      const cy = 960, xs = [200, 540, 880], r = 78;
      for (let i = 0; i < 2; i++) layers.push(stroke(`${id}-conn${i}`, `M${xs[i] + r} ${cy} L${xs[i + 1] - r} ${cy}`, { color: P.stroke, width: 5, inF, outF, z: z++, delay: 6 + i * 10 }));
      nodes.forEach((label, i) => {
        const cx = xs[i];
        layers.push(stroke(`${id}-node${i}`, `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx} ${cy + r} A${r} ${r} 0 1 1 ${cx} ${cy - r} Z`, { color: i === 1 ? P.accent : P.text, width: 5, fill: P.surface, inF, outF, z: z++, delay: i * 10, drawFrames: 12 }));
        if (!label) return;
        const f = fit(label, { maxW: 280, maxLines: 2, max: 36, min: 24 });
        if (f) layers.push(text(`${id}-label${i}`, f.text, { x: cx - 150, w: 300, y: cy + r + 24, size: f.size, weight: 800, color: i === 1 ? P.accent : P.text, inF: inF + i * 10, outF, z: z++, font: SANS, slide: 0 }));
      });
    } else if (template === "compare") {
      const sides = [["left", 90], ["right", 570]];
      const y0 = Math.round(top + 60);
      layers.push(stroke(`${id}-divider`, `M540 ${y0} L540 ${y0 + 640}`, { color: P.stroke, width: 4, inF, outF, z: z++ }));
      for (const [side, x] of sides) {
        const data = p[side] || {};
        const tf = fit(String(data.title || "").toUpperCase(), { maxW: 400, maxLines: 2, max: 60, min: 32 });
        if (tf) layers.push(text(`${id}-${side}-title`, tf.text, { x, w: 420, y: y0, size: tf.size, weight: 800, color: side === "left" ? P.text : P.accent, inF, outF, z: z++, font: SANS }));
        (data.points || []).slice(0, 2).forEach((pt, i) => {
          if (!groundedNumbers(pt, corpus)) return;
          const f = fit(String(pt), { maxW: 400, maxLines: 3, max: 44, min: 30 });
          if (f) layers.push(text(`${id}-${side}-pt${i}`, f.text, { x, w: 420, y: y0 + 200 + i * 210, size: f.size, weight: 500, color: P.text, inF: inF + 10 + i * 10, outF, z: z++, font: SANS, slide: 20 }));
        });
      }
    } else if (template === "bars") {
      const bars = p.bars.slice(0, 4), max = Math.max(...bars.map((b) => Number(b.value)));
      const y0 = Math.round(top + 80);
      bars.forEach((b, i) => {
        const y = y0 + i * 190, width = Math.max(60, Math.round((Number(b.value) / max) * 800));
        const f = fit(String(b.label), { maxW: 900, maxLines: 1, max: 40, min: 28 });
        if (f) layers.push(text(`${id}-bar${i}-label`, f.text, { y, size: f.size, align: "left", color: P.muted, weight: 600, inF, outF, z: z++, font: SANS, slide: 0 }));
        layers.push(stroke(`${id}-bar${i}`, `M90 ${y + 90} L${90 + width} ${y + 90}`, { color: i === 0 ? P.accent : P.text, width: 40, inF, outF, z: z++, delay: 6 + i * 8, drawFrames: 20 }));
        layers.push(text(`${id}-bar${i}-value`, String(b.value), { x: 690, w: 300, y: y - 6, size: 44, weight: 800, align: "left", color: P.text, inF: inF + 16 + i * 8, outF, z: z++, font: SANS, slide: 0 }));
      });
    } else {
      const lines = (p.lines || []).slice(0, 5).map((l) => String(l).slice(0, 36));
      const tx = 110, ty = Math.round(top + 20), tw = W - 220, th = 110 + lines.length * 62;
      layers.push(solid(`${id}-term`, { x: tx, y: ty, w: tw, h: th, background: P.terminal, inF, outF, z: z++ }));
      layers.push(solid(`${id}-termhead`, { x: tx, y: ty, w: tw, h: 46, background: P.surface, inF, outF, z: z++ }));
      layers.push(stroke(`${id}-termline`, `M${tx} ${ty + th} L${tx + tw} ${ty + th}`, { color: P.accent, width: 4, inF, outF, z: z++ }));
      lines.forEach((l, i) => {
        if (!groundedNumbers(l, corpus)) return;
        const lf = fit(l, { maxW: tw - 90, maxLines: 1, max: 34, min: 22, mono: true });
        if (lf) layers.push(text(`${id}-line${i}`, lf.text, { x: tx + 44, w: tw - 80, y: ty + 76 + i * 62, size: lf.size, weight: 400, align: "left", color: i === 0 ? P.accent : P.text, inF: inF + 10 + i * 10, outF, z: z++, font: MONO, slide: 0, mono: true }));
      });
      layers.push(text(`${id}-illustrative`, "ILLUSTRATIVE", { y: ty + th + 24, size: 28, color: P.muted, inF, outF, z: z++, font: SANS, slide: 0, tracking: 0.16 }));
    }
  }
  return { layers, assets };
}

export async function buildAiTested({ channel, topic, script, narration, research, dir, productionId }) {
  const { words, scenes } = scenesFromWords(narration.words);
  const durationS = Math.min(30, Math.ceil(narration.seconds + 0.6));
  const durationF = sec(durationS);
  const ch = channelStyle(channel.id);
  const P = { bg: ch.colors.bg, accent: ch.colors.accent, text: "#FFFFFF", muted: "#9CA3AF", surface: ch.colors.secondary, stroke: "#C8C8CB", terminal: ch.colors.primary };
  const researchData = readJson(research);
  const scriptData = readJson(script.scriptPath);
  const urls = [...new Set([...(scriptData.sources_used || []), ...(researchData.key_facts || []).map((f) => f.source_url)].filter((u) => /^https?:/.test(u)))];
  const shots = await screenshotSources(urls, topic.topic, dir);
  if (!shots.length) throw new StageError("assets", "no cited page produced a usable screenshot; the article highlight has no real source to show");

  const plan = await askJson(planPrompt(scenes, scriptData, researchData, true), "autopilot-visual-plan");
  writeJson(join(dir, "visual-plan.json"), plan);
  const corpus = JSON.stringify(researchData) + JSON.stringify(scriptData);
  // The gate needs a moving real image, so a plan that left the screenshots unused gets the first eligible non-hook scene.
  if (!plan.scenes?.some((s) => s.template === "article")) {
    const s = plan.scenes.find((x) => Number(x.index) > 0);
    if (s) s.template = "article";
  }
  const { layers, assets } = buildLayers(plan.scenes, scenes, durationF, P, shots, corpus);
  layoutCheck(layers, "layout");

  const timeline = {
    version: 1, id: topic.slug, title: `AI Tested: ${topic.topic}`, production_id: productionId, channel_id: `ch-${channel.id.padStart(2, "0")}`,
    width: W, height: H, fps: FPS, durationInFrames: durationF, palette: P, fonts: { primary: SANS, mono: MONO }, assets,
    layers: stripForRender(layers), captions: captions(words), caption_style: { x: 90, y: 1560, w: W - 180, h: 200, size: 48 },
    scenes: scenes.map((s) => ({ id: `s${s.index}`, start: s.from, end: s.to ?? durationS })),
    metadata: { generated_at: new Date().toISOString(), topic_slug: topic.slug, topic: topic.topic, source_script: script.scriptRel, source_audio: narration.mp3, scene_count: scenes.length, duration_s: durationS },
  };
  const timelinePath = join(dir, "timeline.json");
  writeJson(timelinePath, timeline);
  const manifest = {
    assets: Object.entries(assets).map(([asset_id, a]) => ({ asset_id, source_url: a.source_url, sha256: sha256File(join(ROOT, a.file)), bytes: statSync(join(ROOT, a.file)).size, scene_beat_assignment: "article highlight", reason_relevant: `Screenshot of a source cited for ${topic.topic}`, subject: a.credit, label: a.credit })),
    relevance_gate_result: { missing_photo_replaced_by_unrelated_image: false },
  };
  writeJson(join(dir, "asset-manifest.json"), manifest);
  return { timelinePath, audioPath: narration.mp3, manifestPath: join(dir, "asset-manifest.json"), credits: shots.map((s) => s.url) };
}
