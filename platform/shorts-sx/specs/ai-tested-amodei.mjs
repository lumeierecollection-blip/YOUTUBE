// AI Tested Short, style "v3" (real photographs + news captures, a new picture every ~0.5 s; reference: owner upload v3,
// channel-reverse/reports/shorts-study-2026-11-19.md). Formula kept: "[N] years ago, A was at X. Today ..." -> dated timeline in steps (year on screen) ->
// today's stakes as records, shown on a real page capture -> two-line lesson -> comment CTA (ours asks a question; it promises nothing).
// Facts ONLY from Wikipedia "Anthropic" and "Dario Amodei", retrieved 19 Nov 2026 (channel-reverse/research/shorts/*.wiki). Note: Anthropic makes
// the assistant that wrote this script; the wording stays with the encyclopedia's.
export const STYLE = "v3";
// calm (owner, 19 Nov 2026): no strobes or glitches, every shot a different real picture held until the next one, no comment call-to-action
export const CALM = true, FILL = false;
// Anthropic's seven founders as the Anthropic article's infobox lists them; pictures from each person's Wikidata item (P18), or the exact Commons file
export const ENTITIES = [
  { id: "dario", wiki: "Dario Amodei", kind: "person" }, { id: "daniela", wiki: "Daniela Amodei", kind: "person" }, { id: "kaplan", wiki: "Jared Kaplan", kind: "person" },
  { id: "clark", name: "Jack Clark", file: "File:Jack Clark, co-founder of Anthropic, giving a talk on AI at the Schwarzman Centre in Oxford.jpg", kind: "person" },
  { id: "olah", wiki: "Chris Olah", kind: "person" }, { id: "mann", name: "Ben Mann", kind: "person" }, { id: "mccandlish", name: "Sam McCandlish", kind: "person" },
];
export const CUTOUTS = ["ph-altman3"];   // head-and-shoulders photos make full-size cut-outs (stage photos left tiny figures)
// founders' pictures: Anthropic's official press portraits (leadership page), Ben Mann from his Lenny's Podcast cover; owner-approved press use, 19 Nov 2026
export const SCRIPT = "Five years ago, Dario Amodei was OpenAI's vice president of research. In 2021, he and his sister Daniela founded Anthropic with five other former OpenAI staff, over disagreements on AI safety. In May 2026, it was valued at 965 billion dollars. Same research, a different bet. Which do you trust?";
// 48 words for the calm read. "Founded in 2021" is from the Anthropic article; his own article dates his leaving OpenAI to 2020, so the script dates the founding, not the leaving.
export const KEYS = {};
export const SOURCES = { A: { title: "Wikipedia: Anthropic", url: "https://en.wikipedia.org/wiki/Anthropic", retrieved: "2026-11-19" }, D: { title: "Wikipedia: Dario Amodei", url: "https://en.wikipedia.org/wiki/Dario_Amodei", retrieved: "2026-11-19" } };
export const FOOTAGE_REQUIRE = /computer|code|keyboard|laptop|screen|server|data|technology|office|city|business|meeting|stock|chart|typing/i;
export const FOOTAGE = [
  { id: "sx-server", q: "server room data center" }, { id: "sx-typing", q: "typing keyboard close up" }, { id: "sx-city", q: "san francisco city", optional: true },
  { id: "sx-office", q: "tech office team meeting", optional: true }, { id: "sx-stock", q: "stock market chart screen", optional: true }, { id: "sx-code", q: "computer code screen" },
  { id: "sx-door", q: "man walking out office door", optional: true }, { id: "sx-laptop", q: "laptop night office" },
];
export const PHOTOS = [
  ["da-tc1", "File:Dario Amodei at TechCrunch Disrupt 2023 01.jpg", "Dario Amodei at TechCrunch Disrupt 2023"],
  ["da-tc3", "File:Dario Amodei at TechCrunch Disrupt 2023 03.jpg", "Dario Amodei at TechCrunch Disrupt 2023"],
  ["da-tc5", "File:Dario Amodei at TechCrunch Disrupt 2023 05.jpg", "Dario Amodei at TechCrunch Disrupt 2023"],
  ["ph-altman", "File:Sam Altman TechCrunch SF 2019 Day 2 Oct 3 (cropped).jpg", "Sam Altman, OpenAI's CEO"],
  ["ph-anthropic-hq", "File:Slack offices, Howard Street, San Francisco (viewed from the south-west, January 2020).jpg", "500 Howard Street, San Francisco: Anthropic's headquarters"],
  ["da-tc6", "File:Dario Amodei at TechCrunch Disrupt 2023 06.jpg", "Dario Amodei at TechCrunch Disrupt 2023"],
  ["da-tc2", "File:Dario Amodei at TechCrunch Disrupt 2023 02.jpg", "Dario Amodei at TechCrunch Disrupt 2023"],
  ["da-tc4", "File:Dario Amodei at TechCrunch Disrupt 2023 04.jpg", "Dario Amodei at TechCrunch Disrupt 2023"],
  ["da-uk", "File:Dario Amodei in 2023.jpg", "Dario Amodei in London, 24 May 2023 (UK Prime Minister's office photo)"],
  ["logo-openai", "File:OpenAI Logo.png", "OpenAI logo (identifies the company named)"],
  ["logo-anthropic", "File:Anthropic Logo 2.webp", "Anthropic logo (identifies the company named)"],
  ["logo-claude", "File:Claude AI logo.png", "Claude logo (identifies the product named)"],
  ["logo-claude-symbol", "File:Claude AI symbol.svg", "Claude symbol (identifies the product named)"],
  ["logo-chatgpt", "File:ChatGPT logo.svg", "ChatGPT logo (identifies the product named)"],
  ["shot-chatgpt", "File:ChatGPT response screenshot 1.jpg", "A ChatGPT conversation screenshot (shows the product, illustrative)"],
  ["shot-claude", "File:Claude AI website screenshot.webp", "The Claude web app (shows the product named)"],
  ["logo-google", "File:Google 2015 logo.svg", "Google logo (identifies the company named)"],
];
export const CAPTURES = [];   // owner, 19 Nov 2026: no page screenshots
export const SHOTS = [
  { at: "Five", kind: "full", photo: "da-tc6", cap: "Five years ago" },
  { at: "Dario", kind: "full", photo: "da-tc2", cap: "Dario Amodei" },
  { at: "OpenAI's", kind: "brand", logo: "logo-openai", bg: "#000000", lw: 760 },
  { at: "vice", kind: "full", photo: "da-tc1", cap: "VP of Research, OpenAI" },
  { at: "2021,", kind: "year", photo: "da-tc5", year: "2021" },
  { at: "sister", kind: "person", ent: "daniela", role: "his sister, co-founder", bg: "#2a2622" },
  { at: "founded", kind: "brand", logo: "logo-anthropic", bg: "#DD7354" },
  { at: "five", kind: "people", title: "Anthropic's seven founders", people: [{ ent: "dario" }, { ent: "daniela" }, { ent: "kaplan" }, { ent: "clark" }, { ent: "olah" }, { ent: "mann" }, { ent: "mccandlish" }] },
  { at: "disagreements", kind: "page", page: "Over AI safety" },
  { at: "May", kind: "year", photo: "da-uk", year: "2026" },
  { at: "965", kind: "money", value: "$965B", unit: "valuation, May 2026", asset: "png-money-stack", stacks: 3 },
  { at: "Same", kind: "versus", a: { photo: "ph-altman3", label: "Sam Altman, OpenAI CEO" }, b: { ent: "dario", label: "Dario Amodei, Anthropic CEO" }, bgA: "#111111", bgB: "#DD7354" },
  { at: "different", kind: "full", photo: "ph-anthropic-hq", cap: "Anthropic HQ · San Francisco" },
  { at: "Which", kind: "collage", items: [{ photo: "shot-chatgpt", x: 90, y: 430, w: 520, h: 560, top: true, rot: -3 }, { photo: "shot-claude", x: 330, y: 820, w: 680, h: 330, rot: 2 }] },
];
export const POOL = ["photo:da-tc2", "sx-server", "photo:da-tc4", "photo:da-uk", "sx-typing", "photo:da-tc6"];   // 19 Nov: random stock read as messy; the v3 reference fills with photos of the people named
export const TAG = "AI TESTED";
export const CTA = null;   // owner, 19 Nov 2026: no "Comment OpenAI or Claude" end card
export const HASHTAGS = "#AITested #Anthropic #OpenAI";
