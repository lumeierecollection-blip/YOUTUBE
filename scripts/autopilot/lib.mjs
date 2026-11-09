/** Shared helpers for the two-channel autopilot. */
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const CONFIG = JSON.parse(readFileSync(join(ROOT, "config/autopilot.json"), "utf8"));
/** A second checkout of the automation/state branch, created by the workflow. */
export const STATE_DIR = resolve(process.env.AUTOPILOT_STATE_DIR || join(ROOT, ".autopilot-state"));

export const readJson = (p, fallback) => {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { if (fallback !== undefined) return fallback; throw new Error(`cannot read ${p}`); }
};
export const writeJson = (p, v) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); };
export const sha256File = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const slugify = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
export const log = (stage, msg) => console.log(`[autopilot:${stage}] ${msg}`);

/** Error carrying the production stage that failed, recorded in the ledger. */
export class StageError extends Error {
  constructor(stage, message) { super(message); this.stage = stage; }
}

/** Runs a command, streaming output. Returns { status, stdout } and never throws on a non-zero exit. */
export function run(cmd, args, { input, env, timeoutS = 900, cwd = ROOT, capture = false, merge = false } = {}) {
  const r = spawnSync(cmd, args, {
    cwd, input, env: { ...process.env, ...env }, timeout: timeoutS * 1000, encoding: "utf8", maxBuffer: 256 * 1024 * 1024,
    stdio: [input === undefined ? "ignore" : "pipe", capture ? "pipe" : "inherit", merge ? "pipe" : "inherit"],
  });
  if (r.error && r.error.code === "ETIMEDOUT") return { status: 124, stdout: r.stdout || "" };
  if (merge && r.stderr) process.stderr.write(r.stderr);
  return { status: r.status ?? 1, stdout: merge ? `${r.stdout || ""}
${r.stderr || ""}` : r.stdout || "" };
}

export function must(stage, cmd, args, opts) {
  const r = run(cmd, args, opts);
  if (r.status !== 0) throw new StageError(stage, `${[cmd, ...args.slice(0, 2)].join(" ")} exited ${r.status}`);
  return r;
}

export const ffprobeJson = (file) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_name,codec_type,width,height,r_frame_rate", "-of", "json", file], { encoding: "utf8" }));
export const durationOf = (file) => Number(ffprobeJson(file).format.duration);

// Wikimedia asks automated clients to identify themselves and throttles ones that do not.
const USER_AGENT = (url) => /wiki(pedia|media)\.org/.test(url) ? "YOUTUBE-pipeline/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE)" : "Mozilla/5.0 (compatible; youtube-autopilot/1.0)";

/** Network errors and timeouts are retried with backoff; an HTTP error status is returned to the caller. */
export async function fetchWithTimeout(url, opts = {}, timeoutMs = 20000, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      return await fetch(url, { redirect: "follow", ...opts, signal: ctl.signal, headers: { "user-agent": USER_AGENT(String(url)), ...(opts.headers || {}) } });
    } catch (e) {
      if (attempt >= retries) throw e;
      await sleep(2000 * (attempt + 1));
    } finally { clearTimeout(t); }
  }
}

/** Slot id -> working directory for one production. Nothing is shared between productions. */
export const workDir = (slotId) => { const d = join(ROOT, "data", "autopilot-runs", slotId); mkdirSync(d, { recursive: true }); return d; };
export const channelConfig = (channelId) => {
  const c = CONFIG.channels[String(channelId)];
  if (!c) throw new Error(`channel ${channelId} is not configured in config/autopilot.json`);
  return { ...c, id: String(channelId) };
};
export const exists = existsSync;

/** Sends a JPEG to the model chain and returns parsed JSON, or null when no vision model answered. */
export async function askVision(prompt, jpegBuffers, tag = "autopilot-vision") {
  const { callLLM, isProviderError } = await import("../../src/lib/llm.js");
  const images = (Array.isArray(jpegBuffers) ? jpegBuffers : [jpegBuffers]).map((b) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b.toString("base64")}` } }));
  const r = await callLLM([{ role: "user", content: [{ type: "text", text: prompt }, ...images] }], { maxTokens: 900, temperature: 0, keepAlive: 0 }, tag);
  if (!r || isProviderError(r)) return null;
  return parseJsonAnswer(r);
}

/** A truncated or malformed answer is retried; only repeated failure stops the stage. */
export async function askJson(prompt, tag = "autopilot") {
  const { callLLM, isProviderError } = await import("../../src/lib/llm.js");
  let last = "no answer";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await callLLM([{ role: "user", content: prompt }], { maxTokens: 14000, temperature: 0.4, keepAlive: 0, noCache: attempt > 1 }, tag);
    if (!r || isProviderError(r)) last = `no model answered: ${JSON.stringify(r).slice(0, 200)}`;
    else {
      const parsed = parseJsonAnswer(r);
      if (parsed) return parsed;
      last = `model answer was not valid JSON (${JSON.stringify(r).length} characters)`;
    }
    log(tag, `attempt ${attempt}/3 failed: ${last}`);
    await sleep(attempt * 8000);
  }
  throw new StageError(tag, last);
}

export function parseJsonAnswer(r) {
  if (r && typeof r === "object" && !("content" in r)) return r;
  const text = typeof r === "string" ? r : r?.content;
  if (typeof text !== "string") return typeof text === "object" ? text : null;
  const m = text.match(/[\[{][\s\S]*[\]}]/);
  try { return JSON.parse(m ? m[0] : text); } catch { return null; }
}
