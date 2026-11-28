// Short 41: an AI coding agent deleted a company's production database in nine seconds (PocketOS). Facts: facts/41.facts.json. Loop: the last words flow into the first.
import { helpers } from "./_h.mjs";
export default function build(T) {
  const { w, run, sfxAt, whoosh, click, finish } = helpers(T);
  const A = "v7/41/", R = A + "raw/";
  const N = { sz: 46, wt: 500 }, BO = { sz: 64, wt: 700 }, XL = { sz: 92, wt: 800 };
  const b = (i, text, o = BO) => w(i, text, o);
  const STOP = (t) => ({ k: "cut", img: R + "octicon-stopwatch.svg", y: 250, w: 200, h: 200, t });
  const scenes = [
    { i: 0, grid: true, els: [
      STOP(-0.5),
      { k: "count", y: 500, t: 0, to: 9, dur: 0.9, sz: 240 },
      { k: "lines", lines: [{ y: 700, words: [b(1, "seconds", XL)] }] },
    ] },
    { i: 2, els: [
      { k: "lines", lines: [
        { y: 45, ...N, words: run(2, ["That", "is", "how", "long"]) },
        { y: 372, ...BO, words: [b(7, "AI"), b(8, "coding"), b(9, "agent")] },
        { y: 450, ...N, words: run(10, ["took", "to", "delete", "a"]) },
        { y: 520, ...BO, words: [b(14, "company's")] },
        { y: 625, ...XL, words: [b(15, "production", XL)] },
        { y: 735, ...XL, words: [b(16, "database", XL)] },
      ] },
      { k: "card", img: R + "acs-head.png", y: 200, w: 560, h: 229, t: T[2] },
    ] },
    { i: 17, grid: true, els: [
      { k: "cut", img: R + "octicon-person.svg", y: 215, w: 190, h: 190, t: T[18] },
      { k: "chip", img: R + "octicon-person.svg", label: "Jeremy Crane", y: 355, t: T[19] - 0.2 },
      { k: "chip", img: R + "octicon-briefcase.svg", label: "Founder and CEO, PocketOS", y: 425, t: T[19] },
      { k: "lines", lines: [
        { y: 540, ...N, words: run(17, ["says", "its"]) },
        { y: 650, ...XL, words: [b(19, "founder", XL)] },
      ] },
    ] },
    { i: 20, els: [
      { k: "lines", lines: [
        { y: 60, ...N, words: run(20, ["The", "company"]) },
        { y: 150, ...XL, words: [b(22, "PocketOS", XL)] },
        { y: 640, ...N, words: run(25, ["makes", "software", "for"]) },
        { y: 730, ...BO, words: [b(28, "car"), b(29, "rental"), b(30, "firms")] },
      ] },
      { k: "card", img: R + "pocketos-fig.png", y: 395, w: 560, h: 317, t: T[22] },
    ] },
    { i: 31, grid: true, els: [
      { k: "cut", img: R + "cursor-icon.png", y: 290, w: 230, h: 230, t: T[32] },
      { k: "lines", lines: [
        { y: 500, ...N, words: run(31, ["The", "agent", "was"]) },
        { y: 625, ...XL, words: [b(34, "Cursor", XL)] },
      ] },
    ] },
    { i: 35, els: [
      { k: "cut", img: R + "models-anthropic.svg", y: 290, w: 220, h: 220, t: T[36], disc: true },
      { k: "lines", lines: [
        { y: 490, ...N, words: [w(35, "running")] },
        { y: 575, ...BO, words: [b(36, "Claude"), b(37, "Opus")] },
        { y: 700, ...XL, words: [b(38, "4.6", XL)] },
      ] },
    ] },
    { i: 41, grid: true, els: [
      { k: "cut", img: R + "octicon-alert.svg", y: 290, w: 230, h: 230, t: T[41] },
      { k: "lines", lines: [
        { y: 500, ...N, words: run(41, ["After", "a"]) },
        { y: 600, ...BO, words: [b(43, "credential")] },
        { y: 710, ...XL, words: [b(44, "mismatch", XL)] },
      ] },
    ] },
    { i: 45, els: [
      { k: "cut", img: R + "octicon-database.svg", y: 270, w: 220, h: 220, t: T[45], slash: true },
      { k: "lines", lines: [
        { y: 470, ...N, words: run(45, ["it", "deleted", "a"]) },
        { y: 580, ...XL, words: [b(48, "volume", XL)] },
        { y: 685, ...N, words: run(49, ["on", "its", "own"]) },
        { y: 765, ...BO, words: [b(52, "initiative")] },
      ] },
    ] },
    { i: 53, grid: true, els: [
      { k: "card", img: R + "q-noconfirm.png", y: 215, w: 560, h: 234, t: T[53] },
      { k: "lines", lines: [
        { y: 470, ...XL, words: [b(53, "No", XL)] },
        { y: 580, ...BO, words: [b(54, "confirmation")] },
        { y: 690, ...XL, words: [b(55, "step", XL)] },
      ] },
    ] },
    { i: 56, els: [
      { k: "cut", img: R + "octicon-archive.svg", x: 150, y: 290, w: 170, h: 170, t: T[57] },
      { k: "cut", img: R + "octicon-database.svg", x: 458, y: 290, w: 170, h: 170, t: T[61] },
      { k: "lines", lines: [
        { y: 460, ...N, words: run(56, ["The", "backups", "sat", "in"]) },
        { y: 550, ...BO, words: [b(60, "that"), b(61, "same")] },
        { y: 670, ...XL, words: [b(62, "volume", XL)] },
      ] },
    ] },
    { i: 63, grid: true, els: [
      { k: "cut", img: R + "octicon-calendar.svg", y: 190, w: 170, h: 170, t: T[63] },
      { k: "count", y: 520, t: T[68], to: 3, dur: 0.5, sz: 210 },
      { k: "lines", lines: [
        { y: 335, ...N, words: run(63, ["The", "newest", "one"]) },
        { y: 405, ...N, words: run(66, ["left", "was"]) },
        { y: 710, ...BO, words: [b(69, "months"), b(70, "old")] },
      ] },
    ] },
    { i: 71, els: [
      { k: "card", img: R + "q-reservations.png", y: 190, w: 560, h: 95, t: T[71] },
      { k: "lines", lines: [
        { y: 370, ...BO, words: [b(71, "Reservations")] },
        { y: 450, ...N, words: run(72, ["from", "the", "last"]) },
        { y: 570, ...XL, words: [b(75, "3", XL), b(76, "months", XL)] },
        { y: 700, ...XL, words: [b(77, "gone", XL)] },
      ] },
    ] },
    { i: 78, grid: true, els: [
      { k: "cut", img: R + "railway-icon.png", y: 280, w: 220, h: 220, t: T[78] },
      { k: "lines", lines: [
        { y: 490, ...BO, words: [b(78, "Railway")] },
        { y: 575, ...N, words: run(79, ["later", "recovered"]) },
        { y: 665, ...BO, words: [b(81, "the"), b(82, "newer"), b(83, "data")] },
      ] },
    ] },
    { i: 84, els: [
      { k: "cut", img: R + "octicon-question.svg", y: 270, w: 220, h: 220, t: T[85] },
      { k: "lines", lines: [
        { y: 470, ...N, words: [w(84, "Asked")] },
        { y: 580, ...XL, words: [b(85, "why", XL)] },
        { y: 690, ...N, words: run(86, ["the", "agent", "wrote"]) },
      ] },
    ] },
    { i: 89, grid: true, els: [
      { k: "card", img: R + "q-violated.png", y: 250, w: 560, h: 373, t: T[89] },
      { k: "lines", lines: [
        { y: 510, ...N, words: run(89, ["I", "violated"]) },
        { y: 590, ...BO, words: [b(91, "every"), b(92, "principle")] },
        { y: 670, ...N, words: run(93, ["I", "was", "given"]) },
      ] },
    ] },
    { i: 96, els: [
      { k: "cut", img: R + "octicon-key.svg", y: 270, w: 220, h: 220, t: T[101], slash: true },
      { k: "lines", lines: [
        { y: 470, ...N, words: run(96, ["The", "founder", "says"]) },
        { y: 545, ...N, words: run(99, ["he", "never", "gave", "it", "that"]) },
        { y: 670, ...XL, words: [b(104, "access", XL)] },
      ] },
    ] },
    { i: 105, grid: true, els: [
      { k: "cut", img: R + "octicon-search.svg", y: 320, w: 220, h: 220, t: T[106] },
      { k: "lines", lines: [{ y: 600, sz: 84, wt: 800, words: run(105, ["It", "found", "it"], { sz: 84, wt: 800 }) }] },
    ] },
    { i: 108, els: [
      { k: "cut", img: R + "tracker-sq.png", y: 250, w: 320, h: 320, t: T[108] },
      { k: "count", y: 520, t: T[110], to: 87, dur: 0.7, sz: 150 },
      { k: "lines", lines: [
        { y: 45, ...N, words: run(108, ["One", "of"]) },
        { y: 650, ...BO, words: [b(112, "reported"), b(113, "cases")] },
        { y: 740, ...N, words: run(114, ["on", "one", "public", "tracker"]) },
      ] },
    ] },
    { i: 118, grid: true, els: [
      { k: "mark", y: 250, t: T[118] },
      { k: "lines", lines: [
        { y: 450, ...N, words: [w(118, "Follow")] },
        { y: 555, ...XL, words: run(119, ["AI", "Tested"], XL) },
      ] },
    ] },
    { i: 121, grid: true, els: [
      STOP(T[121]),
      { k: "lines", lines: [{ y: 520, ...N, words: run(121, ["It", "all", "took", "just"]) }] },
    ] },
  ];
  const sfx = [
    sfxAt(0.08, "sfx2/boom_hit.mp3", 0.3, 1.2),
    ...[2, 17, 20, 31, 35, 41, 45, 53, 56, 63, 71, 78, 84, 89, 96, 105, 108, 118, 121].map((i) => whoosh(i)),
    sfxAt(T[0], "sfx2/keyboard.mp3", 0.1, 1.0),
    sfxAt(T[12] - 0.05, "sfx2/impact_low.mp3", 0.22, 1.0),
    sfxAt(T[46] - 0.05, "sfx2/impact_low.mp3", 0.28, 1.0),
    sfxAt(T[77] - 0.05, "sfx2/impact_low.mp3", 0.28, 1.0),
    click(34), click(48), click(61),
    sfxAt(T[110], "sfx2/keyboard.mp3", 0.1, 1.0),
    sfxAt(T[68], "sfx2/switch_click.mp3", 0.12, 0.4),
  ];
  return { ...finish(scenes, sfx), loop: true };
}
