// AI Tested Short, style "v3" (real photographs + news captures, a new picture every ~0.5 s; reference: owner upload v3,
// channel-reverse/reports/shorts-study-2026-11-19.md). Formula kept: "[N] years ago, A was at X. Today ..." -> dated timeline in steps (year on screen) ->
// today's stakes as records, shown on a real page capture -> two-line lesson -> comment CTA (ours asks a question; it promises nothing).
// Facts ONLY from Wikipedia "Anthropic" and "Dario Amodei", retrieved 19 Nov 2026 (channel-reverse/research/shorts/*.wiki). Note: Anthropic makes
// the assistant that wrote this script; the wording stays with the encyclopedia's.
export const STYLE = "v3";
export const SCRIPT = "Five years ago, Dario Amodei was OpenAI's vice president of research. Before that, he worked on machine learning at Baidu and Google Brain. At OpenAI, he worked on GPT-2, GPT-3, and reinforcement learning from human feedback. In January 2021, he left with his sister Daniela and five other former OpenAI employees, over disagreements on AI safety. Together they founded Anthropic. In May 2026, it was valued at 965 billion dollars, which Wikipedia calls the world's most valuable AI pure play. And it plans to go public this November. Same research. A different bet on safety. So which one do you trust more? Comment OpenAI or Claude.";
export const KEYS = {};
export const SOURCES = { A: { title: "Wikipedia: Anthropic", url: "https://en.wikipedia.org/wiki/Anthropic", retrieved: "2026-11-19" }, D: { title: "Wikipedia: Dario Amodei", url: "https://en.wikipedia.org/wiki/Dario_Amodei", retrieved: "2026-11-19" } };
export const FOOTAGE_REQUIRE = /computer|code|keyboard|laptop|screen|server|data|technology|office|city|business|meeting|stock|chart|typing/i;
export const FOOTAGE = [
  { id: "sx-server", q: "server room data center" }, { id: "sx-typing", q: "typing keyboard close up" }, { id: "sx-city", q: "san francisco city", optional: true },
  { id: "sx-office", q: "tech office team meeting", optional: true }, { id: "sx-stock", q: "stock market chart screen", optional: true }, { id: "sx-code", q: "computer code screen" },
  { id: "sx-door", q: "man walking out office door", optional: true }, { id: "sx-laptop", q: "laptop night office" },
];
export const PHOTOS = [
  ["da-tc6", "File:Dario Amodei at TechCrunch Disrupt 2023 06.jpg", "Dario Amodei at TechCrunch Disrupt 2023"],
  ["da-tc2", "File:Dario Amodei at TechCrunch Disrupt 2023 02.jpg", "Dario Amodei at TechCrunch Disrupt 2023"],
  ["da-tc4", "File:Dario Amodei at TechCrunch Disrupt 2023 04.jpg", "Dario Amodei at TechCrunch Disrupt 2023"],
  ["da-uk", "File:Dario Amodei in 2023.jpg", "Dario Amodei in London, 24 May 2023 (UK Prime Minister's office photo)"],
  ["logo-openai", "File:OpenAI Logo.png", "OpenAI logo (identifies the company named)"],
  ["logo-anthropic", "File:Anthropic Logo 2.webp", "Anthropic logo (identifies the company named)"],
  ["logo-claude", "File:Claude AI logo.png", "Claude logo (identifies the product named)"],
  ["logo-claude-symbol", "File:Claude AI symbol.svg", "Claude symbol (identifies the product named)"],
  ["logo-chatgpt", "File:ChatGPT logo.svg", "ChatGPT logo (identifies the product named)"],
  ["logo-google", "File:Google 2015 logo.svg", "Google logo (identifies the company named)"],
];
export const CAPTURES = [
  { id: "wiki-anth", url: "https://en.wikipedia.org/wiki/Anthropic", viewport: { width: 1280, height: 900 }, scale: 1, phrases: ["Valued at $965 billion", "former members of OpenAI over disagreements on AI safety", "plans an initial public offering in November 2026"], steps: [{ do: "wait", ms: 1500 }], fullPage: true },
  { id: "wiki-dario", url: "https://en.wikipedia.org/wiki/Dario_Amodei", viewport: { width: 1280, height: 900 }, scale: 1, phrases: ["he was the vice president of research at OpenAI"], steps: [{ do: "wait", ms: 1500 }], fullPage: true },
];
export const SHOTS = [
  { at: "Five", kind: "full", photo: "da-tc6", cap: "Five years ago" },
  { at: "Dario", kind: "full", photo: "da-tc4", sil: "da-tc4", cap: "Dario Amodei" },   // cut-outs: da-tc6 isolates the interviewer and da-tc2 keeps a second person's arm, so only da-tc4 and da-uk flash
  { at: "OpenAI's", kind: "brand", logo: "logo-openai", bg: "#000000", lw: 760 },
  { at: "vice", kind: "capture", capture: "wiki-dario", phrase: "he was the vice president of research at OpenAI", glitch: true },
  { at: "Baidu", kind: "full", media: "sx-server", cap: "Baidu" },
  { at: "Google", kind: "logo", logo: "logo-google", white: true },
  { at: "GPT-2,", kind: "split", photo: "da-tc4", photo2: "da-tc2", pos2: "60% 40%", cap: "GPT-2 · GPT-3" },
  { at: "January", kind: "year", media: "sx-door", year: "2021" },
  { at: "sister", kind: "page", page: "Daniela" },
  { at: "disagreements", kind: "capture", capture: "wiki-anth", phrase: "former members of OpenAI over disagreements on AI safety", glitch: true },
  { at: "founded", kind: "brand", logo: "logo-anthropic", bg: "#DD7354", glitch: true },
  { at: "May", kind: "year", photo: "da-uk", sil: "da-uk", year: "2026" },
  { at: "965", kind: "capture", capture: "wiki-anth", phrase: "Valued at $965 billion", glitch: true },
  { at: "public", kind: "capture", capture: "wiki-anth", phrase: "plans an initial public offering in November 2026" },
  { at: "Same", kind: "full", media: "sx-server", cap: "Same research." },
  { at: "different", kind: "full", photo: "da-tc2", cap: "A different bet." },
  { at: "So", kind: "page", page: "So" },
  { at: "Comment", kind: "cta", logos: ["logo-chatgpt", "logo-claude-symbol"] },
];
export const POOL = ["sx-typing", "sx-server", "sx-city", "sx-office", "sx-code", "sx-laptop", "sx-stock"];
export const TAG = "AI TESTED";
export const CTA = "“Comment”\nOpenAI or Claude";
export const HASHTAGS = "#AITested #Anthropic #OpenAI";
