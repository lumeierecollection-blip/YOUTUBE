/**
 * fetch-flag — one flag file per code, fetched once and kept (src/skills/remotion-render/public/flags/<code>.png).
 * Source: https://flagcdn.com (national flags and US state flags; a flag is a public-domain emblem). The licence
 * and URL are returned for the beat's credit. A failed fetch returns { ok: false } — the beat keeps its map.
 */
import { existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { flagUrl, flagFile } from "../src/skills/remotion-render/visual/flags.js";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "skills", "remotion-render", "public");

export async function fetchFlag(code) {
  if (!/^[a-z]{2}(-[a-z]{2})?$/.test(String(code || ""))) return { ok: false, why: `not a flag code: ${code}` };
  const rel = flagFile(code), abs = join(PUBLIC_DIR, rel), url = flagUrl(code);
  const credit = { source_url: url, license: "Public domain (a national / state flag)", credit: "flagcdn.com" };
  if (existsSync(abs) && statSync(abs).size > 200) return { ok: true, asset: rel, cached: true, ...credit };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { ok: false, why: `${url}: HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200 || buf.toString("ascii", 1, 4) !== "PNG") return { ok: false, why: `${url}: not a PNG` };
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, buf);
    return { ok: true, asset: rel, cached: false, ...credit };
  } catch (e) { return { ok: false, why: `${url}: ${e.message}` }; }
}
