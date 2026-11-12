// Court & Spotlight, serious cut (branch preview/court-and-spotlight-serious). Same fetched sources, claims and script as proof-investigation.mjs,
// drawn on the dark kit: the source sentences themselves are on screen with the quoted words highlighted. Every quoted string below is checked
// against the claims' excerpts before rendering, so nothing on a document card can differ from the fetched text.
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { commonsAsset } from "../../production/commons.mjs";
import * as proof from "./proof-investigation.mjs";

const sharp = createRequire(join(ROOT, "package.json"))("sharp");
const CBS = "CBS News · 25 Apr 2008";
const QUOTES = {
  doj: ["sentenced Wesley Trent Snipes to three years imprisonment Thursday for charges of failing to file income tax returns.", "Snipes was found guilty by a jury on February 1."],
  acq: "Snipes was acquitted in February of five additional charges, including felony tax fraud and conspiracy.",
  alleged: "The government alleged Snipes made at least $13.8 million for the years in question and owed $2.7 million in back taxes.",
  sought: "a victory for prosecutors who sought to make an example of the action star by aggressively pursuing the maximum penalty.",
};
const C = {
  tag: "Case file", kicker: "Federal tax case · 2008", name: ["Wesley", "Snipes"], years: 3, offence: "Failure to file tax returns",
  doj: { source: "U.S. Department of Justice", meta: "Press release", text: `…${QUOTES.doj[0]} … ${QUOTES.doj[1]}`, hl: ["failing to file income tax returns", "found guilty by a jury on February 1"], count: "Failure to file", credit: "DOJ release, as republished by Blast Magazine" },
  acq: { n: 5, source: CBS, text: QUOTES.acq, hl: ["acquitted", "felony tax fraud and conspiracy"] },
  alleged: { value: 13.8, label: "in income, prosecutors alleged", source: CBS, text: QUOTES.alleged, hl: ["alleged", "at least $13.8 million"] },
  sought: { source: CBS, text: `…${QUOTES.sought}`, hl: ["pursuing the maximum penalty"], line: [["Guilty verdict", "1 Feb"], ["Sentence", "24 Apr 2008"]] },
  booking: { kicker: "U.S. Marshals Service · booking photo", credit: "U.S. Marshals Service · public domain", date: "Dated 24 April 2008" },
};
const KIND = { timeline: "acquitted" };

export default async function seriousPreview({ key, runId, tools }) {
  const excerpts = proof.claims.map((c) => c.excerpt).join(" ");
  for (const q of [...QUOTES.doj, QUOTES.acq, QUOTES.alleged, QUOTES.sought, ...C.doj.hl, ...C.acq.hl, ...C.alleged.hl, ...C.sought.hl]) if (!excerpts.includes(q)) throw new Error(`quoted text is not in a fetched claim excerpt: ${q}`);

  const images = {}, entries = [];
  for (const a of proof.ASSETS) {
    const { file, entry } = await commonsAsset({ title: a.title, dir: join(tools.outDir, "assets"), id: a.id, claim: a.claim, role: a.role });
    const jpg = await sharp(file).resize({ width: 1000, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
    images[a.key] = `data:image/jpeg;base64,${jpg.toString("base64")}`; entries.push(entry);
    if (a.key === "portrait") C.portraitCredit = `${entry.credit_line} · shown in b/w`.replace(/, /g, " · ");
  }
  tools.write("asset-manifest.json", { note: "Both photographs are real Wikimedia Commons files with their licences recorded. The portrait is shown in black and white, uncropped of its subject. Documents are typeset excerpts of fetched text. Nothing is AI-generated.", assets: entries, documents: proof.DOCUMENTS });
  const scenes = proof.scenes.map((s) => ({ ...s, kind: KIND[s.kind] || s.kind, background: "black field" }));
  await runFixedShort({ key, runId, tools, spec: { topic: proof.metadata.title, claims: proof.claims, sources: proof.sources, sentences: proof.sentences, scenes, compositionId: "CourtSerious", edgeVoice: "en-US-GuyNeural", gravity: "serious", voice: "Charon", metadata: proof.metadata, minSeconds: 20, maxSeconds: 32, makeProps: () => ({ images, c: C }) } });
}
