/**
 * gemini-files.js — the Gemini Files API upload path for Layer 3.
 *
 * Layer 3 sends a whole rendered video to Gemini, not frames. That needs the
 * Files API, which gemini-client.js does not implement: it has only the
 * OpenAI-compat chat endpoint (gemini-client.js:314) and cachedContents (:444).
 * So this is that upload path, and nothing else.
 *
 * Three operations: upload a video, wait for it to become usable, delete it.
 *
 * ── Why node:https and not fetch() ──────────────────────────────────────
 *
 * The same reason as ollama-client.cjs:43. Node's fetch (undici) aborts any
 * response whose headers take longer than 300 s with UND_ERR_HEADERS_TIMEOUT.
 * A resumable PUT of a multi-megabyte video plus the five-minute poll loop is
 * exactly the shape that trips it, and run 36428496329 lost every plan to it.
 *
 * ── Fail loud, always ───────────────────────────────────────────────────
 *
 * A file that is not an MP4 is rejected BEFORE any network call, by reading the
 * `ftyp` box at offset 4. A file over the 2 GB cap is rejected rather than
 * truncated. A file that never reaches ACTIVE throws rather than being scored
 * while still PROCESSING — scoring a half-ingested file would produce a verdict
 * about a video that was never fully seen, which is the failure mode cedb63e
 * was written against. A failed DELETE throws, so a leaked upload is a visible
 * failure rather than a silent leak.
 */
import { createReadStream, existsSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { basename } from "node:path";

const HOST = "generativelanguage.googleapis.com";
const UPLOAD_BASE = `https://${HOST}/upload/v1beta/files`;
const FILES_BASE = `https://${HOST}/v1beta/files`;
/** Gemini Files API per-file cap. Exceeding it is an error, never a truncation. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * The same key precedence gemini-client.js:55-63 uses. No new env var, and no
 * new key store: reusing that chain means one place decides which key is live.
 */
export function geminiKeys(env = process.env) {
  return [
    env.GEMINI_API_KEY_4,
    env.GEMINI_API_KEY_1 || env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY,
    env.GEMINI_API_KEY_2,
    env.GEMINI_API_KEY_3,
  ].filter(Boolean);
}

export function apiKey(env = process.env) {
  const k = geminiKeys(env)[0];
  if (!k) throw new Error("No Gemini API key: set GEMINI_API_KEY_1 (or GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY), GEMINI_API_KEY_2, GEMINI_API_KEY_3.");
  return k;
}

function req(url, { method = "GET", headers = {}, body, bodyFile, timeoutMs = 600000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? httpsRequest : httpRequest;
    const r = mod(url, { method, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        clearTimeout(timer);
        const buf = Buffer.concat(chunks);
        const text = buf.toString("utf8");
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, text, json, buffer: buf });
      });
      res.on("error", (e) => { clearTimeout(timer); reject(e); });
    });
    const timer = setTimeout(() => {
      const e = new Error(`${method} ${url} -> no response in ${Math.round(timeoutMs / 1000)}s`);
      e.name = "AbortError";
      r.destroy(e);
    }, timeoutMs);
    r.on("error", (e) => { clearTimeout(timer); reject(e); });
    if (bodyFile) {
      const stat = statSync(bodyFile);
      r.setHeader("content-length", stat.size);
      createReadStream(bodyFile).pipe(r);
    } else if (body !== undefined) {
      r.setHeader("content-length", Buffer.byteLength(body));
      r.write(body);
      r.end();
    } else r.end();
  });
}

/**
 * Reject anything that is not an MP4 before spending a network call.
 * ISO-BMFF puts `ftyp` at offset 4; a PNG's magic would put `IHDR` there.
 */
export function assertMp4(filePath) {
  if (!existsSync(filePath)) throw new Error(`not a file: ${filePath}`);
  const size = statSync(filePath).size;
  if (size > MAX_FILE_BYTES) {
    throw new Error(`File API caps at ${MAX_FILE_BYTES} bytes (2 GB); ${filePath} is ${size}. Refusing to truncate.`);
  }
  const fd = openSync(filePath, "r");
  const head = Buffer.alloc(12);
  try { readSync(fd, head, 0, 12, 0); } finally { closeSync(fd); }
  if (head.toString("latin1", 4, 8) !== "ftyp") {
    throw new Error(`${filePath} is not an MP4: expected 'ftyp' at offset 4, found '${head.toString("latin1", 4, 8)}'`);
  }
  return { sizeBytes: size, mimeType: "video/mp4" };
}

/**
 * Resumable upload: POST metadata, take the upload URL from the Location
 * header, PUT the bytes with `upload, finalize`.
 */
export async function uploadVideo(filePath, { env = process.env, mimeType } = {}) {
  const { sizeBytes, mimeType: detected } = assertMp4(filePath);
  const key = apiKey(env);
  const type = mimeType || detected;

  const start = await req(UPLOAD_BASE, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "content-type": "application/json",
      "x-goog-upload-protocol": "resumable",
      "x-goog-upload-command": "start",
      "x-goog-upload-header-content-length": String(sizeBytes),
      "x-goog-upload-header-content-type": type,
    },
    body: JSON.stringify({ file: { display_name: basename(filePath) } }),
  });
  if (start.status >= 300) throw new Error(`upload start failed: HTTP ${start.status} ${start.text.slice(0, 300)}`);

  const uploadUrl = start.headers.location || start.headers["x-goog-upload-url"];
  if (!uploadUrl) throw new Error(`upload start returned no upload URL (HTTP ${start.status}); headers: ${Object.keys(start.headers).join(", ")}`);

  const done = await req(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": type,
      "x-goog-upload-command": "upload, finalize",
      // Required and not in the resumable-upload example: without it the PUT
      // returns 400 "Missing X-Goog-Upload-Offset header." The offset is 0
      // because the whole file goes up in one PUT, so there is no resume.
      "x-goog-upload-offset": "0",
    },
    bodyFile: filePath,
  });
  if (done.status >= 300) throw new Error(`upload PUT failed: HTTP ${done.status} ${done.text.slice(0, 300)}`);
  const file = done.json?.file || done.json;
  if (!file?.name || !file?.uri) throw new Error(`upload finalize returned no name/uri: ${done.text.slice(0, 300)}`);
  return {
    name: file.name,
    uri: file.uri,
    mimeType: file.mimeType || type,
    sizeBytes: Number(file.sizeBytes || sizeBytes),
    expirationTime: file.expirationTime || null,
  };
}

/**
 * Files API resource names come back already prefixed ("files/abc123"), so
 * naively appending them to .../v1beta/files produces /v1beta/files/files/abc123
 * and a 404 on both poll and delete. Strip the prefix once, here.
 */
export function fileResource(name) {
  const id = String(name).replace(/^files\//, "");
  if (!id) throw new Error(`unusable file name: ${JSON.stringify(name)}`);
  return id;
}

/**
 * Wait for ACTIVE. Throws on timeout or FAILED — never returns a PROCESSING
 * file for scoring, because a verdict on a half-ingested video is a verdict
 * about something nobody watched.
 */
export async function pollUntilActive(fileName, { timeoutMs = 300000, pollMs = 5000, env = process.env, sleep } = {}) {
  const key = apiKey(env);
  const wait = sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const deadline = Date.now() + timeoutMs;
  const started = Date.now();
  const id = fileResource(fileName);
  let last = null;

  while (Date.now() < deadline) {
    const r = await req(`${FILES_BASE}/${id}`, { headers: { "x-goog-api-key": key } });
    if (r.status >= 300) throw new Error(`file poll failed: HTTP ${r.status} ${r.text.slice(0, 300)}`);
    const file = r.json;
    last = file;
    const state = file?.state;
    if (state === "ACTIVE") {
      return { state, uri: file.uri, name: file.name, waitedMs: Date.now() - started };
    }
    if (state === "FAILED") {
      throw new Error(`file ${fileName} FAILED to process: ${JSON.stringify(file.error || file).slice(0, 300)}`);
    }
    await wait(pollMs);
  }
  throw new Error(`file ${fileName} was still ${last?.state ?? "unknown"} after ${Math.round(timeoutMs / 1000)}s; refusing to score a PROCESSING file`);
}

/**
 * Delete the upload. Throws on a non-2xx so a leaked upload surfaces at the
 * caller's finally rather than disappearing into a log line.
 */
export async function deleteFile(fileName, { env = process.env } = {}) {
  const key = apiKey(env);
  const id = fileResource(fileName);
  const r = await req(`${FILES_BASE}/${id}`, { method: "DELETE", headers: { "x-goog-api-key": key } });
  if (r.status >= 300) {
    throw new Error(`delete ${fileName} failed: HTTP ${r.status} ${r.text.slice(0, 300)}`);
  }
  console.error(`[gemini-files] deleted ${fileName} (HTTP ${r.status})`);
  return { deleted: true, status: r.status };
}