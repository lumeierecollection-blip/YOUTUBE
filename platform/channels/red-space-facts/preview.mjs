// Red Space Facts preview: "Saturn is losing its rings". Runs on GitHub (channel-preview.yml), never locally.
import { execFileSync } from "node:child_process";
import { copyFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { narrate } from "../../production/index.mjs";
import { runQa } from "./qa.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(readFileSync(join(here, "sample.json"), "utf8"));
const channel = JSON.parse(readFileSync(join(here, "channel.json"), "utf8"));
const FPS = 30, MAX_S = 30, GAP_S = 0.22, LEAD_S = 0.12, TAIL_S = 0.5, MAX_RATE = 0;
const SCENE_IDS = ["s1", "s2", "s3", "s4", "s5", "s6"];

const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args], { stdio: "inherit" });

const STYLE = "Lively and upbeat, a little quicker than conversational, with clear articulation. Confident documentary narration for a YouTube Short.";

/** The whole script is voiced once at the voice's own pace. A take that runs long is voiced again; the speed is never changed. */
async function voiceAll(outDir) {
  const text = SCENE_IDS.map((id) => sample.scenes.find((s) => s.scene_id === id).narration).join(" ");
  let n = null;
  for (let take = 1; take <= 3; take++) {
    n = await narrate({ text, edgeVoice: channel.voice.tts_voice, outDir, name: "voice-track", style: STYLE });
    console.log(`voice take ${take}: ${n.seconds.toFixed(2)}s, ${n.wpm} wpm`);
    if (n.seconds + TAIL_S <= MAX_S - 0.3) break;
  }
  if (n.sentences.length !== SCENE_IDS.length) throw new Error(`voice produced ${n.sentences.length} sentences for ${SCENE_IDS.length} scenes`);
  if (n.seconds + TAIL_S > MAX_S - 0.3) throw new Error(`narration is ${n.seconds.toFixed(2)}s at natural speed; cut words, never speed the voice`);
  return n;
}

export default async function preview({ key, runId, tools }) {
  tools.write("story-outline.md", `# ${sample.topic}\n\n${sample.blueprint.central_question}\n\n${sample.blueprint.thesis}\n\n${sample.blueprint.beats.map((b) => `- ${b.beat_id} (${b.role}): ${b.purpose}`).join("\n")}\n\nConclusion: ${sample.blueprint.conclusion}\n`);
  tools.stage("research_complete", "ok", { sources: sample.sources.length });
  tools.stage("blueprint_complete", "ok");

  const narr = await voiceAll(tools.outDir);
  const rate = 0;
  const voices = narr.sentences.map((s, i) => ({ id: SCENE_IDS[i], dur: s.end - s.start, text: sample.scenes.find((x) => x.scene_id === SCENE_IDS[i]).narration, start: s.start }));
  tools.write("script-draft.md", `# Script draft (PROVISIONAL narration, hand-planned, not from the script engine)\n\nVoice: ${narr.engine}, natural pace ${narr.wpm} wpm, playback speed ${narr.playback_speed}.\n\n${sample.scenes.map((s) => `**${s.scene_id}** (${s.treatment}): ${s.narration}`).join("\n\n")}\n`);
  tools.stage("script_complete", "ok");
  tools.stage("script_approved", "pending", { note: "provisional narration awaiting the script engine" });

  // Scene i starts when its narration starts, read from the measured words.
  const totalS = Math.ceil((narr.seconds + TAIL_S) * FPS) / FPS;
  const timing = voices.map((v, i) => ({ id: v.id, start_s: i === 0 ? 0 : v.start, end_s: i + 1 < voices.length ? voices[i + 1].start : totalS, voice_s: v.dur, text: v.text }));
  const frames = Math.round(totalS * FPS);
  const sceneFrames = timing.map((t, i) => ({ id: t.id, from: Math.round(t.start_s * FPS), dur: Math.round(t.end_s * FPS) - Math.round(t.start_s * FPS) }));
  const audio = join(tools.outDir, "voice-preview.mp3");
  copyFileSync(narr.mp3, audio);
  tools.write("narration.json", { engine: narr.engine, seconds: narr.seconds, wpm: narr.wpm, playback_speed: narr.playback_speed, notes: narr.notes });
  tools.stage("voice_complete", "ok", { engine: narr.engine, wpm: narr.wpm });

  const narration = Object.fromEntries(timing.map((t) => [t.id, t.text]));
  const planScenes = sample.scenes.map((s, i) => ({
    scene_id: s.scene_id, narration: s.narration, main_point: s.main_point, visual_objective: s.visual_objective, treatment: s.treatment,
    background: s.scene_id === "s4" ? "white (explanatory graphic)" : "space (3D scene)",
    skill: "Three.js via @remotion/three (provisional SOLSYS stand-in), channels/red-space-facts/compositions.jsx",
    assets: [
      ...(["s1", "s3", "s5", "s6"].includes(s.scene_id) ? [{ id: "saturn-texture", origin: "NASA 3D Resources, Images and Textures/Saturn/Saturn.jpg", licence: "NASA material; not reviewed or endorsed by NASA", source_url: "https://github.com/nasa/NASA-3D-Resources/tree/master/Images%20and%20Textures/Saturn" }] : []),
      { id: "figures", origin: "NASA NSSDC fact sheets", source_url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/" },
    ],
    animation: "real-time 3D camera and object motion rendered per frame",
    on_screen_text: s.on_screen_text, claim_ids: s.claim_ids,
    data_sources: [...new Set(sample.claims.filter((c) => s.claim_ids.includes(c.claim_id)).map((c) => c.source_url))],
    transition: "6-frame fade", start_s: timing[i].start_s, end_s: timing[i].end_s,
  }));
  tools.write("scene-plan.json", { channel: key, production_run: runId, format: "short", scenes: planScenes });
  tools.write("claims.json", sample.claims);
  tools.stage("visual_complete", "ok");

  const video = tools.renderComposition({ id: "RedSpaceSaturnShort", props: { scenes: sceneFrames, narration }, output: "preview.mp4", audio, durationInFrames: frames });
  tools.stage("render_complete", "ok");

  await tools.contactSheet({ video, scenes: timing.map((t, i) => ({ id: t.id, start_s: t.start_s, end_s: t.end_s, treatment: sample.scenes[i].treatment, objective: sample.scenes[i].visual_objective })) });
  const qa = await runQa({ tools, video, timing, sample, rate, maxRate: MAX_RATE, maxSeconds: MAX_S, expectedFrames: frames });
  tools.stage(qa.passed ? "qa_passed" : "blocked", qa.passed ? "ok" : "failed", { failures: qa.failures });
  if (!qa.passed) throw new Error(`QA failed: ${qa.failures.join("; ")}`);
  tools.stage("preview_ready", "ok", { duration_s: qa.duration_s, narration: "provisional" });
}
