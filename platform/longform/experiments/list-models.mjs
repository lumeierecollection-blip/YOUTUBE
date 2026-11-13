#!/usr/bin/env node
/** Lists the Google models our API keys can reach (names and generateContent support only; no prompt is sent, no quota is spent). Usage: node list-models.mjs <out.json> */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
const out = process.argv[2] || "output/models.json";
const keys = ["GEMINI_API_KEY_1", "GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"].map((k) => process.env[k]).filter(Boolean);
const seen = new Map();
for (const [i, key] of keys.entries()) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${key}`);
  if (!r.ok) { console.log(`key ${i + 1}: HTTP ${r.status}`); continue; }
  for (const m of (await r.json()).models || []) seen.set(m.name, { name: m.name.replace("models/", ""), display: m.displayName, methods: m.supportedGenerationMethods, version: m.version, updated: m.description?.slice(0, 120) });
  console.log(`key ${i + 1}: ok`);
}
const list = [...seen.values()].filter((m) => (m.methods || []).includes("generateContent")).sort((a, b) => a.name.localeCompare(b.name));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ date: new Date().toISOString(), keys: keys.length, models: list }, null, 2));
console.log(list.map((m) => `${m.name} | ${m.display}`).join("\n"));
