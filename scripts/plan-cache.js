#!/usr/bin/env node
/**
 * plan-cache.js - Deterministic visual plan caching via content hash.
 *
 * Hashes script + SRT + channel identity + capability version.
 * Reuses cached plans to save Gemini tokens.
 *
 * Usage:
 *   import { getCachedPlan, setCachedPlan, planCacheKey } from './plan-cache.js';
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, '.cache', 'visual-plans');
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CAPABILITY_VERSION = '1.0.0';
const SCHEMA_VERSION = '1.0.0';

/**
 * Generate a content hash for plan caching.
 */
export function planCacheKey(scriptPath, srtPath, channelId, channelConfig) {
  const parts = [];
  if (scriptPath && existsSync(scriptPath)) {
    parts.push(readFileSync(scriptPath, 'utf-8'));
  }
  if (srtPath && existsSync(srtPath)) {
    parts.push(readFileSync(srtPath, 'utf-8'));
  }
  if (channelConfig) {
    parts.push(JSON.stringify({
      style: channelConfig.style,
      colors: channelConfig.colors,
      font: channelConfig.font,
      bg_mode: channelConfig.bg_mode,
      asset_treatment: channelConfig.asset_treatment,
    }));
  }
  parts.push(CAPABILITY_VERSION, SCHEMA_VERSION);
  const canonical = parts.join('---CACHE_SEP---');
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Get a cached plan. Returns null on miss or expired entry.
 */
export function getCachedPlan(cacheKey) {
  try {
    const cachePath = join(CACHE_DIR, cacheKey + '.json');
    if (!existsSync(cachePath)) return null;
    const raw = JSON.parse(readFileSync(cachePath, 'utf-8'));
    if (Date.now() - raw.timestamp > CACHE_TTL_MS) return null;
    console.error('[plan-cache] HIT: ' + cacheKey.slice(0, 12) + '...');
    return raw.plan;
  } catch {
    return null;
  }
}

/**
 * Store a plan in the cache.
 */
export function setCachedPlan(cacheKey, plan) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    const cachePath = join(CACHE_DIR, cacheKey + '.json');
    writeFileSync(cachePath, JSON.stringify({
      timestamp: Date.now(),
      cacheKey,
      plan,
    }, null, 2) + '\n');
    console.error('[plan-cache] SET: ' + cacheKey.slice(0, 12) + '...');
  } catch (e) {
    console.error('[plan-cache] Write failed: ' + e.message);
  }
}

/**
 * Invalidate a specific cache entry.
 */
export function invalidatePlan(cacheKey) {
  try {
    const cachePath = join(CACHE_DIR, cacheKey + '.json');
    if (existsSync(cachePath)) {
      const { rmSync } = require('node:fs');
      rmSync(cachePath);
      console.error('[plan-cache] INVALIDATED: ' + cacheKey.slice(0, 12) + '...');
    }
  } catch {}
}

/**
 * Get cache statistics.
 */
export function getCacheStats() {
  try {
    const { readdirSync } = require('node:fs'); const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    return { entries: files.length };
  } catch {
    return { entries: 0 };
  }
}

// CLI
if (process.argv.includes('--stats')) {
  const stats = getCacheStats();
  console.log(JSON.stringify(stats, null, 2));
}