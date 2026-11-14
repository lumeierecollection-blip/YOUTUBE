// AI Tested long-form #2, fresh cycle 14 Nov 2026: "The Megaspeed Numbers That Do Not Agree".
// Reference formula (owner-approved alternate): Retraced "The Spy Who Seduced Nvidia's CEO" (bSGI08uxvWY): a dated cold open, the sources named up front, the original text on screen with
// the claim line highlighted, dark editorial look. OUR script differs on purpose: it is not a retelling of the personal story. It lines up the figures reported about one company
// (Megaspeed), says what each figure measures and who reported it, and shows where they cannot be added or compared. That is a counting job, which is what this channel does.
// Evidence on screen = real captures (Playwright, 14 Nov 2026) of Wikipedia's "Megaspeed" article, with the sentences highlighted in place.
// Source limits, stated plainly: Wikipedia is a secondary source and this article is on a fast-moving story. Every figure below is attributed to the outlet Wikipedia names for it; where
// Wikipedia names none, the video says so. We have not seen the Wall Street Journal, Bloomberg or Straits Times articles themselves. Allegations are worded as allegations, and Megaspeed's denial
// (CBS News, 13 Nov 2026) is stated in the video.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";

const R = JSON.parse(readFileSync(join(ROOT, "data/longform/ai-tested/nvidia/rects-megaspeed.json"), "utf8"));
const IMG = (f) => ({ file: `lf2/ai-tested/${f}`, w: 2880, h: 1800 });
const FIT = 1760 / 2880;
const mid = (rects) => { const x0 = Math.min(...rects.map((r) => r.x)), x1 = Math.max(...rects.map((r) => r.x + r.w)), y0 = Math.min(...rects.map((r) => r.y)), y1 = Math.max(...rects.map((r) => r.y + r.h)); return { x: Math.round((x0 + x1) / 2), y: Math.round((y0 + y1) / 2) }; };
const cam = (rects, zoom = 1.0) => { const c = mid(rects); return [{ f: 0, x: 1440, y: 900, zoom: FIT }, { f: 50, x: c.x, y: c.y, zoom }]; };
const CAPTURED = "Captured 14 Nov 2026 with Playwright";
const URL = "en.wikipedia.org/wiki/Megaspeed";
const PILL = "THE NUMBERS";

export const SOURCES = {
  WM: { title: "Wikipedia: Megaspeed (secondary source; summarises Wall Street Journal, Bloomberg, New York Times and Straits Times reporting)", url: "https://en.wikipedia.org/wiki/Megaspeed", retrieved: "2026-11-14" },
  WK: { title: "Wikipedia: Jensen Huang spying scandal (secondary source)", url: "https://en.wikipedia.org/wiki/Jensen_Huang_spying_scandal", retrieved: "2026-11-14" },
  CBS: { title: "CBS News: Singapore held Alice Huang's passport for months, but got little help from U.S. on Nvidia chip probe, 13 Nov 2026", url: "https://www.cbsnews.com/news/jensen-huang-nvidia-alice-huang-singapore-investigation-china-chips/", retrieved: "2026-11-14" },
};

export const EPISODE = {
  channel: "ai-tested", slug: "megaspeed-numbers", title: "The Megaspeed Numbers That Do Not Agree", target_minutes: 6,
  sound: { bed: "MUSIC_HISTORY_DOC", bed_rel_db: -20, dip_scenes: ["verdict"] },
  beats: [
    { id: "M01", part: "cold open", ref: "Retraced: dated cold open; the original text on screen", src: ["WM"],
      vo: "September 2024. An official from the U.S. Bureau of Industry and Security visits a data centre in Malaysia run by a company called Megaspeed. According to Wikipedia's summary of the reporting, the official finds a large number of Nvidia's high-end equipment still in shipping containers, not unpacked, not installed, not running. That raised suspicion. This video lines up the numbers reported about Megaspeed, and shows where they cannot be compared.",
      scene: { type: "browser", image: IMG("nvd-meg-6.jpg"), url: URL, pill: "SEPTEMBER 2024", foot: `Source: Wikipedia, Megaspeed (secondary) · ${CAPTURED}`, cam: cam(R.containers, 1.0), boxes: [{ rects: R.containers, from: 90, label: "Still in shipping containers" }] } },
    { id: "M02", part: "cold open", ref: "Retraced: sources stated up front", src: [],
      vo: "Three rules for the numbers. Name who reported each one. Say what it measures: money spent, chips imported, chips found, or chips said to have reached China. And never add figures from different sources together. Every page used here is listed in the description, and we have not seen the original newspaper articles, only how Wikipedia summarises them.",
      scene: { type: "flow", title: "Three rules for the numbers", pill: PILL, foot: "Wikipedia is a secondary source; the outlet it names is the outlet we name", steps: [{ title: "Name the source", text: "Who reported the figure, as named in the article" }, { title: "Say what it measures", text: "Spent, imported, found, or said to have reached China" }, { title: "Never add them up", text: "Figures from different sources measure different things" }] } },
    { id: "M03", part: "the company", ref: "Retraced: the background before the event", src: ["WM", "WK"],
      vo: "The company itself is young. It was founded in 2015 as the Singapore subsidiary of a Chinese gaming firm, 7Road. In March 2023 it was bought by a group of investors and renamed Megaspeed. Later that year it was sold again, to a Singapore company called Swiftdata. Even the month of that second sale differs between Wikipedia's two articles: October 2023 in one, November 2023 in the other.",
      scene: { type: "flow", title: "Megaspeed, 2015 to 2023", pill: "THE COMPANY", foot: "Sources: Wikipedia, Megaspeed and Jensen Huang spying scandal (secondary)", steps: [{ title: "2015", text: "Founded as 7Road International, Singapore subsidiary of a Chinese gaming firm" }, { title: "March 2023", text: "Bought by a group of investors and renamed Megaspeed International" }, { title: "Oct or Nov 2023", text: "Sold to Swiftdata, a Singapore company. The two articles give different months" }, { title: "2024", text: "Affiliates registered in the U.S., Australia, Malaysia, Indonesia and Thailand" }] } },
    { id: "M04", part: "the company", ref: "Retraced: the claim line highlighted in the original text", src: ["WM"],
      vo: "Swiftdata had been incorporated only a few weeks earlier. After the sale its owner became Megaspeed's sole director. The article says Megaspeed also became an Nvidia Cloud Partner, a status it says gave the company priority access to chips.",
      scene: { type: "browser", image: IMG("nvd-meg-1.jpg"), url: URL, pill: "THE SALE", foot: `Source: Wikipedia, Megaspeed (secondary) · ${CAPTURED}`, cam: cam(R.swift, 1.1), boxes: [{ rects: R.swift, from: 70, label: "Sold to Swiftdata" }] } },
    { id: "M05", part: "the figures", ref: "AI Tested: one counted figure per scene, with what it counts", src: ["WM"],
      vo: "Number one. Wikipedia says Megaspeed acquired around five billion dollars in AI chips and advanced hardware in November 2023. The sentence names no outlet. It is a figure for hardware acquired in one period.",
      scene: { type: "browser", image: IMG("nvd-meg-2.jpg"), url: URL, pill: "FIGURE 1 · $5 BILLION", foot: `Source: Wikipedia, Megaspeed (secondary) · no outlet named in this sentence · ${CAPTURED}`, cam: cam(R.five_bn, 1.1), boxes: [{ rects: R.five_bn.slice(0, 2), from: 70, label: "Acquired, Nov 2023" }] } },
    { id: "M06", part: "the figures", ref: "AI Tested: one counted figure per scene, with what it counts", src: ["WM"],
      vo: "Number two. The article says Megaspeed imported Nvidia hardware worth at least four point six billion dollars between its founding in 2023 and November 2025. That is hardware imported, over two years. It is lower than the first figure and it covers a longer time. They are not the same measurement.",
      scene: { type: "browser", image: IMG("nvd-meg-5.jpg"), url: URL, pill: "FIGURE 2 · $4.6 BILLION", foot: `Source: Wikipedia, Megaspeed (secondary) · ${CAPTURED}`, cam: cam(R.four_six, 1.1), boxes: [{ rects: R.four_six, from: 70, label: "Imported, 2023 to Nov 2025" }] } },
    { id: "M07", part: "the figures", ref: "AI Tested: the count that does not match", src: ["WM"],
      vo: "Number three is a count, not a price. Bloomberg reported that Megaspeed had imported about one hundred and thirty-six thousand Nvidia GPUs. But when Nvidia's auditors came to inspect, they found only a few thousand of the latest model. Inspected is not the same as imported. The article does not say how many were checked, or where the rest were.",
      scene: { type: "browser", image: IMG("nvd-meg-6.jpg"), url: URL, pill: "FIGURE 3 · 136,000 v A FEW THOUSAND", foot: `Source: Wikipedia, Megaspeed (secondary), citing Bloomberg · ${CAPTURED}`, cam: cam(R.few_thousand, 1.1), boxes: [{ rects: R.few_thousand, from: 70, label: "Found by Nvidia's auditors (Bloomberg)" }] } },
    { id: "M08", part: "the figures", ref: "Retraced: the unattributed claim flagged on screen", src: ["WM"],
      vo: "Number four is the largest. The same article says that up to two hundred and forty thousand restricted chips, worth at least seven point five billion dollars, flowed into China through a network of affiliated companies. Its source is given only as trade records and foreign media investigations. No outlet is named. It also measures something different: chips said to have reached China, not chips bought by Megaspeed.",
      scene: { type: "browser", image: IMG("nvd-meg-4.jpg"), url: URL, pill: "FIGURE 4 · $7.5 BILLION", foot: `Source: Wikipedia, Megaspeed (secondary) · no outlet named for this figure · ${CAPTURED}`, cam: cam(R.seven_five, 1.1), boxes: [{ rects: R.seven_five, from: 70, label: "Source not named" }] } },
    { id: "M09", part: "the figures", ref: "AI Tested: the comparison table", src: ["WM"],
      vo: "Put side by side, the four figures answer four different questions. Five billion dollars is hardware acquired in one month. Four point six billion is hardware imported over two years. A few thousand is what one set of auditors found. Seven point five billion is what was said to have gone to China. You cannot subtract one from another. Anyone who does is making a new number that nobody reported.",
      scene: { type: "flow", title: "Four figures, four meanings", pill: PILL, foot: "Figures as summarised by Wikipedia, Megaspeed (secondary); they are not added or compared", steps: [{ title: "$5 billion", text: "Hardware acquired, Nov 2023 · no outlet named" }, { title: "$4.6 billion", text: "Hardware imported, 2023 to Nov 2025 · about 136,000 GPUs reported by Bloomberg" }, { title: "A few thousand", text: "Latest-model chips Nvidia's auditors found · Bloomberg" }, { title: "$7.5 billion", text: "Said to have reached China, up to 240,000 chips · no outlet named" }] } },
    { id: "M10", part: "the response", ref: "Retraced: the denial and the response stated next to the allegation", src: ["CBS", "WM", "WK"],
      vo: "What do the people involved say? Megaspeed has denied any wrongdoing, CBS News reported. Wikipedia, citing the Straits Times, says the company has been almost completely shut down since 2025 and has hired outside lawyers for an internal investigation. On Nvidia's side, the article says the company had determined Megaspeed was a Singapore company and believed its purchases were legal, and that it asked U.S. officials whether to suspend dealings and was told there was no need. No official or document is named for that last claim.",
      scene: { type: "browser", image: IMG("nvd-meg-3.jpg"), url: URL, pill: "THE RESPONSE", foot: `Sources: CBS News (denial); Wikipedia (secondary), citing the Straits Times · ${CAPTURED}`, cam: cam(R.shut, 1.1), boxes: [{ rects: R.shut, from: 70, label: "Almost completely shut down (Straits Times)" }] } },
    { id: "M11", part: "the ledger", ref: "AI Tested: the result first, limits listed (verdict card)", src: ["WM", "WK", "CBS"],
      vo: "So here is the result. The reporting describes a company that bought a very large amount of hardware in a short time, and officials who suspected it was being passed on. It does not give one agreed number for what was bought, one for what was checked, or one for what reached China. And in the pages we read, no court judgment on diversion is reported.",
      scene: { type: "verdict", line: "Four figures. Four meanings. No agreed total.", points: ["$5 billion: hardware acquired in Nov 2023 (Wikipedia, no outlet named)", "$4.6 billion: hardware imported 2023 to Nov 2025", "A few thousand: latest-model chips found by Nvidia's auditors (Bloomberg)", "$7.5 billion: said to have reached China; no outlet named", "Megaspeed denies wrongdoing (CBS)"], limits: ["We read Wikipedia's summaries, not the newspaper articles", "Wikipedia's two articles disagree on the month of the sale", "A fast-moving story: pages may have changed since 14 Nov 2026", "No court judgment on diversion was reported in the pages we read"], pill: "VERDICT", foot: "Sources listed in the description" } },
    { id: "M12", part: "close", ref: "channel format: a comment question in the close", src: [],
      vo: "That is the record as of the fourteenth of November. If you have seen one of these figures in a primary document, tell us in the comments and we will check it. Which number should we look at next?",
      scene: { type: "flow", title: "Where this came from", pill: "SOURCES", foot: "Pages captured or read on 14 Nov 2026", steps: [{ title: "Wikipedia · Megaspeed", text: "Secondary source, summarising WSJ, Bloomberg, NYT, Straits Times" }, { title: "Wikipedia · Jensen Huang spying scandal", text: "Secondary source, for the date of the sale" }, { title: "CBS News", text: "Singapore held Alice Huang's passport for months, 13 Nov 2026" }] } },
  ],
};
