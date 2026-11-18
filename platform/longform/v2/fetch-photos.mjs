#!/usr/bin/env node
/** Downloads Wikimedia Commons photographs (licence checked by platform/production/commons.mjs) into public/lf2/<channel>/ and merges ATTRIBUTIONS.json.
 * Usage: node platform/longform/v2/fetch-photos.mjs <channel-dir> <id> "<File:Title.jpg>" "<what it shows>" [<id> "<title>" "<claim>" ...]
 * The claim is what the picture is allowed to illustrate (it is recorded; keep it literal, e.g. "a crowd at a 2016 match, not a Premier League match"). */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { commonsAsset } from "../../production/commons.mjs";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");   // not ../../preview/lib.mjs: that loads sharp, which the cutout runner does not install
const [chDir, ...rest] = process.argv.slice(2);
const dir = join(ROOT, "src/skills/remotion-render/public/lf2", chDir), attPath = join(dir, "ATTRIBUTIONS.json");
const att = existsSync(attPath) ? JSON.parse(readFileSync(attPath, "utf8")) : {};
for (let i = 0; i < rest.length; i += 3) {
  const [id, title, claim] = rest.slice(i, i + 3);
  try {
    const { file, entry } = await commonsAsset({ title, dir, id, claim, role: "reference clone 18 Nov 2026" });
    att[id] = { ...entry, file: basename(file), credit_line: `${entry.author}, ${entry.licence}, via Wikimedia Commons`, authenticity: "authentic" };
    writeFileSync(attPath, JSON.stringify(att, null, 1));   // after every picture: a later failure (HTTP 429) must not lose the credits already fetched
    console.log(id, "->", basename(file), "|", att[id].credit_line);
  } catch (e) { console.log("FAILED", id, String(e.message).slice(0, 120)); process.exitCode = 1; }
  await new Promise((r) => setTimeout(r, 4000));   // Commons rate-limits bursts
}
