/**
 * A1 runner — turns each frozen fixture into the inputs both components need, then runs
 * each component independently and records raw scores + rationale + which model answered.
 *
 * Why a video and not a PNG: gemini-frame-review.js has no frame-level entry point. It is
 * CLI-only (--video/--script/--srt/--channel) and picks its rubric by sniffing
 * <video>-manifest.json for beats[].canvas (gemini-frame-review.js:712). Without canvas
 * beats it silently applies the PAPER rubric — the wrong rubric for this test. So each
 * fixture gets a real constant-image video plus a manifest carrying canvas beats, which
 * forces the full-canvas rubric this pipeline actually renders with.
 *
 * One SRT cue -> one sampled frame (computeBeatTimes takes 65% through each cue), so the
 * model sees exactly the fixture and nothing else.
 *
 * Usage: node run-a1.mjs            (all fixtures, all reachable providers)
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = "data/audit/a1-discrimination";
const FIX = join(DIR, "fixtures");
const WORK = join(DIR, "work");
mkdirSync(WORK, { recursive: true });

const FRAMES = [
  { id: "A", png: "frame-A-fallback-white-caption-only.png", composition: "TYPE-FULL", label: "uniform white ground, caption-layer text only (fallback signature)" },
  { id: "B", png: "frame-B-varied-ground-composed.png", composition: "NUMBER-FULL", label: "varied ground, composed scene (A1's B)" },
  { id: "Bprime", png: "frame-Bprime-white-ground-composed.png", composition: "NUMBER-FULL", label: "EXTENSION: white ground + B's composed elements — isolates ground from composition" },
];

const NARRATION = "Over forty percent of borrowers immediately throw extra cash at high-interest debt first.";
const CHANNEL = "1";

// A manifest beat with `canvas` present is what flips the verifier to the full-canvas
// rubric. `dark` is what canvas-ground reads, so it is set from the fixture's own ground.
for (const f of FRAMES) {
  const stem = `frame-${f.id}`;
  const video = join(WORK, `${stem}.mp4`);
  execFileSync("ffmpeg", ["-loop", "1", "-i", join(FIX, f.png), "-t", "2", "-r", "30", "-pix_fmt", "yuv420p",
    "-vf", "scale=1080:1920", "-c:v", "libx264", "-preset", "veryfast", "-y", video], { stdio: "pipe" });

  writeFileSync(join(WORK, `${stem}.srt`),
    `1\n00:00:00,000 --> 00:00:02,000\n${NARRATION}\n`);

  const isDark = f.id === "B";
  writeFileSync(join(WORK, `${stem}-manifest.json`), JSON.stringify({
    video: `${stem}.mp4`, fps: 30, width: 1080, height: 1920, duration_sec: 2,
    // canvas.dark: true only for the dark-ground fixture. canvas-ground fails a dark
    // ground by design (local-audit.cjs:500), and that failure is a RESULT, not an error.
    beats: [{ index: 0, start_sec: 0, duration_sec: 2, visual_type: "TYPE", canvas: { composition: f.composition, dark: isDark, boxes: {}, name_card: null } }],
  }, null, 2) + "\n");

  writeFileSync(join(WORK, `${stem}-script.json`), JSON.stringify({
    channel: CHANNEL, title: `A1 fixture ${f.id}`, beats: [{ index: 0, narration: NARRATION }],
  }, null, 2) + "\n");

  console.log(`[a1] ${f.id}: ${video} (${f.label})`);
}
console.log(`\n[inputs] ${join(WORK)}`);
console.log("[note] FORCE_PROVIDER decides which model answers; providers with no key locally are reported as unreachable, not silently skipped.");