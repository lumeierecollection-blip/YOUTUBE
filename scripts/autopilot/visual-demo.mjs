#!/usr/bin/env node
/** Demonstration only: renders fixtures through the real builders and gates. It cannot upload. */
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT, channelConfig, durationOf, must, readJson, run, workDir, writeJson } from "./lib.mjs";
import { FPS, H, W, captions, channelStyle, paletteFor, paperBackground, solid, stripForRender, text } from "./visual-common.mjs";
import { BUILDERS, makeContext } from "./visual-vocabulary.mjs";

const target = process.argv[2];
const out = join(ROOT, "output/visual-demo", target === "reel" ? "reel" : `ch${target}`);
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

function sheet(mp4, name, duration, count = 15) {
  const tmp = join(out, "tiles-" + name); mkdirSync(tmp, { recursive: true });
  for (let i = 0; i < count; i++) must("sheet", "ffmpeg", ["-y", "-v", "error", "-ss", ((duration / count) * (i + 0.6)).toFixed(3), "-i", mp4, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "3", join(tmp, `f${String(i).padStart(2, "0")}.jpg`)]);
  must("sheet", "ffmpeg", ["-y", "-v", "error", "-framerate", "1", "-i", join(tmp, "f%02d.jpg"), "-vf", `tile=5x${Math.ceil(count / 5)}`, "-frames:v", "1", "-q:v", "3", join(out, name + ".jpg")]);
  rmSync(tmp, { recursive: true, force: true });
}

const SAMPLES = {
  flow: { headline: "FLOW", steps: ["Connect the model", "Read the data", "Answer the user", "Log the result"] }, hub: { headline: "HUB", center: "The archive", spokes: ["Scribes", "King", "Army", "Temple", "Merchants"] }, stack: { headline: "EXPLODED STACK", layers: ["Application layer", "Protocol", "Data sources", "Hardware"] },
  cause: { headline: "CAUSE", chain: ["Prices rose across the market", "Developers moved workloads", "Margins fell for everyone"] }, timeline: { headline: "TIMELINE", sources: ["https://example.test"], events: [{ date: "1400 BC", label: "The archive was written" }, { date: "2025", label: "First pieces recovered" }, { date: "2026", label: "New tablets announced" }] },
  bars: { headline: "BARS", unit: "test units", sources: ["https://example.test"], prefix: "$", bars: [{ label: "First", value: 1.36 }, { label: "Second", value: 0.68 }, { label: "Third", value: 2.87 }] },
  line: { headline: "LINE", unit: "test units", sources: ["https://example.test"], points: [{ x: "Jan", value: 1 }, { x: "Feb", value: 2 }, { x: "Mar", value: 1.5 }, { x: "Apr", value: 3 }] }, counter: { headline: "COUNTER", value: 3400, suffix: " years", label: "Count-up number with a label", sources: ["https://example.test"] },
  proportion: { headline: "PROPORTION", part: 77.7, total: 100, percent: true, label: "Ring swept to the exact share", sources: ["https://example.test"] }, ranked: { headline: "RANKED", items: ["First name", "Second name", "Third name", "Fourth"], sources: ["https://example.test"] },
  before_after: { headline: "BEFORE AND AFTER", before: { title: "Before", points: ["One connector per source"] }, after: { title: "After", points: ["One open standard"] } }, conclusion: { headline: "A distinct closing line" },
};

async function reel() {
  const { renderEditor } = await import("../../src/skills/remotion-render/render-editor.js");
  for (const [ch, vox, font] of [["2", false, "Space Grotesk"], ["1", true, "Cormorant Garamond"]]) {
    const P = paletteFor(channelStyle(ch)), layers = [], names = Object.keys(SAMPLES), each = 75, durationF = names.length * each; let z = 10;
    layers.push(solid("bg", { x: 0, y: 0, w: W, h: H, background: vox ? paperBackground(P) : P.bg, inF: 0, outF: durationF, z: z++, keyframes: { opacity: [{ f: 0, v: 1 }, { f: durationF, v: 1 }] } }));
    layers.push(text("warn", "LAYOUT TEST: NOT REAL DATA", { y: 130, size: 30, color: P.muted, inF: 0, outF: durationF, z: z++, font, slide: 0 }));
    names.forEach((name, i) => {
      const inF = i * each, outF = inF + each, id = `t${i}`;
      if (name !== "conclusion") layers.push(text(`${id}-h`, SAMPLES[name].headline, { y: 220, size: 60, weight: 800, color: P.text, inF, outF, z: z++, font, slide: 20 }));
      BUILDERS[name](makeContext({ id, inF, outF, top: 340, P, font, nextZ: () => z++, layers, vox }), SAMPLES[name]);
    });
    const dir = workDir(`reel-${ch}`);
    const tl = { version: 1, id: `reel-${ch}`, title: "layout test", width: W, height: H, fps: FPS, durationInFrames: durationF, palette: P, fonts: { primary: font }, assets: {}, layers: stripForRender(layers), captions: [], scenes: [] };
    writeJson(join(dir, "timeline.json"), tl);
    const audio = join(dir, "silence.mp3");
    must("reel", "ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", String(durationF / FPS), "-b:a", "64k", audio]);
    copyFileSync(audio, join(ROOT, "src/skills/remotion-render/vo.mp3"));
    const rel = `data/autopilot-runs/reel-${ch}/reel.mp4`;
    await renderEditor({ timelinePath: join(dir, "timeline.json"), audioPath: audio, outputPath: rel, scale: 1 });
    copyFileSync(join(ROOT, rel), join(out, `reel-ch${ch}.mp4`));
    sheet(join(ROOT, rel), `reel-ch${ch}`, durationF / FPS, 12);
  }
}

async function production(ch) {
  process.env.AUTOPILOT_REPLAY = join(ROOT, `fixtures/visual-demo/replay-${ch}.json`);
  const channel = channelConfig(ch), qa = await import("./qa.mjs"), { narrate } = await import("./script-stage.mjs"), { visualGate } = await import("./visual-gate.mjs");
  const f = ch === "2"
    ? { topic: { topic: "October 2026 LLM API price changes", slug: "llm-api-price-changes-october-2026-report" }, research: "data/research/2/llm-api-price-changes-october-2026-report.json", script: "data/research/2/demo-llm-prices-shorts-script.json" }
    : { topic: { topic: "Hittite royal archive at Kayalipinar", slug: "hittite-cuneiform-tablets-discovery-2026", commons_query: "Hittite Cuneiform Tablet", wikipedia_title: "Hittites" }, research: "data/research/1/hittite-cuneiform-tablets-discovery-2026.json", script: "data/research/1/demo-hittite-shorts-script.json" };
  const stem = f.script.split("/").pop().replace(/\.json$/, ""), researchPath = join(ROOT, f.research);
  const script = { scriptPath: join(ROOT, f.script), scriptRel: f.script, stem };
  const dir = workDir(`visual-demo-ch${ch}`), productionId = `demo-ch${ch}`;
  const narration = narrate({ channel, topic: f.topic, researchPath, script });
  const builder = channel.treatment === "vox" ? (await import("./hidden-past.mjs")).buildHiddenPast : (await import("./ai-tested.mjs")).buildAiTested;
  const built = await builder({ channel, topic: f.topic, script, narration, research: researchPath, dir, productionId });
  const { renderEditor } = await import("../../src/skills/remotion-render/render-editor.js");
  const mp4Rel = `data/autopilot-runs/visual-demo-ch${ch}/final.mp4`, mp4 = join(ROOT, mp4Rel);
  await renderEditor({ timelinePath: built.timelinePath, audioPath: built.audioPath, outputPath: mp4Rel, scale: 1 });
  let vox = null;
  if (channel.treatment === "vox") vox = await (await import("./vox-gate.mjs")).voxGate({ mp4, dir, outDir: join(dir, "vox-frames"), productionId });
  const technical = qa.technicalChecks(mp4);
  const visual = await visualGate({ mp4, inventory: built.inventory, palette: built.palette, dir });
  const videoQa = qa.runVideoQa({ mp4, timelinePath: built.timelinePath, dir, treatment: channel.treatment });
  const acceptance = qa.acceptance({ channel, topic: f.topic, script, narration, mp4, timelinePath: built.timelinePath, manifestPath: built.manifestPath, dir, productionId });
  const summary = { note: "Demonstration. Model answers are replayed from a hand-written plan; frame_review is done by a person, not this script.", duration: durationOf(mp4), technical, visual: { pass: visual.pass, failures: visual.failures, median: visual.median_background_share, adjacent: visual.adjacent }, video_qa: { pass: videoQa.pass, blocking: videoQa.blocking, superseded: videoQa.superseded }, acceptance: { pass: acceptance.pass, failures: acceptance.report.failures }, vox: vox ? { pass: vox.pass, failures: vox.failures, counts: vox.counts, stability: vox.scenes.filter((s) => s.measured.stability).map((s) => ({ scene: s.scene, ...s.measured.stability })) } : null };
  writeJson(join(out, "qa-summary.json"), summary);
  console.log(JSON.stringify(summary).slice(0, 1500));
  copyFileSync(mp4, join(out, "final.mp4"));
  for (const n of ["visual-inventory.json", "visual-gate.json", "video-qa.json", "acceptance.json", "timeline.json", "asset-manifest.json"]) if (existsSync(join(dir, n))) copyFileSync(join(dir, n), join(out, n));
  if (existsSync(join(dir, "vox-frames"))) cpSync(join(dir, "vox-frames"), join(out, "vox-frames"), { recursive: true });
  sheet(mp4, "contact-sheet", durationOf(mp4));
}

if (target === "reel") await reel(); else await production(target);
