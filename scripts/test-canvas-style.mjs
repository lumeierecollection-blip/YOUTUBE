// node scripts/test-canvas-style.mjs — the per-beat styling rules (visual/canvas-style.js).
import { assignDark, assignEmphasis, assignVertical, assignNumberAccent, styleCanvases, statesChange, DARK_MAX } from "../src/skills/remotion-render/visual/canvas-style.js";

let bad = 0;
const yes = (name, cond, detail = "") => { if (!cond) bad++; console.log(`${cond ? "ok  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };
const T = (extra = {}) => ({ visual_type: "TYPE", composition: "TYPE-FULL", headline: "Rates will cut savings", ...extra });
const D = (extra = {}) => ({ visual_type: "BAR", composition: "DATA-FULL", ...extra });
const P = () => ({ visual_type: "PHOTO", composition: "SCENE-FULL", photo: { asset: "x.jpg" } });
const M = () => ({ visual_type: "MAP", composition: "DATA-FULL" });

// Dark beats.
let cs = [T(), D(), T(), D(), T(), D()];
yes("6 beats: the 4th beat is dark", JSON.stringify(assignDark(cs)) === "[3]");
cs = [T(), D(), T(), P(), T(), D()];
yes("the 4th is a photo: the 5th is dark instead", JSON.stringify(assignDark(cs)) === "[4]");
cs = [T(), D(), T(), P(), M(), D()];
yes("4th photo and 5th map: none dark", assignDark(cs).length === 0);
cs = Array.from({ length: 12 }, (_, i) => (i % 2 ? D() : T()));
const dk = assignDark(cs);
yes("12 beats: two dark beats", dk.length === 2 && dk.length <= DARK_MAX, JSON.stringify(dk));
yes("never consecutive", dk.every((d, i) => i === 0 || d - dk[i - 1] >= 2));
yes("a 3-beat video has no dark beat", assignDark([T(), D(), T()]).length === 0);
const six = Array.from({ length: 6 }, () => T());
assignDark(six);
yes("the hook is never dark", six[0].dark === false);

// Emphasis: one word, from a TYPE beat, not the hook.
cs = [T({ emphasis_word: "cut" }), D(), T({ emphasis_word: "cut" }), T({ emphasis_word: "savings" })];
yes("emphasis: first eligible TYPE beat after the hook", assignEmphasis(cs) === 2 && cs[2].emphasis_beat && !cs[3].emphasis_beat && !cs[0].emphasis_beat);
cs = [T(), T({ emphasis_word: "unprecedented", headline: "An unprecedented move" }), T({ emphasis_word: "absent" })];
yes("emphasis: a long word or one not in the headline is skipped", assignEmphasis(cs) === -1);

// Vertical: at most one, only in a long video, short headline.
cs = Array.from({ length: 8 }, (_, i) => T({ headline: i === 4 ? "The rule breaks" : "Rates will cut savings again soon" }));
yes("vertical: one beat, the middle one", assignVertical(cs) === 4 && cs.filter((c) => c.vertical).length === 1);
yes("vertical: none in a short video", assignVertical([T(), T(), T(), T()]) === -1);

// Number accent.
const N = (v) => ({ visual_type: "COUNTER", composition: "TYPE-FULL", data: { value: v } });
cs = [N("$105M"), N("34%"), N("$2 billion"), T()];
const best = assignNumberAccent(cs, ["The fraud cost $105M.", "It is a share.", "It is a figure.", ""]);
yes("the biggest figure is always accented", best === 2 && cs[2].number_accent === true);
yes("a change / loss sentence is accented", cs[0].number_accent === true);
yes("a neutral figure is ink", cs[1].number_accent === false);
yes("change words", statesChange("Rates rose sharply") && statesChange("investors lost money") && !statesChange("The board met on Tuesday"));

// The whole pass: sentence case, index, variant.
cs = [T({ headline: "SEC SUES FOR FRAUD" }), D(), T(), D(), T(), D()];
const r = styleCanvases(cs, ["The SEC sued him for fraud.", "", "", "", "", ""]);
yes("sentence case rebuilt from the narration", cs[0].headline === "SEC sues for fraud", cs[0].headline);
yes("variant alternates with the beat index", cs.every((c, i) => c.variant === i && c.beat_index === i));
yes("styleCanvases reports its decisions", Array.isArray(r.dark) && "emphasis" in r);

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
