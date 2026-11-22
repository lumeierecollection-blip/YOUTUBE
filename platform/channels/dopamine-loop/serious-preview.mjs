// Dopamine Loop, serious cut (branch preview/dopamine-loop-serious). Same fetched abstract and script as sample.mjs; no characters. The picture is
// public-domain paintings from Wikimedia Commons (licence checked on the run and recorded) and the study's own sentences on a document card.
// The quoted study text below is copied from the PubMed abstract (PMID 14551436) and each quote is checked against the claims' excerpts before rendering.
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { commonsAsset } from "../../production/commons.mjs";
import { claims, metadata, scenes, sentences, sources } from "./sample.mjs";

const LONG = /-long/.test(process.env.GITHUB_REF_NAME || ""); // 16:9 long-form look test
const sharp = createRequire(join(ROOT, "package.json"))("sharp");
const ART = {
  back: ["File:Vilhelm Hammershoi - Interieur mit Rueckenansicht einer Frau - 1903-1904 - Randers Kunstmuseum.jpg", "Vilhelm Hammershøi, Interior, 1903–04"],
  cafe: ["File:Edgar Degas - In a Café - Google Art Project 2.jpg", "Edgar Degas, In a Café"],
  melancholy: ["File:Edvard Munch - Melancholy (1894-96).jpg", "Edvard Munch, Melancholy, 1894–96"],
  window: ["File:Caspar David Friedrich - Frau am Fenster - Google Art Project.jpg", "C. D. Friedrich, Woman at a Window"],
  moon: ["File:Caspar David Friedrich - Two Men Contemplating the Moon - Google Art Project.jpg", "C. D. Friedrich, Two Men Contemplating the Moon"],
};
const STUDY = {
  journal: "Science · 10 Oct 2003", id: "PMID 14551436", title: "Does rejection hurt? An fMRI study of social exclusion", authors: "Eisenberger NI, Lieberman MD, Williams KD · Science 302(5643):290-2",
  find1: "…the anterior cingulate cortex (ACC) was more active during exclusion than during inclusion and correlated positively with self-reported distress.", hl1: ["more active during exclusion than during inclusion", "correlated positively with self-reported distress"],
  find2: "Right ventral prefrontal cortex (RVPFC) was active during exclusion and correlated negatively with self-reported distress.", hl2: ["correlated negatively with self-reported distress"],
};

export default async function seriousPreview({ key, runId, tools }) {
  // Every sentence shown on the document card must be inside a claim excerpt that was copied from the fetched abstract.
  const excerpts = claims.map((c) => c.excerpt).join(" ");
  for (const q of [STUDY.find1.replace(/^…/, ""), STUDY.find2, ...STUDY.hl1, ...STUDY.hl2]) if (!excerpts.includes(q)) throw new Error(`quoted study text is not in the fetched abstract excerpts: ${q}`);

  const images = {}, credits = {}, entries = [];
  for (const [k, [title, label]] of Object.entries(ART)) {
    const { file, entry } = await commonsAsset({ title, dir: join(tools.outDir, "assets"), id: `art-${k}`, role: "background painting, illustrative mood only", kind: "illustrative" });
    if (!/public domain/i.test(entry.licence)) throw new Error(`${title} is not public domain (${entry.licence})`);
    const jpg = await sharp(file).resize({ width: 1300, withoutEnlargement: true }).jpeg({ quality: 84 }).toBuffer();
    images[k] = `data:image/jpeg;base64,${jpg.toString("base64")}`; credits[k] = `${label} · public domain`; entries.push(entry);
  }
  tools.write("asset-manifest.json", { note: "Paintings are public-domain works from Wikimedia Commons, used as mood plates and credited on screen. They do not depict the study. Nothing is AI-generated.", assets: entries });
  await runFixedShort({ key, runId, tools, spec: { topic: "Why being left out hurts", claims, sources, sentences, scenes, compositionId: LONG ? "DopamineSeriousWide" : "DopamineSerious", size: LONG ? [1920, 1080] : undefined, edgeVoice: "en-GB-RyanNeural", gravity: "serious", voice: "Charon", metadata, minSeconds: 20, maxSeconds: 32, makeProps: () => ({ images, credits, study: STUDY }) } });
}
