/** Tools a channel's preview.mjs uses. Every output is real pipeline output, stored per run. */
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REMOTION = join(ROOT, "src/skills/remotion-render");
const sharp = createRequire(join(ROOT, "package.json"))("sharp");

export const registry = () => JSON.parse(readFileSync(join(ROOT, "config/channel-registry.json"), "utf8"));
export const channelEntry = (key) => {
  const c = registry().channels.find((x) => x.key === key);
  if (!c) throw new Error(`no channel "${key}" in config/channel-registry.json`);
  return c;
};

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, timeout: 40 * 60e3, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(" ")} failed (exit ${r.status})`);
};
export const durationOf = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

function ensureBundleAudio(audio) {
  const target = join(REMOTION, "vo.mp3");
  if (audio) copyFileSync(audio, target);
  else if (!existsSync(target)) run("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "1", target]);
}

export const STAGES = ["started", "research_complete", "blueprint_complete", "script_complete", "script_approved", "visual_complete", "voice_complete", "render_complete", "qa_passed", "preview_ready", "awaiting_approval", "blocked", "finished", "failed"];

export function makeTools({ key, runId, outDir, agent, publish }) {
  mkdirSync(outDir, { recursive: true });
  const stage = (name, status, extra = {}) => {
    if (!STAGES.includes(name)) throw new Error(`unknown stage "${name}"; use one of ${STAGES.join(", ")}`);
    const repo = process.env.GITHUB_REPOSITORY, runNo = process.env.GITHUB_RUN_ID;
    const meta = { channel: key, production_run: runId, agent, stage: name, status, timestamp: new Date().toISOString(), branch: process.env.GITHUB_REF_NAME || null, commit: process.env.GITHUB_SHA || null, artifact_url: repo && runNo ? `https://github.com/${repo}/actions/runs/${runNo}#artifacts` : null, ...extra };
    writeFileSync(join(outDir, "preview-meta.json"), JSON.stringify(meta, null, 2));
    publish();
    return meta;
  };
  return {
    outDir, stage, durationOf,
    write: (name, content) => { const f = join(outDir, name); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, typeof content === "string" ? content : JSON.stringify(content, null, 2)); return f; },

    /** A composition registered in src/skills/remotion-render/channels/<key>/compositions.jsx. */
    renderComposition({ id, props = {}, output = "preview.mp4", audio = null, durationInFrames = null, timeoutMinutes = 40 }) {
      ensureBundleAudio(audio);
      const file = join(outDir, output), job = join(outDir, `${output}.job.json`);
      writeFileSync(job, JSON.stringify({ id, props, output: file, audio, durationInFrames }));
      run("node", ["render-channel-composition.mjs", job], { cwd: REMOTION, timeout: timeoutMinutes * 60e3 }); // long-form passes a longer limit
      rmSync(job, { force: true });
      if (audio) {
        // The bundle does not carry per-render audio, so the voice track is added here. The picture sets the
        // length: silence pads the voice to the end, so the timeline's closing hold is not cut off.
        const withAudio = `${file}.audio.mp4`;
        run("ffmpeg", ["-y", "-v", "error", "-i", file, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-af", "apad", "-t", String(durationOf(file)), withAudio]);
        copyFileSync(withAudio, file);
        rmSync(withAudio, { force: true });
      }
      return file;
    },

    /** An editor timeline (schemas/editor-timeline.json), through the same renderer production uses. */
    async renderTimeline({ timeline, audio, output = "preview.mp4" }) {
      ensureBundleAudio(audio);
      const { renderEditor } = await import(join(REMOTION, "render-editor.js").replace(/\\/g, "/").replace(/^([A-Za-z]:)/, "file:///$1"));
      const timelinePath = join(outDir, `${output}.timeline.json`);
      writeFileSync(timelinePath, JSON.stringify(timeline));
      await renderEditor({ timelinePath, audioPath: audio, outputPath: relative(ROOT, join(outDir, output)).replace(/\\/g, "/"), scale: 1 });
      return join(outDir, output);
    },

    /** Neural voice sample through edge-tts. Generated speech; never presented as a human recording. */
    voice({ text, voice, output = "voice-preview.mp3", rate = "+0%" }) {
      const file = join(outDir, output), input = join(outDir, `${output}.txt`);
      writeFileSync(input, text);
      // edge-tts intermittently returns NoAudioReceived on runners; the same voice is retried, never silently swapped.
      for (let attempt = 1; ; attempt++) {
        try { run("edge-tts", ["--voice", voice, `--rate=${rate}`, "--file", input, "--write-media", file]); break; }
        catch (e) { if (attempt >= 4) throw e; spawnSync("sleep", [String(attempt * 15)]); }
      }
      rmSync(input, { force: true });
      return file;
    },

    /** scenes: [{ id, start_s, end_s, treatment, objective }]. Real frames, labelled. */
    async contactSheet({ video, scenes, output = "contact-sheet.jpg", channel = key }) {
      const W = 300, H = 533, LABEL = 118, cols = Math.min(5, scenes.length), rows = Math.ceil(scenes.length / cols);
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      const wrap = (s, n) => { const out = []; let line = ""; for (const w of String(s).split(/\s+/)) { if ((line + " " + w).trim().length > n) { out.push(line); line = w; } else line = (line + " " + w).trim(); } if (line) out.push(line); return out.slice(0, 2); };
      const tiles = [];
      for (const [i, s] of scenes.entries()) {
        const f = join(outDir, `.frame-${i}.png`), at = s.start_s + (s.end_s - s.start_s) * 0.72;
        run("ffmpeg", ["-y", "-v", "error", "-ss", at.toFixed(3), "-i", video, "-frames:v", "1", f]);
        const img = await sharp(f).resize(W, H, { fit: "contain", background: "#222" }).toBuffer();
        const lines = [`${channel} | ${s.id} | ${s.start_s.toFixed(1)}-${s.end_s.toFixed(1)}s`, s.treatment, ...wrap(s.objective, 44)];
        const label = Buffer.from(`<svg width="${W}" height="${LABEL}"><rect width="${W}" height="${LABEL}" fill="#111"/>${lines.map((l, k) => `<text x="10" y="${24 + k * 24}" font-family="sans-serif" font-size="${k < 2 ? 17 : 15}" font-weight="${k === 1 ? 700 : 400}" fill="#eee">${esc(l)}</text>`).join("")}</svg>`);
        tiles.push({ img, label, i });
        rmSync(f, { force: true });
      }
      const composite = tiles.flatMap(({ img, label, i }) => { const left = (i % cols) * (W + 6), top = Math.floor(i / cols) * (H + LABEL + 6); return [{ input: img, left, top }, { input: label, left, top: top + H }]; });
      const file = join(outDir, output);
      await sharp({ create: { width: cols * (W + 6), height: rows * (H + LABEL + 6), channels: 3, background: "#444" } }).composite(composite).jpeg({ quality: 86 }).toFile(file);
      return file;
    },
  };
}
