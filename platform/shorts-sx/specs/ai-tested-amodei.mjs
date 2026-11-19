// AI Tested Short, style "v3" (real photographs + news captures, a new picture every ~0.5 s; reference: owner upload v3,
// channel-reverse/reports/shorts-study-2026-11-19.md). Formula kept: "[N] years ago, A was at X. Today ..." -> dated timeline in steps (year on screen) ->
// today's stakes as records, shown on a real page capture -> two-line lesson -> comment CTA (ours asks a question; it promises nothing).
// Facts ONLY from Wikipedia "Anthropic" and "Dario Amodei", retrieved 19 Nov 2026 (channel-reverse/research/shorts/*.wiki). Note: Anthropic makes
// the assistant that wrote this script; the wording stays with the encyclopedia's.
export const STYLE = "v3";
// calm (owner, 19 Nov 2026): no strobes or glitches, every shot a different real picture held until the next one, no comment call-to-action
export const CALM = true, FILL = false;
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
export const CAPTURES = [
  { id: "wiki-anth", url: "https://en.wikipedia.org/wiki/Anthropic", viewport: { width: 1280, height: 900 }, scale: 1, phrases: ["Valued at $965 billion", "former members of OpenAI over disagreements on AI safety", "plans an initial public offering in November 2026"], steps: [{ do: "wait", ms: 1500 }], fullPage: true },
  { id: "wiki-dario", url: "https://en.wikipedia.org/wiki/Dario_Amodei", viewport: { width: 1280, height: 900 }, scale: 1, phrases: ["he was the vice president of research at OpenAI"], steps: [{ do: "wait", ms: 1500 }], fullPage: true },
];
export const SHOTS = [
  { at: "Five", kind: "full", photo: "da-tc6", cap: "Five years ago" },
  { at: "Dario", kind: "full", photo: "da-tc4", cap: "Dario Amodei" },
  { at: "OpenAI's", kind: "brand", logo: "logo-openai", bg: "#000000", lw: 760 },
  { at: "vice", kind: "capture", capture: "wiki-dario", phrase: "he was the vice president of research at OpenAI" },
  { at: "2021,", kind: "year", photo: "da-tc1", year: "2021" },
  { at: "sister", kind: "page", page: "Daniela Amodei" },
  { at: "founded", kind: "brand", logo: "logo-anthropic", bg: "#DD7354" },
  { at: "former", kind: "full", photo: "da-tc5", cap: "Seven former OpenAI staff" },
  { at: "disagreements", kind: "capture", capture: "wiki-anth", phrase: "former members of OpenAI over disagreements on AI safety" },
  { at: "May", kind: "year", photo: "da-uk", year: "2026" },
  { at: "965", kind: "capture", capture: "wiki-anth", phrase: "Valued at $965 billion" },
  { at: "Same", kind: "split", photo: "ph-altman", photo2: "da-tc3", pos2: "60% 35%", lab1: "Sam Altman · OpenAI CEO", lab2: "Dario Amodei · Anthropic" },
  { at: "different", kind: "full", photo: "ph-anthropic-hq", cap: "Anthropic HQ · San Francisco" },
  { at: "Which", kind: "collage", items: [{ photo: "shot-chatgpt", x: 90, y: 430, w: 520, h: 560, top: true, rot: -3 }, { photo: "shot-claude", x: 330, y: 820, w: 680, h: 330, rot: 2 }] },
];
export const POOL = ["photo:da-tc2", "sx-server", "photo:da-tc4", "photo:da-uk", "sx-typing", "photo:da-tc6"];   // 19 Nov: random stock read as messy; the v3 reference fills with photos of the people named
export const TAG = "AI TESTED";
export const CTA = null;   // owner, 19 Nov 2026: no "Comment OpenAI or Claude" end card
export const HASHTAGS = "#AITested #Anthropic #OpenAI";
