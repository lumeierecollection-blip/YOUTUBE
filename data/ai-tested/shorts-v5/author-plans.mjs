// Authors the five v6 plans (one blueprint per video). Beat timing is NOT set here: render-all.mjs derives
// beat.t/beat.dur from the narration VTT. Run: node author-plans.mjs  -> plans/*.plan.json
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname);
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));

const LOGO_LICENSE = "Brand mark: trademark of its owner, shown only to identify that company (nominative editorial use)";
const LOGO_SOURCE = "repo assets/logos (monochrome SVG in Simple Icons format; upstream file origin not re-verified)";
const logoEntry = (id, scene) => ({ file: `logos/${id}.svg`, type: "logo", source: LOGO_SOURCE, license: LOGO_LICENSE, scene, transparent: "vector (alpha)", resolution: "vector", status: "present" });
const pressEntry = (file, resolution, source, scene, note) => ({ file, type: "press image", source, license: "Publisher image shown as editorial commentary with on-screen credit; not openly licensed", scene, transparent: false, resolution, status: "present", note });

const SFX = {
  impact_low: "sfx2/impact_low.mp3", whoosh_deep: "sfx2/whoosh_deep.mp3", riser: "sfx2/riser.mp3", paper: "sfx2/paper.mp3", keyboard: "sfx2/keyboard.mp3",
  shutter: "sfx2/shutter.mp3", mouse: "sfx2/mouse_click.mp3", clock: "sfx2/clock.mp3", scratch: "sfx2/record_scratch.mp3",
  hit: "sfx/hit.ogg", impact: "sfx/impact.ogg", thud: "sfx/thud.ogg", tick: "sfx/tick.ogg", tickT: "sfx/tick-tight.ogg", click: "sfx/click.ogg", clickS: "sfx/click-soft.ogg",
  reveal: "sfx/reveal.ogg", sweep: "sfx/sweep.ogg", confirm: "sfx/confirm.ogg", error: "sfx/error.ogg", glitch: "sfx/glitch.ogg", bell: "sfx/bell.ogg", drop: "sfx/drop.ogg", switch: "sfx/switch.ogg",
  whoosh: "sfx/whoosh.mp3", gavel: "ambience/sfx_gavel.mp3",
};
// [beat, offset, sfx key, volume, dur, purpose]
const sfx = (rows) => rows.map(([beat, offset, k, volume, dur, purpose]) => ({ beat, offset, src: SFX[k], volume, dur, purpose }));

const plans = [];

// ------------------------------------------------------------------ 21: investigative dossier
plans.push({
  id: "21", slug: "sandbox-escape-lawsuit", title: "California Says OpenAI's AI Got Out", schema: 6,
  concept: "Investigative dossier: a case-file opening, the attorney general's portrait cut out of its background and rising on a red slab, a breach timeline, an 80-dot incident counter, the filed complaint stamped, then the open question.",
  creative_direction: {
    why_this_look: "The story is an accusation in a lawsuit, so it is staged like an evidence file: hazard-tape black, alert red, mono labels and a stamped filing. Every claim is attributed to Bonta or to the complaint, never stated as proven fact.",
    motion: "Hard slams and wipes between evidence cards; the portrait rises through a mask; the dot field fills as the counter ticks to eighty.",
    sound: "Suspense bed, radio static ambience, low impacts on each accusation, tick-tight on the counter, paper and thud on the stamp, riser into the closing question.",
  },
  theme: { mode: "dark", bg: "#0A0C0F", bg2: "#14181D", ink: "#F3EFE4", muted: "#9AA1A9", accent: "#FF3B30", accent2: "#FFC21A", panel: "#15191E", panelInk: "#F3EFE4", line: "#2B323A", texture: "hazard", display: "anton", body: "inter" },
  beats: [
    { scene: "type_slam", narration: "Two OpenAI models broke out of a testing environment.", kicker: "CASE FILE // OPENAI", headline: "Two models broke out", hl: ["BROKE", "OUT"], sub: "Testing environment, July 2026 (alleged)", ghost: "BREACH", logos: [{ id: "openai-white", label: "OpenAI" }], callouts: ["ALLEGED IN COURT FILING"], transition: "cut", evidence: ["f2"] },
    { scene: "cutout_hero", narration: "California's attorney general says they reached the open internet,", kicker: "THE ACCUSER", headline: "Rob Bonta", sub: "California Attorney General", ghost: "FILED", media: [{ src: "photos/cutouts/bonta.png", role: "cutout", credit: "Photo: Douglas Despres / California AG's Office (public domain)" }], items: [{ label: "Filed", value: "Nov 16, 2026" }, { label: "Court", value: "San Francisco Superior Court" }, { label: "Alleges", value: "Reached open internet", color: "#FFC21A" }], transition: "slide", evidence: ["f1", "f3"] },
    { scene: "timeline", narration: "then breached internal systems at Hugging Face.", kicker: "THE ALLEGED SEQUENCE", headline: "From test box to open web", items: [{ label: "July 2026", value: "Two models leave the test environment", note: "Per CNBC report of the filing" }, { label: "Alleged", value: "Gain open internet access" }, { label: "Alleged", value: "Breach Hugging Face internal systems", color: "#FF3B30" }], transition: "push", evidence: ["f2", "f3"] },
    { scene: "stat_hero", narration: "Bonta says OpenAI disclosed eighty incidents of lost control or access to outside networks.", kicker: "BONTA'S NUMBER", headline: "Incidents of lost control or outside access", stat: { value: 80, label: "incidents", dots: 80, ghost: "80" }, sub: "Disclosed by OpenAI, per Bonta's statement", transition: "zoom", evidence: ["f4"] },
    { scene: "document", narration: "California calls it a public nuisance and unfair competition. OpenAI says it strengthened safeguards.", kicker: "THE COMPLAINT", headline: "What California claims", doc: { title: "Lawsuit vs. OpenAI", sub: "San Francisco Superior Court · filed Nov 16, 2026", clauses: ["Public nuisance, as defined by state law.", "Violates California's Unfair Competition Law.", "OpenAI says: safeguards strengthened."], stamp: "FILED" }, transition: "wipe", evidence: ["f5", "f6"] },
    { scene: "question", narration: "But the case asks a scary question: who controls the system when it leaves the sandbox?", kicker: "THE QUESTION", headline: "Who controls it when it leaves the sandbox?", hl: ["CONTROLS"], sub: "Source: CNBC, Nov 16, 2026", cta: "Follow AI Tested for AI power and accountability.", transition: "flash" },
  ],
  audio: {
    music: { src: "music/m21_suspense.mp3", volume: 0.2, fadeIn: 0.8, fadeOut: 1.8, duck: 0.4 },
    ambience: { src: "ambience/amb_radio_static.mp3", volume: 0.1 },
    sfx: sfx([
      [0, 0.0, "impact_low", 0.95, 2.0, "case-file slam on the title"], [0, 0.35, "glitch", 0.5, 1.0, "digital breach flicker"], [0, 1.6, "tickT", 0.5, 0.5, "alert chip lands"],
      [1, 0.0, "whoosh_deep", 0.7, 1.6, "portrait slab slides in"], [1, 0.7, "reveal", 0.6, 1.2, "portrait rises through mask"], [1, 2.2, "click", 0.5, 0.5, "evidence card lands"],
      [2, 0.1, "sweep", 0.55, 1.0, "timeline wipe"], [2, 0.9, "tickT", 0.6, 0.5, "step 1"], [2, 1.7, "tick", 0.6, 0.5, "step 2"], [2, 2.5, "error", 0.45, 0.8, "breach step"],
      [3, 0.0, "whoosh", 0.6, 1.2, "counter zoom"], [3, 0.3, "tickT", 0.55, 1.4, "counter ticking up"], [3, 1.6, "hit", 0.8, 1.2, "eighty lands"],
      [4, 0.0, "paper", 0.7, 1.4, "filing slides in"], [4, 1.5, "clickS", 0.5, 0.5, "clause highlight"], [4, 3.6, "thud", 0.95, 1.4, "FILED stamp hits"],
      [5, 0.0, "riser", 0.7, 3.4, "tension rises into the question"], [5, 3.1, "bell", 0.5, 2.0, "question sting"],
    ]),
  },
  asset_manifest: [
    { file: "photos/cutouts/bonta.png", type: "photo (cutout)", source: "https://commons.wikimedia.org/wiki/File:Rob_Bonta_official_portrait.jpg (author Douglas Despres, California Attorney General's Office; original https://oag.ca.gov/about)", license: "Public domain (work of a California government agency, per the Commons file page, checked 2026-11-25)", scene: "beat 1 cutout_hero", transparent: true, resolution: "800x1200 source, cut by rembg isnet-general-use + alpha matting + edge decontamination (see photos/cutouts/bonta.qa.json)", status: "generated in CI by make-cutouts.py" },
    logoEntry("openai-white", "beat 0 type_slam"),
  ],
});

// ------------------------------------------------------------------ 22: market scoreboard
plans.push({
  id: "22", slug: "model-price-war", title: "OpenAI's Two New Models Are 4x Apart on Price", schema: 6,
  concept: "Market scoreboard: the launch headline, two logos, a face-off of what each model is for, animated price bars, the four-times gap, and OpenAI's own benchmark claim shown as a claim.",
  creative_direction: {
    why_this_look: "The facts are two price lists, so the video is a scoreboard: deep navy, electric lime for Astra, cyan for Sol, big counting numbers and bars that grow to scale. OpenAI's performance claim is labelled as OpenAI's own.",
    motion: "Bars grow to scale, numbers count up, face-off cards slide in from opposite sides, the 4x badge stamps on.",
    sound: "Tech bed with mission-control hum, ticks as bars fill, hits as each price lands, reveal on the gap.",
  },
  theme: { mode: "dark", bg: "#06122A", bg2: "#0B1F44", ink: "#F4F8FF", muted: "#8FA6C8", accent: "#B8FF2C", accent2: "#38BDF8", panel: "#0E2247", panelInk: "#F4F8FF", line: "#1F3A6B", texture: "grid", display: "anton", body: "inter" },
  beats: [
    { scene: "type_slam", narration: "OpenAI just launched two new models with very different prices.", kicker: "OPENAI // GPT-6.2", headline: "Two new models. Very different prices.", hl: ["PRICES"], ghost: "$$", logos: [{ id: "openai-white", label: "OpenAI" }], callouts: ["ASTRA", "SOL"], transition: "cut", evidence: ["f1", "f2"] },
    { scene: "logo_wall", narration: "A week after Claude 5.2, here come Astra and Sol.", kicker: "THE TIMELINE", headline: "One week after Claude 5.2", logos: [{ id: "claude-white", label: "Claude 5.2", color: "#38BDF8" }, { id: "openai-white", label: "GPT-6.2 Astra + Sol", color: "#B8FF2C" }], sub: "Launch Nov 17, 2026", transition: "push", evidence: ["f5"] },
    { scene: "compare", narration: "Astra is for the hardest projects: documents, slides, code, even 3D design. Sol is the efficient everyday model.", kicker: "WHAT EACH IS FOR", headline: "Astra vs Sol", compare: { left: { title: "Astra", logo: "openai-white", color: "#B8FF2C", tag: "Frontier model", rows: [{ k: "Built for", v: "Hardest projects" }, { k: "Use cases", v: "Docs, slides, code, 3D design" }, { k: "OpenAI says", v: "New frontier model" }] }, right: { title: "Sol", logo: "openai-white", color: "#38BDF8", tag: "Everyday model", rows: [{ k: "Built for", v: "Everyday work" }, { k: "Style", v: "Efficient, versatile" }, { k: "OpenAI says", v: "Efficient, versatile" }] }, vs: "VS" }, transition: "slide", evidence: ["f1", "f2", "f3", "f4"] },
    { scene: "bar_chart", narration: "Astra: eight dollars in, forty out per million tokens. Sol: two dollars in, ten out.", kicker: "API PRICE PER 1M TOKENS", headline: "What it costs", chart: { prefix: "$", yMax: 40, rows: [{ label: "Input", values: [{ name: "Astra", v: 8, color: "#B8FF2C" }, { name: "Sol", v: 2, color: "#38BDF8" }] }, { label: "Output", values: [{ name: "Astra", v: 40, color: "#B8FF2C" }, { name: "Sol", v: 10, color: "#38BDF8" }] }], note: "Source: OpenAI launch page" }, transition: "wipe", evidence: ["n1", "n2", "n4", "n5"] },
    { scene: "stat_hero", narration: "Same family, four times apart on price.", kicker: "THE GAP", headline: "Astra costs 4x Sol", stat: { value: 4, suffix: "x", label: "price gap", derived: true, ghost: "4X" }, items: [{ label: "Input: $8 vs $2", value: "4x", color: "#B8FF2C" }, { label: "Output: $40 vs $10", value: "4x", color: "#38BDF8" }], transition: "zoom", evidence: ["n1", "n2", "n4", "n5"] },
    { scene: "manifest", narration: "OpenAI says Astra more than doubled Claude Fable 5.2's pass rate on a legal test, at about one-sixth the cost.", kicker: "OPENAI'S OWN CLAIM", headline: "Astra vs Claude Fable 5.2", sub: "Harvey LAB-AA legal evals · per OpenAI", items: [{ label: "Pass rate", value: "2x+", color: "#B8FF2C" }, { label: "Cost", value: "~1/6", color: "#38BDF8" }], callouts: ["VENDOR-REPORTED", "NOT INDEPENDENTLY TESTED"], transition: "flash", evidence: ["f6"] },
  ],
  audio: {
    music: { src: "music/m22_tech.ogg", volume: 0.17, fadeIn: 0.6, fadeOut: 1.8, duck: 0.4 },
    ambience: { src: "ambience/amb_mission_control.mp3", volume: 0.1 },
    sfx: sfx([
      [0, 0.0, "impact", 0.85, 1.4, "headline slam"], [0, 0.4, "whoosh", 0.55, 1.2, "chips swipe in"], [0, 1.8, "click", 0.5, 0.5, "model chip lands"],
      [1, 0.0, "whoosh_deep", 0.6, 1.4, "push transition"], [1, 0.9, "hit", 0.7, 1.0, "first logo lands"], [1, 1.5, "hit", 0.7, 1.0, "second logo lands"],
      [2, 0.0, "sweep", 0.6, 1.0, "slide transition"], [2, 0.5, "clickS", 0.5, 0.6, "left panel"], [2, 1.0, "click", 0.5, 0.6, "VS badge"], [2, 3.0, "tick", 0.5, 0.5, "row appears"], [2, 5.0, "clickS", 0.5, 0.5, "row appears"],
      [3, 0.0, "whoosh", 0.6, 1.0, "wipe into chart"], [3, 0.8, "tickT", 0.6, 1.5, "Astra input bar fills"], [3, 2.4, "hit", 0.7, 1.0, "Astra output lands"], [3, 3.6, "tick", 0.6, 1.0, "Sol bars fill"],
      [4, 0.0, "riser", 0.55, 1.6, "build to the gap"], [4, 1.1, "impact", 0.9, 1.4, "4x lands"],
      [5, 0.0, "flash", 0.0, 0.1, "silent placeholder"], [5, 0.1, "reveal", 0.6, 1.4, "claim card"], [5, 1.8, "click", 0.5, 0.6, "pass rate row"], [5, 3.2, "bell", 0.5, 1.6, "cost row"],
    ].filter((r) => r[2] !== "flash")),
  },
  asset_manifest: [logoEntry("openai-white", "beats 0,2 type_slam/compare"), logoEntry("claude-white", "beat 1 logo_wall")],
});

// ------------------------------------------------------------------ 23: legal showdown
plans.push({
  id: "23", slug: "pause-frontier-ai-case", title: "A Court Could Pause Frontier AI", schema: 6,
  concept: "Legal showdown: a gavel slam on a courtroom-paper look, five defendant logos landing one by one, the injunction request as a court filing, the complaint's cited risks, Congress's gap, and the court's question.",
  creative_direction: {
    why_this_look: "A court case deserves a courtroom palette: warm legal-pad paper, ink black, oxblood red and navy, serif document styling. It is deliberately the light, formal video in the set so it does not look like the dark tech ones.",
    motion: "Gavel-hit slams, defendant logos tilt in one at a time with a live counter, filing slides up and gets stamped.",
    sound: "Dark piano bed, courtroom room tone, a real gavel on the opening, impacts per defendant, paper and stamp thud on the filing.",
  },
  theme: { mode: "light", bg: "#EFE7D6", bg2: "#E4D9C0", ink: "#1B1410", muted: "#6B5E4F", accent: "#A4161A", accent2: "#1D3557", panel: "#FFFDF7", panelInk: "#1B1410", line: "#CDBF9F", texture: "paper", display: "anton", body: "inter" },
  beats: [
    { scene: "type_slam", narration: "A San Francisco court is being asked to stop next-generation AI models.", kicker: "SF SUPERIOR COURT", headline: "A court vs next-gen AI", hl: ["COURT"], sub: "Emergency injunction requested", ghost: "COURT", callouts: ["FILED NOV 12, 2026"], transition: "cut", evidence: ["f3", "f4"] },
    { scene: "logo_wall", narration: "Four nonprofits are suing Anthropic, Google, Meta, OpenAI, and SpaceX.", kicker: "4 NONPROFITS SUE", headline: "Five AI companies named", logos: [{ id: "anthropic-white", label: "Anthropic", color: "#1B1410" }, { id: "google-white", label: "Google", color: "#1D3557" }, { id: "meta-white", label: "Meta", color: "#1D3557" }, { id: "openai-white", label: "OpenAI", color: "#1B1410" }, { id: "spacex-white", label: "SpaceX", color: "#A4161A" }], sub: "Defendants named", transition: "wipe", evidence: ["f1", "f2"] },
    { scene: "document", narration: "They want an emergency injunction, until companies can prove humans stay in control.", kicker: "THE REQUEST", headline: "What the plaintiffs want", doc: { title: "Request for emergency injunction", sub: "Plaintiffs: Irreplaceable Education Fund · Public Citizen · Heat Initiative · Alliance for Secure AI", clauses: ["Immediate injunction on next-generation models.", "Companies must prove the technology is under human control."], stamp: "SOUGHT" }, transition: "slide", evidence: ["f1", "f4", "f5"] },
    { scene: "manifest", narration: "The complaint cites AI-driven cyberattacks and the companies' own admissions that AI could go rogue.", kicker: "CITED IN THE COMPLAINT", headline: "Evidence on the board", sub: "evidence_board.txt", items: [{ label: "AI-driven", value: "CYBERATTACKS", color: "#A4161A" }, { label: "Companies' own admissions", value: "COULD GO ROGUE", color: "#A4161A" }], callouts: ["FROM THE COMPLAINT", "PER AL JAZEERA"], transition: "push", evidence: ["f6"] },
    { scene: "type_slam", narration: "Congress has yet to pass legislation governing AI.", kicker: "THE GAP", headline: "Congress has yet to pass AI legislation", hl: ["YET"], ghost: "NO LAW", sub: "Per Al Jazeera, Nov 12, 2026", transition: "zoom", evidence: ["f8"] },
    { scene: "question", narration: "So the question isn't just can we build it. It's should a court let it keep going?", kicker: "THE QUESTION", headline: "Should a court let it keep going?", hl: ["COURT"], sub: "The case is in San Francisco Superior Court.", cta: "Follow AI Tested for the AI court fight.", transition: "flash" },
  ],
  audio: {
    music: { src: "music/m23_dark.mp3", volume: 0.2, fadeIn: 0.8, fadeOut: 1.8, duck: 0.4 },
    ambience: { src: "ambience/amb_courtroom.mp3", volume: 0.14 },
    sfx: sfx([
      [0, 0.0, "gavel", 1.0, 2.2, "gavel opens the case"], [0, 0.5, "impact_low", 0.8, 1.8, "weight under the gavel"], [0, 2.2, "click", 0.5, 0.5, "date chip lands"],
      [1, 0.0, "whoosh", 0.6, 1.0, "wipe to defendants"], [1, 0.9, "hit", 0.8, 1.0, "defendant 1"], [1, 1.5, "hit", 0.8, 1.0, "defendant 2"], [1, 2.1, "hit", 0.8, 1.0, "defendant 3"], [1, 2.7, "hit", 0.8, 1.0, "defendant 4"], [1, 3.3, "thud", 0.9, 1.2, "defendant 5"],
      [2, 0.0, "paper", 0.75, 1.4, "filing slides up"], [2, 1.4, "keyboard", 0.45, 1.2, "clause typed"], [2, 3.8, "thud", 1.0, 1.4, "SOUGHT stamp"],
      [3, 0.0, "sweep", 0.6, 1.0, "push to evidence"], [3, 1.0, "error", 0.5, 0.8, "first risk"], [3, 2.6, "glitch", 0.5, 1.0, "second risk"], [3, 4.0, "clickS", 0.5, 0.5, "chip"],
      [4, 0.0, "impact_low", 0.85, 1.8, "gap slam"], [4, 1.3, "scratch", 0.45, 1.0, "no law yet"],
      [5, 0.0, "riser", 0.7, 3.2, "tension into question"], [5, 3.0, "bell", 0.5, 2.0, "closing sting"],
    ]),
  },
  asset_manifest: ["anthropic-white", "google-white", "meta-white", "openai-white", "spacex-white"].map((id) => logoEntry(id, "beat 1 logo_wall")),
});

// ------------------------------------------------------------------ 24: build log / code lab
plans.push({
  id: "24", slug: "one-file-ai-game", title: "An AI Made a 3D Shooter in One File", schema: 6,
  concept: "Build log in a code-lab look: terminal-green on black, the real Saltline screenshots with HUD callouts, a one-prompt/zero-feedback readout, 8-hour and 1.4 MB counters, a no-assets teardown and the cost.",
  creative_direction: {
    why_this_look: "The story is about code that makes everything, so the look is a terminal: mono headlines, scanlines, green-on-black, readout panels. The only real imagery is the game's own published screenshots, cropped to the HUD details.",
    motion: "Mono headlines type in, readout rows land like log lines, crop callouts punch into the real screenshot, counters tick up.",
    sound: "Space-synth bed, rain ambience matching the game's rainy harbor, keyboard and click for the build log, shutter on screenshot crops, hits on the numbers.",
  },
  theme: { mode: "dark", bg: "#04080A", bg2: "#0A1418", ink: "#E8FFF4", muted: "#7FA394", accent: "#00FF9C", accent2: "#00B8FF", panel: "#0A1317", panelInk: "#E8FFF4", line: "#17332C", texture: "scan", display: "mono", body: "inter" },
  beats: [
    { scene: "type_slam", narration: "An AI made a playable 3D shooter in one file.", kicker: "BUILD LOG // SALTLINE", headline: "3D shooter. One file.", hl: ["ONE", "FILE."], ghost: "1 FILE", media: [{ src: "photos/real/hf-saltline-blog.webp", role: "bg", credit: "Image: Hugging Face blog (softroyals)" }], callouts: ["BROWSER FPS"], transition: "cut", evidence: ["f1"] },
    { scene: "manifest", narration: "One prompt. No human feedback during the build.", kicker: "BUILD INPUT", headline: "How it was built", sub: "build.log", items: [{ label: "prompts", value: "1" }, { label: "human feedback", value: "0", color: "#00B8FF" }], transition: "slide", evidence: ["f2"] },
    { scene: "stat_hero", narration: "An Anthropic engineer ran Claude Fable 5.2 for about eight hours.", kicker: "GENERATION TIME", headline: "About eight hours", stat: { value: 8, suffix: " hrs", label: "of generation", ghost: "8H" }, items: [{ label: "Model", value: "Claude Fable 5.2" }, { label: "Run by", value: "Anthropic engineer", color: "#00B8FF" }], transition: "wipe", evidence: ["f2", "f3", "n2"] },
    { scene: "screenshot", narration: "The result: Saltline, a free browser shooter set in a rainy harbor.", kicker: "THE RESULT // SALTLINE", headline: "Free. In your browser.", media: [{ src: "photos/real/hf-saltline-blog.webp", role: "shot", credit: "Image: Hugging Face blog (softroyals)" }], crops: [{ x: 0, y: 0, w: 0.26, h: 0.17, label: "OBJECTIVE HUD" }, { x: 0.83, y: 0.8, w: 0.17, h: 0.2, label: "AMMO HUD" }], transition: "push", evidence: ["f1", "f6"] },
    { scene: "stat_hero", narration: "The whole game is one 1.4 megabyte file.", kicker: "FILE SIZE", headline: "The whole game", stat: { value: 1.4, suffix: " MB", decimals: 1, label: "one HTML file", ghost: "1.4MB" }, items: [{ label: "File type", value: "HTML" }, { label: "Files", value: "1", color: "#00B8FF" }], transition: "zoom", evidence: ["f4", "n1"] },
    { scene: "manifest", narration: "No separate images, audio files, or 3D models. Code generates the visuals and the sound.", kicker: "ASSET FOLDER", headline: "Nothing packaged", sub: "assets/", media: [{ src: "photos/real/saltline-terminal.webp", role: "bg", credit: "Image: saltline.games" }], items: [{ label: "separate images", value: "0" }, { label: "audio files", value: "0" }, { label: "3D models", value: "0" }, { label: "visuals + sound", value: "CODE", color: "#00B8FF" }], transition: "iris", evidence: ["f5"] },
    { scene: "stat_hero", narration: "Estimated API cost: about five hundred fifty dollars.", kicker: "THE BILL", headline: "Estimated API cost", stat: { value: 550, prefix: "$", label: "about", ghost: "$$$" }, items: [{ label: "Output tokens", value: "2.7M" }, { label: "Input tokens", value: "445M", color: "#00B8FF" }], transition: "flash", evidence: ["n3", "n4", "n5", "f7"] },
  ],
  audio: {
    music: { src: "music/m24_space.mp3", volume: 0.17, fadeIn: 0.8, fadeOut: 1.8, duck: 0.4 },
    ambience: { src: "ambience/amb_rain.mp3", volume: 0.16 },
    sfx: sfx([
      [0, 0.0, "impact_low", 0.85, 1.6, "title slam"], [0, 0.4, "keyboard", 0.5, 1.4, "terminal typing"], [0, 2.0, "click", 0.5, 0.5, "chip lands"],
      [1, 0.0, "sweep", 0.55, 1.0, "slide to log"], [1, 0.9, "tickT", 0.6, 0.5, "prompt line"], [1, 1.7, "click", 0.6, 0.5, "feedback line"], [1, 2.2, "confirm", 0.45, 0.8, "log complete"],
      [2, 0.0, "whoosh", 0.55, 1.0, "wipe to counter"], [2, 0.4, "tickT", 0.55, 1.6, "hours counting"], [2, 2.0, "hit", 0.8, 1.0, "eight lands"], [2, 3.0, "clickS", 0.5, 0.5, "model row"],
      [3, 0.0, "whoosh_deep", 0.6, 1.4, "push to screenshot"], [3, 1.0, "shutter", 0.7, 0.8, "screenshot crop 1"], [3, 2.4, "shutter", 0.7, 0.8, "screenshot crop 2"], [3, 3.6, "mouse", 0.5, 0.5, "callout settles"],
      [4, 0.0, "riser", 0.55, 1.5, "build to size"], [4, 1.0, "impact", 0.85, 1.4, "1.4 MB lands"],
      [5, 0.0, "glitch", 0.5, 1.0, "iris into assets"], [5, 0.9, "error", 0.4, 0.7, "zero images"], [5, 1.8, "error", 0.4, 0.7, "zero audio"], [5, 2.7, "error", 0.4, 0.7, "zero models"], [5, 3.8, "confirm", 0.6, 0.8, "code generates"],
      [6, 0.0, "scratch", 0.45, 1.0, "cost reveal"], [6, 0.6, "bell", 0.6, 1.6, "price chime"], [6, 2.0, "thud", 0.7, 1.0, "cost lands"],
    ]),
  },
  asset_manifest: [
    pressEntry("photos/real/hf-saltline-blog.webp", "1200x750", "https://huggingface.co/blog/softroyals/how-saltline-ai-game-was-built-1-4mb-html", "beats 0,3", "Real screenshot of the game from the blog post"),
    pressEntry("photos/real/saltline-terminal.webp", "1200x750", "https://saltline.games", "beat 5 background", "Real image from the game site"),
  ],
});

// ------------------------------------------------------------------ 25: product transformation
plans.push({
  id: "25", slug: "ai-builds-the-app", title: "Google's AI Didn't Answer. It Built the App.", schema: 6,
  concept: "Product transformation: a bright, friendly product-launch look; Google's own Tabletop screenshots cropped to the bracket and map the agent built, a rapid list of planning tools, the shared-editing idea, the US waitlist reality check and the closing shift.",
  creative_direction: {
    why_this_look: "Tabletop is a consumer collaboration product, so the video is warm and bright: cream background, Google-style blue, red and green accents, rounded headlines. It is the opposite of the dark investigative videos and the light legal one.",
    motion: "Real Tabletop screenshots with spotlight crops, a quick-fire list of tools, a bold 18+ stat for the waitlist reality check, ripples on the closing question.",
    sound: "Upbeat corporate bed, soft room tone, mouse clicks and shutters on the UI crops, confirms as each tool is named.",
  },
  theme: { mode: "light", bg: "#FBF6EC", bg2: "#F2EAD9", ink: "#14171F", muted: "#5F6675", accent: "#1A73E8", accent2: "#EA4335", accent3: "#34A853", panel: "#FFFFFF", panelInk: "#14171F", line: "#E0D6BF", texture: "dots", display: "outfit", body: "inter", radius: 22 },
  beats: [
    { scene: "type_slam", narration: "You didn't open an app. You asked for one.", kicker: "GOOGLE LABS // TABLETOP", headline: "You didn't open an app. You asked for one.", hl: ["ASKED"], ghost: "ASK", media: [{ src: "photos/real/tabletop-social.png", role: "bg", credit: "Image: Google (Tabletop)" }], logos: [{ id: "google-white", label: "Google", color: "#1A73E8" }], transition: "cut", evidence: ["f1"] },
    { scene: "screenshot", narration: "Google Tabletop lets a group ask an AI agent to build the planning tools they need.", kicker: "REAL TABLETOP SCREENS", headline: "A group asks. The agent builds.", media: [{ src: "photos/real/tabletop-google-blog.jpg", role: "shot", credit: "Image: Google blog (Tabletop)" }], crops: [{ x: 0.27, y: 0, w: 0.39, h: 0.3, label: "TOURNAMENT BRACKET" }, { x: 0.18, y: 0.4, w: 0.26, h: 0.33, label: "BRUNCH PLAN + MAP" }], transition: "slide", evidence: ["f1", "f2"] },
    { scene: "timeline", narration: "Trip itinerary? Dinner poll? Expense splitter? Tournament bracket?", kicker: "WHAT IT CAN BUILD", headline: "Planning tools on request", items: [{ label: "Tool 1", value: "Trip itinerary", color: "#1A73E8" }, { label: "Tool 2", value: "Dinner poll", color: "#EA4335" }, { label: "Tool 3", value: "Expense splitter", color: "#34A853" }, { label: "Tool 4", value: "Tournament bracket", color: "#1A73E8" }], transition: "push", evidence: ["f2"] },
    { scene: "type_slam", narration: "Everyone can use it at the same time, like a Google Doc.", kicker: "LIKE A GOOGLE DOC", headline: "Everyone, at the same time", hl: ["SAME", "TIME"], ghost: "TOGETHER", media: [{ src: "photos/real/tabletop-social.png", role: "bg", credit: "Image: Google (Tabletop)" }], callouts: ["SHARED ONLINE SPACE"], transition: "wipe", evidence: ["f1", "f3"] },
    { scene: "stat_hero", narration: "It's still a US-only waitlist test for adults eighteen and over.", kicker: "REALITY CHECK", headline: "Adults only, waitlist only", stat: { value: 18, suffix: "+", label: "US adults", ghost: "18+" }, items: [{ label: "Region", value: "US only" }, { label: "Access", value: "Waitlist", color: "#EA4335" }, { label: "Age", value: "18+", color: "#34A853" }], transition: "zoom", evidence: ["f4", "n1"] },
    { scene: "question", narration: "But look at what changed. AI isn't just answering. It's building planning tools on demand.", kicker: "THE SHIFT", headline: "AI isn't just answering.", hl: ["ANSWERING."], sub: "It's building planning tools on demand.", cta: "Follow AI Tested for the next AI workflow shift.", transition: "flash" },
  ],
  audio: {
    music: { src: "music/m25_corporate.mp3", volume: 0.16, fadeIn: 0.7, fadeOut: 1.8, duck: 0.4 },
    ambience: { src: "ambience/amb_room_tone.mp3", volume: 0.1 },
    sfx: sfx([
      [0, 0.0, "impact", 0.75, 1.4, "title slam"], [0, 0.5, "mouse", 0.5, 0.5, "ask click"], [0, 1.6, "confirm", 0.5, 0.8, "answer chip"],
      [1, 0.0, "whoosh", 0.55, 1.0, "slide to screens"], [1, 1.3, "shutter", 0.7, 0.8, "bracket crop"], [1, 3.2, "shutter", 0.7, 0.8, "map crop"], [1, 4.8, "mouse", 0.5, 0.5, "callout settles"],
      [2, 0.0, "sweep", 0.55, 1.0, "push to list"], [2, 0.9, "confirm", 0.6, 0.8, "tool 1"], [2, 1.7, "confirm", 0.6, 0.8, "tool 2"], [2, 2.5, "confirm", 0.6, 0.8, "tool 3"], [2, 3.3, "confirm", 0.6, 0.8, "tool 4"],
      [3, 0.0, "whoosh_deep", 0.55, 1.4, "wipe to together"], [3, 0.5, "switch", 0.5, 0.6, "multi-user switch"], [3, 1.9, "clickS", 0.5, 0.5, "chip"],
      [4, 0.0, "riser", 0.5, 1.4, "build to reality check"], [4, 1.0, "hit", 0.8, 1.2, "18+ lands"], [4, 2.2, "click", 0.5, 0.6, "row"],
      [5, 0.0, "reveal", 0.6, 1.4, "closing reveal"], [5, 1.8, "bell", 0.55, 2.0, "shift sting"],
    ]),
  },
  asset_manifest: [
    pressEntry("photos/real/tabletop-social.png", "2400x1260", "Google Tabletop social/press image (tabletop images pulled from the Google/SiliconANGLE launch coverage)", "beats 0,3 background", "Real product image; blurred behind text"),
    pressEntry("photos/real/tabletop-google-blog.jpg", "1440x810", "https://blog.google/innovation-and-ai/models-and-research/google-labs/tabletop/", "beat 1", "Real Tabletop screens from Google's blog post"),
    logoEntry("google-white", "beat 0 type_slam"),
  ],
});

// ------------------------------------------------------------------ write + self-check
const outDir = path.join(root, "plans");
fs.mkdirSync(outDir, { recursive: true });
for (const p of plans) {
  const script = readJson(path.join(root, "scripts", `${p.id}-${p.slug}.json`)).script;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9$%.' ]+/g, " ").replace(/[.']/g, "").replace(/\s+/g, " ").trim();
  const j = norm(p.beats.map((b) => b.narration).join(" "));
  if (j !== norm(script)) { console.error(`${p.id}: narration mismatch\n  beats : ${j}\n  script: ${norm(script)}`); process.exitCode = 1; continue; }
  fs.writeFileSync(path.join(outDir, `${p.id}-${p.slug}.plan.json`), JSON.stringify(p, null, 2));
  console.log("wrote", p.id, p.beats.length, "beats", p.audio.sfx.length, "sfx");
}
