// Short 40: OpenCode, the free open source AI coding agent. Facts: facts/40.facts.json. Loop-friendly: the last words flow into the first.
import { helpers } from "./_h.mjs";
export default function build(T) {
  const { w, run, sfxAt, whoosh, click, finish } = helpers(T);
  const A = "v7/40/", R = A + "raw/";
  const N = { sz: 46, wt: 500 }, BO = { sz: 64, wt: 700 }, XL = { sz: 92, wt: 800 };
  const b = (i, text, o = BO) => w(i, text, o);
  const TERM = { k: "cut", img: R + "opencode-terminal.png", y: 330, w: 560, h: 457, t: -0.6 };
  const scenes = [
    { i: 0, grid: true, els: [
      TERM,
      { k: "lines", lines: [
        { y: 625, words: [w(0, "OpenCode", { ...XL, t: -0.5 })] },
        { y: 770, ...N, words: run(1, ["A", "free", "AI"]) },
        { y: 840, ...BO, words: [b(4, "Coding"), b(5, "Agent")] },
      ] },
    ] },
    { i: 6, els: [
      { k: "cut", img: R + "octicon-mark-github.svg", y: 190, w: 190, h: 190, t: T[6], disc: true },
      { k: "lines", lines: [
        { y: 345, ...N, words: run(6, ["with", "over"]) },
        { y: 640, ...BO, words: [b(13, "GitHub"), b(14, "Stars")] },
      ] },
      { k: "count", y: 490, t: T[8], to: 229000, dur: 1.5, sz: 118, suffix: "+" },
      { k: "cut", img: R + "octicon-star-fill.svg", y: 770, w: 120, h: 120, t: T[14], rot: 14 },
    ] },
    { i: 15, grid: true, els: [
      { k: "cut", img: R + "octicon-unlock.svg", y: 290, w: 240, h: 240, t: T[17] },
      { k: "lines", lines: [
        { y: 110, ...N, words: run(15, ["It", "is"]) },
        { y: 520, ...XL, words: [b(17, "Open", XL), b(18, "Source", XL)] },
        { y: 660, ...N, words: run(19, ["under", "the"]) },
        { y: 750, sz: 48, wt: 700, words: [w(21, "MIT", { pill: true }), w(24, "license", { pill: true })] },
      ] },
    ] },
    { i: 25, els: [
      { k: "cut", img: R + "opencode-terminal.png", y: 270, w: 400, h: 326, t: T[30] - 0.1 },
      { k: "cut", img: R + "opencode-desktop-icon.png", y: 700, w: 170, h: 170, t: T[34] - 0.1 },
      { k: "lines", lines: [
        { y: 62, ...N, words: run(25, ["You", "run", "it", "in", "your"]) },
        { y: 490, ...BO, words: [b(30, "Terminal")] },
        { y: 565, ...N, words: run(31, ["or", "in", "a"]) },
        { y: 835, ...BO, words: [b(34, "Desktop"), b(35, "App")] },
      ] },
    ] },
    { i: 36, grid: true, els: [
      { k: "lines", lines: [
        { y: 240, ...N, words: run(36, ["Start", "with", "the"]) },
        { y: 710, ...XL, words: [b(39, "Free", XL), b(40, "Models", XL)] },
      ] },
      { k: "card", img: A + "opencode-site-free-models.png", y: 450, w: 548, h: 198, t: T[36] },
    ] },
    { i: 41, els: [
      { k: "cut", img: R + "octicon-key.svg", y: 270, w: 210, h: 210, t: T[41], slash: true },
      { k: "lines", lines: [
        { y: 510, ...XL, words: [b(41, "No", XL), b(42, "Account", XL)] },
        { y: 595, ...N, words: [w(43, "needed")] },
        { y: 760, sz: 50, wt: 500, words: run(44, ["Or", "bring", "your", "own"]) },
      ] },
    ] },
    { i: 48, grid: true, els: [
      { k: "lines", lines: [
        { y: 70, ...N, words: run(48, ["It", "connects", "to", "more", "than"]) },
        { y: 295, ...BO, words: [b(55, "Providers")] },
        { y: 835, ...N, words: run(56, ["including", "local", "models"]) },
      ] },
      { k: "count", y: 190, t: T[53], to: 200, dur: 0.8, sz: 124, suffix: "+" },
      { k: "cut", img: R + "models-openai.svg", x: 120, y: 480, w: 150, h: 150, t: T[55], disc: true },
      { k: "cut", img: R + "models-anthropic.svg", x: 304, y: 480, w: 150, h: 150, t: T[55] + 0.18, disc: true },
      { k: "cut", img: R + "models-google.svg", x: 488, y: 480, w: 150, h: 150, t: T[56], disc: true },
      { k: "cut", img: R + "models-github-copilot.svg", x: 120, y: 665, w: 150, h: 150, t: T[57], disc: true },
      { k: "cut", img: R + "models-ollama-cloud.svg", x: 304, y: 665, w: 150, h: 150, t: T[57] + 0.2, disc: true },
      { k: "cut", img: R + "models-lmstudio.svg", x: 488, y: 665, w: 150, h: 150, t: T[58], disc: true },
    ] },
    { i: 59, els: [
      { k: "cut", img: R + "models-openai.svg", y: 190, w: 200, h: 200, t: T[64] },
      { k: "lines", lines: [
        { y: 345, sz: 40, wt: 500, words: run(59, ["You", "can", "even", "sign", "in", "with"]) },
        { y: 430, sz: 50, wt: 700, words: run(65, ["ChatGPT", "Plus", "or", "Pro"], { pill: true }) },
        { y: 560, sz: 42, wt: 500, words: run(69, ["instead", "of", "an", "API", "key"]) },
      ] },
      { k: "cut", img: R + "octicon-key.svg", y: 730, w: 190, h: 190, t: T[72], slash: true },
    ] },
    { i: 74, grid: true, els: [
      { k: "lines", lines: [{ y: 80, ...N, words: run(74, ["It", "supports"]) }] },
      { k: "card", img: A + "opencode-site-features.png", y: 320, w: 560, h: 340, t: T[74] },
      { k: "bullets", y: 600, gap: 85, sz: 54, items: [
        { words: [w(76, "MCP"), w(79, "servers")] },
        { words: [w(80, "Skills")] },
        { words: [w(82, "Custom"), w(83, "agents")] },
      ] },
    ] },
    { i: 84, grid: true, els: [
      { k: "cut", img: R + "octicon-pencil.svg", y: 330, w: 230, h: 230, t: T[88] },
      { k: "lines", lines: [
        { y: 90, ...N, words: run(84, ["Two", "built", "in", "agents"]) },
        { y: 590, ...XL, words: [b(88, "Build", XL)] },
        { y: 715, sz: 52, wt: 700, words: run(90, ["full", "access"], { pill: true }) },
      ] },
    ] },
    { i: 92, els: [
      { k: "cut", img: R + "octicon-lock.svg", y: 330, w: 230, h: 230, t: T[92] },
      { k: "lines", lines: [
        { y: 590, ...XL, words: [b(92, "Plan", XL)] },
        { y: 715, sz: 52, wt: 700, words: run(94, ["read", "only"], { pill: true }) },
      ] },
    ] },
    { i: 96, grid: true, els: [
      { k: "lines", lines: [
        { y: 130, ...N, words: run(96, ["Install", "it", "with"]) },
        { y: 690, sz: 74, wt: 800, words: [b(99, "One", { sz: 74, wt: 800 }), b(100, "Command", { sz: 74, wt: 800 })] },
      ] },
      { k: "code", y: 230, w: 540, t: T[96] - 0.2, dur: 0.85, sz: 25, lines: ["curl -fsSL", "https://opencode.ai/v2/install", "| bash"] },
    ] },
    { i: 101, grid: true, els: [
      { k: "mark", y: 250, t: T[101] },
      { k: "lines", lines: [
        { y: 450, ...N, words: [w(101, "Follow")] },
        { y: 555, ...XL, words: run(102, ["AI", "Tested"], XL) },
        { y: 680, ...N, words: run(104, ["for", "more", "free", "tools"]) },
      ] },
    ] },
    { i: 108, els: [
      { k: "lines", lines: [
        { y: 150, ...XL, words: [w(108, "Comment", XL)] },
        { y: 540, sz: 52, wt: 500, words: run(110, ["and", "I", "will", "pin"]) },
      ] },
      { k: "comment", y: 250, w: 520, t: T[109] - 0.3, text: "OpenCode", sz: 58 },
      { k: "cut", img: R + "octicon-mark-github.svg", y: 730, w: 170, h: 170, t: T[113], disc: true },
    ] },
    { i: 114, grid: true, els: [
      TERM,
      { k: "lines", lines: [{ y: 625, sz: 84, wt: 800, words: run(114, ["the", "link", "to"]) }] },
    ] },
  ];
  const sfx = [
    sfxAt(0.08, "sfx2/boom_hit.mp3", 0.3, 1.2),
    whoosh(6), whoosh(15), whoosh(25), whoosh(36), whoosh(41), whoosh(48), whoosh(59), whoosh(74), whoosh(84), whoosh(92), whoosh(96), whoosh(101), whoosh(108),
    sfxAt(T[8], "sfx2/keyboard.mp3", 0.1, 1.4),
    sfxAt(T[14] - 0.05, "sfx2/impact_low.mp3", 0.25, 1.0),
    click(55), click(56), click(57), click(58),
    click(76), click(80), click(82),
    sfxAt(T[96] - 0.1, "sfx2/keyboard.mp3", 0.14, 1.2),
    sfxAt(T[109] - 0.3, "sfx2/keyboard.mp3", 0.12, 0.9),
    sfxAt(T[113], "sfx2/switch_click.mp3", 0.12, 0.4),
  ];
  return { ...finish(scenes, sfx), loop: true };
}
