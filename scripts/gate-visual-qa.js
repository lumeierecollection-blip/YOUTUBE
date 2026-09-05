#!/usr/bin/env node
/**
 * Step 6 — the section-7 QA checker. Six checks against one rendered video.
 *
 *   node scripts/gate-visual-qa.js --channel ch-01 --video <path> --plan <path>
 *   node scripts/gate-visual-qa.js --channel ch-01 --video <path> --plan <path> --no-vision
 *
 * Section 7 ends "If any check fails, the render must be marked as rejected and
 * a human must be notified. Do not automatically retry." So this exits non-zero
 * and writes a rejection record. It never re-renders, never adjusts anything,
 * and never downgrades a failure to a warning.
 *
 * WHICH CHECKS ARE MEASUREMENTS AND WHICH ARE NOT — stated up front, because
 * the difference matters more than the pass rate.
 *
 *   7.1 colour       MEASURED from the video's own pixels.
 *   7.2 typography   NOT measured from pixels. Identifying a typeface from a
 *                    rendered frame needs OCR plus font matching, which this
 *                    does not attempt. It checks the PLAN's declared faces
 *                    against the channel's two declared families, against the
 *                    woff2 files that exist, AND against the @font-face rules
 *                    in fonts-loader.js. That is a real check of the contract;
 *                    it is not a check of the pixels, and calling it one would
 *                    be a lie.
 *   7.3 environment  VISION. Needs VISION_API_KEY and a vision-capable
 *                    VISION_MODEL. Absent, it FAILS as unverified rather than
 *                    passing quietly — an unrun check is not a passed check.
 *   7.4 objects      VISION, same conditions.
 *
 * WHICH VISION ENDPOINT, AND WHAT WAS ACTUALLY MEASURED FROM HERE.
 *
 * The default base is Google's OpenAI-compatible surface, because that is the
 * one this sandbox can reach and the one whose request shape was verified:
 * POSTing exactly the body built below, with a deliberately invalid key,
 * returns 400 "Please pass a valid API key" — the path, method and payload are
 * accepted and only the credential is missing. `opencode.ai/zen/v1`, the
 * previous default, is refused at the egress proxy from this container
 * (connect_rejected, curl exit 56); it may well be reachable from CI, which is
 * why the base stays an environment variable rather than a constant.
 *
 * Set for Gemini:  VISION_API_BASE=https://generativelanguage.googleapis.com/v1beta/openai
 *                  VISION_MODEL=gemini-2.5-flash   (any vision-capable Gemini)
 * Set for OpenCode: VISION_API_BASE=https://opencode.ai/zen/v1
 *
 * NEITHER 7.3 NOR 7.4 HAS EVER RETURNED A REAL VERDICT. No key reaches this
 * container, so every run to date has recorded them as UNVERIFIED failures.
 * The first real answer will come from CI, and it may well disagree with the
 * four measured checks.
 *   7.5 transitions  MEASURED from the plan against transition_language.
 *   7.6 authenticity MEASURED from the plan's ASSET REFERENCES: every asset
 *                    must name a source and the query that retrieved it.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { decodePNG } from "../src/skills/remotion-render/decode-png.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
/**
 * Two ffmpeg binaries, deliberately. The Remotion compositor ships a MINIMAL
 * build: `ffmpeg -filters` on it lists neither `tile` nor `color`, so it cannot
 * assemble a contact sheet. `ffmpeg-static` has the full filter set. Its
 * ffprobe is the compositor's, which is the one that exists.
 */
const FFMPEG_MIN = join(ROOT, "src", "skills", "remotion-render", "node_modules",
  "@remotion", "compositor-linux-x64-gnu", "ffmpeg");
const FFPROBE = FFMPEG_MIN.replace(/ffmpeg$/, "ffprobe");
const FFMPEG = existsSync(join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg"))
  ? join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg")
  : FFMPEG_MIN;

/**
 * "within a tolerance of +-5% in HSV" does not name a metric, so this states
 * one and sticks to it: 5% of each channel's own full range. Hue is circular
 * over 360 degrees, so 5% is 18 degrees; saturation and value are 0..1, so 5%
 * is 0.05. Any other reading of "5%" would be a different check, and a check
 * whose tolerance is ambiguous is not a check.
 */
const HUE_TOL = 360 * 0.05;
const SV_TOL = 0.05;
/** Frames sampled across the video for the colour census and the contact sheet. */
const SAMPLES = 12;
/** A colour has to occupy this much of the sampled pixels to count as dominant. */
const DOMINANT_MIN = 0.04;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=").slice(1).join("=") : fallback;
}

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return [h, max ? d / max : 0, max];
}

/** Circular hue distance, so 359 and 1 are two degrees apart, not 358. */
function hsvWithinTolerance(a, b) {
  let dh = Math.abs(a[0] - b[0]);
  if (dh > 180) dh = 360 - dh;
  // A near-grey colour has no meaningful hue, so hue is not compared when both
  // are desaturated -- otherwise every off-white would fail on hue noise.
  const greyish = a[1] < 0.12 && b[1] < 0.12;
  return (greyish || dh <= HUE_TOL) && Math.abs(a[1] - b[1]) <= SV_TOL && Math.abs(a[2] - b[2]) <= SV_TOL;
}

function sampleFrames(video, outDir) {
  const dur = Number(execFileSync(FFPROBE,
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", video],
    { encoding: "utf-8" }).trim());
  if (!Number.isFinite(dur) || dur <= 0) throw new Error(`could not read duration of ${video}`);
  const paths = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = (dur * (i + 0.5)) / SAMPLES;
    const p = join(outDir, `f${String(i).padStart(2, "0")}.png`);
    execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-ss", String(t),
      "-i", video, "-frames:v", "1", "-vf", "scale=270:480", "-y", p]);
    paths.push(p);
  }
  return paths;
}

/**
 * Dominant colours, by bucketing each channel to 32 levels so antialiasing and
 * codec noise do not each become their own "colour", then keeping buckets that
 * hold at least DOMINANT_MIN of the sampled pixels.
 */
function dominantColours(pngs) {
  const buckets = new Map();
  let total = 0;
  for (const p of pngs) {
    const { data, width, height, channels: ch } = decodePNG(p);
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const i = (y * width + x) * ch;
        const key = `${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`;
        const cur = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
        cur.n++; cur.r += data[i]; cur.g += data[i + 1]; cur.b += data[i + 2];
        buckets.set(key, cur);
        total++;
      }
    }
  }
  return [...buckets.values()]
    .filter((b) => b.n / total >= DOMINANT_MIN)
    .sort((a, b) => b.n - a.n)
    .map((b) => ({
      rgb: [Math.round(b.r / b.n), Math.round(b.g / b.n), Math.round(b.b / b.n)],
      share: b.n / total,
    }));
}

function contactSheet(pngs, out) {
  execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error",
    "-pattern_type", "glob", "-i", join(dirname(pngs[0]), "f*.png"),
    "-vf", "tile=4x3", "-frames:v", "1", "-q:v", "3", "-y", out]);
  return out;
}

/** Section 5's plan is plain text with fixed headings; read the ones QA needs. */
function parsePlan(text) {
  const section = (name) => {
    const re = new RegExp(`^${name}$([\\s\\S]*?)(?=^[A-Z][A-Z ]+$|\\Z)`, "m");
    const m = re.exec(text);
    return m ? m[1].trim().split("\n").map((l) => l.trim()).filter(Boolean) : [];
  };
  return {
    template: (section("TEMPLATE SELECTED")[0] || "").split(/\s{2,}/)[0],
    assets: section("ASSET REFERENCES"),
    text: section("TEXT CONTENT"),
    transitions: section("TRANSITION SCHEDULE"),
  };
}

function visionCheck(sheet, spec) {
  const base = process.env.VISION_API_BASE || "https://generativelanguage.googleapis.com/v1beta/openai";
  const key = process.env.VISION_API_KEY;
  const model = process.env.VISION_MODEL;
  if (!key || !model) {
    return {
      ran: false,
      reason: "VISION_API_KEY / VISION_MODEL not set — 7.3 and 7.4 are UNVERIFIED. " +
        "An unrun check is not a passed check, so both are reported as failures.",
    };
  }
  const prompt =
    `You are looking at a contact sheet of 12 consecutive frames from one video.\n` +
    `Answer ONLY with JSON, no prose, no markdown fences:\n` +
    `{ "environment": "<what place or surface these frames depict, 3 words max>",\n` +
    `  "environment_matches": true|false,\n` +
    `  "objects_seen": ["<objects you can actually identify>"],\n` +
    `  "core_object_identifiable": true|false,\n` +
    `  "notes": "<one sentence>" }\n\n` +
    `environment_matches: is the environment "${spec.environment_type}"?\n` +
    `core_object_identifiable: can you identify AT LEAST ONE of these, ` +
    `unambiguously, as a depicted thing rather than a label naming it: ` +
    `${spec.core_objects.join(", ")}?\n` +
    `Report only what is visible. If the frames are abstract shapes and text, ` +
    `say so and answer false.`;
  const body = JSON.stringify({
    model, max_tokens: 400, temperature: 0,
    messages: [{ role: "user", content: [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${readFileSync(sheet).toString("base64")}` } },
    ] }],
  });
  // A blocked or unreachable endpoint makes curl exit non-zero, which would
  // otherwise abort the whole gate with a stack trace and leave 7.1, 7.2, 7.5
  // and 7.6 unreported. An endpoint that cannot be reached is exactly the
  // UNVERIFIED case this check already knows how to state.
  let res;
  try {
    res = execFileSync("curl", ["-sS", "--max-time", "180",
      "-H", "Content-Type: application/json",
      "-H", `Authorization: Bearer ${key}`,
      "-d", "@-", `${base.replace(/\/$/, "")}/chat/completions`],
      { input: body, encoding: "utf-8" });
  } catch (e) {
    return {
      ran: false,
      reason: `vision endpoint ${base} could not be reached: ${String(e.stderr || e.message).trim().slice(0, 200)}`,
    };
  }
  let raw;
  try {
    raw = JSON.parse(res).choices[0].message.content.trim()
      .replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
  } catch (e) {
    return { ran: false, reason: `vision endpoint returned no usable message: ${res.slice(0, 200)}` };
  }
  try {
    return { ran: true, ...JSON.parse(raw) };
  } catch (e) {
    return { ran: false, reason: `model did not return JSON — it may not support vision:\n${raw.slice(0, 300)}` };
  }
}

function main() {
  const cid = arg("channel");
  const video = arg("video");
  const planPath = arg("plan");
  const noVision = process.argv.includes("--no-vision");
  if (!cid || !video) {
    console.error("usage: gate-visual-qa.js --channel ch-01 --video <path> [--plan <path>] [--no-vision]");
    process.exit(2);
  }

  const spec = (JSON.parse(readFileSync(join(ROOT, "config", "visual-identity.json"), "utf-8")).channels || {})[cid];
  if (!spec) { console.error(`no visual identity specification for ${cid}`); process.exit(2); }
  const vid = existsSync(video) ? video : join(ROOT, video);
  if (!existsSync(vid)) { console.error(`no video at ${video}`); process.exit(2); }

  const work = join(tmpdir(), `vqa-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  const findings = [];
  const results = {};

  try {
    const pngs = sampleFrames(vid, work);

    // ── 7.1 colour compliance ─────────────────────────────────────────────
    const declared = spec.primary_palette.map((h) => ({ hex: h, hsv: rgbToHsv(...hexToRgb(h)) }));
    const dom = dominantColours(pngs);
    const offPalette = [];
    for (const d of dom) {
      const hsv = rgbToHsv(...d.rgb);
      const hit = declared.find((p) => hsvWithinTolerance(hsv, p.hsv));
      if (!hit) {
        offPalette.push({
          rgb: `#${d.rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`,
          share: +(d.share * 100).toFixed(1),
          hsv: hsv.map((v, i) => (i ? +v.toFixed(2) : Math.round(v))),
        });
      }
    }
    results["7.1"] = { dominant: dom.length, offPalette };
    if (offPalette.length) {
      findings.push(`7.1 colour: ${offPalette.length} dominant colour(s) outside primary_palette ` +
        `(±${HUE_TOL}° hue, ±${SV_TOL} S/V): ` +
        offPalette.map((o) => `${o.rgb} at ${o.share}%`).join(", ") +
        `\n      declared: ${spec.primary_palette.join(", ")}`);
    }

    // ── 7.2 typography compliance (contract, not pixels) ──────────────────
    //
    // TWO CONDITIONS, NOT ONE. The first version of this check asked only
    // whether a woff2 sat in public/fonts, and passed ch-02 on the strength of
    // NotoSerif-400.woff2 being there — while fonts-loader.js, which is what
    // actually injects the @font-face rules, had no rule for the family. The
    // caption rendered in Chromium's fallback sans and the gate said ok. A
    // font is only loaded if a file exists AND something declares it.
    const renderDir = join(ROOT, "src", "skills", "remotion-render");
    const have = new Set(readdirSync(join(renderDir, "public", "fonts"))
      .map((f) => (/^([A-Za-z]+)-/.exec(f) || [])[1]).filter(Boolean)
      .map((s) => s.toLowerCase()));
    const loader = readFileSync(join(renderDir, "fonts-loader.js"), "utf-8");
    const declaredFaces = new Set([...loader.matchAll(/font-family:"([^"]+)"/g)]
      .map((m) => m[1].replace(/[\s_-]+/g, "").toLowerCase()));
    const norm = (s) => String(s).replace(/[\s_-]+/g, "").toLowerCase();
    const faces = [spec.typography_primary, spec.typography_secondary];
    const missing = faces.filter((f) => !have.has(norm(f)));
    const undeclared = faces.filter((f) => have.has(norm(f)) && !declaredFaces.has(norm(f)));
    results["7.2"] = { declared: faces, missing, undeclared };
    if (missing.length) findings.push(`7.2 typography: declared face(s) with no woff2: ${missing.join(", ")}`);
    if (undeclared.length) {
      findings.push(`7.2 typography: ${undeclared.join(", ")} has a woff2 but no @font-face in fonts-loader.js — ` +
        `the render will silently fall back. Re-run src/skills/remotion-render/fetch-fonts.js.`);
    }

    // ── 7.5 transition compliance + 7.6 asset authenticity ────────────────
    if (planPath) {
      const plan = parsePlan(readFileSync(join(ROOT, planPath), "utf-8"));
      const allowed = new Set(spec.transition_language);
      const used = plan.transitions
        .map((l) => (/->\s*\S+:\s*([a-z-]+)/.exec(l) || [])[1])
        .filter(Boolean);
      const bad = used.filter((t) => !allowed.has(t));
      results["7.5"] = { used, disallowed: bad };
      if (bad.length) findings.push(`7.5 transitions: ${bad.join(", ")} not in transition_language (${[...allowed].join(", ")})`);

      const assetLines = plan.assets.filter((l) => !/^\(none/.test(l));
      const unsourced = assetLines.filter((l) => !/https?:\/\/|source|query/i.test(l));
      results["7.6"] = { assets: assetLines.length, unsourced: unsourced.length };
      if (unsourced.length) {
        findings.push(`7.6 authenticity: ${unsourced.length} asset(s) with no source or query logged`);
      }
      if (!assetLines.length) {
        results["7.6"].note = "no external assets in this plan, so 7.6 has nothing to verify — a pass here is vacuous, not strong";
      }
    } else {
      results["7.5"] = { skipped: "no --plan given" };
      results["7.6"] = { skipped: "no --plan given" };
      findings.push("7.5 / 7.6: no plan supplied, so neither could be checked. Section 7 requires both.");
    }

    // ── 7.3 environment + 7.4 objects ─────────────────────────────────────
    if (noVision) {
      results["7.3"] = results["7.4"] = { skipped: "--no-vision" };
      findings.push("7.3 / 7.4: skipped by --no-vision. Both are UNVERIFIED; this render is not QA-complete.");
    } else {
      const sheet = contactSheet(pngs, join(work, "sheet.jpg"));
      const v = visionCheck(sheet, spec);
      results["7.3"] = results["7.4"] = v;
      if (!v.ran) {
        findings.push(`7.3 environment: UNVERIFIED — ${v.reason}`);
        findings.push(`7.4 objects: UNVERIFIED — same reason`);
      } else {
        if (!v.environment_matches) {
          findings.push(`7.3 environment: model saw "${v.environment}", specification declares "${spec.environment_type}"`);
        }
        if (!v.core_object_identifiable) {
          findings.push(`7.4 objects: none of ${spec.core_objects.length} core_objects identifiable. ` +
            `Model saw: ${(v.objects_seen || []).join(", ") || "(nothing identifiable)"}`);
        }
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  const rejected = findings.length > 0;
  const record = {
    generatedAt: new Date().toISOString(),
    channel: cid, video: basename(vid), plan: planPath || null,
    verdict: rejected ? "REJECTED" : "ACCEPTED",
    tolerances: { hue_degrees: HUE_TOL, saturation: SV_TOL, value: SV_TOL, dominant_min_share: DOMINANT_MIN },
    results, findings,
  };
  const outDir = join(ROOT, "data", "audit", "visual-qa");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `${cid}-${basename(vid).replace(/\.[^.]+$/, "")}.json`);
  writeFileSync(out, JSON.stringify(record, null, 2) + "\n");

  console.log(`\nsection-7 QA — ${cid} — ${basename(vid)}`);
  for (const k of ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6"]) {
    const hit = findings.some((f) => f.startsWith(k));
    console.log(`  ${hit ? "REJECT" : "ok    "}  ${k}`);
  }
  if (findings.length) {
    console.log("");
    for (const f of findings) console.log(`  ${f}`);
    console.log(`\nVERDICT: REJECTED. Section 7: a human must be notified and there is no automatic retry.`);
    console.log(`record: data/audit/visual-qa/${basename(out)}`);
    process.exit(1);
  }
  console.log(`\nVERDICT: ACCEPTED.\nrecord: data/audit/visual-qa/${basename(out)}`);
}

main();
