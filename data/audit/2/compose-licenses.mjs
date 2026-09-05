// Stage 2 (CLAIM-assets-005): compose THIRD_PARTY_LICENSES.md = existing
// content + OFL section with verbatim OFL 1.1 text and per-family copyright
// lines. UTF-8 safe (PowerShell 5.1 Get-Content/Set-Content mangles UTF-8).
import { readFileSync, writeFileSync } from "fs";

const head = readFileSync("THIRD_PARTY_LICENSES.md", "utf8");
const ofl = readFileSync("data/audit/2/ofl-1.1.txt", "utf8").trim();
if (head.includes("SIL Open Font License")) {
  throw new Error("head already contains a fonts section");
}

const rows = [
  ["Inter", "Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter)"],
  ["DM Sans", "Copyright 2014 The DM Sans Project Authors (https://github.com/googlefonts/dm-fonts)"],
  ["JetBrains Mono", "Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)"],
  ["Roboto Condensed", "Copyright 2011 The Roboto Project Authors (https://github.com/googlefonts/roboto-classic)"],
  ["Nunito", "Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito)"],
  ["Fira Sans", "Copyright (c) 2012-2015, The Mozilla Foundation and Telefonica S.A."],
  ["Comic Neue", "Copyright 2014 The Comic Neue Project Authors (https://github.com/crozynski/comicneue)"],
  ["Noto Serif", "Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic)"],
  ["Space Grotesk", "Copyright 2020 The Space Grotesk Project Authors (https://github.com/floriankarsten/space-grotesk)"],
  ["Cormorant Garamond", "Copyright 2015 the Cormorant Project Authors (github.com/CatharsisFonts/Cormorant)"],
  ["Oswald", "Copyright 2016 The Oswald Project Authors (https://github.com/googlefonts/OswaldFont)"],
  ["Bebas Neue", "Copyright \u00a9 2010 by Dharma Type."],
  ["Playfair Display", "Copyright 2017 The Playfair Display Project Authors (https://github.com/clauseggers/Playfair-Display), with Reserved Font Name \"Playfair Display\""],
];

const table = rows.map(([f, c]) => `| ${f} | ${c} |`).join("\n");

const section = [
  "",
  "## Fonts \u2014 SIL Open Font License 1.1",
  "",
  "Vendored into `src/skills/remotion-render/public/fonts/` from Google Fonts",
  "(latin subsets, fetched via fonts.googleapis.com/css2). Each family ships an",
  "`OFL.txt` in the google/fonts repository; the copyright lines below are taken",
  "verbatim from each family\u2019s `OFL.txt`.",
  "",
  "| Family | Copyright line (from google/fonts OFL.txt) |",
  "|---|---|",
  table,
  "",
  "Full licence text (the SIL Open Font License, Version 1.1, 26 February 2007):",
  "",
  "```",
  ofl,
  "```",
  "",
].join("\n");

const out = head.replace(/\s+$/, "") + "\n" + section + "\n";
writeFileSync("THIRD_PARTY_LICENSES.md", out, "utf8");
console.log("composed THIRD_PARTY_LICENSES.md, chars=" + out.length);
