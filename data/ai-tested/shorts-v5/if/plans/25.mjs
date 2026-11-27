// Scene plan for short 25 (Tabletop). Word indexes refer to if/audio/25.vtt.
export default function build(T) {
// word i with display text (and style overrides)
const w = (i, text, o = {}) => ({ w: text, t: T[i], ...o });
const run = (i0, texts, o = {}) => texts.map((tx, k) => w(i0 + k, tx, o));
const B = { sz: 56, wt: 700 }; // bold keyword style
const bold = (i0, texts) => run(i0, texts, B);

const SZ = { lead: 40 };
const cardW = 462;
const A = "v7/25/";
const t0 = (i) => Math.max(0, T[i] - 0.15);
const scenes = [
  { i: 0, grid: true, els: [
    { k: "props", t: 0.0, a: "v7/25/google-g-logo-tile.png", b: "v7/25/tabletop-logo-endcard-crop.png", bWide: true },
    { k: "lines", lines: [
      { y: 440, words: run(0, ["google", "is", "testing", "a", "tool", "where"]) },
      { y: 505, sz: 56, wt: 700, words: bold(6, ["You", "Ask", "An", "AI"]) },
      { y: 575, sz: 33, wt: 700, words: run(10, ["to", "build", "the", "app", "your", "group", "needs"], { pill: true }) },
    ] },
  ] },
  { i: 17, els: [
    { k: "lines", lines: [
      { y: 440, words: run(17, ["it", "is", "called"]) },
      { y: 520, sz: 76, wt: 800, words: [w(20, "Tabletop", { sz: 76, wt: 800 })] },
    ] },
    { k: "chip", img: A + "google-g-logo-tile.png", label: "GOOGLE LABS", y: 620, t: T[20] },
  ] },
  { i: 21, els: [
    { k: "lines", lines: [
      { y: 100, words: run(21, ["your", "group", "shares"]) },
      { y: 165, sz: 56, wt: 700, words: bold(24, ["One", "Online", "Space"]) },
    ] },
    { k: "card", img: A + "tabletop-video-shared-space-invite-t09.png", y: 368, w: cardW, h: 260, t: T[21] },
  ] },
  { i: 27, els: [
    { k: "lines", lines: [
      { y: 100, words: run(27, ["add", "links,", "files", "and", "ideas"]) },
      { y: 165, sz: 56, wt: 700, words: bold(32, ["Then", "Ask", "The", "Agent"]) },
    ] },
    { k: "card", img: A + "tabletop-video-ask-prompt-t11.png", y: 368, w: cardW, h: 260, t: T[27] },
  ] },
  { i: 36, els: [
    { k: "lines", lines: [
      { y: 100, words: run(36, ["or", "pick", "a"]) },
      { y: 165, sz: 56, wt: 700, words: bold(39, ["Starter", "Template"]) },
    ] },
    { k: "card", img: A + "tabletop-video-tool-picker-t18.png", y: 368, w: cardW, h: 260, t: T[36] },
  ] },
  { i: 41, grid: true, els: [
    { k: "lines", lines: [
      { y: 470, words: run(41, ["it", "can", "build"]) },
      { y: 540, sz: 56, wt: 700, words: bold(44, ["Things", "Like", "These"]) },
    ] },
  ] },
  { i: 47, els: [
    { k: "lines", lines: [
      { y: 100, words: run(47, ["first,", "a"]) },
      { y: 165, sz: 56, wt: 700, words: bold(49, ["Trip", "Itinerary"]) },
    ] },
    { k: "card", img: A + "tabletop-labs-trip-planning-dinner-decider.png", y: 368, w: cardW, h: 250, t: T[47] },
  ] },
  { i: 51, els: [
    { k: "lines", lines: [
      { y: 100, words: run(51, ["second,", "a"]) },
      { y: 165, sz: 56, wt: 700, words: bold(53, ["Dinner", "Poll"]) },
    ] },
    { k: "card", img: A + "tabletop-video-vote-ui-live-cursors-t53.png", y: 368, w: cardW, h: 260, t: T[51] },
  ] },
  { i: 55, els: [
    { k: "lines", lines: [
      { y: 100, words: run(55, ["third,", "an"]) },
      { y: 165, sz: 56, wt: 700, words: bold(57, ["Expense", "Splitter"]) },
    ] },
    { k: "card", img: A + "tabletop-video-expense-overview-t57.png", y: 368, w: cardW, h: 260, t: T[55] },
  ] },
  { i: 59, els: [
    { k: "lines", lines: [
      { y: 100, words: run(59, ["fourth,", "a"]) },
      { y: 165, sz: 56, wt: 700, words: bold(61, ["Tournament", "Bracket"]) },
    ] },
    { k: "card", img: A + "tabletop-video-tournament-bracket-t22.png", y: 368, w: cardW, h: 260, t: T[59] },
  ] },
  { i: 63, grid: true, els: [
    { k: "lines", lines: [
      { y: 470, words: run(63, ["and", "here", "is", "the", "part"]) },
      { y: 545, sz: 66, wt: 800, words: run(68, ["THAT", "MATTERS"], { sz: 66, wt: 800 }) },
    ] },
  ] },
  { i: 70, els: [
    { k: "lines", lines: [
      { y: 73, words: run(70, ["everyone", "uses", "it"]) },
      { y: 117, words: run(73, ["at", "the", "same", "time"]) },
      { y: 165, sz: 56, wt: 700, words: bold(77, ["Like", "A", "Google", "Doc"]) },
    ] },
    { k: "card", img: A + "tabletop-video-shared-cursors-vote-t31.png", y: 400, w: cardW, h: 260, t: T[70] },
  ] },
  { i: 81, els: [
    { k: "lines", lines: [
      { y: 73, words: run(81, ["it", "is", "still", "a", "google", "labs"]) },
      { y: 130, sz: 56, wt: 700, words: bold(87, ["Experiment"]) },
    ] },
    { k: "card", img: A + "tabletop-labs-landing-waitlist.png", y: 340, w: cardW, h: 200, t: T[81] },
    { k: "bullets", y: 625, gap: 78, sz: 34, items: [
      { words: run(88, ["US", "only"]) },
      { words: run(90, ["adults", "eighteen", "and", "over"]) },
      { words: run(94, ["by", "waitlist"]) },
    ] },
  ] },
  { i: 96, grid: true, els: [
    { k: "lines", lines: [
      { y: 400, words: run(96, ["you", "just", "found", "the", "tool"]) },
      { y: 450, words: run(101, ["that", "builds", "your"]) },
      { y: 520, sz: 60, wt: 700, words: bold(104, ["Group's", "Planning"]) },
      { y: 590, sz: 60, wt: 700, words: bold(106, ["Tools"]) },
    ] },
  ] },
  { i: 107, els: [
    { k: "mark", y: 360, t: T[107] },
    { k: "lines", lines: [
      { y: 540, words: run(107, ["follow"]) },
      { y: 620, sz: 76, wt: 800, words: run(108, ["AI", "Tested"], { sz: 76, wt: 800 }) },
    ] },
  ] },
];
// Reference layout: lead text above the card, bold keyword below it.
for (const s of scenes) {
  if (!s.els.some((e) => e.k === "card")) continue;
  for (const e of s.els) if (e.k === "lines") for (const l of e.lines) { if (l.y === 165) l.y = 595; else if (l.y === 100) l.y = 117; }
}
const planScenes = scenes.map((s, k) => ({ t0: k === 0 ? 0 : t0(s.i), t1: k === scenes.length - 1 ? 999 : t0(scenes[k + 1].i), grid: !!s.grid, els: s.els }));

const sfxAt = (t, src, vol, d) => ({ t, src, vol, dur: d });
const sfx = [
  sfxAt(0.08, "sfx2/boom_hit.mp3", 0.35, 1.2),
  sfxAt(T[20] - 0.1, "sfx2/whoosh_quick.mp3", 0.12, 0.6),
  sfxAt(T[21] - 0.1, "sfx2/whoosh_swipe.mp3", 0.12, 0.6),
  sfxAt(T[27] - 0.1, "sfx2/whoosh_swipe.mp3", 0.12, 0.6),
  sfxAt(T[36] - 0.1, "sfx2/whoosh_swipe.mp3", 0.12, 0.6),
  sfxAt(T[47] - 0.1, "sfx2/whoosh_quick.mp3", 0.12, 0.6),
  sfxAt(T[51] - 0.1, "sfx2/whoosh_quick.mp3", 0.12, 0.6),
  sfxAt(T[55] - 0.1, "sfx2/whoosh_quick.mp3", 0.12, 0.6),
  sfxAt(T[59] - 0.1, "sfx2/whoosh_quick.mp3", 0.12, 0.6),
  sfxAt(T[68] - 0.05, "sfx2/impact_low.mp3", 0.3, 1.2),
  sfxAt(T[70] - 0.1, "sfx2/whoosh_swipe.mp3", 0.12, 0.6),
  sfxAt(T[81] - 0.1, "sfx2/whoosh_swipe.mp3", 0.12, 0.6),
  sfxAt(T[88] - 0.05, "sfx2/mouse_click.mp3", 0.12, 0.4),
  sfxAt(T[90] - 0.05, "sfx2/mouse_click.mp3", 0.12, 0.4),
  sfxAt(T[94] - 0.05, "sfx2/mouse_click.mp3", 0.12, 0.4),
  sfxAt(T[107] - 0.05, "sfx2/boom_hit.mp3", 0.25, 1.0),
];


return { scenes: planScenes, sfx };
}
