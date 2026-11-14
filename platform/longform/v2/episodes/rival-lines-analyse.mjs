// Rival Lines long-form, fresh cycle 14 Nov 2026: "How To Analyse a Football Match (Using a Real Final)".
// CLONE of Football Made Simple, "How To Analyse Football - A Guide For Beginners" (gpgYLJrPP2M, 10 Nov 2026, 349k views, the channel's newest upload),
// measured from its whisper transcript (output/fresh-cycle-2026-11-14/study/r-fms-analyse/gpgYLJrPP2M/transcript.txt). Its structure, kept in order:
//   0:00 "Can you analyse this sequence?" (a move plays, the viewer is asked to note what they see; "we're coming back to this exact clip")
//   0:30 the TV picture is rigged against you (the camera follows the ball) -> 2:47 principle: most of the match happens off the ball, take notes
//   3:48 principle: the base formation, then the deviation from it -> a hypothesis -> 5:32 the evidence for it later in the match
//   9:35 principle: who moved, and what changed -> a worked example -> 11:17 "your turn" -> 12:55 rewatch the opening sequence with new eyes.
// Their worked examples are broadcast clips we cannot licence; ours are the Euro 2024 final from StatsBomb open data (free with attribution), drawn with our tactics
// board (the same dark pitch, dots and callouts their channel uses). Every number is taken from the data-checked beats of episodes/rival-lines.mjs (counted from
// data/longform/rival/euro2024-final.json); the scenes are those beats' scenes, re-sequenced into the guide's structure. The analysis method lines are presented as a
// method ("ask yourself..."), not as facts.
import { EPISODE as SRC, SOURCES as SRC_SOURCES } from "./rival-lines.mjs";

const S = Object.fromEntries(SRC.beats.map((b) => [b.id, b.scene]));
export const SOURCES = { ...SRC_SOURCES, FMS: { title: "Structure reference (not a fact source): Football Made Simple, How To Analyse Football - A Guide For Beginners", url: "https://www.youtube.com/watch?v=gpgYLJrPP2M", retrieved: "2026-11-14" } };

export const EPISODE = {
  channel: "rival-lines", slug: "how-to-analyse", title: "How To Analyse a Football Match (Using the Euro 2024 Final)", target_minutes: 7,
  sound: { bed: "MUSIC_DOC_WINTER", bed_rel_db: -22, dip_scenes: [] },
  beats: [
    { id: "G01", part: "the test", ref: "gpgYLJrPP2M 0:00: the move plays first, then the question", src: ["SB"],
      vo: "Can you analyse this move? Watch it once. Seven passes in twenty seconds, and a goal in a European Championship final. Whatever you notice, write it down, because we are coming back to this exact move at the end.",
      scene: S.R03 },
    { id: "G02", part: "the problem", ref: "gpgYLJrPP2M 0:30: the TV picture is rigged against you", src: ["SB"],
      vo: "Here is the problem. When you watch on television, the camera follows the ball. Even the free tracking data we use for this video only records the players who were inside the broadcast camera's view. Most of what decides a match happens somewhere else.",
      scene: { ...S.R08, note: "StatsBomb 360: only players inside the broadcast camera's view are recorded" } },
    { id: "G03", part: "principle one", ref: "gpgYLJrPP2M 2:47: principle one, with one counted figure", src: ["SB"],
      vo: "So principle one: watch the players without the ball. In the final in Berlin, Spain played five hundred and ninety-two passes and England three hundred and twenty-three. Every one of those passes was decided by where the other twenty players stood.",
      scene: S.R01 },
    { id: "G04", part: "principle two", ref: "gpgYLJrPP2M 3:48: the base formation first", src: ["SB"],
      vo: "Principle two: start with the base shape, then look for what is different. On paper, both teams started in a four-two-three-one. These dots are where each starter actually was when they touched the ball in the first half.",
      scene: S.R04 },
    { id: "G05", part: "principle two", ref: "gpgYLJrPP2M 4:27: the deviation that starts a hypothesis", src: ["SB"],
      vo: "Now the deviation. Spain's most-used passing link in the first half was not in midfield. It was between the two centre-backs, Le Normand and Laporte: thirty-one completed passes. That is worth writing down, because it suggests a hypothesis: England were happy to let Spain have the ball at the back.",
      scene: S.R05 },
    { id: "G06", part: "the evidence", ref: "gpgYLJrPP2M 5:44: test the hypothesis against the evidence", src: ["SB"],
      vo: "Does the evidence back it up? England pressed most in the middle third: seventy-five of their hundred and sixty-five pressures. They were not chasing Spain's centre-backs. They were waiting further up.",
      scene: S.R06 },
    { id: "G07", part: "the evidence", ref: "gpgYLJrPP2M 6:23: the hypothesis confirmed by the outcome", src: ["SB"],
      vo: "And for forty-five minutes it worked. Spain had far more of the ball, three hundred and twenty-seven passes to England's hundred and forty-nine, but it led to five shots worth a third of a goal in expected-goals terms. Nil-nil at half-time was a fair score.",
      scene: S.R06b },
    { id: "G08", part: "principle three", ref: "gpgYLJrPP2M 9:35: who moved, and what changed", src: ["SB"],
      vo: "Principle three: when something changes, ask who moved. At half-time Spain took off their midfield anchor, Rodri. He had completed twenty-nine of his thirty-two passes. Martín Zubimendi replaced him.",
      scene: S.R07 },
    { id: "G09", part: "principle three", ref: "gpgYLJrPP2M 10:24: the worked example plays out", src: ["SB"],
      vo: "Two minutes into the second half, Spain scored. Cucurella, Williams, back to Laporte, Fabián Ruiz, Carvajal, then Lamine Yamal across to Williams, who shot first time with his left foot.",
      scene: S.R08 },
    { id: "G10", part: "principle three", ref: "gpgYLJrPP2M 10:50: the other side's change", src: ["SB"],
      vo: "England changed too. Cole Palmer came on for Kobbie Mainoo with twenty minutes left. Two minutes and fifteen seconds later, he scored.",
      scene: S.R10 },
    { id: "G11", part: "principle three", ref: "gpgYLJrPP2M 11:01: the consequence, drawn", src: ["SB"],
      vo: "Saka to Bellingham, Bellingham lays it back, and Palmer shoots from outside the box. Ask yourself the same question again: who moved, and what space did that open?",
      scene: S.R11 },
    { id: "G12", part: "principle three", ref: "gpgYLJrPP2M: the answer to the change", src: ["SB"],
      vo: "Spain answered. Oyarzabal, who had replaced Morata, played it out to Cucurella, then got on the end of his low cross and scored with his right foot.",
      scene: S.R12 },
    { id: "G13", part: "the totals", ref: "Football Made Simple: totals panel before the verdict", src: ["SB"],
      vo: "Over the match, Spain had sixteen shots worth one point seven nine expected goals. England had nine, worth point seven three. Spain completed a hundred and thirty-seven passes into the final third. England completed fifty-five.",
      scene: S.R13 },
    { id: "G14", part: "your turn", ref: "gpgYLJrPP2M 11:17: the viewer's own exercise", src: ["SB"],
      vo: "Now your turn. Seven substitutions, three goals, and only one fifteen-minute spell in which England passed more than Spain. It included their equaliser. Pause here, and before you look anything up, write down what you think changed in that spell.",
      scene: S.R15 },
    { id: "G15", part: "the test again", ref: "gpgYLJrPP2M 12:55: rewatch the opening sequence with new knowledge", src: ["SB"],
      vo: "Finally, watch the opening move again. Look at the shape first, then the deviation, then who moved. How different does it look now? Tell us in the comments what you spotted the second time that you missed the first.",
      scene: S.R03 },
  ],
  thumbs: (SRC.thumbs || []).slice(0, 1).map((t) => ({ ...t, name: "thumb1-analyse", big: "Analyse\nlike a pro", small: "a real final" })),
};
