// Red Space Facts preview: "Saturn is losing its rings". Runs on GitHub (channel-preview.yml), never locally.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runQa } from "./qa.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(readFileSync(join(here, "sample.json"), "utf8"));
const channel = JSON.parse(readFileSync(join(here, "channel.json"), "utf8"));
const FPS = 30, MAX_S = 30, GAP_S = 0.22, LEAD_S = 0.12, TAIL_S = 0.5, MIN_SCENE_S = 2.2, MAX_RATE = 8;
const SCENE_IDS = ["s1", "s2", "s3", "s4", "s5", "s6"];

const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args], { stdio: "inherit" });

/** Voice every scene at one rate. The voice is never sped past +MAX_RATE%: words get cut instead. */
function voiceAll(tools, rate) {
  const files = SCENE_IDS.map((id) => {
    const sc = sample.scenes.find((s) => s.scene_id === id);
    return { id, file: tools.voice({ text: sc.narration, voice: channel.voice.tts_voice, output: `vo-${id}.mp3`, rate: `+${rate}%` }), text: sc.narration };
  });
  files.forEach((f) => { f.dur = tools.durationOf(f.file); });
  return files;
}

export default async function preview({ key, runId, tools }) {
  tools.write("story-outline.md", `# ${sample.topic}\n\n${sample.blueprint.central_question}\n\n${sample.blueprint.thesis}\n\n${sample.blueprint.beats.map((b) => `- ${b.beat_id} (${b.role}): ${b.purpose}`).join("\n")}\n\nConclusion: ${sample.blueprint.conclusion}\n`);
  tools.stage("research_complete", "ok", { sources: sample.sources.length });
  tools.stage("blueprint_complete", "ok");

  let rate = 0, voices;
  for (const r of [0, 4, 8]) {
    rate = r;
    voices = voiceAll(tools, r);
    const total = LEAD_S + voices.reduce((a, v) => a + Math.max(MIN_SCENE_S, v.dur + GAP_S), 0) + TAIL_S;
    console.log(`rate +${r}%: voice ${voices.map((v) => v.dur.toFixed(2)).join(" ")} total ${total.toFixed(2)}s`);
    if (total <= MAX_S - 0.4) break;
    if (r === MAX_RATE) {
      tools.stage("blocked", "failed", { reason: `narration does not fit ${MAX_S}s at +${MAX_RATE}%; cut words` });
      throw new Error("narration too long: cut words, do not speed past +8%");
    }
  }
  tools.write("script-draft.md", `# Script draft (PROVISIONAL narration, hand-planned, not from the script engine)\n\nVoice: ${channel.voice.tts_voice}, rate +${rate}% (limit +${MAX_RATE}%).\n\n${sample.scenes.map((s) => `**${s.scene_id}** (${s.treatment}): ${s.narration}`).join("\n\n")}\n`);
  tools.stage("script_complete", "ok");
  tools.stage("script_approved", "pending", { note: "provisional narration awaiting the script engine" });

  // Scene i starts when its narration starts.
  let cursor = LEAD_S;
  const timing = voices.map((v) => {
    const len = Math.max(MIN_SCENE_S, v.dur + GAP_S);
    const t = { id: v.id, start_s: cursor, end_s: cursor + len, voice_s: v.dur, text: v.text };
    cursor += len;
    return t;
  });
  const totalS = cursor + TAIL_S;
  timing[0].start_s = 0;
  timing[timing.length - 1].end_s = totalS;
  const frames = Math.round(totalS * FPS);
  const sceneFrames = timing.map((t) => ({ id: t.id, from: Math.round(t.start_s * FPS), dur: 0 }));
  sceneFrames.forEach((s, i) => { const end = i + 1 < sceneFrames.length ? sceneFrames[i + 1].from : frames; s.dur = end - s.from; });

  // One audio track: each clip padded to its scene length; the first carries the short lead.
  const inputs = voices.flatMap((v) => ["-i", v.file]);
  const lead = Math.round(LEAD_S * 1000);
  const filt = voices.map((v, i) => `[${i}:a]${i === 0 ? `adelay=${lead}|${lead},` : ""}apad=whole_dur=${(sceneFrames[i].dur / FPS).toFixed(3)}[a${i}]`).join(";") + ";" + voices.map((_, i) => `[a${i}]`).join("") + `concat=n=${voices.length}:v=0:a=1[out]`;
  const audio = join(tools.outDir, "voice-preview.mp3");
  ff([...inputs, "-filter_complex", filt, "-map", "[out]", "-ar", "44100", "-b:a", "128k", audio]);
  tools.stage("voice_complete", "ok", { rate: `+${rate}%` });

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
  tools.stage("preview_ready", "ok", { duration_s: qa.duration_s, narration: "provisional" });
}
