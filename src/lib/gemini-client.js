/**
 * gemini-client.js — Resilient Gemini API client with key rotation + disk cache.
 *
 * Reads up to 3 API keys from environment variables:
 *   GEMINI_API_KEY_1 (or GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY)
 *   GEMINI_API_KEY_2
 *   GEMINI_API_KEY_3
 *
 * FAILURE CONTRACT — Gemini is tried once per request; the CALLER then falls
 * back to local Ollama (src/lib/llm.js). Every failure returns an object
 * { source: "gemini", error: <kind>, detail } instead of retrying:
 *   429 / quota / rate limit   -> the NEXT key (each has its own quota);
 *                                 "quota_exhausted" only after every key
 *                                 returned it. No waiting: a spent quota
 *                                 resets in ~24 h, not seconds.
 *   503 / other 5xx / timeout  -> ONE retry after 5 s, then "unavailable".
 *   400 / 401 / 403            -> "hard_error".
 *   an answer with no message  -> "bad_response".
 *   token budget spent         -> "budget_exhausted".
 *   FORCE_PLANNER=ollama       -> "forced_off", and no request is made.
 * A success returns the parsed JSON content (or { content }) as before.
 *
 * Disk cache at .cache/gemini/ — key = SHA256(model + prompt + schema).
 * TTL: 30 days. Makes re-renders free.
 *
 * Cursor persists across invocations within a single process.
 * 250ms delay between retries to avoid hammering.
 *
 * Usage:
 *   import { callGemini } from "../lib/gemini-client.js";
 *   const result = await callGemini(messages, { maxTokens: 1200 });
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const CACHE_DIR = join(ROOT, ".cache", "gemini");
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const RETRY_DELAY_MS = 250;
const MAX_RETRIES_PER_KEY = 1;
const REQUEST_TIMEOUT_S = 90;

// ── Key management ────────────────────────────────────────────────

/**
 * Collect Gemini API keys from environment. Returns a non-empty array.
 * Never logs key values.
 */
function collectKeys() {
  const keys = [
    process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean);

  if (keys.length === 0) {
    throw new Error("No Gemini API keys found. Set GEMINI_API_KEY_1 (or GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY), GEMINI_API_KEY_2, GEMINI_API_KEY_3.");
  }

  return keys;
}

let keyIndex = 0;
let keys = null;

/**
 * Force re-read of keys from environment (for testing).
 */
export function reloadKeys() {
  keys = null;
  keyIndex = 0;
}

function currentKey() {
  if (!keys) keys = collectKeys();
  return keys[keyIndex];
}

function maskKey(key) {
  if (!key || key.length < 10) return "***";
  return key.slice(0, 6) + "..." + key.slice(-4);
}

function advanceKey() {
  if (!keys) keys = collectKeys();
  if (keyIndex + 1 < keys.length) {
    keyIndex++;
    console.error(`[gemini-client] Rotating to key ${keyIndex + 1}/${keys.length} (${maskKey(keys[keyIndex])})`);
    return true;
  }
  return false;
}

// ── Error classification ──────────────────────────────────────────

function isRetryable(statusCode, errorMsg) {
  // Rate limit
  if (statusCode === 429) return true;
  // Transient server errors
  if (statusCode >= 500 && statusCode < 600) return true;
  // Network timeouts
  if (/(?:ETIMEDOUT|ECONNRESET|socket hang up|timeout|curl.*error)/i.test(errorMsg || "")) return true;
  // Gemini-specific quota errors
  if (/quota|PerDayPerProject|tokens per minute|rate.?limit/i.test(errorMsg || "")) return true;
  return false;
}

function isHardError(statusCode) {
  // 400, 401, 403 on a well-formed request — key is bad or request is bad
  return statusCode === 400 || statusCode === 401 || statusCode === 403;
}

// ── Disk cache ────────────────────────────────────────────────────

let cacheHits = 0;
let cacheMisses = 0;

/**
 * Generate cache key from model + messages + options.
 * Key = SHA256 of the canonical request string.
 */
function cacheKey(model, messages, maxTokens, temperature) {
  const canonical = JSON.stringify({ model, messages, maxTokens, temperature });
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Read from disk cache. Returns null on miss or expired entry.
 */
function cacheGet(key) {
  try {
    const cachePath = join(CACHE_DIR, `${key}.json`);
    if (!existsSync(cachePath)) return null;

    const raw = JSON.parse(readFileSync(cachePath, "utf-8"));
    if (Date.now() - raw.timestamp > CACHE_TTL_MS) {
      // Expired
      return null;
    }
    cacheHits++;
    console.error(`[gemini-client] Cache HIT for ${key.slice(0, 12)}...`);
    return raw.response;
  } catch {
    return null;
  }
}

/**
 * Write to disk cache.
 */
function cacheSet(key, response) {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    const cachePath = join(CACHE_DIR, `${key}.json`);
    writeFileSync(cachePath, JSON.stringify({
      timestamp: Date.now(),
      response,
    }), "utf-8");
    cacheMisses++;
    console.error(`[gemini-client] Cache MISS for ${key.slice(0, 12)}... (hits: ${cacheHits}, misses: ${cacheMisses})`);
  } catch (e) {
    console.error(`[gemini-client] Cache write failed: ${e.message}`);
  }
}

/**
 * Get cache statistics.
 */
export function getCacheStats() {
  return { hits: cacheHits, misses: cacheMisses, dir: CACHE_DIR };
}

// ── Token budget ──────────────────────────────────────────────────

const MAX_TOKENS_PER_VIDEO = parseInt(process.env.MAX_TOKENS_PER_VIDEO || "50000", 10);
let sessionTokens = 0;

/**
 * Track token usage. Called after each API response.
 * Throws if budget exceeded.
 */
function trackTokens(usage) {
  if (usage && typeof usage.total_tokens === "number") {
    sessionTokens += usage.total_tokens;
    console.error(`[gemini-client] Tokens used: ${usage.total_tokens} (session total: ${sessionTokens}/${MAX_TOKENS_PER_VIDEO})`);
    if (sessionTokens > MAX_TOKENS_PER_VIDEO) {
      throw new Error(
        `Token budget exceeded: ${sessionTokens}/${MAX_TOKENS_PER_VIDEO} tokens used this session. ` +
        `Set MAX_TOKENS_PER_VIDEO to increase the limit, or reduce the number of Gemini calls.`
      );
    }
  }
}

/**
 * Get current session token usage.
 */
export function getTokenUsage() {
  return { used: sessionTokens, budget: MAX_TOKENS_PER_VIDEO };
}

/**
 * Reset session token counter (for testing).
 */
export function resetTokenUsage() {
  sessionTokens = 0;
}

// ── Core API call ─────────────────────────────────────────────────

const QUOTA_RE = /quota|RESOURCE_EXHAUSTED|rate.?limit|PerDayPerProject|tokens per minute/i;
const UNAVAILABLE_RE = /UNAVAILABLE|high demand|overloaded|ETIMEDOUT|ECONNRESET|socket hang up|timed? ?out|curl/i;

function classify(statusCode, msg) {
  const code = Number(statusCode) || 0;
  if (code === 429 || QUOTA_RE.test(msg || "")) return "quota_exhausted";
  if (code >= 500 && code < 600) return "unavailable";
  if (code === 400 || code === 401 || code === 403) return "hard_error";
  if (UNAVAILABLE_RE.test(msg || "")) return "unavailable";
  return null;
}
const fail = (error, detail) => ({ source: "gemini", error, detail: String(detail || "").slice(0, 300) });

/**
 * Make a chat completion call to Gemini via OpenAI-compatible endpoint.
 *
 * @param {Array<{role: string, content: string|Array}>} messages
 * @param {Object} opts
 * @param {number} [opts.maxTokens=1200]
 * @param {number} [opts.temperature=0]
 * @param {string} [opts.model="gemini-3.5-flash-lite"]
 * @returns {Promise<Object>} Parsed JSON response, or { source: "gemini", error, detail }
 */
export async function callGemini(messages, opts = {}) {
  const {
    maxTokens = 1200,
    temperature = 0,
    model = "gemini-3.5-flash-lite",
    noCache = false,
  } = opts;

  if (String(process.env.FORCE_PLANNER || "").toLowerCase() === "ollama") {
    console.error("[gemini-client] FORCE_PLANNER=ollama — no Gemini request made");
    return fail("forced_off", "FORCE_PLANNER=ollama");
  }
  try {
    if (!keys) keys = collectKeys();
  } catch (e) {
    return fail("no_key", e.message);
  }

  // Check disk cache first (skip if noCache is set)
  const ck = noCache ? null : cacheKey(model, messages, maxTokens, temperature);
  if (ck) {
    const cached = cacheGet(ck);
    if (cached) return cached;
  }

  const baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
  const body = JSON.stringify({ model, max_tokens: maxTokens, temperature, messages });

  // 429 / quota rotates through every configured key (each key has its own
  // quota); quota_exhausted is returned only after EVERY key returned it.
  // 503 keeps its one retry after 5 s. Run 36431582306 fell to Ollama on
  // every channel while two of three keys still had quota.
  const tag = opts.tag || "gemini";
  const tried = new Set();
  let unavailableRetried = false;
  for (;;) {
    let kind = null, detail = "";
    tried.add(keyIndex);
    try {
      const res = execFileSync("curl", [
        "-sS", "--max-time", String(REQUEST_TIMEOUT_S),
        "-H", "Content-Type: application/json",
        "-H", `Authorization: Bearer ${currentKey()}`,
        "-d", "@-",
        `${baseUrl}/chat/completions`,
      ], { input: body, encoding: "utf-8", timeout: (REQUEST_TIMEOUT_S + 10) * 1000 });

      let parsed = JSON.parse(res);
      // The API sometimes wraps its error in an array: [{"error": {...}}]
      // (run 36422387281: '503 ... high demand' came back this way).
      if (Array.isArray(parsed) && parsed[0] && parsed[0].error) parsed = parsed[0];

      // Track token usage (budget enforcement)
      if (parsed.usage) {
        try {
          trackTokens(parsed.usage);
        } catch (e) {
          return fail("budget_exhausted", e.message);
        }
      }

      if (parsed.error) {
        const statusCode = parsed.error.code || parsed.error.status || 0;
        detail = `${statusCode}: ${parsed.error.message || JSON.stringify(parsed.error)}`;
        kind = classify(statusCode, detail) || "bad_response";
      } else if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
        // Success — extract content
        const content = parsed.choices[0].message.content;
        let result;
        if (typeof content === "string") {
          // Try to parse as JSON (handles markdown fences)
          const cleaned = content.trim()
            .replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
          try {
            result = JSON.parse(cleaned);
          } catch {
            // Not JSON — return raw content wrapped
            result = { content };
          }
        } else {
          result = parsed.choices[0].message;
        }
        // Write to cache on success
        if (ck && !result.error) {
          cacheSet(ck, result);
        }
        console.error(`[${tag}] gemini key ${keyIndex + 1}/${keys.length} answered`);
        return result;
      } else {
        kind = "bad_response";
        detail = `unexpected response shape: ${JSON.stringify(parsed).slice(0, 240)}`;
      }
    } catch (e) {
      detail = String(e.message || e);
      kind = classify(0, detail) || "unavailable";
    }

    if (kind === "quota_exhausted") {
      const next = keys.findIndex((_, i) => !tried.has(i));
      if (next >= 0) {
        console.error(`[gemini] key ${keyIndex + 1} exhausted, trying key ${next + 1}`);
        keyIndex = next;
        continue;
      }
      console.error(`[gemini] all keys exhausted, falling to ollama`);
      return fail(kind, detail);
    }
    if (kind === "unavailable" && !unavailableRetried) {
      unavailableRetried = true;
      console.error(`[gemini-client] key ${keyIndex + 1} unavailable (${detail.slice(0, 160)}) — one retry in 5 s`);
      await sleep(5000);
      continue;
    }
    console.error(`[gemini-client] key ${keyIndex + 1} ${kind}: ${detail.slice(0, 200)}`);
    return fail(kind, detail);
  }
}

// ── Synchronous variant (for scripts that can't use async) ────────

/**
 * Synchronous version of callGemini for use in non-async contexts.
 * Uses spawnSync instead of execFileSync with timeout.
 */
export function callGeminiSync(messages, opts = {}) {
  const {
    maxTokens = 1200,
    temperature = 0,
    model = "gemini-3.5-flash-lite",
  } = opts;

  if (!keys) keys = collectKeys();

  const baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
  const totalKeys = keys.length;

  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const apiKey = currentKey();
    const body = JSON.stringify({ model, max_tokens: maxTokens, temperature, messages });

    try {
      const res = execFileSync("curl", [
        "-sS", "--max-time", String(REQUEST_TIMEOUT_S),
        "-H", "Content-Type: application/json",
        "-H", `Authorization: Bearer ${apiKey}`,
        "-d", "@-",
        `${baseUrl}/chat/completions`,
      ], { input: body, encoding: "utf-8" });

      const parsed = JSON.parse(res);

      if (parsed.error) {
        const statusCode = parsed.error.code || parsed.error.status || 0;
        const errorMsg = parsed.error.message || JSON.stringify(parsed.error);

        if (isRetryable(statusCode, errorMsg)) {
          console.error(`[gemini-client] Retryable error on key ${keyIndex + 1}: ${errorMsg.slice(0, 150)}`);
          if (advanceKey()) continue;
          break;
        }

        if (isHardError(statusCode)) {
          return { error: `Gemini API hard error (${statusCode}): ${errorMsg.slice(0, 300)}` };
        }
      }

      if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
        const content = parsed.choices[0].message.content;
        if (typeof content === "string") {
          const cleaned = content.trim()
            .replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
          try {
            return JSON.parse(cleaned);
          } catch {
            return { content };
          }
        }
        return parsed.choices[0].message;
      }

      if (advanceKey()) continue;
      break;

    } catch (e) {
      const msg = String(e.message || e);
      if (isRetryable(0, msg)) {
        console.error(`[gemini-client] Network error on key ${keyIndex + 1}: ${msg.slice(0, 150)}`);
        if (advanceKey()) continue;
        break;
      }
      return { error: `Gemini API call failed: ${msg.slice(0, 300)}` };
    }
  }

  return { error: `All ${totalKeys} Gemini keys exhausted` };
}

// ── Helpers ───────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Get the number of available keys (for testing/diagnostics).
 */
export function getKeyCount() {
  if (!keys) keys = collectKeys();
  return keys.length;
}

/**
 * Reset the key cursor to 0 (for testing).
 */
export function resetKeyCursor() {
  keyIndex = 0;
}
