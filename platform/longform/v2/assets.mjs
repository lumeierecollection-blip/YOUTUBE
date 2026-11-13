#!/usr/bin/env node
/**
 * Long form v2: downloads the real photographs each sample episode uses from Wikimedia Commons into the Remotion public folder, and writes
 * the licence manifest next to them (public/lf2/<channel>/ATTRIBUTIONS.json). Refuses anything whose licence does not allow reuse
 * (platform/production/commons.mjs). Usage: node platform/longform/v2/assets.mjs [channel]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
import { commonsAsset } from "../../production/commons.mjs";

const sharp = createRequire(join(ROOT, "package.json"))("sharp");
export const ASSETS = {
  "hidden-past": [
    ["troop-carrier-1967", "File:Six Day War. An Israeli troop carrier on the east bank of the Suez Canal opposite Ismailia. June 1967. D326-110.jpg", "Israeli troop carrier on the east bank of the canal, June 1967"],
    ["boat-port-tewfik-1967", "File:Six Day War. Israeli boat on Suez Canal. In background Port Tewfik. June 1967. D326-113.jpg", "Israeli boat on the canal, Port Tewfik behind, 9 June 1967"],
    ["bitter-lake-space", "File:Great Bitter Lake from space (hires).JPG", "Great Bitter Lake photographed from orbit, 2002"],
    ["suezship-1973", "File:Suezship.JPG", "Ship in the canal zone, November 1973"],
    ["minesweep-1974", "File:RH-53Ds sweeping the Suez Canal 1974.jpg", "US Navy RH-53D helicopters sweeping the canal for mines, 1974"],
    ["minesweep-1974-b", "File:RH-53D sweeping Suez Canal 1974.jpg", "RH-53D sweeping the canal, 1974"],
    ["little-rock-1975", "File:Foredeck of USS Little Rock (CLG-4) on 5 June 1975 (NH 98966).jpg", "USS Little Rock in the reopening convoy, 5 June 1975"],
    ["canal-1967-a", "File:Suez Canal 997009324813105171.jpg", "Suez Canal, 1967"],
    ["canal-1967-b", "File:Suez Canal 997009324827405171.jpg", "Suez Canal, 1967"],
  ],
  "court-and-spotlight": [
    ["becker-1994", "File:Boris Becker (cropped).jpg", "Boris Becker, 1994"],
    ["becker-action-1994", "File:Boris Becker in action.jpg", "Boris Becker playing, 1994"],
    ["becker-2007", "File:Boris Becker 2007 amk.jpg", "Boris Becker, 2007"],
    ["becker-2013", "File:Boris Becker Frankfurter Buchmesse 2013 1.JPG", "Boris Becker at the Frankfurt Book Fair, 2013"],
    ["becker-2018", "File:Boris Becker 2018.jpg", "Boris Becker, 2018"],
    ["becker-2019", "File:Boris Becker - 2019102190927 2019-04-12 Radio Regenbogen Award 2019 - Sven - 1D X MK II - 0283 - B70I6481-2.jpg", "Boris Becker, April 2019"],
  ],
};

if (process.argv[1] && process.argv[1].endsWith("assets.mjs")) {
  for (const ch of process.argv[2] ? [process.argv[2]] : Object.keys(ASSETS)) {
    const dir = join(ROOT, "src/skills/remotion-render/public/lf2", ch), manifestFile = join(dir, "ATTRIBUTIONS.json"), manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : {};
    for (const [id, title, claim] of ASSETS[ch]) {
      if (manifest[id] && existsSync(join(dir, manifest[id].file))) continue;
      try {
        const { file, entry } = await commonsAsset({ title, dir, id, claim, role: "long-form sample episode" });
        const meta = await sharp(file).metadata();
        manifest[id] = { ...entry, file: file.split(/[\\/]/).pop(), width: meta.width, height: meta.height };
        console.log("ok", ch, id, entry.licence, `${meta.width}x${meta.height}`);
      } catch (e) { console.log("REFUSED", ch, id, e.message); }
      writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
    }
  }
}
