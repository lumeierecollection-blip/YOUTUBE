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
  "red-space-facts": [
    ["uranus-voyager2-1986", "File:Uranus2.jpg", "Uranus photographed by Voyager 2, January 1986 (true colour)"],
    ["uranus-voyager2-two-color", "File:Two color images of Uranus from 9.1 million km (Voyager 2, P-29478).tif", "Two colour images of Uranus from 9.1 million km, Voyager 2, 17 January 1986"],
    ["uranus-rings-voyager2", "File:Uranus Rings, Voyager 2.tif", "Uranus's rings, Voyager 2"],
    ["uranus-webb-nircam-2023", "File:STScI-Uranus-NIRCam.png", "Uranus and its rings, JWST NIRCam, 6 April 2023"],
    ["uranus-webb-closeup-2023", "File:Uranus Close-up (NIRCam image) (2023-150).png", "Uranus close-up, JWST NIRCam, December 2023"],
    ["uranus-new-moon-2025", "File:Uranus - New Moon (Annotated) (01K2283APYH89WYXJRX28XW5RT).png", "JWST image with the newly found moon S/2025 U1 annotated, 19 August 2025"],
  ],
  "psychology": [
    ["rosenthal-2008", "File:Robert Rosenthal (15615621830).jpg", "Robert Rosenthal, 2008"],
    ["rosenthal-2018", "File:Robert Rosenthal in 2018.jpg", "Robert Rosenthal, 2018"],
  ],
  "celebrity-news": [
    ["swift-eras-london-2024", "File:Taylor Swift Eras Tour London 20240819 1989era.jpg", "Taylor Swift, Eras Tour, London, 19 August 2024"],
    ["swift-eras-bcplace-2024", "File:Taylor Swift The Eras Tour at BC Place, Landscape.jpg", "Taylor Swift, Eras Tour, BC Place Vancouver, December 2024"],
    ["swift-eras-red-2023", "File:Eras Tour - Inglewood, California - Red act 7.jpg", "Taylor Swift, Eras Tour Red act, Inglewood, 9 August 2023"],
    ["swift-2007", "File:Taylor Swift (2007) retouched.jpg", "Taylor Swift, 2007"],
    ["swift-amas-2019", "File:Taylor Swift AMAs 2019.png", "Taylor Swift at the American Music Awards, 24 November 2019"],
    ["swift-2019-portrait", "File:Taylor Swift 2 - 2019 by Glenn Francis (cropped).jpg", "Taylor Swift, March 2019"],
    ["braun-2022", "File:Scott (Scooter) Braun 2022.jpg", "Scooter Braun, 2022"],
  ],
  "rival-lines": [
    ["spain-moncloa-2024-1", "File:Sánchez se reunió con los futbolistas de la selección española tras ganar la Eurocopa 2024 (1).jpg", "Spain's squad at La Moncloa after winning Euro 2024, 15 July 2024"],
    ["spain-moncloa-2024-2", "File:Sánchez se reunió con los futbolistas de la selección española tras ganar la Eurocopa 2024 (2).jpg", "Spain's squad at La Moncloa after winning Euro 2024, 15 July 2024"],
    ["spain-moncloa-2024-3", "File:Sánchez se reunió con los futbolistas de la selección española tras ganar la Eurocopa 2024 (3).jpg", "Spain's squad at La Moncloa after winning Euro 2024, 15 July 2024"],
    ["olympiastadion-2024", "File:Olympiastadion, Berlin (LRM 20240812 134444).jpg", "Olympiastadion Berlin, August 2024"],
    ["oyarzabal-2018", "File:Mikel Oyarzabal 2018.jpg", "Mikel Oyarzabal, 2018"],
    ["palmer-2024", "File:ColePalmervsLeicester.jpg", "Cole Palmer v Leicester, 23 November 2024"],
    ["yamal-2025", "File:Lamine Yamal in 2025.jpg", "Lamine Yamal, 2025"],
  ],
};

if (process.argv[1] && process.argv[1].endsWith("assets.mjs")) {
  for (const ch of process.argv[2] ? [process.argv[2]] : Object.keys(ASSETS)) {
    const dir = join(ROOT, "src/skills/remotion-render/public/lf2", ch), manifestFile = join(dir, "ATTRIBUTIONS.json"), manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : {};
    for (const [id, title, claim] of ASSETS[ch]) {
      if (manifest[id] && existsSync(join(dir, manifest[id].file))) continue;
      try {
        const { file, entry } = await commonsAsset({ title, dir, id, claim, role: "long-form sample episode" });
        // TIFF originals (NASA) are not browser images: re-encode anything that is not JPEG or PNG to a real JPEG at the same path.
        const head = await sharp(file).metadata();
        if (!["jpeg", "png"].includes(head.format)) { const buf = await sharp(file).resize({ width: 2400, withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer(); writeFileSync(file, buf); }
        const meta = await sharp(file).metadata();
        manifest[id] = { ...entry, file: file.split(/[\\/]/).pop(), width: meta.width, height: meta.height };
        console.log("ok", ch, id, entry.licence, `${meta.width}x${meta.height}`);
      } catch (e) { console.log("REFUSED", ch, id, e.message); }
      writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
    }
  }
}
