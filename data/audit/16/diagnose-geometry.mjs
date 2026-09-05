#!/usr/bin/env node
/**
 * Stage-16 diagnostic — dump the exact beat/shot geometry covering the four
 * FRM-02 failing frames (1463/1706/1950/2191) for the stage-16 script.
 * Mirrors render-frame.mjs's package build (channel 1, debt-snowball script,
 * stage-14 measure SRT/VO) without rendering anything.
 *
 * Output: per beat — start/end frames, strategy, material, framing, camera,
 * depth planes, anchorFrame, phrase, shotFrame() derived rect, and a
 * computed output-space position of every decor y that matters (horizon,
 * ridge bottom, stake bottom, ellipse, headline rows) under the captionDrop
 * transform + camera + far-plane parallax at the beat's settled state.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildMgPackage } from "../../../src/skills/remotion-render/compositions/mg-package.js";
import { chunkTextClauseAware } from "../../../src/skills/remotion-render/compositions/beats.js";
import { narrationSections } from "../../../src/utils/script-narration.js";

// stage.jsx is .jsx — can't import in node. Re-derive shotFrame() here (pure math).
function shotFrameNode(shot) {
  if (!shot) return { x: 0, y: 0, w: 1080, h: 1920, cx: 540, cy: 960 };
  const cov = shot.coverage;
  const w = 1080 * (shot.bleed ? Math.max(cov, 1.05) : cov);
  const h = 1920 * 0.46 * (shot.bleed ? Math.max(cov, 1.05) : cov);
  const cx = 1080 * shot.anchorX;
  const cy = 1920 * shot.anchorY;
  return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..", "..");
const RENDER_DIR = join(ROOT, "src", "skills", "remotion-render");

function loadChannel(channelId) {
  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = data.channels || data;
  const numId = parseInt(channelId, 10);
  return channels.find((c) => c.id === numId || c.channel_id === channelId);
}
function toContentSections(script) {
  const sections = narrationSections(script);
  return sections
    .filter((s) => s.voiceover && s.voiceover.trim())
    .map((s) => ({
      id: s.id, timing: s.timing, voiceover: s.voiceover,
      content: chunkTextClauseAware(s.voiceover),
      visualCue: s.visual_cue || null, bRoll: Array.isArray(s.b_roll) ? s.b_roll : null,
      textOverlay: s.text_overlay || null, animationCue: s.animation_cue || null,
      transitionOut: s.transition_out || null, beats: Array.isArray(s.beats) ? s.beats : null,
    }));
}

const channel = loadChannel("1");
const script = JSON.parse(readFileSync(join(ROOT, "data", "research", "1", "debt-snowball-vs-debt-avalanche-shorts-script.json"), "utf-8"));
const sections = toContentSections(script);
const srtText = readFileSync(join(ROOT, "data", "audit", "14", "measure", "debt-snowball-shorts-vo.srt"), "utf-8");
const mg = buildMgPackage(srtText, {
  sections,
  hook: script.hook || null,
  channel,
  iconMap: channel.icon_map || null,
  bRollFiles: [],
  imageForSection: () => null,
  totalMs: undefined,
  revealPlacement: channel.script_template && channel.script_template.reveal_placement,
  silenceTechnique: channel.sfx_profile && channel.sfx_profile.silence_technique,
});

const CAPTION_RESERVE_Y = 110;
const SAFE = { top: 288, bottom: 1248, left: 48, right: 888 };
const probe = [1463, 1706, 1950, 2191];

console.log("totalFrames:", mg.totalFrames, "beats:", mg.beats.length);
for (const b of mg.beats) {
  const end = b.startFrame + b.durationInFrames;
  const covers = probe.filter((p) => p >= b.startFrame && p < end);
  const plan = b.visualPlan || {};
  const shot = plan.shot || null;
  let f = { w: 1080, h: 1920, cx: 540, cy: 960 };
  if (shot) {
    f = shotFrameNode(shot);
  }
  const cam = shot && shot.camera ? shot.camera : null;
  const camAt0 = cam ? { scale: cam.from.scale, dx: cam.from.x * 1080, dy: cam.from.y * 1920 } : { scale: 1, dx: 0, dy: 0 };
  const camAt1 = cam ? { scale: cam.to.scale, dx: cam.to.x * 1080, dy: cam.to.y * 1920 } : { scale: 1, dx: 0, dy: 0 };
  const far = shot ? (shot.planes || []).find((p) => p.name === "far") : null;
  const farOffY_1 = cam ? ((cam.to.y - cam.from.y) * 1920) * ((far ? far.parallax : 1) - 1) : 0;
  const subjOffY_1 = cam ? ((cam.to.y - cam.from.y) * 1920) * (1 - 1) : 0;
  const outY = (designY, camState, offY) => {
    const { scale, dy } = camState;
    return (designY - 960) * scale + 960 + dy + offY + CAPTION_RESERVE_Y;
  };
  const pad = (s, n) => String(s).padEnd(n);
  console.log("---");
  console.log(pad(`beat start=${b.startFrame} end=${end}`, 30), "covers:", covers.join(",") || "-");
  console.log(pad(`  archetype=${b.archetype}`, 30), `strategy=${plan.strategy || "?"}`);
  console.log(`  material=${shot && shot.material} framing=${shot && shot.framing && shot.framing.id} (anchor ${shot && shot.anchorX},${shot && shot.anchorY} cov ${shot && shot.coverage}) variant=${plan.variant}`);
  console.log(`  camera=${cam && cam.id} from(${cam && cam.from.scale},${cam && cam.from.x},${cam && cam.from.y}) to(${cam && cam.to.scale},${cam && cam.to.x},${cam && cam.to.y})`);
  console.log(`  planes=${shot && shot.planes.map((p) => `${p.name}:${p.parallax}`).join(" ")}`);
  console.log(`  shotFrame: w=${f.w.toFixed(0)} h=${f.h.toFixed(0)} cx=${f.cx.toFixed(0)} cy=${f.cy.toFixed(0)}`);
  const horizon = 1920 * 0.6; // ATMOSPHERE_HORIZON_Y
  console.log(`  horizon(design)=${horizon}`);
  console.log(`    ridge bottom output @ e=0: ${outY(horizon, camAt0, 0).toFixed(1)}   @ e=1(far): ${outY(horizon, camAt1, farOffY_1).toFixed(1)}`);
  console.log(`    subject-decor output   @ e=0: ${outY(horizon, camAt0, 0).toFixed(1)}   @ e=1: ${outY(horizon, camAt1, subjOffY_1).toFixed(1)}`);
  const phrase = plan.supporting && plan.supporting.phrase || "(none)";
  console.log(`  phrase="${phrase}"  anchorFrame=${b.anchorFrame} (local ${b.anchorFrame - b.startFrame})`);
  const stakeH = Math.max(90, f.h * 0.2);
  const stakeTop = horizon - stakeH;
  const textBottom = 1920 - (stakeTop - 26);
  console.log(`  stakeH=${stakeH.toFixed(1)} stakeTop=${stakeTop.toFixed(1)} textBottom(design)=${textBottom.toFixed(1)}`);
  console.log(`    text bottom output @ e=0: ${outY(textBottom, camAt0, 0).toFixed(1)}  @ e=1: ${outY(textBottom, camAt1, subjOffY_1).toFixed(1)}`);
}