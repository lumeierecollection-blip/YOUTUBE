/**
 * Hidden Past long-form job (branch longform/hidden-past[-...]). This is the PILOT: a real, sourced Charles Ponzi episode of about 2 to 3 minutes,
 * run through the full long-form path (gate, voice per chapter, 16:9 render, QA, thumbnail, YouTube chapters) to prove the pipeline before a
 * 6 to 10 minute episode. It runs under a pilot format (shorter windows, two quotations) and the run records that it did.
 * Every claim's text is checked against the fetched Wikipedia article before anything is voiced; every image is a public-domain Commons file.
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
import { commonsAsset } from "../../production/commons.mjs";
import { AREA, frameMap, pathOf, polygonsOf } from "../../../scripts/autopilot/map-vox.mjs";
import { loadFormats } from "../../longform/script-gate.mjs";
import { runLongform } from "../../longform/run-longform.mjs";
import { reliefFor } from "../../longform/relief.mjs";
import { spawnSync } from "node:child_process";

const sharp = createRequire(join(ROOT, "package.json"))("sharp");
const UA = { "User-Agent": "HiddenPastLongform/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; evidence-led history)" };
const WIKI = "https://en.wikipedia.org/wiki/Charles_Ponzi", SRC = "wiki-ponzi";
const getJson = async (url) => { for (let i = 1; ; i++) { const r = await fetch(url, { headers: UA }); if (r.ok) return r.json(); if (i >= 4) throw new Error(`${url} -> ${r.status}`); await new Promise((res) => setTimeout(res, i * 3000)); } };

const claim = (claim_id, must, text = must) => ({ claim_id, claim: text, source_id: SRC, source_url: WIKI, published: "2026-11-12", excerpt: must, confidence: "high", context: "English Wikipedia, Charles Ponzi, fetched on the run; the excerpt must appear verbatim in the fetched text.", contradictory_evidence: [], editorial_status: "established_fact" });
const CLAIMS = [
  claim("sec", "In January 1920, Ponzi started his own company, the \"Securities Exchange Company\""),
  claim("promise", "He promised clients a 50% profit within 45 days or 100% profit within 90 days"),
  claim("first", "In the first month, 18 people invested in his company with a total of $1,800."),
  claim("lugo", "Born in Lugo, Italy"),
  claim("arrive", "On 15 November 1903, Ponzi arrived in Boston aboard the S.S. Vancouver."),
  claim("pocket", "By his own account, Ponzi had $2.50 in his pocket"),
  claim("hopes", "\"I landed in this country with $2.50 in cash and $1 million in hopes, and those hopes never left me,\""),
  claim("coupons", "buying discounted postal reply coupons in other countries and redeeming them at face value in the U.S."),
  claim("growth", "Between February and March 1920, the total amount invested had risen from $5,000 to $25,000"),
  claim("perday", "At that time, Ponzi was making $250,000 a day."),
  claim("barron", "160 million postal reply coupons would have to be in circulation. However, only about 27,000 actually were."),
  claim("post", "On 26 July 1920, the Post started a series of articles that asked hard questions"),
  claim("lost", "They lost about $20 million in 1920 dollars"),
  claim("counts", "Ponzi was charged with 86 counts of mail fraud"),
  claim("five", "Ponzi was sentenced to five years in federal prison."),
  claim("released", "Ponzi was released in 1934."),
  claim("trouble", "He told reporters before he left, \"I went looking for trouble, and I found it.\""),
  claim("rio", "He died in the charity ward of Hospital São Francisco in Rio de Janeiro on 18 January 1949"),
  claim("estate", "He left an estate of $75, which was barely enough to bury him."),
];
const S = (text, scene, claim_ids, extra = {}) => ({ text, scene, claim_ids, ...extra });
const Q = (text, scene, editorial) => ({ text, scene, claim_ids: [], allow_no_claim: true, editorial });
const CREDIT = "Wikipedia, Charles Ponzi";

const CHAPTERS = [
  { id: "promise", title: "Fifty percent in forty-five days", scenes: [
      { kind: "photo", image: "portrait", portrait: true, name: "Charles Ponzi", note: "Securities Exchange Company, Boston", year: "1920", treatment: "portrait-with-name", objective: "Who and where" },
      { kind: "number", big: "50%", label: "profit promised within 45 days", big2: "$1,800", label2: "from 18 investors in the first month", year: "1920", treatment: "stakes-number", objective: "The promise and the first money" },
      { kind: "title", kicker: "The question", text: "How could a promise that big fall so fast?", treatment: "central-question", objective: "Central question" }],
    sentences: [
      S("In January 1920, a man in Boston named Charles Ponzi started a firm called the Securities Exchange Company.", 0, ["sec"]),
      S("He promised clients a fifty percent profit within forty-five days.", 1, ["promise"]),
      S("In the first month, eighteen people invested a total of one thousand eight hundred dollars.", 1, ["first"]),
      Q("So how could a promise that big fall apart so fast?", 2, "central question, asked before the answer")] },
  { id: "arrival", title: "From Lugo to Boston", scenes: [
      { kind: "map", map: "arrival", caption: "Lugo to Boston", portrait: "faceCut", portraitSide: "left", name: "Charles Ponzi", year: "1903", treatment: "route-map", objective: "Where he came from" },
      { kind: "number", big: "$2.50", label: "in his pocket on arrival, by his own account", year: "1903", treatment: "stakes-number", objective: "How little he had" },
      { kind: "quote", quote: "I landed in this country with $2.50 in cash and $1 million in hopes, and those hopes never left me", speaker: "Charles Ponzi", source: CREDIT, year: "1903", treatment: "quote-card", objective: "His own words" }],
    sentences: [
      S("Ponzi was born in Lugo, in Italy.", 0, ["lugo"]),
      S("On the fifteenth of November 1903, he arrived in Boston aboard the steamship Vancouver.", 0, ["arrive"]),
      S("By his own account, he had two dollars and fifty cents in his pocket.", 1, ["pocket"]),
      S("Later he said he landed with two dollars fifty in cash and a million dollars in hopes.", 2, ["hopes"], { quote: { source_id: SRC, text: "I landed in this country with $2.50 in cash and $1 million in hopes, and those hopes never left me", speaker: "Charles Ponzi" } })] },
  { id: "coupons", title: "The coupons", scenes: [
      { kind: "photo", image: "desk", name: "Charles Ponzi at his desk", year: "1920", treatment: "framed-photo", objective: "The man at work" },
      { kind: "number", big: "$5,000", label: "invested by February 1920", big2: "$25,000", label2: "by March", year: "1920", treatment: "growth-numbers", objective: "How fast it grew" },
      { kind: "number", big: "$250,000", label: "taken in a day, late July 1920", year: "1920", treatment: "stakes-number", objective: "The peak" },
      { kind: "number", big: "160,000,000", label: "coupons needed to cover the money", big2: "27,000", label2: "actually in circulation", year: "1920", treatment: "needed-vs-existed", objective: "Why it could not work" }],
    sentences: [
      S("His story was that he bought international reply coupons cheaply abroad and redeemed them at face value in the United States.", 0, ["coupons"]),
      S("Between February and March 1920, the money invested rose from five thousand to twenty-five thousand dollars.", 1, ["growth"]),
      S("By late July, Ponzi was taking in two hundred and fifty thousand dollars a day.", 2, ["perday"]),
      S("But to cover the money, a hundred and sixty million coupons would have had to exist, and only about twenty-seven thousand did.", 3, ["barron"])] },
  { id: "fall", title: "The fall", scenes: [
      { kind: "title", kicker: "26 July 1920", text: "The Boston Post starts asking questions", year: "1920", treatment: "date-card", objective: "The turn" },
      { kind: "number", big: "$20,000,000", label: "lost by investors, in 1920 dollars", year: "1920", treatment: "stakes-number", objective: "What it cost" },
      { kind: "photo", image: "mug", name: "Booking photograph of Charles Ponzi", year: "1920", treatment: "framed-photo", objective: "The charge and sentence" },
      { kind: "quote", quote: "I went looking for trouble, and I found it.", speaker: "Charles Ponzi, to reporters, 1934", source: CREDIT, year: "1934", treatment: "quote-card", objective: "His own words on leaving" },
      { kind: "map", map: "exile", caption: "Boston to Rio de Janeiro", year: "1949", treatment: "route-map", objective: "Where it ended" },
      { kind: "title", kicker: "Tell us below", text: "Would you have trusted fifty percent in forty-five days?", treatment: "comment-question", objective: "Question for the comments" }],
    sentences: [
      S("On the twenty-sixth of July 1920, the Boston Post started asking hard questions.", 0, ["post"]),
      S("Investors lost about twenty million dollars in nineteen-twenty money.", 1, ["lost"]),
      S("Charged with eighty-six counts of mail fraud, Ponzi was sentenced to five years in federal prison.", 2, ["counts", "five"]),
      S("Released in 1934, he told reporters that he went looking for trouble and found it.", 3, ["released", "trouble"], { quote: { source_id: SRC, text: "I went looking for trouble, and I found it.", speaker: "Charles Ponzi" } }),
      S("He died in Rio de Janeiro in 1949, leaving an estate of seventy-five dollars.", 4, ["rio", "estate"]),
      Q("Would you have trusted a promise of fifty percent in forty-five days?", 5, "question for the comments")] },
];

/** A pilot runs the real gate with shorter windows; the record (script-gate.json) shows pilot: true. */
function pilotFormats() {
  const f = loadFormats();
  f.shared.quotes_required = 2;
  Object.assign(f.channels["hidden-past"], { minutes: [1.2, 4], chapters: [3, 6], chapter_minutes: [0.2, 2], question_by_words: 120 });
  return f;
}

async function coords(title) {
  const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=coordinates&redirects=1&titles=${encodeURIComponent(title)}`);
  const c = Object.values(j.query.pages)[0].coordinates?.[0];
  if (!c) throw new Error(`no coordinates for ${title}`);
  return { lat: c.lat, lon: c.lon };
}
const FULL = { x: 0, y: 0, w: 1920, h: 1080 };
async function routeMap(places) {
  const pts = []; for (const p of places) pts.push({ ...p, ...(await coords(p.title)) });
  const m = frameMap(pts, undefined, { area: FULL }), focused = new Set(m.focusFeatures);
  const landD = pathOf(m.features.filter((f) => !focused.has(f)).flatMap((f) => polygonsOf(f)), m.project, true, FULL);
  const countryD = pathOf(m.focusFeatures.flatMap((f) => polygonsOf(f)), m.project, true, FULL);
  const pins = pts.map((p) => { const [x, y] = m.project([p.lon, p.lat]); return { name: p.name, x, y, side: x > 1500 ? "left" : "right" }; });
  const relief = await reliefFor(m.box, FULL);
  return { landD, countryD, labels: [], pins, routeD: "M" + pins.map((p) => `${p.x} ${p.y}`).join(" L"), places: pts, relief };
}

export default async function hiddenPastLongform({ key, runId, tools }) {
  const wiki = Object.values((await getJson("https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=Charles_Ponzi")).query.pages)[0].extract;
  for (const c of CLAIMS) if (!wiki.includes(c.excerpt)) throw new Error(`claim ${c.claim_id}: "${c.excerpt}" not found in the fetched article`);
  const pkg = { channel: key, topic: "Charles Ponzi and the 1920 Boston scheme", title: "Charles Ponzi: The Promise That Named a Fraud", central_question: "How could a promise that big fall so fast?", claims: CLAIMS, sources: [{ source_id: SRC, url: WIKI, published: "2026-11-12" }], chapters: CHAPTERS };

  const images = {}, credits = {}, entries = [];
  for (const [k, title] of Object.entries({ portrait: "File:Ponzi1920.jpg", desk: "File:Charles Ponzi.jpg", mug: "File:Charles Ponzi mug shot.jpg", face: "File:Chas. Ponzi LCCN2014711137.jpg" })) {
    const { file, entry } = await commonsAsset({ title, dir: join(tools.outDir, "assets"), id: k, claim: "", role: "photograph of Charles Ponzi" });
    if (!/public domain/i.test(entry.licence)) throw new Error(`${title}: licence ${entry.licence}`);
    images[k] = `data:image/jpeg;base64,${(await sharp(file).resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer()).toString("base64")}`;
    credits[k] = entry.credit_line; entries.push(entry);
  }
  { const src = join(tools.outDir, "assets", "face.jpg"), out = join(tools.outDir, "assets", "face-cutout.png");
    const r = spawnSync("python3", [join(ROOT, "platform/production/cutout.py"), src, out, "--model", "isnet-general-use"], { encoding: "utf8", timeout: 900000 });
    if (r.status === 0) { images.faceCut = `data:image/png;base64,${(await sharp(out).resize({ height: 1000, withoutEnlargement: true }).png().toBuffer()).toString("base64")}`; entries.push({ id: "face-cutout", treatment: "photographic cut-out (rembg isnet-general-use) of File:Chas. Ponzi LCCN2014711137.jpg; no pixel generated" }); }
    else console.log("cut-out failed, map shown without portrait:", String(r.stderr).split(String.fromCharCode(10)).filter(Boolean).slice(-2).join(" ")); }
  tools.write("asset-manifest.json", { note: "Public-domain photographs from Wikimedia Commons; maps drawn from Natural Earth with coordinates from English Wikipedia. Nothing is AI-generated.", assets: entries });
  const maps = { arrival: await routeMap([{ title: "Lugo, Emilia-Romagna", name: "Lugo" }, { title: "Boston", name: "Boston" }]), exile: await routeMap([{ title: "Boston", name: "Boston" }, { title: "Rio de Janeiro", name: "Rio de Janeiro" }]) };
  tools.write("map-places.json", Object.fromEntries(Object.entries(maps).map(([k, m]) => [k, m.places])));

  const metadata = {
    title: pkg.title,
    style: "this-is-history", hashtags: ["#history", "#ponzi", "#documentary"],
    summary: [
      "In January 1920 Charles Ponzi, an Italian immigrant who had arrived in Boston in 1903 with $2.50, promised investors a 50% profit in 45 days. His story was that he bought international reply coupons cheaply abroad and redeemed them at face value in the United States.",
      "By late July 1920 he was taking in $250,000 a day. But covering the money would have needed 160 million coupons, and only about 27,000 existed. When the Boston Post started asking questions, the scheme collapsed: investors lost about $20 million, and Ponzi, charged with 86 counts of mail fraud, was sentenced to five years in federal prison.",
      "Released and deported in 1934, he died in Rio de Janeiro in 1949, leaving an estate of $75.",
    ],
    credits: "Photographs: public domain, Wikimedia Commons. Maps: Natural Earth (public domain), coordinates from English Wikipedia.",
    question: "Would you have trusted a promise of 50% in 45 days? Tell us in the comments.",
    description: "In 1920 Charles Ponzi promised Boston investors a 50% profit in 45 days. He arrived in 1903 with $2.50; by late July 1920 he was taking in $250,000 a day. Covering the money would have needed 160 million postal reply coupons, and only about 27,000 existed. Investors lost about $20 million. Every fact is from the English Wikipedia article on Charles Ponzi; the photographs are public domain, from Wikimedia Commons. Would you have trusted a promise of 50% in 45 days? Tell us in the comments.\n\n#History #Ponzi #Fraud #HiddenPast\n\nSource: " + WIKI,
    tags: ["Charles Ponzi", "Ponzi scheme", "history documentary", "fraud", "1920 Boston", "financial history"],
  };
  await runLongform({ key, runId, tools, spec: { pkg, compositionId: "HiddenPastLongform", formats: pilotFormats(), metadata, edgeVoice: "en-GB-RyanNeural", gravity: "serious", voice: "Charon",
    makeProps: () => ({ images, credits, maps }), thumbnail: { compositionId: "HiddenPastLongThumb", props: { image: images.portrait, words: ["Ponzi", "1920"], maps, map: "exile" } }, renderMinutes: 60 } });
}
