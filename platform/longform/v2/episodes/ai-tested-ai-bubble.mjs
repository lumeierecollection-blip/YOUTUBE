// AI Tested long-form, fresh cycle 15 Nov 2026: "The AI Bubble Already Popped Twice. Why Hasn't Ours?"
// CLONE of How Money Works, "Why China's AI Bubble Popped... And Ours" (WXV9emaUeo0, 1.93M views, 4 days old at selection), measured from its whisper transcript
// (output/fresh-cycle-2026-11-14/clone/shots/WXV9emaUeo0/transcript.txt) and 165-shot list (median shot 4.5 s). Its structure, kept in order:
//   0:00 "everyone says it's a bubble - so why hasn't it popped?" -> the money used to come from cash, now it is debt -> 2:26 it already popped in China and Korea
//   -> 3:03 the debt side -> circular deals -> is the revenue there? -> regulators -> the other side -> verdict, then "keep learning".
// Its look: newspaper/article clippings laid on a green desk with the key line highlighted, numbers on cards, a fast cut rhythm. Ours: real captures of the
// Wikipedia "AI bubble" article (Playwright, 15 Nov 2026) on the same kind of green desk (Browser desk mode), flow cards for the numbers.
// Not copied: their TV news clips (not licensable), their "$?" mascot (their brand), their sponsor read.
// Facts: ONLY from Wikipedia, "AI bubble" (secondary source, as fetched 14-15 Nov 2026: output/fresh-cycle-2026-11-14/ai-tested/bubble/bubble.clean); every figure is
// attributed to the organisation the article names. Forecasts are said to be forecasts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";

const R = JSON.parse(readFileSync(join(ROOT, "data/longform/ai-tested/nvidia/rects-bubble.json"), "utf8"));
const FIT = 1480 / 2880, URL = "en.wikipedia.org/wiki/AI_bubble", FOOT = "Source: Wikipedia, 'AI bubble' (secondary source) · captured 15 Nov 2026 with Playwright";
const mid = (rects) => { const x0 = Math.min(...rects.map((r) => r.x)), x1 = Math.max(...rects.map((r) => r.x + r.w)), y0 = Math.min(...rects.map((r) => r.y)), y1 = Math.max(...rects.map((r) => r.y + r.h)); return { x: Math.round((x0 + x1) / 2), y: Math.round((y0 + y1) / 2) }; };
// one desk clipping: shot of the captured page, push in from the whole clipping to the highlighted sentence(s), boxes drawn in order
const clip = (keys, pill, labels = [], zoom = 1.05) => {
  const shot = R[keys[0]].shot, all = keys.flatMap((k) => R[k].rects), c = mid(all);
  return { type: "browser", desk: true, frame: false, image: { file: `lf2/ai-tested/bub-${shot}.jpg`, w: 2880, h: 1800 }, url: URL, pill, foot: FOOT,
    cam: [{ f: 0, x: 1440, y: 900, zoom: FIT }, { f: 45, x: c.x, y: c.y, zoom }], boxes: keys.map((k, i) => ({ rects: R[k].rects, from: 60 + i * 75, label: labels[i] })) };
};

export const SOURCES = {
  WB: { title: "Wikipedia: AI bubble (secondary source; summarises WSJ, Morgan Stanley, NBER, Bank of England, IMF, Federal Reserve, Goldman Sachs, JPMorgan statements)", url: "https://en.wikipedia.org/wiki/AI_bubble", retrieved: "2026-11-15" },
  HMW: { title: "Structure reference (not a fact source): How Money Works, Why China's AI Bubble Popped... And Ours", url: "https://www.youtube.com/watch?v=WXV9emaUeo0", retrieved: "2026-11-14" },
};

export const EPISODE = {
  channel: "ai-tested", slug: "ai-bubble", title: "The AI Bubble Already Popped Twice. Why Hasn't Ours?", target_minutes: 7,
  sound: { bed: "MUSIC_DOC_HEART", bed_rel_db: -21, dip_scenes: ["verdict"] },
  beats: [
    { id: "H01", part: "the question", ref: "WXV9emaUeo0 0:00: everyone calls it a bubble, so why hasn't it popped?", src: ["WB"],
      vo: "By now you have probably heard artificial intelligence compared to the dot-com bubble by almost everyone. So the obvious question is this: if everyone can see the bubble, why hasn't it popped? Part of the answer is how it is being paid for. Early AI investment was funded mainly from companies' own cash. By 2026, according to Wikipedia's summary of the reporting, the bond market dominated the financing, alongside three trillion dollars in off-balance-sheet commitments.",
      scene: clip(["bond", "off"], "HOW IT'S PAID FOR", ["Bonds now dominate", "$3 trillion off the balance sheet"]) },
    { id: "H02", part: "it already popped", ref: "WXV9emaUeo0 2:26: it has already popped somewhere else", src: ["WB"],
      vo: "And in two places, it already has. In late June and July 2026, South Korea's stock market fell forty-four percent in forty days, erasing two point one eight trillion dollars in market value, in a sell-off of Samsung Electronics and SK Hynix.",
      scene: clip(["kospi", "kospi2"], "SOUTH KOREA", ["-44% in 40 days", "$2.18 trillion erased"]) },
    { id: "H03", part: "it already popped", ref: "WXV9emaUeo0 2:26: the second market", src: ["WB"],
      vo: "In China, the STAR50 index had dropped forty percent between July and October, which several organisations described as the bursting of China's AI bubble.",
      scene: clip(["china"], "CHINA", ["“The bursting of China's AI bubble”"]) },
    { id: "H04", part: "it already popped", ref: "How Money Works: the numbers on cards", src: ["WB"],
      vo: "The trigger in Korea, according to the article, was Big Tech's lack of short-term return on its AI infrastructure, and fear of slowing demand for the memory chips those two companies make. In China it was export limits and limited demand.",
      scene: { type: "flow", title: "Two crashes, 2026", pill: "ALREADY POPPED", foot: FOOT, steps: [{ title: "South Korea · KOSPI", text: "-44% in 40 days, $2.18 trillion erased (June-July)" }, { title: "Trigger", text: "No short-term return on AI infrastructure; fear of weaker memory-chip demand" }, { title: "China · STAR50", text: "-40% from July to October" }, { title: "Trigger", text: "Export limits and limited demand" }] } },
    { id: "H05", part: "why it matters", ref: "How Money Works: the stakes for everyone else", src: ["WB"],
      vo: "Why should anyone outside Korea or China care? Because in late 2025, thirty percent of the S&P 500 rested on just five companies: Nvidia, Microsoft, Apple, Alphabet and Amazon. That was the greatest concentration in half a century.",
      scene: clip(["sp"], "FIVE COMPANIES", ["30% of the S&P 500"]) },
    { id: "H06", part: "the debt side", ref: "WXV9emaUeo0 3:03: the debt side", src: ["WB"],
      vo: "Now the debt side. In 2025, analysts at Morgan Stanley estimated that the debt used to fund data centres could exceed one trillion dollars by 2028. That is a forecast. What is already true, the article says, is that many data centre bonds are rated BBB or junk.",
      scene: clip(["debt", "junk"], "THE DEBT", ["> $1 trillion by 2028 (Morgan Stanley estimate)", "BBB or junk"]) },
    { id: "H07", part: "the circle", ref: "How Money Works: the circular deals", src: ["WB"],
      vo: "Some of the money also goes round in a circle. Nvidia announced a hundred-billion-dollar investment in OpenAI, on the expectation that OpenAI would fill new data centres with the chips it buys from Nvidia. The Wall Street Journal wrote that this kind of circularity can be virtuous on the upside, and vicious on the downside.",
      scene: clip(["nvda"], "THE CIRCLE", ["$100 billion into OpenAI"]) },
    { id: "H08", part: "the circle", ref: "How Money Works: the deal map", src: ["WB"],
      vo: "It is not one deal. OpenAI bought billions of dollars of chips from AMD in a deal that made it one of AMD's largest shareholders. Microsoft holds a large stake in OpenAI. And Oracle entered a three-hundred-billion-dollar deal with it. The same companies are each other's investors, suppliers and customers.",
      scene: { type: "flow", title: "Investor, supplier and customer at once", pill: "THE CIRCLE", foot: FOOT, steps: [{ title: "Nvidia → OpenAI", text: "$100 billion investment; OpenAI buys Nvidia GPUs" }, { title: "OpenAI → AMD", text: "Billions in chips; becomes one of AMD's largest shareholders" }, { title: "Microsoft", text: "Large stake in OpenAI" }, { title: "Oracle", text: "$300 billion deal with OpenAI" }] } },
    { id: "H09", part: "the revenue", ref: "WXV9emaUeo0: is the revenue there?", src: ["WB"],
      vo: "So is the revenue there to pay for it? A National Bureau of Economic Research study published in February 2026 found that ninety percent of firms reported no impact of AI on their workplace and productivity, even while their executives projected productivity gains of one point four percent.",
      scene: clip(["nber"], "THE REVENUE", ["90% of firms: no impact"]) },
    { id: "H10", part: "the regulators", ref: "How Money Works: the official warning", src: ["WB"],
      vo: "Regulators noticed. In 2025 the Bank of England and the International Monetary Fund warned of a possible correction. By August 2026, some Federal Reserve officials were raising concerns about the pace of spending and the growing use of debt. Kansas City Fed president Jeff Schmid said it was important to assess whether the AI ecosystem was becoming too big to fail.",
      scene: clip(["fed"], "THE REGULATORS", ["“Too big to fail?”"], 1.0) },
    { id: "H11", part: "the other side", ref: "How Money Works: the counter-argument before the verdict", src: ["WB"],
      vo: "Not everyone agrees it is a bubble. Goldman Sachs's chief equity strategist argued that the gains are backed by actual profit growth. Morgan Stanley analysts called the fears premature. And JPMorgan concluded that AI does not meet the classic criteria for a financial bubble.",
      scene: clip(["gs", "jpm"], "THE OTHER SIDE", ["Goldman Sachs: backed by profits", "JPMorgan: not a classic bubble"]) },
    { id: "H12", part: "the answer", ref: "WXV9emaUeo0 23:37: why it hasn't popped, in one picture", src: ["WB"],
      vo: "So why hasn't ours popped? On this record, because the biggest companies could pay from their own cash for a long time. That is changing. The financing has moved to bonds, the forecasts for data centre debt run past a trillion dollars, and two AI-linked stock markets have already fallen.",
      scene: { type: "flow", title: "Why ours hasn't popped, yet", pill: "THE ANSWER", foot: FOOT, steps: [{ title: "Then", text: "Paid from the companies' own cash" }, { title: "Now", text: "Bonds dominate; $3 trillion off the balance sheet" }, { title: "Next", text: "Data-centre debt forecast past $1 trillion by 2028 (Morgan Stanley)" }, { title: "Already", text: "Korea -44%, China -40% in 2026" }] } },
    { id: "H13", part: "the answer", ref: "AI Tested: the result first, with its limits (verdict card)", src: ["WB"],
      vo: "Here is where that leaves it. Two AI markets have already fallen hard this year. The American boom is now financed more and more by debt. And the biggest banks still disagree about whether any of it is a bubble at all.",
      scene: { type: "verdict", line: "Two markets have already fallen. Ours now runs on debt.", points: ["South Korea: -44% in 40 days, $2.18 trillion erased", "China's STAR50: -40% from July to October", "Data-centre debt: over $1 trillion by 2028 (forecast)", "Many data-centre bonds: BBB or junk", "Goldman Sachs, Morgan Stanley, JPMorgan: not a bubble"], limits: ["One secondary source: Wikipedia's 'AI bubble' article", "Forecasts are forecasts", "Figures as reported, not audited by us"], pill: "VERDICT", foot: FOOT } },
    { id: "H14", part: "close", ref: "channel format: a comment question in the close", src: [],
      vo: "Do you think this is a bubble, or the start of something that pays for itself? Tell us in the comments, and check the description for every source used.",
      scene: { type: "flow", title: "Where this came from", pill: "SOURCES", foot: "Pages captured or read on 14-15 Nov 2026", steps: [{ title: "Wikipedia · AI bubble", text: "Secondary source summarising WSJ, Morgan Stanley, NBER, BoE, IMF, the Fed, Goldman Sachs and JPMorgan" }] } },
  ],
  thumbs: [{ name: "thumb1-bubble", big: "The AI bubble\nalready popped", num: "-44%", numLabel: "in 40 days · South Korea", small: "twice" }],
};
