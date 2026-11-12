/**
 * One path for a long-form (16:9) video, beside the Shorts path (fixed-short.mjs), never replacing it:
 * gate the script against its channel format -> voice each chapter at its natural pace -> one timeline -> render 1920x1080 -> real-frame
 * contact sheet per chapter -> technical QA on the MP4 -> thumbnail -> YouTube chapters and metadata. Everything is written into the run folder.
 * A failed gate or QA stops the run; nothing here uploads.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { buildTimeline, FPS, technicalQa } from "../production/index.mjs";
import { checkLongScript, loadFormats } from "./script-gate.mjs";
import { flattenScenes, narrateChapters, youtubeChapters } from "./assemble.mjs";

export async function runLongform({ key, runId, tools, spec }) {
  const { pkg, compositionId, makeProps, metadata, edgeVoice, gravity = "serious", voice = null, thumbnail = null, renderMinutes = 240 } = spec;
  const formats = spec.formats || loadFormats(), fmt = formats.channels[key];

  // 1. The script gate. A pilot may pass its own formats (shorter windows) and says so in the record.
  const gate = checkLongScript({ ...pkg, channel: key }, formats);
  tools.write("long-script.json", pkg);
  tools.write("script-gate.json", { ...gate, pilot: Boolean(spec.formats), format: fmt });
  tools.write("script-final.md", [`# ${pkg.title}`, "", `Central question: ${pkg.central_question}`, "", ...pkg.chapters.flatMap((c, i) => [`## ${i + 1}. ${c.title}`, "", ...c.sentences.map((s) => `${s.text}${s.quote ? ` [quote: ${s.quote.speaker}]` : ""}  \n  claims: ${(s.claim_ids || []).join(", ") || `none (${s.editorial || "?"})`}`), ""]), "## Sources", ...(pkg.sources || []).map((s) => `- ${s.url}`)].join("\n"));
  if (!gate.ok) { tools.stage("blocked", "failed", { issues: gate.errors.slice(0, 6).join("; ") }); throw new Error(`script gate: ${gate.errors.join(" | ")}`); }
  for (const st of ["research_complete", "blueprint_complete", "script_complete", "script_approved"]) tools.stage(st, "ok", st === "script_approved" ? { note: "passed the long-form script gate; not reviewed by a person" } : {});

  // 2. Voice per chapter, joined onto one clock.
  const { scenes, sceneOfSentence } = flattenScenes(pkg.chapters);
  const narration = await narrateChapters({ chapters: pkg.chapters, outDir: tools.outDir, edgeVoice, gravity, voice, gap: formats.shared.gap_between_chapters_s });
  const minutes = narration.seconds / 60;
  tools.write("narration.json", { engine: narration.engine, seconds: narration.seconds, wpm: narration.wpm, playback_speed: 1, chapter_starts_s: narration.chapterStarts, notes: narration.notes });
  tools.stage("voice_complete", "ok", { engine: narration.engine, minutes: +minutes.toFixed(1), wpm: narration.wpm });

  // 3. Timeline (same builder as Shorts), chapters on it, scene plan.
  const timeline = buildTimeline({ narration, sceneOfSentence, sceneMeta: scenes, tail: 1.2, maxWordsPerCaption: 7 });
  const chapterMarks = pkg.chapters.map((c, i) => ({ title: c.title, from: Math.round(narration.chapterStarts[i] * FPS) }));
  tools.write("timeline.json", { ...timeline, chapters: chapterMarks });
  tools.write("scene-plan.json", { channel: key, production_run: runId, format: "long", scenes: timeline.scenes.map((s) => ({ scene_id: s.id, chapter: s.chapter_title, treatment: s.treatment, visual_objective: s.objective, start_s: s.start_s, end_s: s.end_s })) });
  tools.stage("visual_complete", "ok", { scenes: timeline.scenes.length });

  // 4. Render 1920x1080.
  const extra = makeProps ? await makeProps({ timeline, narration, chapters: chapterMarks }) : {};
  const video = tools.renderComposition({ id: compositionId, props: { durationInFrames: timeline.durationInFrames, scenes: timeline.scenes, captions: timeline.captions, chapters: chapterMarks, ...extra }, audio: narration.mp3, durationInFrames: timeline.durationInFrames, timeoutMinutes: renderMinutes });
  tools.stage("render_complete", "ok");

  // 5. Real frames: one per chapter (mid-chapter) on the contact sheet.
  const ends = [...narration.chapterStarts.slice(1), narration.seconds];
  await tools.contactSheet({ video, scenes: pkg.chapters.map((c, i) => ({ id: `ch${i + 1}`, start_s: narration.chapterStarts[i], end_s: ends[i], treatment: c.scenes[0]?.treatment || "", objective: c.title })) });

  // 6. QA on the MP4 against the channel's long-form window.
  const [lo, hi] = (spec.formats || formats).channels[key].minutes;
  const qa = technicalQa({ video, narration, timeline, minSeconds: lo * 60, maxSeconds: hi * 60 + 30, size: [formats.frame.width, formats.frame.height] });
  tools.write("qa-report.json", { ...qa, format: "long", minutes: +minutes.toFixed(2), gate: gate.stats });
  if (!qa.pass) { tools.stage("blocked", "failed", { issues: qa.failures.join("; ") }); throw new Error(`QA failed: ${qa.failures.join("; ")}`); }
  tools.stage("qa_passed", "ok");

  // 7. Thumbnail: a one-frame render of the channel's thumbnail composition, saved as a 1280x720 JPEG.
  if (thumbnail) {
    const t = tools.renderComposition({ id: thumbnail.compositionId, props: thumbnail.props || {}, output: "thumbnail.mp4", durationInFrames: 1 });
    spawnSync("ffmpeg", ["-y", "-v", "error", "-i", t, "-frames:v", "1", "-vf", "scale=1280:720", "-q:v", "2", join(tools.outDir, "thumbnail.jpg")]);
  }

  // 8. Metadata with YouTube chapters.
  const chaptersText = youtubeChapters(pkg.chapters, narration.chapterStarts, narration.seconds);
  if (metadata) tools.write("delivery.json", { ...metadata, description: `${metadata.description}\n\nChapters\n${chaptersText}`, chapters: chaptersText, format: "long", duration_s: +narration.seconds.toFixed(1) });
  copyFileSync(narration.mp3, join(tools.outDir, "voice-preview.mp3"));
  tools.stage("preview_ready", "ok");
  tools.stage("awaiting_approval", "ok");
  return { video, narration, timeline, qa, gate };
}
