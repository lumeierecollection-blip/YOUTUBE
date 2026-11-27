// Short 24: Saltline, a 3D shooter built from one prompt. Facts: facts/24.facts.json
import { helpers } from "./_h.mjs";
export default function build(T) {
  const { w, run, whoosh, sfxAt, click, cardScene, finish } = helpers(T);
  const A = "v7/24/";
  const BO = { sz: 56, wt: 700 }, XL = { sz: 76, wt: 800 };
  const b = (i, text, o = BO) => w(i, text, o);
  const scenes = [
    { i: 0, grid: true, els: [
      { k: "props", t: 0.0, a: A + "claude-symbol-tile.png", b: A + "anthropic-wordmark-tile.png" },
      { k: "lines", lines: [
        { y: 440, ...BO, words: [b(0, "One"), b(1, "Prompt")] },
        { y: 510, words: run(2, ["built", "a", "playable"]) },
        { y: 585, ...BO, words: [b(5, "3D"), b(7, "Shooter")] },
      ] },
    ] },
    { i: 8, els: [
      { k: "lines", lines: [
        { y: 73, words: run(8, ["it", "is", "called"]) },
        { y: 595, ...XL, words: [b(11, "Saltline", XL)] },
      ] },
      { k: "card", img: A + "saltline-game-01-spawn-briefing.png", y: 368, w: 462, h: 260, t: T[8] },
    ] },
    cardScene(12, run(12, ["a", "free"]), [b(14, "Browser"), b(15, "Game")], A + "saltline-site-hero-capture.png"),
    { i: 16, grid: true, els: [
      { k: "lines", lines: [
        { y: 430, words: run(16, ["generated", "by"]) },
        { y: 505, ...BO, words: [b(18, "Claude"), b(19, "Fable"), b(20, "5.2")] },
      ] },
      { k: "chip", img: A + "claude-symbol-tile.png", label: "ANTHROPIC", y: 610, t: T[18] },
    ] },
    { i: 23, grid: true, els: [
      { k: "lines", lines: [
        { y: 410, words: run(23, ["from", "a", "single"]) },
        { y: 480, ...BO, words: [b(26, "Prompt")] },
        { y: 555, sz: 33, wt: 700, words: run(27, ["with", "no", "human", "feedback"], { pill: true }) },
        { y: 625, words: run(31, ["during", "the", "build"]) },
      ] },
    ] },
    { i: 34, els: [
      { k: "lines", lines: [
        { y: 73, words: run(34, ["Anthropic", "engineer"]) },
        { y: 595, ...BO, words: [b(36, "Felix"), b(37, "Rieseberg")] },
        { y: 650, sz: 33, wt: 700, words: run(38, ["ran", "the", "experiment"], { pill: true }) },
      ] },
      { k: "card", img: A + "hf-blog-title-capture.png", y: 368, w: 462, h: 216, t: T[34] },
    ] },
    cardScene(41, run(41, ["the", "whole", "game", "is"]), [b(45, "One"), b(46, "HTML"), b(47, "File")], A + "github-repo-single-index-html.png", { h: 150 }),
    cardScene(48, [w(48, "about")], [b(49, "1.4"), b(52, "Megabytes")], A + "hf-blog-1.4MB-sentence.png", { h: 170 }),
    { i: 53, grid: true, els: [
      { k: "lines", lines: [{ y: 300, words: run(53, ["there", "are", "no", "separate"]) }] },
      { k: "bullets", y: 410, gap: 78, sz: 40, items: [
        { words: [w(57, "Image")] },
        { words: [w(58, "Video")] },
        { words: [w(59, "Audio")] },
        { words: [w(61, "3D"), w(63, "Model"), w(64, "Files")] },
      ] },
    ] },
    { i: 65, els: [
      { k: "lines", lines: [
        { y: 73, words: run(65, ["the", "visuals", "and", "audio"]) },
        { y: 117, words: run(69, ["come", "from"]) },
        { y: 595, ...XL, words: [b(71, "Code", XL)] },
      ] },
      { k: "card", img: A + "index-html-code-view-1.36MB.png", y: 380, w: 462, h: 260, t: T[65] },
    ] },
    cardScene(72, run(72, ["you", "play", "in", "a", "rain", "soaked"]), [b(78, "Container"), b(79, "Terminal")], A + "saltline-game-04-stacked-containers-crane.png"),
    { i: 80, els: [
      { k: "lines", lines: [
        { y: 73, words: [w(80, "disable"), w(81, "3"), w(82, "uplink")] },
        { y: 117, words: run(83, ["relays", "then"].slice(0, 1)).concat([w(84, "then")]) },
        { y: 595, ...BO, words: [b(85, "Escape"), b(86, "By"), b(87, "Boat")] },
      ] },
      { k: "card", img: A + "saltline-game-07-relay-cargo-ship.png", y: 368, w: 462, h: 260, t: T[80] },
    ] },
    { i: 88, grid: true, els: [
      { k: "lines", lines: [
        { y: 450, words: run(88, ["the", "build", "took", "about"]) },
        { y: 540, sz: 76, wt: 800, words: [b(92, "8", XL), b(93, "Hours", XL)] },
      ] },
    ] },
    { i: 94, grid: true, els: [
      { k: "lines", lines: [
        { y: 420, words: run(94, ["estimated", "cost"]) },
        { y: 490, words: [w(96, "about")] },
        { y: 575, sz: 76, wt: 800, words: [b(97, "$550", XL)] },
      ] },
    ] },
    { i: 101, grid: true, els: [
      { k: "lines", lines: [
        { y: 400, words: run(101, ["you", "just", "saw"]) },
        { y: 470, words: [w(104, "a"), w(105, "whole"), w(106, "game")] },
        { y: 545, ...BO, words: [b(107, "From"), b(108, "One"), b(109, "Prompt")] },
      ] },
    ] },
    { i: 110, els: [
      { k: "mark", y: 360, t: T[110] },
      { k: "lines", lines: [
        { y: 540, words: run(110, ["follow"]) },
        { y: 620, ...XL, words: run(111, ["AI", "Tested"], XL) },
      ] },
    ] },
  ];
  const sfx = [
    sfxAt(0.08, "sfx2/boom_hit.mp3", 0.35, 1.2),
    whoosh(8, "quick"), whoosh(12), whoosh(34), whoosh(41), whoosh(48, "quick"),
    click(57), click(58), click(59), click(61),
    sfxAt(T[65] - 0.05, "sfx2/keyboard.mp3", 0.12, 1.2),
    whoosh(72), whoosh(80),
    sfxAt(T[92] - 0.05, "sfx2/impact_low.mp3", 0.3, 1.2),
    sfxAt(T[97] - 0.05, "sfx2/impact_low.mp3", 0.3, 1.2),
    sfxAt(T[110] - 0.05, "sfx2/boom_hit.mp3", 0.25, 1.0),
  ];
  return finish(scenes, sfx);
}
