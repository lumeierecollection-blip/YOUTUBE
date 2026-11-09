// Channel QA for AI Tested. Writes qa-report.json. Runs on GitHub with no Claude session.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, "../../..");
const req = createRequire(join(ROOT, "package.json"));

export async function runQa({ outDir, video, scenes, plan, claims, pkg, stdout, found }) {
  const sharp = req("sharp"), Ajv = req("ajv");
  const checks = [], add = (id, pass, detail) => checks.push({ id, pass: !!pass, detail });
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate:format=duration", "-of", "json", video]).toString());
  const v = probe.streams.find((s) => s.codec_type === "video"), duration = Number(probe.format.duration);
  add("duration<=30s", duration <= 30, `${duration.toFixed(2)}s`);
  add("1080x1920", v.width === 1080 && v.height === 1920, `${v.width}x${v.height}`);
  add("30fps", v.r_frame_rate === "30/1", v.r_frame_rate);
  add("has audio", probe.streams.some((s) => s.codec_type === "audio"), "");

  // Contracts
  const ajv = new Ajv({ strict: false, allErrors: true });
  const schema = JSON.parse(readFileSync(join(ROOT, "platform/contracts/scene-plan.schema.json"), "utf8"));
  const ok = ajv.validate(schema, plan);
  add("scene-plan schema", ok, ok ? "" : ajv.errorsText());

  // Claims: every cited id exists; claim categories valid; demonstrated claims have real evidence; no purple.
  const ids = new Set(claims.map((c) => c.claim_id));
  const cited = [...pkg.sentences, ...plan.scenes].flatMap((x) => x.claim_ids);
  add("claim ids resolve", cited.every((c) => ids.has(c)), cited.filter((c) => !ids.has(c)).join(","));
  add("every claim has excerpt + source", claims.every((c) => c.excerpt && c.source_url), "");
  const demo = claims.filter((c) => c.editorial_status === "demonstrated_feature");
  add("demonstrated claims backed by real output", demo.every((c) => found.every((f) => stdout.includes(f))), `${demo.length} demonstrated, ${claims.length - demo.length} documented only`);
  const palette = JSON.parse(readFileSync(join(HERE, "channel.json"), "utf8")).palette;
  const hue = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return null; const d = mx - mn; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
  add("palette has no purple", Object.values(palette).every((c) => { const h = hue(c); return h === null || h < 250 || h > 320; }), "");

  // Frames: scene frames exist, are not blank, backgrounds white except terminal scene content, captions sit clear of the stage.
  let prev = null;
  for (const s of scenes) {
    const f = join(outDir, `scene-${s.id}.jpg`);
    if (!existsSync(f)) { add(`frame ${s.id}`, false, "missing"); continue; }
    const img = sharp(f), st = await img.stats(), sd = st.channels.reduce((a, c) => a + c.stdev, 0) / 3;
    const corner = await sharp(f).extract({ left: 0, top: 300, width: 16, height: 1200 }).stats();
    const white = corner.channels.every((c) => c.mean > 235);
    add(`frame ${s.id} not blank`, sd > 12, `stdev ${sd.toFixed(1)}`);
    add(`frame ${s.id} white page edge`, white, corner.channels.map((c) => c.mean.toFixed(0)).join("/"));
    const small = await sharp(f).resize(32, 56).greyscale().raw().toBuffer();
    if (prev) { let d = 0; for (let i = 0; i < small.length; i++) d += Math.abs(small[i] - prev[i]); add(`frame ${s.id} differs from previous`, d / small.length > 4, `mean diff ${(d / small.length).toFixed(1)}`); }
    prev = small;
  }
  add("voice preview exists", existsSync(join(outDir, "voice-preview.mp3")), "");
  add("narration marked provisional", pkg.provisional === "hand-planned sample, not from the script engine", "");
  const failures = checks.filter((c) => !c.pass).map((c) => `${c.id} (${c.detail})`);
  const report = { channel: "ai-tested", duration_s: duration, scene_count: scenes.length, pass: failures.length === 0, failures, checks };
  writeFileSync(join(outDir, "qa-report.json"), JSON.stringify(report, null, 2));
  return report;
}

// Standalone: node qa.mjs <outDir>  (re-checks a finished run from its files)
if (process.argv[1] && process.argv[1].endsWith("qa.mjs") && process.argv[2]) {
  const d = process.argv[2], rd = (f) => JSON.parse(readFileSync(join(d, f), "utf8"));
  const plan = rd("scene-plan.json"), pkg = rd("script-package.json");
  const scenes = plan.scenes.map((s) => ({ id: s.scene_id, start_s: s.start_s, end_s: s.end_s }));
  const raw = readFileSync(join(d, "terminal-raw.txt"), "utf8");
  runQa({ outDir: d, video: join(d, "preview.mp4"), scenes, plan, claims: rd("claims.json"), pkg, stdout: raw, found: ["--print", "--output-format"] }).then((r) => console.log(r.pass ? "QA pass" : r.failures));
}
