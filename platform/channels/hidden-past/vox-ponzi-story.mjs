/**
 * Hidden Past, layered Vox cut at about 30 seconds: Charles Ponzi, the scheme that took his name. Written directly from one fetched Wikipedia article
 * ("Charles Ponzi", retrieved on the run). Every claim carries a text the run must find in that article before anything renders. The pictures are
 * four Wikimedia Commons files, all public domain (licences read from the API on the run); none is captioned with a date or place the file does not carry.
 * Not reviewed by the script engine's critic. The story answers, in order: who, what he promised, why it could not work, what happened when a newspaper
 * asked questions, what investors lost, what the court did, and how he ended. Nothing is left as an open question except the one for the comments.
 */
export const TOPIC = "Charles Ponzi: the 1920 Boston scheme that gave 'Ponzi scheme' its name";
export const WIKI_ARTICLE = "https://en.wikipedia.org/wiki/Charles_Ponzi";
export const WIKI_TITLE = "Charles_Ponzi";
export const RUN_TEXT = "Ponzi paid out $2 million in three days to a wild crowd outside his office.";
const COMMONS = (t) => `https://commons.wikimedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")")}`;

export const ASSETS = [
  { key: "portrait", id: "ponzi-1920", title: "File:Ponzi1920.jpg", claim: "K1", role: "Charles Ponzi, standing, with a cane", halftone: true },
  { key: "desk", id: "ponzi-desk", title: "File:Charles Ponzi.jpg", claim: "K2", role: "Charles Ponzi at a desk (Commons date 1920-08)", halftone: true },
  { key: "mug", id: "ponzi-mug", title: "File:Charles Ponzi mug shot.jpg", claim: "K5", role: "Booking photograph of Charles Ponzi (front and side)", halftone: true },
  { key: "face", id: "ponzi-lccn", title: "File:Chas. Ponzi LCCN2014711137.jpg", claim: "K7", role: "Portrait of Charles Ponzi, Library of Congress glass negative", halftone: true },
];
for (const a of ASSETS) a.page_url = COMMONS(a.title);

const claim = (claim_id, text, excerpt, must, context = "", status = "established_fact") => ({ claim_id, claim: text, source_id: "wiki-ponzi", source_url: WIKI_ARTICLE, published: "2026-11-12", excerpt, confidence: "high", context, contradictory_evidence: [], editorial_status: status, must: { from: "wiki", text: must } });
export const CLAIMS = [
  claim("K1", "Charles Ponzi promised clients a 50% profit within 45 days or 100% profit within 90 days.", "He promised clients a 50% profit within 45 days or 100% profit within 90 days", "He promised clients a 50% profit within 45 days or 100% profit within 90 days"),
  claim("K2", "The scheme claimed to profit by buying discounted postal reply coupons abroad and redeeming them at face value in the U.S.", "buying discounted postal reply coupons in other countries and redeeming them at face value in the U.S.", "buying discounted postal reply coupons in other countries and redeeming them at face value in the U.S."),
  claim("K3", "Financial journalist Clarence Barron noted that 160 million coupons would have to be in circulation to cover the investments, while only about 27,000 actually were.", "160 million postal reply coupons would have to be in circulation. However, only about 27,000 actually were.", "160 million postal reply coupons would have to be in circulation. However, only about 27,000 actually were."),
  claim("K4", "On 26 July 1920 the Boston Post began articles asking hard questions; the articles caused a run on the company, and Ponzi paid out $2 million in three days to a crowd outside his office.", "Ponzi paid out $2 million in three days to a wild crowd outside his office.", "Ponzi paid out $2 million in three days to a wild crowd outside his office.", "The Post series began 26 July 1920 (stated in the article).", "established_fact"),
  claim("K5", "On 11 August 1920 the Bank Commissioner seized Hanover Trust; the news brought down five other banks, and investors lost about $20 million in 1920 dollars, receiving less than 30 cents on the dollar.", "They lost about $20 million in 1920 dollars", "They lost about $20 million in 1920 dollars"),
  claim("K6", "Ponzi was charged with 86 counts of mail fraud, pleaded guilty on 1 November 1920 to a single count, and was sentenced to five years in federal prison.", "Ponzi was charged with 86 counts of mail fraud", "Ponzi was charged with 86 counts of mail fraud", "The guilty plea and the sentence are in the same paragraph of the article."),
  claim("K7", "Ponzi was released in 1934 and deported to Italy on 7 October.", "On 7 October, Ponzi was officially deported.", "On 7 October, Ponzi was officially deported."),
  claim("K8", "He died in the charity ward of a hospital in Rio de Janeiro on 18 January 1949, leaving an estate of $75.", "He left an estate of $75, which was barely enough to bury him.", "He left an estate of $75, which was barely enough to bury him."),
];

const V = (text, claim_ids = []) => ({ text, claim_ids });
export const SLOTS = [
  { id: "name", scene: 0, variants: [V("Charles Ponzi promised fifty percent profit in forty-five days.", ["K1"]), V("Ponzi promised fifty percent in forty-five days.", ["K1"])] },
  { id: "coupons", scene: 1, variants: [V("To pay everyone, he needed one hundred sixty million coupons, but only twenty-seven thousand existed.", ["K2", "K3"]), V("Only twenty-seven thousand of a needed hundred sixty million coupons existed.", ["K3"])] },
  { id: "run", scene: 2, optional: true, variants: [V("A newspaper questioned him, and he paid a crowd two million dollars in three days.", ["K4"]), V("He paid a crowd two million dollars in three days.", ["K4"])] },
  { id: "collapse", scene: 3, variants: [V("His bank was seized, and investors lost about twenty million dollars.", ["K5"]), V("Investors lost twenty million dollars.", ["K5"])] },
  { id: "sentence", scene: 4, variants: [V("Charged with eighty-six counts of mail fraud, he pleaded guilty to one and got five years.", ["K6"]), V("He admitted one of eighty-six fraud counts: five years.", ["K6"])] },
  { id: "end", scene: 5, variants: [V("Deported in nineteen thirty-four, he died in Rio de Janeiro with seventy-five dollars.", ["K7", "K8"]), V("He died in Rio with seventy-five dollars.", ["K8"])] },
  { id: "close", scene: 6, allow_no_claim: true, editorial: "closing question for viewers, not a claim", variants: [V("Would you have invested?")] },
];

export const SCENES = [
  { kind: "name", treatment: "name-title-with-portrait", objective: "Open on the name Charles Ponzi over his photograph with the promise stated at once: 50% in 45 days", background: "paper panel in saturated frame" },
  { kind: "coupons", treatment: "giant-numbers-and-desk-photo", objective: "Show why it could not work: 160 million coupons needed against 27,000 that existed", background: "paper panel in saturated frame" },
  { kind: "run", treatment: "quote-slip-with-number", objective: "Quote the source sentence on the two million dollars paid out in three days to the crowd", background: "paper panel in saturated frame" },
  { kind: "collapse", treatment: "giant-number-and-stamp", objective: "Show the twenty million dollars investors lost and the bank seized", background: "paper panel in saturated frame" },
  { kind: "sentence", treatment: "counted-dots-and-photo", objective: "Draw eighty-six counts as dots, the one he pleaded guilty to in the accent colour, with the booking photograph and the five-year sentence", background: "paper panel in saturated frame" },
  { kind: "end", treatment: "number-and-portrait", objective: "Show the seventy-five dollars he left, his death in Rio de Janeiro and his 1934 deportation", background: "paper panel in saturated frame" },
  { kind: "close", treatment: "title-with-stamp", objective: "Close on a question viewers can answer in the comments: would you have invested", background: "paper panel in saturated frame" },
];

export const METADATA = {
  title: "Charles Ponzi: 50% in 45 Days. What Really Happened",
  description: "In 1920 Charles Ponzi promised Boston investors a 50% profit in 45 days. He said he would buy discounted postal reply coupons abroad and redeem them in the U.S., but covering the money taken in would have needed 160 million coupons, and only about 27,000 were in circulation. After the Boston Post questioned him, he paid out $2 million in three days to a crowd outside his office; then the state seized his bank. Investors lost about $20 million in 1920 dollars. Charged with 86 counts of mail fraud, he pleaded guilty to one and was sentenced to five years. He was deported to Italy in 1934 and died in Rio de Janeiro in 1949, leaving $75. Would you have invested? Tell us in the comments.\n\n#Shorts #History #Ponzi #Fraud #HiddenPast\n\nSource: https://en.wikipedia.org/wiki/Charles_Ponzi\nImages: public-domain photographs from Wikimedia Commons (Ponzi1920.jpg, Charles Ponzi.jpg, Charles Ponzi mug shot.jpg, Chas. Ponzi LCCN2014711137.jpg), credited in the video.",
  tags: ["Charles Ponzi", "Ponzi scheme", "fraud", "1920 Boston", "financial history", "history", "swindler"],
};
