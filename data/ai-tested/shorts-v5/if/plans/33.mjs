// Short 33: Claude Sheets. Facts: facts/33.facts.json
import { helpers } from "./_h.mjs";
export default function build(T) {
  const { w, run, whoosh, sfxAt, click, finish } = helpers(T);
  const A = "v7/33/";
  const BO = { sz: 56, wt: 700 }, XL = { sz: 76, wt: 800 };
  const b = (i, text, o = BO) => w(i, text, o);
  const scenes = [
    { i: 0, grid: true, els: [
      { k: "props", t: 0.0, a: A + "claude-symbol-tile.png", b: A + "claude-wordmark-tile.png" },
      { k: "lines", lines: [
        { y: 440, words: run(0, ["Claude", "now", "has", "a"]) },
        { y: 515, ...BO, words: [b(4, "Spreadsheet")] },
        { y: 590, ...BO, words: [b(5, "Built"), b(6, "In")] },
      ] },
    ] },
    { i: 7, els: [
      { k: "lines", lines: [
        { y: 73, words: run(7, ["it", "is", "called"]) },
        { y: 595, ...BO, words: [b(10, "Claude"), b(11, "Sheets")] },
      ] },
      { k: "card", img: A + "sheets-title.png", y: 368, w: 462, h: 260, t: T[7] },
    ] },
    { i: 12, grid: true, els: [
      { k: "lines", lines: [
        { y: 450, words: run(12, ["and", "it", "is", "in"]) },
        { y: 540, ...XL, words: [b(16, "Beta", XL)] },
      ] },
    ] },
    { i: 17, grid: true, els: [
      { k: "lines", lines: [{ y: 300, words: run(17, ["ask", "for", "a"]) }] },
      { k: "bullets", y: 400, gap: 78, sz: 40, items: [
        { words: [w(20, "Campaign"), w(21, "Tracker")] },
        { words: [w(24, "Hiring"), w(25, "Budget")] },
      ] },
    ] },
    { i: 26, grid: true, els: [
      { k: "lines", lines: [
        { y: 190, words: run(26, ["and", "Claude", "builds"]) },
        { y: 245, words: run(29, ["a", "sheet", "with"]) },
      ] },
      { k: "bullets", y: 340, gap: 78, sz: 40, items: [
        { words: [w(32, "Tabs")] },
        { words: [w(33, "Formulas")] },
        { words: [w(34, "Formatting")] },
        { words: [w(36, "Drop"), w(37, "Downs")] },
      ] },
    ] },
    { i: 38, els: [
      { k: "lines", lines: [
        { y: 73, words: run(38, ["when", "Claude", "changes", "a", "cell"]) },
        { y: 117, words: run(43, ["the", "edit", "is"]) },
        { y: 595, ...BO, words: [b(46, "Outlined")] },
        { y: 650, sz: 33, wt: 700, words: run(50, ["see", "what", "changed"], { pill: true }) },
      ] },
      { k: "card", img: A + "sheets-works.png", y: 368, w: 462, h: 150, t: T[38] },
    ] },
    { i: 53, grid: true, els: [
      { k: "lines", lines: [
        { y: 300, words: run(53, ["you", "and", "your", "team", "work"]) },
        { y: 375, words: run(58, ["in", "the"]) },
        { y: 450, ...BO, words: [b(60, "Same"), b(61, "Cells")] },
        { y: 525, words: run(62, ["at", "the"]) },
        { y: 600, ...BO, words: [b(64, "Same"), b(65, "Time")] },
      ] },
    ] },
    { i: 66, grid: true, els: [
      { k: "lines", lines: [
        { y: 400, words: run(66, ["it", "includes", "over"]) },
        { y: 500, ...XL, words: [b(69, "250", XL)] },
        { y: 590, ...BO, words: [b(72, "Functions")] },
      ] },
    ] },
    { i: 73, els: [
      { k: "lines", lines: [
        { y: 73, words: run(73, ["for", "full", "Excel"]) },
        { y: 117, words: run(76, ["export", "it", "or", "use"]) },
        { y: 595, ...BO, words: [b(80, "Claude"), b(81, "for"), b(82, "Excel")] },
      ] },
      { k: "card", img: A + "sheets-vs-excel.png", y: 368, w: 462, h: 154, t: T[73] },
    ] },
    { i: 83, grid: true, els: [
      { k: "lines", lines: [{ y: 240, words: run(83, ["it", "is", "in", "beta", "on"]) }] },
      { k: "bullets", y: 320, gap: 70, sz: 40, items: [
        { words: [w(88, "Pro")] },
        { words: [w(89, "Max")] },
        { words: [w(90, "Ultra")] },
        { words: [w(91, "Team")] },
        { words: [w(93, "Enterprise")] },
      ] },
    ] },
    { i: 95, grid: true, els: [
      { k: "lines", lines: [
        { y: 400, words: run(95, ["you", "just", "saw"]) },
        { y: 470, words: run(98, ["Claude", "build", "a"]) },
        { y: 550, ...BO, words: [b(101, "Spreadsheet")] },
      ] },
    ] },
    { i: 102, els: [
      { k: "mark", y: 360, t: T[102] },
      { k: "lines", lines: [
        { y: 540, words: run(102, ["follow"]) },
        { y: 620, ...XL, words: run(103, ["AI", "Tested"], XL) },
      ] },
    ] },
  ];
  const sfx = [
    sfxAt(0.08, "sfx2/boom_hit.mp3", 0.35, 1.2),
    whoosh(7, "quick"), click(20), click(24), click(32), click(33), click(34), click(36),
    whoosh(38), whoosh(73),
    click(88), click(89), click(90), click(91), click(93),
    sfxAt(T[69] - 0.05, "sfx2/impact_low.mp3", 0.3, 1.2),
    sfxAt(T[102] - 0.05, "sfx2/boom_hit.mp3", 0.25, 1.0),
  ];
  return finish(scenes, sfx);
}
