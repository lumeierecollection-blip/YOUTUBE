// ESM entry point for scripts/lib/channel-lookup.cjs. The repo is "type": "module",
// so ES-module callers import this; CommonJS callers require the .cjs directly.
// Both are the SAME implementation -- there is exactly one resolution rule.
import { createRequire } from "node:module";

const L = createRequire(import.meta.url)("./channel-lookup.cjs");

export const { normalizeChannelId, loadChannels, candidatesFor, resolveChannel, isConsistent } = L;
