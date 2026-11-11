/**
 * One path for a directly scripted Short: the script is given, the voice is generated once at its own pace,
 * and everything else (timeline, render, frames, QA) comes from the measured voice. Used by channels whose
 * script was written by hand from fetched sources, so each of them is marked as NOT reviewed by the script
 * engine's independent critic. It never speeds the voice up; a take that runs long is voiced again.
 */
import { assertHashtags } from "./hashtags.mjs";
import { buildTimeline, FPS, narrate, publishFrames, technicalQa } from "./index.mjs";
import { mixMusic } from "./mix.mjs";

export async function runFixedShort({ key, runId, tools, spec }) {
  const { topic, claims, sources = [], compositionId, makeProps, edgeVoice, style, metadata, minSeconds = 20, maxSeconds = 30, writtenBy = "written directly on the owner's instruction from fetched sources" } = spec;
  let { sentences, scenes } = spec;
  const note = { approved_by: "not reviewed by the engine critic", written_by: writtenBy, independent_provider: false };

  tools.write("claims.json", claims);
  tools.write("script-package.json", { channel: key, production_run: runId, topic, format: "short", sentences, sources, claims, quality_report: note });
  tools.write("script-final.md", [`# ${topic}`, "", `> ${note.approved_by}. ${note.written_by}.`, "", ...sentences.map((s, i) => `${i + 1}. ${s.text}  \n   claims: ${(s.claim_ids || []).join(", ") || "none"}`), "", "## Sources", ...sources.map((s) => `- ${s.url}`), ""].join("\n"));
  for (const st of ["research_complete", "blueprint_complete", "script_complete"]) tools.stage(st, "ok");
  tools.stage("script_approved", "pending", { note: note.approved_by });

  const known = new Set(claims.map((c) => c.claim_id));
  const orphan = sentences.filter((s) => !(s.claim_ids || []).length && s.allow_no_claim !== true).map((s) => s.text);
  const unknown = sentences.flatMap((s) => (s.claim_ids || []).filter((id) => !known.has(id)));
  if (unknown.length) throw new Error(`script cites claims that do not exist: ${unknown.join(", ")}`);
  if (orphan.length) throw new Error(`sentences without a claim record: ${orphan.join(" | ")}`);

  let narration = null;
  // The voice's pace varies a little between takes. If every take misses the window, `spec.refit(measuredWpm)` may supply a script re-fitted to the
  // pace actually measured; the voice is never sped up.
  for (let pass = 1; ; pass++) {
    const text = sentences.map((s) => s.text).join(" ");
    for (let take = 1; take <= 3; take++) {
      narration = await narrate({ text, edgeVoice, outDir: tools.outDir, name: "voice-track", style, gravity: spec.gravity || null, voice: spec.voice || null });
      console.log(`voice take ${take}: ${narration.seconds.toFixed(2)}s, ${narration.wpm} wpm, ${narration.engine}`);
      if (narration.seconds >= minSeconds && narration.seconds <= maxSeconds - 0.75) break;
    }
    if (narration.seconds >= minSeconds && narration.seconds <= maxSeconds - 0.75) break;
    if (!spec.refit || pass >= 3) throw new Error(`narration is ${narration.seconds.toFixed(2)}s at natural speed (allowed ${minSeconds} to ${maxSeconds - 0.75}s); change the script, never the speed`);
    ({ sentences, scenes } = spec.refit(narration.wpm));
    console.log(`script refitted to the measured ${narration.wpm} wpm: ${sentences.length} sentences`);
  }
  if (narration.sentences.length !== sentences.length) throw new Error(`voice produced ${narration.sentences.length} sentences for ${sentences.length} script sentences; use exactly one sentence-ending mark per sentence`);
  tools.write("narration.json", { engine: narration.engine, seconds: narration.seconds, wpm: narration.wpm, playback_speed: narration.playback_speed, notes: narration.notes });
  tools.stage("voice_complete", "ok", { engine: narration.engine, wpm: narration.wpm });

  const timeline = buildTimeline({ narration, sceneOfSentence: sentences.map((s) => s.scene), sceneMeta: scenes.map((m, i) => ({ id: `s${i + 1}`, ...m })) });
  tools.write("timeline.json", timeline);
  tools.write("scene-plan.json", { channel: key, production_run: runId, format: "short", scenes: timeline.scenes.map((s, i) => ({ scene_id: s.id, narration: sentences.filter((x) => x.scene === i).map((x) => x.text).join(" "), main_point: s.objective, visual_objective: s.objective, treatment: s.treatment, background: s.background || "white", skill: s.skill || "remotion", claim_ids: [...new Set(sentences.filter((x) => x.scene === i).flatMap((x) => x.claim_ids || []))], start_s: s.start_s, end_s: s.end_s })) });
  tools.stage("visual_complete", "ok");

  const extra = makeProps ? await makeProps({ timeline, narration }) : {};
  // Optional original music, ducked under the voice. The voice track stays the timing authority.
  const mixed = spec.music ? mixMusic({ narration, timeline, outDir: tools.outDir, mood: spec.music.mood, level: spec.music.level }) : null;
  const video = tools.renderComposition({ id: compositionId, props: { durationInFrames: timeline.durationInFrames, scenes: timeline.scenes, captions: timeline.captions, ...extra }, audio: mixed ? mixed.file : narration.mp3, durationInFrames: timeline.durationInFrames });
  tools.stage("render_complete", "ok");
  await publishFrames({ tools, video, timeline, objectiveOf: (s) => s.objective });

  const qa = technicalQa({ video, narration, timeline, minSeconds: Math.min(minSeconds, 20), maxSeconds });
  tools.write("qa-report.json", { ...qa, fps: FPS, narration: { engine: narration.engine, seconds: narration.seconds, wpm: narration.wpm, playback_speed: narration.playback_speed }, script: note, scenes: timeline.scenes.map((s) => ({ id: s.id, kind: s.kind, start_s: s.start_s, end_s: s.end_s })) });
  if (!qa.pass) { tools.stage("blocked", "failed", { issues: qa.failures.join("; ") }); throw new Error(`QA failed: ${qa.failures.join("; ")}`); }
  tools.stage("qa_passed", "ok");
  tools.stage("preview_ready", "ok");
  if (metadata) { assertHashtags(metadata.description); tools.write("delivery.json", metadata); }
  tools.stage("awaiting_approval", "ok");
  return { video, narration, timeline, qa };
}
