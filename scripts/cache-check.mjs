#!/usr/bin/env node
/**
 * cache-check — proves the response cache survives between CI jobs (owner, 2026-10-10).
 *
 *   node scripts/cache-check.mjs write   # job 1: one real Gemini call, cached to .cache/gemini
 *   node scripts/cache-check.mjs read    # job 2 (cache restored): the SAME call must be answered from the cache, with no network call
 *
 * Prints the cache key, whether its file existed before the call, and whether gemini-client logged "Cache HIT". Exit 1 if the read job
 * had to call the network. Text only (the text endpoint is the one that still answers while audio is quota-limited).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { callGemini } from "../src/lib/gemini-client.js";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const MODE = process.argv[2];
const opts = { model: "gemini-3.5-flash-lite", maxTokens: 64, temperature: 0, tag: "cache-check" };
const messages = [{ role: "user", content: "Reply with exactly the word: cached" }];
// The same canonical request gemini-client keys on (src/lib/gemini-client.js cacheKey).
const key = createHash("sha256").update(JSON.stringify({ model: opts.model, messages, maxTokens: opts.maxTokens, temperature: opts.temperature })).digest("hex");
const file = join(ROOT, ".cache", "gemini", `${key}.json`);
const before = existsSync(file);

const hits = [];
const orig = console.error;
console.error = (...a) => { const s = a.join(" "); if (/Cache HIT/.test(s)) hits.push(s); orig(...a); };
const t0 = Date.now();
const r = await callGemini(messages, opts);
console.error = orig;
const ms = Date.now() - t0;
const answer = r && typeof r === "object" ? (r.error ? `ERROR ${r.error}` : JSON.stringify(r).slice(0, 80)) : String(r);
console.log(`[cache-check] ${MODE}: key ${key.slice(0, 16)}… file existed before the call: ${before}; answer: ${answer}; ${ms} ms; cache HIT logged: ${hits.length > 0}`);
if (MODE === "read" && !before) { console.error("::error::the cache did not survive to this job: the call went to the network"); process.exit(1); }
if (MODE === "read" && hits.length === 0) { console.error("::error::the file was there but gemini-client did not answer from it"); process.exit(1); }
