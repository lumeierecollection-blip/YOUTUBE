// Short 32: Claude Ship. Facts: facts/32.facts.json
import { helpers } from "./_h.mjs";
export default function build(T) {
  const { w, run, whoosh, sfxAt, click, finish } = helpers(T);
  const A = "v7/32/";
  const BO = { sz: 56, wt: 700 }, XL = { sz: 76, wt: 800 };
  const b = (i, text, o = BO) => w(i, text, o);
  const scenes = [
    { i: 0, grid: true, els: [
      { k: "props", t: 0.0, a: A + "claude-symbol-tile.png", b: A + "anthropic-wordmark-tile.png" },
      { k: "lines", lines: [
        { y: 400, words: run(0, ["Anthropic", "just", "launched"]) },
        { y: 480, ...BO, words: [b(3, "Claude"), b(4, "Ship")] },
        { y: 560, sz: 33, wt: 700, words: run(5, ["in", "beta"], { pill: true }) },
      ] },
    ] },
    { i: 7, grid: true, els: [
      { k: "lines", lines: [{ y: 300, words: [w(7, "it")] }] },
      { k: "bullets", y: 380, gap: 78, sz: 40, items: [
        { words: [w(8, "Reviews"), w(9, "Pull"), w(10, "Requests")] },
        { words: [w(11, "Fixes"), w(12, "Them")] },
        { words: [w(14, "Decides"), w(17, "Ready"), w(18, "To"), w(19, "Merge")] },
      ] },
    ] },
    { i: 20, grid: true, els: [
      { k: "lines", lines: [{ y: 250, words: run(20, ["it", "has", "three", "parts"]) }] },
      { k: "bullets", y: 350, gap: 78, sz: 40, items: [
        { words: [w(24, "Code"), w(25, "Review")] },
        { words: [w(26, "PR"), w(27, "Steward")] },
        { words: [w(29, "Claude"), w(30, "Approvals")] },
      ] },
    ] },
    { i: 31, els: [
      { k: "lines", lines: [
        { y: 73, words: run(31, ["Code", "Review", "posts", "its"]) },
        { y: 117, words: run(36, ["on", "the", "pull", "request"]) },
        { y: 595, ...BO, words: [b(35, "Findings")] },
      ] },
      { k: "card", img: A + "ship-code-review.png", y: 368, w: 462, h: 260, t: T[31] },
    ] },
    { i: 40, els: [
      { k: "lines", lines: [
        { y: 73, words: run(40, ["PR", "Steward", "works", "on"]) },
        { y: 595, ...BO, words: [b(44, "Failing"), b(45, "Checks")] },
        { y: 650, sz: 33, wt: 700, words: run(47, ["merge", "conflicts"], { pill: true }) },
      ] },
      { k: "card", img: A + "ship-steward-pr.png", y: 368, w: 462, h: 260, t: T[40] },
    ] },
    { i: 49, grid: true, els: [
      { k: "lines", lines: [
        { y: 380, words: run(49, ["but", "it", "is", "designed"]) },
        { y: 470, ...BO, words: [b(53, "Not"), b(54, "to"), b(55, "Approve")] },
        { y: 545, ...BO, words: [b(56, "or"), b(57, "Merge")] },
      ] },
    ] },
    { i: 58, els: [
      { k: "lines", lines: [
        { y: 73, words: run(58, ["Claude", "Approvals", "follows", "a"]) },
        { y: 595, ...BO, words: [b(62, "Policy"), b(63, "File")] },
        { y: 650, sz: 33, wt: 700, words: run(64, ["your", "team", "writes"], { pill: true }) },
        { y: 705, sz: 33, wt: 700, words: run(67, ["in", "the", "repository"]) },
      ] },
      { k: "card", img: A + "ship-approvals-yml.png", y: 368, w: 462, h: 260, t: T[58] },
    ] },
    { i: 70, els: [
      { k: "lines", lines: [
        { y: 73, words: run(70, ["developers", "can", "run"]) },
        { y: 117, words: run(75, ["in", "Claude", "Code"]) },
        { y: 595, ...XL, words: [b(73, "/ship", XL)] },
      ] },
      { k: "card", img: A + "ship-terminal.png", y: 368, w: 462, h: 150, t: T[70] },
    ] },
    { i: 78, grid: true, els: [
      { k: "lines", lines: [
        { y: 330, words: run(78, ["it", "is", "on"]) },
        { y: 405, ...BO, words: [b(81, "Team"), b(82, "and")] },
        { y: 480, ...BO, words: [b(83, "Enterprise")] },
        { y: 555, words: run(84, ["plans", "for", "GitHub"]) },
        { y: 625, words: [w(87, "repositories")] },
      ] },
    ] },
    { i: 88, els: [
      { k: "lines", lines: [
        { y: 73, words: run(88, ["you", "just", "saw", "Claude", "Ship"]) },
        { y: 117, words: run(93, ["take", "a", "pull", "request", "from"]) },
        { y: 595, ...BO, words: [b(98, "Review"), b(99, "To"), b(100, "Approval")] },
      ] },
      { k: "card", img: A + "ship-diagram.png", y: 368, w: 462, h: 236, t: T[88] },
    ] },
    { i: 101, els: [
      { k: "mark", y: 360, t: T[101] },
      { k: "lines", lines: [
        { y: 540, words: run(101, ["follow"]) },
        { y: 620, ...XL, words: run(102, ["AI", "Tested"], XL) },
      ] },
    ] },
  ];
  const sfx = [
    sfxAt(0.08, "sfx2/boom_hit.mp3", 0.35, 1.2),
    click(8), click(11), click(14), click(24), click(26), click(29),
    whoosh(31), whoosh(40), whoosh(58), whoosh(70), whoosh(88),
    sfxAt(T[53] - 0.05, "sfx2/impact_low.mp3", 0.3, 1.2),
    sfxAt(T[101] - 0.05, "sfx2/boom_hit.mp3", 0.25, 1.0),
  ];
  return finish(scenes, sfx);
}
