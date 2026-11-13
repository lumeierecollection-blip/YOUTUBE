// Court & Spotlight long-form sample: "Boris Becker: Four Guilty Verdicts, Twenty Acquittals". A documented case with primary sources:
// the judge's sentencing remarks (judiciary.uk PDF) and two Insolvency Service press releases (gov.uk, captured from the Wayback Machine
// because the live pages now return HTTP 410). Career facts and the release date come from Wikipedia and are marked REPORTED on screen
// where they are not in a primary source. Every card carries its status: court finding / official statement / reported.
// Known inconsistency, stated: paragraph 1 of the sentencing remarks says the bankruptcy order was made on "21 June 2018"; paragraph 2
// of the same document, and both gov.uk releases, say 21 June 2017. The episode uses 21 June 2017 and does not show paragraph 1's date.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";

const D = join(ROOT, "src/skills/remotion-render/public/lf2/court-and-spotlight");
const J = (f) => JSON.parse(readFileSync(join(D, f), "utf8"));
const att = J("ATTRIBUTIONS.json"), credit = (id) => `${att[id].author} / Wikimedia Commons (${att[id].licence})`;
const A = (id) => `lf2/court-and-spotlight/${id}.jpg`;
// page captures: rects are CSS pixels; the screenshots are at the capture scale
const page = (id) => { const m = J(`${id}.json`), s = m.scale; const img = { file: A(m.shots.at(-1).file.replace(".png", "")), w: m.viewport.width * s, h: (m.shots.length === 1 ? m.page_height : m.viewport.height) * s }; /* only the gov.uk captures are full-page (one shot) */ const r = (ph) => (m.rects[ph] || []).map((q) => ({ x: q.x * s, y: q.y * s, w: q.w * s, h: q.h * s })); return { img, r, url: m.url }; };
const pdf = (id, pno) => { const m = J(`${id}.json`), pg = m.pages[pno]; return { img: { file: `lf2/court-and-spotlight/${pg.file.replace(".png", ".jpg")}`, w: pg.w, h: pg.h }, r: (ph) => m.rects[ph] || [] }; };
const G1 = page("gov-convicted"), G2 = page("gov-restrictions"), JU = page("judiciary"), S1 = pdf("sentencing", "1"), S7 = pdf("sentencing7", "7");

export const SOURCES = {
  J: { title: "Sentencing remarks, R v Boris Becker, Southwark Crown Court, 29 April 2022 (HHJ Deborah Taylor)", url: "https://www.judiciary.uk/judgments/sentencing-remarks-r-v-boris-becker/", file: "docs/longform/episodes/court-and-spotlight-becker/sources/R-v-Becker-Sentencing-remarks.pdf", status: "primary, court" },
  G1: { title: "Insolvency Service: Boris Becker convicted of bankruptcy offences (8 April 2022, updated 29 April 2022)", url: "https://www.gov.uk/government/news/boris-becker-convicted-of-bankruptcy-offences", captured_from: "https://web.archive.org/web/2022id_/https://www.gov.uk/government/news/boris-becker-convicted-of-bankruptcy-offences", status: "primary, official" },
  G2: { title: "Insolvency Service: Becker's bankruptcy restrictions extended (5 November 2019)", url: "https://www.gov.uk/government/news/beckers-bankruptcy-restrictions-extended", captured_from: "https://web.archive.org/web/2022id_/https://www.gov.uk/government/news/beckers-bankruptcy-restrictions-extended", status: "primary, official" },
  W: { title: "Wikipedia: Boris Becker", url: "https://en.wikipedia.org/wiki/Boris_Becker", retrieved: "2026-11-13", status: "secondary: used only for career facts and the release date, shown as REPORTED" },
  COMMONS: { title: "Wikimedia Commons photographs (public/lf2/court-and-spotlight/ATTRIBUTIONS.json)", url: "https://commons.wikimedia.org/" },
};
const BUG = "Primary sources: judiciary.uk · gov.uk";
// The 24 counts. Guilty: 4, 10, 13, 14 (J para 1, G1). Acquitted counts named in the remarks: 1, 2, 3, 5-9 (J para 8). The remarks do not
// number the other 12 acquittals, so those cells carry no number rather than an assumed one.
const counts = [...[1, 2, 3].map((n) => ({ n, result: "acquitted" })), { n: 4, result: "guilty", text: "removed close to €427,000 from his bankruptcy estate" }, ...[5, 6, 7, 8, 9].map((n) => ({ n, result: "acquitted" })),
  { n: 10, result: "guilty", text: "did not disclose a property in Leimen, Germany" }, { n: 13, result: "guilty", text: "concealed a €825,000 loan from Bank of Alpinum, Liechtenstein" }, { n: 14, result: "guilty", text: "did not disclose 75,000 shares in Breaking Data Corp" },
  ...Array.from({ length: 12 }, () => ({ n: "", result: "acquitted" }))];

export const EPISODE = {
  channel: "court-and-spotlight", slug: "becker", title: "Boris Becker: Four Guilty Verdicts, Twenty Acquittals", target_minutes: 9,
  beats: [
    { id: "C01", part: "cold open", ref: "mxCZUz2F24E 0:00: real headlines collaged over a dark field, claim words highlighted", src: ["G1", "J"], frames: [20, 70, 140],
      vo: "On the twenty-ninth of April 2022, a judge at Southwark Crown Court in London sent one of the most famous tennis players in history to prison.",
      scene: { type: "collage", photo: A("becker-2018"), credit: credit("becker-2018"), bug: BUG, title: "R v Boris Becker",
        items: [{ file: G1.img.file, w: G1.img.w, h: G1.img.h, crop: { x: 280, y: 330, w: 1500, h: 260 }, x: 140, y: 120, width: 1050, rot: -2, mark: G1.r("Boris Becker convicted of bankruptcy offences") },
          { file: JU.img.file, w: JU.img.w, h: JU.img.h, crop: { x: 330, y: 520, w: 1800, h: 260 }, x: 760, y: 420, width: 1020, rot: 1.5, mark: JU.r("Sentencing remarks: R -v- Boris Becker") },
          { file: G1.img.file, w: G1.img.w, h: G1.img.h, crop: { x: 280, y: 1395, w: 1500, h: 150 }, x: 220, y: 640, width: 1050, rot: -0.8, mark: G1.r("of 2 years and 6 months at Southwark Crown Court on 29 April 2022") }] } },
    { id: "C02", part: "cold open", ref: "SunnyV2: real photograph with a Credit tag; name lower third", src: ["W", "COMMONS"], frames: [60],
      vo: "Thirty-seven years earlier, Boris Becker had won Wimbledon at seventeen, unseeded, the youngest man ever to win a Grand Slam singles title at the time.",
      scene: { type: "photo", image: A("becker-action-1994"), credit: credit("becker-action-1994"), name: "Boris Becker", sub: "Won Wimbledon in 1985, aged 17 (photo: 1994)", status: "reported", pos: "50% 40%" } },
    { id: "C03", part: "cold open", ref: "jZpq6BCud7s: typed lines under a dated header on black", src: ["J"], frames: [200],
      vo: "The judge did not send him to prison for being in debt. She sent him there for what he did after he was declared bankrupt.",
      scene: { type: "transcript", date: "29 April 2022", heading: "Southwark Crown Court", status: "finding", bug: BUG, source: "Sentencing remarks, R v Boris Becker, paragraphs 1 and 30 (judiciary.uk)",
        lines: [{ who: "THE JUDGE", text: "You were found guilty after trial of four offences under the Insolvency Act 1986." }, { who: "THE JUDGE", text: "You were acquitted of 20 other offences." }, { who: "THE JUDGE", text: "You have shown no remorse or acceptance of your guilt." }] } },
    { id: "C04", part: "the debt", ref: "-p_TBe0Re_s: date card between sections", src: ["J", "G2"], frames: [60],
      vo: "The story starts with a house in Mallorca.",
      scene: { type: "date", big: "2016 – 2017", small: "The Finca, Mallorca" } },
    { id: "C05", part: "the debt", ref: "mxCZUz2F24E: the real document, camera travels to the claim line, highlight sweeps the words", src: ["J"], frames: [30, 120],
      vo: "A private bank, Arbuthnot Latham, had lent him money to develop the property. When the loan was not repaid, the bank demanded it. Becker fought the demand and lost. On the twenty-eighth of April 2017 the bank presented a bankruptcy petition to the High Court for three million, three hundred and forty-eight thousand pounds.",
      scene: { type: "source", image: S1.img, status: "finding", bug: BUG, label: "Sentencing remarks, paragraph 2 · judiciary.uk", highlights: [{ rects: S1.r("Bankruptcy Petition was presented to the High Court for"), from: 40 }] } },
    { id: "C06", part: "the debt", ref: "R60ZGwd3n9E dated history; our case timeline with a status on every node", src: ["G1", "G2", "J"], frames: [80],
      vo: "On the twenty-first of June 2017, the court made the bankruptcy order. From that day, the law required him to disclose everything he owned, so it could be shared among his creditors.",
      scene: { type: "timeline", title: "The case, on the record", active: 2, bug: BUG, nodes: [
        { date: "1985", title: "Wins Wimbledon at 17", status: "reported", text: "Unseeded; then the youngest male Grand Slam singles champion.", source: "Wikipedia" },
        { date: "28 Apr 2017", title: "Bank's petition", status: "finding", text: "Arbuthnot Latham presents a bankruptcy petition for £3,348,582.57.", source: "Sentencing remarks, para 2" },
        { date: "21 Jun 2017", title: "Declared bankrupt", status: "finding", text: "The High Court makes the bankruptcy order. He must now disclose all his assets to his trustee.", source: "Sentencing remarks; Insolvency Service" },
        { date: "17 Oct 2019", title: "12-year restrictions", status: "official", text: "He agrees bankruptcy restrictions lasting until 16 October 2031.", source: "Insolvency Service, 5 Nov 2019" },
        { date: "8 Apr 2022", title: "Guilty on 4 counts", status: "finding", text: "Convicted of four offences under the Insolvency Act 1986; acquitted of 20.", source: "Sentencing remarks; Insolvency Service" },
        { date: "29 Apr 2022", title: "Sentenced", status: "finding", text: "Two years and six months in total.", source: "Sentencing remarks, para 32" },
        { date: "15 Dec 2022", title: "Released", status: "reported", text: "Released after about eight months and deported to Germany.", source: "Wikipedia" }] } },
    { id: "C07", part: "the debt", ref: "SunnyV2: the official page captured, the key figures highlighted in turn", src: ["G2"], frames: [40, 150],
      vo: "In 2019 the Official Receiver, the government officer who handles bankruptcies, had investigated undisclosed transactions worth more than four and a half million pounds. Becker agreed to restrictions that would last until 2031.",
      scene: { type: "source", image: G2.img, status: "official", bug: BUG, label: "Insolvency Service press release, 5 November 2019 · gov.uk (archived copy)", highlights: [{ rects: G2.r("totalling over £4.5m"), from: 40 }, { rects: G2.r("accepted on 17 October 2019 and lasts until 16 October 2031"), from: 120 }] } },
    { id: "C08", part: "the trial", ref: "Our addition for the channel rule: every count shown, findings and acquittals never mixed", src: ["J", "G1"], frames: [180],
      vo: "He was charged with twenty-four offences. The jury convicted him of four and acquitted him of twenty, including every charge about what he did before the bankruptcy order. This matters: the twenty are not findings against him.",
      scene: { type: "ledger", title: "24 charges. 4 guilty verdicts.", counts, source: "Sentencing remarks, paras 1 and 8 (judiciary.uk); Insolvency Service, 8 April 2022. Unnumbered cells: acquittals the remarks do not number.", bug: BUG } },
    { id: "C09", part: "the trial", ref: "WiRLNEl-4bk / SunnyV2: one big sourced figure, then what it was", src: ["G1", "J"], frames: [60],
      vo: "Count four: after he was declared bankrupt, he moved close to four hundred and twenty-seven thousand euros out of a business account, in payments to other people. The jury found that this removed property from his bankruptcy estate.",
      scene: { type: "amount", count: "COUNT 4 · GUILTY", value: "€426,930.90", label: "transferred to several third parties from his bankruptcy estate", detail: "Paid out of a company account he used for business and personal spending, between 23 June and 28 September 2017.", source: "Insolvency Service, 8 April 2022; sentencing remarks, para 8", status: "finding", bug: BUG } },
    { id: "C10", part: "the trial", ref: "SunnyV2: the official list captured, each count highlighted", src: ["G1"], frames: [60, 160],
      vo: "Counts ten, thirteen and fourteen: he did not disclose a property in Leimen in Germany, a loan of eight hundred and twenty-five thousand euros from a bank in Liechtenstein, and seventy-five thousand shares in a technology company.",
      scene: { type: "source", image: G1.img, status: "finding", bug: BUG, label: "Insolvency Service press release, 8 April 2022 · gov.uk (archived copy)", highlights: [{ rects: G1.r("Failed to disclose ownership of a property in Leiman in Germany (count 10)"), from: 30 }, { rects: G1.r("Concealed a loan of €825,000 from the Bank of Alpinum of Lichtenstein"), from: 90 }, { rects: G1.r("Ownership of 75,000 shares in Breaking Data Corp (count 14)"), from: 150 }] } },
    { id: "C11", part: "the trial", ref: "mxCZUz2F24E: diagram of who is who, connectors drawn on", src: ["G1", "J"], frames: [140],
      vo: "His defence was that his advisers were responsible for what was, and was not, disclosed. The jury did not accept that on these four counts.",
      scene: { type: "relations", title: "Who was who in R v Becker", focus: "becker", bug: BUG, nodes: [
        { id: "becker", label: "Boris Becker", sub: "bankrupt, defendant", x: 960, y: 540, kind: "subject" },
        { id: "bank", label: "Arbuthnot Latham", sub: "private bank, petitioner", x: 420, y: 260 }, { id: "trustees", label: "Joint trustees", sub: "Smith & Williamson LLP", x: 1500, y: 260 },
        { id: "is", label: "Insolvency Service", sub: "prosecutor", x: 420, y: 820 }, { id: "court", label: "Southwark Crown Court", sub: "HHJ Deborah Taylor", x: 1500, y: 820 }],
        links: [{ a: "bank", b: "becker", label: "petition, £3.35m" }, { a: "becker", b: "trustees", label: "must disclose all assets" }, { a: "is", b: "becker", label: "24 charges" }, { a: "court", b: "becker", label: "4 guilty, 20 acquitted" }] } },
    { id: "C12", part: "the sentence", ref: "SunnyV2 / FRONTLINE: the real document, camera on the decisive line", src: ["J", "W"], frames: [40, 140],
      vo: "At sentencing, the judge pointed to his earlier conviction for tax evasion in Germany. He had been given a suspended sentence then, and in her words, he did not heed the warning.",
      scene: { type: "source", image: S7.img, status: "finding", bug: BUG, label: "Sentencing remarks, paragraphs 29 and 30 · judiciary.uk", highlights: [{ rects: S7.r("you did not heed the warning you were given and the suspended sentence"), from: 40 }, { rects: S7.r("you have shown no remorse or acceptance of your guilt"), from: 120 }] } },
    { id: "C13", part: "the sentence", ref: "mxCZUz2F24E: white-box black-serif quote card with who and where", src: ["J"], frames: [70],
      vo: "She also wrote this.",
      scene: { type: "quote", text: "Whilst I accept the humiliation you have felt as a result of these proceedings, there has been no humility.", who: "HHJ Deborah Taylor", where: "Sentencing remarks, Southwark Crown Court, 29 April 2022, para 30", status: "finding", mark: [14, 18], bug: BUG } },
    { id: "C14", part: "the sentence", ref: "WiRLNEl-4bk: one figure, its source on screen", src: ["J"], frames: [60],
      vo: "Two and a half years for count four, eighteen months each for the other three, served at the same time. Half of it in custody.",
      scene: { type: "amount", count: "THE SENTENCE", value: "2 y 6 m", label: "for count 4, with 18 months each for counts 10, 13 and 14, served at the same time", detail: "He would serve half before release on licence.", source: "Sentencing remarks, para 32", status: "finding", bug: BUG } },
    { id: "C15", part: "after", ref: "SunnyV2: real photograph, credit tag; REPORTED status where the source is secondary", src: ["W", "COMMONS"], frames: [60],
      vo: "He was released on the fifteenth of December 2022, after about eight months, and was reported to have been deported to Germany the same day.",
      scene: { type: "photo", image: A("becker-2019"), credit: credit("becker-2019"), layout: "framed", name: "Released 15 December 2022", sub: "Reported: deported to Germany the same day (photo: April 2019)", status: "reported" } },
  ],
  transitions: [
    { name: "tx1-date-dip", a: "C04", b: "C05", kind: "dip", dur: 18, aAt: 40, note: "date card dips through black into the document" },
    { name: "tx2-ledger-wipe", a: "C08", b: "C09", kind: "wipe", dur: 16, aAt: 170, note: "accent-line wipe from the ledger to the count-4 amount" },
    { name: "tx3-doc-to-quote", a: "C12", b: "C13", kind: "dissolve", dur: 20, aAt: 160, note: "document dissolves into the quote card" },
  ],
  thumbs: [
    { name: "thumb1-guilty", photo: A("becker-2018"), big: "Guilty\n4 of 24", small: "Bankrupt", doc: { file: G1.img.file, w: G1.img.w, x: 280, y: 1640, s: 0.62, mark: G1.r("convicted of four counts against the Insolvency Act 1986") } },
    { name: "thumb2-humility", photo: A("becker-2019"), big: "\"No\nhumility\"", small: "The judge", doc: { file: S7.img.file, w: S7.img.w, x: 120, y: 960, s: 0.75, mark: S7.r("there has been no humility") } },
    { name: "thumb3-wimbledon", photo: A("becker-action-1994"), big: "Wimbledon\nto prison", small: "€426,930", pos: "60% 40%" },
  ],
};
