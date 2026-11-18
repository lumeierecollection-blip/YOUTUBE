#!/usr/bin/env node
/** Downloads Wikimedia Commons photographs (licence checked by platform/production/commons.mjs) into public/lf2/<channel>/ and merges ATTRIBUTIONS.json.
 * Usage: node platform/longform/v2/fetch-photos.mjs <channel-dir> <id> "<File:Title.jpg>" "<what it shows>" [<id> "<title>" "<claim>" ...]
 * The claim is what the picture is allowed to illustrate (it is recorded; keep it literal, e.g. "a crowd at a 2016 match, not a Premier League match"). */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { commonsAsset } from "../../production/commons.mjs";
import { ROOT } from "../../preview/lib.mjs";
const [chDir, ...rest] = process.argv.slice(2);
const dir = join(ROOT, "src/skills/remotion-render/public/lf2", chDir), attPath = join(dir, "ATTRIBUTIONS.json");
const att = existsSync(attPath) ? JSON.parse(readFileSync(attPath, "utf8")) : {};
for (let i = 0; i < rest.length; i += 3) {
  const [id, title, claim] = rest.slice(i, i + 3);
  const { file, entry } = await commonsAsset({ title, dir, id, claim, role: "reference clone 18 Nov 2026" });
  att[id] = { ...entry, file: basename(file), credit_line: `${entry.author}, ${entry.licence}, via Wikimedia Commons`, authenticity: "authentic" };
  console.log(id, "->", basename(file), "|", att[id].credit_line);
}
writeFileSync(attPath, JSON.stringify(att, null, 1));
