// Short 22: GPT-6.2 Astra vs Sol pricing. Facts: facts/22.facts.json
import { helpers } from "./_h.mjs";
export default function build(T) {
  const { w, run, whoosh, sfxAt, cardScene, finish } = helpers(T);
  const A = "v7/22/";
  const BO = { sz: 56, wt: 700 }, XL = { sz: 76, wt: 800 }, HUGE = { sz: 66, wt: 800 };
  const b = (i, text, o = BO) => w(i, text, o);
  const scenes = [
    { i: 0, grid: true, els: [
      { k: "props", t: 0.0, a: A + "tile_openai.png", b: A + "tile_openai_wordmark.png", bWide: true },
      { k: "lines", lines: [
        { y: 430, words: run(0, ["OpenAI", "just", "launched"]) },
        { y: 500, ...BO, words: [b(3, "Two"), b(4, "New"), b(5, "Models")] },
        { y: 575, sz: 33, wt: 700, words: run(6, ["with", "very", "different", "prices"], { pill: true }) },
      ] },
    ] },
    { i: 10, grid: true, els: [
      { k: "lines", lines: [
        { y: 400, words: run(10, ["they", "are"]) },
        { y: 470, ...BO, words: [b(12, "GPT"), b(13, "6.2")] },
        { y: 550, ...XL, words: [b(16, "Astra", XL)] },
        { y: 625, ...BO, words: [b(17, "and"), b(18, "Sol")] },
      ] },
    ] },
    cardScene(19, run(19, ["Astra", "is", "for", "the"]), [b(23, "Hardest"), b(24, "Projects")], A + "oa_astra_printout_poster.png"),
    cardScene(25, [], [b(25, "Documents")], A + "oa_document_memo.png", { pos: "50% 20%" }),
    cardScene(26, [], [b(26, "Slides")], A + "oa_slides_deck_small_marks.png"),
    cardScene(27, [], [b(27, "Code")], A + "oa_frontend_site_morrow.png"),
    cardScene(28, [w(28, "even")], [b(29, "3D"), b(31, "Design")], A + "oa_cad_mechanical_assembly.png"),
    cardScene(32, run(32, ["Sol", "is", "the", "efficient", "one"]), [b(37, "For"), b(38, "Everyday"), b(39, "Work")], A + "oa_workbook_atlas_health.png"),
    { i: 40, grid: true, els: [
      { k: "lines", lines: [
        { y: 470, words: run(40, ["here", "are", "the"]) },
        { y: 545, ...BO, words: [b(43, "Prices")] },
        { y: 615, sz: 33, wt: 700, words: run(44, ["per", "million", "tokens"], { pill: true }) },
      ] },
    ] },
    { i: 47, grid: true, els: [
      { k: "lines", lines: [{ y: 360, ...XL, words: [b(47, "Astra", XL)] }] },
      { k: "bullets", y: 520, gap: 90, sz: 48, items: [{ words: [w(49, "$8"), w(51, "in")] }, { words: [w(53, "$40"), w(54, "out")] }] },
    ] },
    { i: 55, grid: true, els: [
      { k: "lines", lines: [{ y: 360, ...XL, words: [b(55, "Sol", XL)] }] },
      { k: "bullets", y: 520, gap: 90, sz: 48, items: [{ words: [w(57, "$2"), w(59, "in")] }, { words: [w(61, "$10"), w(62, "out")] }] },
    ] },
    { i: 63, grid: true, els: [
      { k: "lines", lines: [
        { y: 470, words: run(63, ["that", "is"]) },
        { y: 545, ...HUGE, words: [b(65, "Four", HUGE), b(66, "Times", HUGE), b(67, "Apart", HUGE)] },
      ] },
    ] },
    { i: 68, els: [
      { k: "lines", lines: [
        { y: 60, words: run(68, ["OpenAI", "says", "Astra"]) },
        { y: 110, words: run(71, ["more", "than", "doubled"]) },
        { y: 160, words: [w(74, "Claude"), w(75, "Fable"), w(76, "5.2's")] },
        { y: 595, ...BO, words: [b(79, "Pass"), b(80, "Rate")] },
        { y: 650, sz: 33, wt: 700, words: run(81, ["on", "a", "legal", "test"], { pill: true }) },
      ] },
      { k: "card", img: A + "oa_harvey_legal_benchmark.png", y: 400, w: 462, h: 260, t: T[68] },
    ] },
    { i: 85, grid: true, els: [
      { k: "lines", lines: [
        { y: 470, words: run(85, ["at", "about"]) },
        { y: 545, ...HUGE, words: [b(87, "ONE", HUGE), b(88, "SIXTH", HUGE)] },
        { y: 615, words: run(89, ["the", "cost"]) },
      ] },
    ] },
    { i: 91, els: [
      { k: "lines", lines: [
        { y: 73, words: [w(91, "9to5Google"), w(95, "says"), w(96, "it"), w(97, "came")] },
        { y: 117, words: run(98, ["a", "week", "after"]) },
        { y: 595, ...BO, words: [b(101, "Claude"), b(102, "5.2")] },
      ] },
      { k: "card", img: A + "article_hero.jpg", y: 368, w: 462, h: 260, t: T[91] },
    ] },
    { i: 105, grid: true, els: [
      { k: "lines", lines: [
        { y: 400, words: run(105, ["you", "just", "saw"]) },
        { y: 470, words: [w(108, "two"), w(109, "OpenAI"), w(110, "models")] },
        { y: 545, ...BO, words: [b(111, "Four"), b(112, "Times"), b(113, "Apart")] },
        { y: 615, words: run(114, ["on", "price"]) },
      ] },
    ] },
    { i: 116, els: [
      { k: "mark", y: 360, t: T[116] },
      { k: "lines", lines: [
        { y: 540, words: run(116, ["follow"]) },
        { y: 620, ...XL, words: run(117, ["AI", "Tested"], XL) },
      ] },
    ] },
  ];
  const sfx = [
    sfxAt(0.08, "sfx2/boom_hit.mp3", 0.35, 1.2),
    whoosh(19, "quick"), whoosh(25, "quick"), whoosh(26, "quick"), whoosh(27, "quick"), whoosh(28, "quick"), whoosh(32),
    sfxAt(T[47] - 0.05, "sfx2/mouse_click.mp3", 0.12, 0.4),
    sfxAt(T[55] - 0.05, "sfx2/mouse_click.mp3", 0.12, 0.4),
    sfxAt(T[65] - 0.05, "sfx2/impact_low.mp3", 0.3, 1.2),
    whoosh(68), whoosh(91),
    sfxAt(T[116] - 0.05, "sfx2/boom_hit.mp3", 0.25, 1.0),
  ];
  return finish(scenes, sfx);
}
