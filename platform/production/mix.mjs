/**
 * Original music under the narration. The music is synthesised by platform/production/music.py (no third-party material), then
 * ducked by the voice with ffmpeg sidechaincompress so the narration always stays on top, then limited to avoid clipping.
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: "utf8" }); if (r.status !== 0) throw new Error(`${cmd} failed: ${String(r.stderr).split("\n").slice(-4).join(" ").slice(0, 400)}`); return r; };

export function mixMusic({ narration, timeline, outDir, mood, level = 0.5 }) {
  const total = timeline.duration_s;
  const music = join(outDir, "music.wav"), mixed = join(outDir, "voice-and-music.mp3");
  const hits = mood === "suspense" ? timeline.scenes.slice(1).map((s) => s.start_s.toFixed(2)).join(",") : "";
  run(process.platform === "win32" ? "python" : "python3", [join(HERE, "music.py"), music, "--mood", mood, "--seconds", total.toFixed(2), ...(hits ? ["--hits", hits] : [])]);
  run("ffmpeg", ["-y", "-v", "error", "-i", narration.mp3, "-i", music, "-filter_complex",
    `[0:a]aresample=44100,apad,asplit=2[v1][v2];[1:a]volume=${level}[m];[m][v1]sidechaincompress=threshold=0.03:ratio=12:attack=15:release=400[duck];[duck][v2]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[out]`,
    "-map", "[out]", "-t", total.toFixed(3), "-ar", "44100", "-b:a", "192k", mixed]);
  const manifest = { mood, file: "voice-and-music.mp3", generator: "platform/production/music.py", third_party_material: "none", licence: "original to this repository, synthesised by its own code", ducking: "ffmpeg sidechaincompress keyed by the narration", music_level: level, hit_times_s: hits ? hits.split(",").map(Number) : [] };
  writeFileSync(join(outDir, "music-manifest.json"), JSON.stringify(manifest, null, 2));
  return { file: mixed, manifest };
}
