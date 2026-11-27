// Short 31: Claude "Install as app". Facts: facts/31.facts.json
import { helpers } from "./_h.mjs";
export default function build(T) {
  const { w, run, whoosh, sfxAt, click, cardScene, finish } = helpers(T);
  const A = "v7/31/";
  const BO = { sz: 56, wt: 700 }, XL = { sz: 76, wt: 800 };
  const b = (i, text, o = BO) => w(i, text, o);
  const scenes = [
    { i: 0, grid: true, els: [
      { k: "props", t: 0.0, a: A + "claude-symbol-tile.png", b: A + "claude-wordmark-tile.png" },
      { k: "lines", lines: [
        { y: 440, words: run(0, ["Claude", "can", "now", "turn"]) },
        { y: 510, words: run(4, ["an", "artifact", "into", "a"]) },
        { y: 585, ...BO, words: [b(8, "Mac"), b(9, "or"), b(10, "Windows")] },
        { y: 655, ...BO, words: [b(11, "App")] },
      ] },
    ] },
    { i: 12, els: [
      { k: "lines", lines: [
        { y: 73, words: run(12, ["it", "is", "called"]) },
        { y: 595, ...BO, words: [b(15, "Install"), b(16, "As"), b(17, "App")] },
      ] },
      { k: "card", img: A + "app-welcome.png", y: 368, w: 462, h: 260, t: T[12] },
    ] },
    { i: 18, grid: true, els: [
      { k: "lines", lines: [
        { y: 450, words: run(18, ["and", "it", "is", "in"]) },
        { y: 540, ...XL, words: [b(22, "Beta", XL)] },
      ] },
    ] },
    cardScene(23, run(23, ["the", "app", "gets", "its", "own"]), [b(28, "Icon")], A + "app-hero.png"),
    { i: 29, els: [
      { k: "lines", lines: [
        { y: 73, words: run(29, ["and", "opens", "in", "its", "own"]) },
        { y: 117, words: run(35, ["instead", "of", "inside", "Claude"]) },
        { y: 595, ...BO, words: [b(34, "Window")] },
      ] },
      { k: "card", img: A + "app-marrow.png", y: 368, w: 462, h: 260, t: T[29] },
    ] },
    { i: 39, grid: true, els: [
      { k: "lines", lines: [
        { y: 430, words: run(39, ["it", "can", "use", "Claude"]) },
        { y: 505, words: run(43, ["and", "your"]) },
        { y: 585, ...BO, words: [b(45, "Connectors")] },
      ] },
    ] },
    { i: 46, grid: true, els: [
      { k: "lines", lines: [
        { y: 400, words: run(46, ["and", "it", "updates"]) },
        { y: 475, words: run(49, ["when", "the", "artifact"]) },
        { y: 565, ...BO, words: [b(52, "is"), b(53, "Edited")] },
      ] },
    ] },
    { i: 54, grid: true, els: [
      { k: "lines", lines: [{ y: 300, words: run(54, ["installed", "apps", "can", "send"]) }] },
      { k: "bullets", y: 410, gap: 78, sz: 40, items: [
        { words: [w(58, "Notifications")] },
        { words: [w(63, "Menu"), w(64, "Bar")] },
      ] },
    ] },
    { i: 65, els: [
      { k: "lines", lines: [
        { y: 73, words: run(65, ["Anthropic", "people", "made", "apps", "like"]) },
        { y: 595, ...BO, words: [b(70, "Linnet")] },
        { y: 650, sz: 33, wt: 700, words: run(71, ["a", "layered", "image", "editor"], { pill: true }) },
      ] },
      { k: "card", img: A + "app-linnet.png", y: 368, w: 462, h: 260, t: T[65] },
    ] },
    { i: 75, els: [
      { k: "lines", lines: [
        { y: 73, words: [w(75, "and")] },
        { y: 595, ...BO, words: [b(76, "Tern")] },
        { y: 650, sz: 33, wt: 700, words: run(77, ["a", "terminal"], { pill: true }) },
        { y: 705, sz: 33, wt: 700, words: run(79, ["with", "Claude", "beside", "you"]) },
      ] },
      { k: "card", img: A + "app-tern.png", y: 368, w: 462, h: 260, t: T[75] },
    ] },
    { i: 83, grid: true, els: [
      { k: "lines", lines: [
        { y: 400, words: run(83, ["you", "need", "to", "be"]) },
        { y: 480, ...BO, words: [b(87, "Online"), b(88, "and")] },
        { y: 555, ...BO, words: [b(89, "Signed"), b(90, "in")] },
        { y: 630, words: run(91, ["to", "open", "one"]) },
      ] },
    ] },
    { i: 94, grid: true, els: [
      { k: "lines", lines: [
        { y: 400, words: run(94, ["you", "just", "saw"]) },
        { y: 470, words: run(97, ["Claude", "artifacts", "become"]) },
        { y: 550, ...BO, words: [b(100, "Desktop"), b(101, "Apps")] },
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
    whoosh(12, "quick"), whoosh(23), whoosh(29), whoosh(65), whoosh(75),
    click(58), click(63),
    sfxAt(T[22] - 0.05, "sfx2/impact_low.mp3", 0.3, 1.2),
    sfxAt(T[102] - 0.05, "sfx2/boom_hit.mp3", 0.25, 1.0),
  ];
  return finish(scenes, sfx);
}
