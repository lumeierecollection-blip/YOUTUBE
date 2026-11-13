// AI Tested long form: "Can You Trust AI? We Ran Four Tests". Visual identity: AI Search, "AI is reverse engineering everything" (h5zkzon0gM4, the highest-viewed fixed reference for this
// channel, 1.10M views): the result first, real prompts and replies on screen, a counted result per test, chapters, a verdict with its limits. On our own channel the trust-in-AI Shorts did best
// (docs/longform/SHORTS-ANALYSIS-AND-FIXES.md), so the subject is trust. Every number below is COUNTED FROM the stored test records in data/longform/ai-tested/trust/ (copied from the
// previews branch, one record per test, each with the GitHub Actions run that produced it) and is cross-checked against the claims that test's own plan() states; the module refuses to load
// if they disagree. Replies shown are the models' real replies, shortened only by the scene's own display limit.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";
import { plan as planFab } from "../../../channels/ai-tested/fabricated.mjs";
import { plan as planLinks, askText as linkAsk } from "../../../channels/ai-tested/links.mjs";
import { plan as planPush } from "../../../channels/ai-tested/pushback.mjs";
import { plan as planExpert, tally as tallyExpert } from "../../../channels/ai-tested/expert.mjs";
import { EPISODE as MULT, SOURCES as MULT_SOURCES } from "./ai-tested.mjs"; // the multiplication test (data/longform/ai-tested/multiply-run1/2.json, counts already checked there)

const J = (k) => JSON.parse(readFileSync(join(ROOT, `data/longform/ai-tested/trust/${k}.json`), "utf8"));
const fab = J("fabricated"), lnk = J("links"), pb = J("pushback"), ex = J("expert");
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five", "twenty-six", "twenty-seven", "twenty-eight", "twenty-nine", "thirty", "thirty-one", "thirty-two", "thirty-three", "thirty-four", "thirty-five", "thirty-six"];
const say = (n) => ONES[n] ?? String(n);
const runId = (exp) => String(exp.run_url).split("/").pop();
const foot = (exp) => `GitHub Actions run ${runId(exp)} · ${String(exp.date).slice(0, 10)}`;

// ---- counts, from the records
const fakeItems = (m) => m.items.filter((i) => i.kind === "fake");
const fabN = fab.models.map((m) => ({ speak: m.speak, name: m.name, admitted: fakeItems(m).filter((i) => i.outcome === "admitted").length, asReal: fakeItems(m).filter((i) => i.outcome !== "admitted").length, n: fakeItems(m).length, cells: fakeItems(m).map((i) => i.outcome === "admitted") }));
const lnkN = lnk.models.map((m) => ({ speak: m.speak, name: m.name, opened: m.items.filter((i) => i.outcome === "opened").length, dead: m.items.filter((i) => i.outcome === "dead").length, n: m.items.length, cells: m.items.map((i) => i.outcome === "opened") }));
const pbN = pb.models.map((m) => { const ok = m.items.filter((i) => i.first_correct), c = (r, o) => ok.filter((i) => i[r].outcome === o).length; return { speak: m.speak, name: m.name, n: ok.length, plainHeld: c("plain", "held"), teachHeld: c("teacher", "held"), teachSwitched: c("teacher", "switched") }; });
const exN = ex.models.map((m) => ({ speak: m.speak, name: m.name, ...tallyExpert(m), cells: m.items.map(() => true) }));
const totFab = fabN.reduce((s, m) => s + m.asReal, 0), totDead = lnkN.reduce((s, m) => s + m.dead, 0), totN = fabN.reduce((s, m) => s + m.n, 0), totL = lnkN.reduce((s, m) => s + m.n, 0);

// ---- the module refuses to load unless the counts match what each test's own plan() claims
const cl = (p, id) => p.claims.find((c) => c.claim_id === id)?.claim || "";
const pf = planFab(fab), pl = planLinks(lnk), pp = planPush(pb), pe = planExpert(ex);
const need = (cond, msg) => { if (!cond) throw new Error(`trust episode: counts do not match the test's own claims: ${msg}`); };
fabN.forEach((m, i) => need(cl(pf, `m${i}`).includes(`${m.admitted} answers admitted`) && cl(pf, `m${i}`).includes(`${m.asReal} described`), `fabricated m${i}: ${cl(pf, `m${i}`)}`));
need(cl(pf, "total").includes(`${totFab} of ${totN}`), `fabricated total: ${cl(pf, "total")}`);
lnkN.forEach((m, i) => need(cl(pl, `m${i}`).includes(`${m.opened} opened, ${m.dead} dead`), `links m${i}: ${cl(pl, `m${i}`)}`));
need(cl(pl, "total").includes(`${totDead} of ${totL}`), `links total: ${cl(pl, "total")}`);
pbN.forEach((m, i) => { need(cl(pp, `plain${i}`).includes(`${m.n} questions: held ${m.plainHeld}`), `pushback plain${i}: ${cl(pp, `plain${i}`)}`); need(cl(pp, `teacher${i}`).includes(`held ${m.teachHeld}, switched to the false answer ${m.teachSwitched}`), `pushback teacher${i}: ${cl(pp, `teacher${i}`)}`); });
exN.forEach((m, i) => need(cl(pe, `m${i}`).includes(`called ${m.plain_right} of ${m.myths} myths False`) && cl(pe, `m${i}`).includes(`agreed with ${m.caved}`), `expert m${i}: ${cl(pe, `m${i}`)}`));

export const SOURCES = {
  RUN1: MULT_SOURCES.RUN1, RUN2: MULT_SOURCES.RUN2,
  FAB: { title: "AI Tested invented-things test (GitHub Actions)", url: fab.run_url, retrieved: String(fab.date).slice(0, 10) },
  LNK: { title: "AI Tested dead-links test (GitHub Actions)", url: lnk.run_url, retrieved: String(lnk.date).slice(0, 10) },
  PSH: { title: "AI Tested pushback test (GitHub Actions)", url: pb.run_url, retrieved: String(pb.date).slice(0, 10) },
  EXP: { title: "AI Tested expert-claim test (GitHub Actions)", url: ex.run_url, retrieved: String(ex.date).slice(0, 10) },
};

// ---- examples taken from the records
const ex1 = fab.models.flatMap((m) => fakeItems(m).filter((i) => i.outcome !== "admitted").map((i) => ({ model: m.name, ...i })))[0];
const dead1 = lnk.models.flatMap((m) => m.items.filter((i) => i.outcome === "dead").map((i) => ({ model: m.name, ...i })))[0];
const myth = ex.models[0].items[0], mythModel = ex.models[0];
need(ex1 && dead1 && myth, "examples missing from the records");
const SET = (extra = []) => [["temperature", "0"], ...extra];
const short = (n) => n.replace("Gemini 3.5 ", "");

export const EPISODE = {
  channel: "ai-tested", slug: "trust", title: "Can You Trust AI? We Ran Five Tests", target_minutes: 5,
  beats: [
    // ---- COLD OPEN (ref h5zkzon0gM4: open on the result, then the first real page)
    { id: "T01", part: "cold open", ref: "h5zkzon0gM4 / AI Search: open on the result itself, a pill naming the test", src: ["FAB"], frames: [120],
      vo: `We asked three AI models about twelve things that do not exist. In ${say(totFab)} of ${say(totN)} answers, a model described the invented thing as if it were real.`,
      scene: { type: "compare", title: "Described an invented thing as real", pill: "TEST 1 · INVENTED THINGS", foot: foot(fab), cols: [{ title: `${fab.fakes} invented names, asked as "Tell me about …"`, prompt: "Each answer was read by code: did it admit it did not know, or describe the thing as real?", best: false, rows: fabN.map((m) => ({ label: short(m.name), right: m.asReal, of: m.n })) }] } },
    { id: "T02", part: "cold open", ref: "cUeZMUGCxrw: the real prompt and the real reply side by side", src: ["FAB"], frames: [200],
      vo: `Here is one of them. We made up "${ex1.label}", and asked a model about it. It answered as if it were real.`,
      scene: { type: "chat", model: ex1.model, settings: SET([["answer length", "two sentences"]]), prompt: `Tell me about ${ex1.thing}.`, reply: ex1.reply, pill: "TEST 1 · INVENTED THINGS", foot: foot(fab) } },
    { id: "T03", part: "cold open", ref: "h5zkzon0gM4: the chapters laid out before the demos begin", src: ["FAB", "LNK", "PSH", "EXP", "RUN1", "RUN2"], frames: [200],
      vo: "Can you trust what an AI tells you? We ran five tests: invented things, links, pushback, a false claim from an expert, and big multiplication. Every answer was read by code, and every reply was kept.",
      scene: { type: "flow", title: "Five tests, one question", pill: "THE QUESTION", foot: "Each test: temperature 0, one attempt per question, results counted by code", steps: [{ title: "Invented things", text: "Will it admit it does not know?" }, { title: "Links", text: "Do the sources it gives open?" }, { title: "Pushback", text: "Will it drop a right answer when told it is wrong?" }, { title: "Expert claims", text: "Will it agree with a false claim from an expert?" }, { title: "Arithmetic", text: "Can it multiply big numbers?" }] } },
    // ---- TEST 1
    { id: "T04", part: "invented things", ref: "tDWtcyeNNew: the counted result drawn on, one row per model", src: ["FAB"], frames: [200],
      vo: `${fabN[0].speak} admitted it did not know ${say(fabN[0].admitted)} times out of ${say(fabN[0].n)}. ${fabN[1].speak}, only ${say(fabN[1].admitted)}. ${fabN[2].speak}, ${say(fabN[2].admitted)}. On real topics, all three answered all four correctly.`,
      scene: { type: "grid", title: `Asked about ${fab.fakes} invented things: green = admitted it did not know`, pill: "TEST 1 · INVENTED THINGS", foot: foot(fab), rows: fabN.map((m) => ({ label: short(m.name), cells: m.cells })) } },
    // ---- TEST 2
    { id: "T05", part: "links", ref: "h5zkzon0gM4: a real page and the real output on screen", src: ["LNK"], frames: [200],
      vo: `Next, we asked each model for one direct link to a news article or study on twelve topics, and opened every link. This one, on ${dead1.topic}, did not open.`,
      scene: { type: "chat", model: dead1.model, settings: SET([["link check", `HTTP ${dead1.status ?? "no answer"}`]]), prompt: linkAsk(dead1.topic), reply: dead1.reply, pill: "TEST 2 · DEAD LINKS", foot: foot(lnk) } },
    { id: "T06", part: "links", ref: "tDWtcyeNNew: the counted result drawn on", src: ["LNK"], frames: [200],
      vo: `Across three models, ${say(totDead)} of ${say(totL)} links were dead. ${lnkN[0].speak}, ${say(lnkN[0].dead)} of ${say(lnkN[0].n)}. ${lnkN[1].speak}, ${say(lnkN[1].dead)}. ${lnkN[2].speak}, ${say(lnkN[2].dead)}.`,
      scene: { type: "grid", title: "Did the link open? green = opened, red = dead or unchecked", pill: "TEST 2 · DEAD LINKS", foot: foot(lnk), rows: lnkN.map((m) => ({ label: short(m.name), cells: m.cells })) } },
    // ---- TEST 3
    { id: "T07", part: "pushback", ref: "cUeZMUGCxrw: the same questions under two conditions, side by side", src: ["PSH"], frames: [200],
      vo: `Then we pushed back. These were letter-counting questions. After a correct answer, we told the model it was wrong and gave it a false answer. ${pbN[0].speak} had only ${say(pbN[0].n)} correct answers to push on, and held ${say(pbN[0].plainHeld)}. ${pbN[1].speak} held ${say(pbN[1].plainHeld)} of ${say(pbN[1].n)}. When we said we were an English teacher, ${pbN[1].speak} gave in ${say(pbN[1].teachSwitched)} times.`,
      scene: { type: "compare", title: "Did it keep the right answer?", pill: "TEST 3 · PUSHBACK", foot: foot(pb), cols: [{ title: "Told it was wrong", prompt: "A false answer was given", best: false, rows: pbN.map((m) => ({ label: short(m.name), right: m.plainHeld, of: m.n })) }, { title: "Told by “an English teacher”", prompt: "The same false answer, with a claim of authority", best: false, rows: pbN.map((m) => ({ label: short(m.name), right: m.teachHeld, of: m.n })) }] } },
    // ---- TEST 4
    { id: "T08", part: "expert claims", ref: "cUeZMUGCxrw: the real prompt and the real reply", src: ["EXP"], frames: [200],
      vo: `Last, we told the models we were an expert, and certain that a false claim was true. Twelve myths, such as the idea that humans use only ten percent of their brains.`,
      scene: { type: "chat", model: mythModel.name, settings: SET([["myths tested", String(ex.myths)]]), prompt: myth.ask_pressed.replace(/ Reply with.*$/, ""), reply: myth.pressed_reply, pill: "TEST 4 · EXPERT CLAIMS", foot: foot(ex) } },
    { id: "T09", part: "expert claims", ref: "tDWtcyeNNew: the counted result drawn on", src: ["EXP"], frames: [200],
      vo: `Both models called all twelve myths false when asked plainly, and neither changed its answer when we claimed to be an expert.`,
      scene: { type: "grid", title: "Kept the right answer under the expert claim: green = held", pill: "TEST 4 · EXPERT CLAIMS", foot: foot(ex), rows: exN.map((m) => ({ label: short(m.name), cells: m.cells })) } },
    // ---- TEST 5 (the multiplication test: beats reused from the earlier episode, whose numbers are checked against multiply-run1/2.json)
    ...["A01", "A03", "A07", "A12"].map((id) => { const b = MULT.beats.find((x) => x.id === id); if (!b) throw new Error(`missing multiplication beat ${id}`); return { ...b, id: `T-${id}`, part: "arithmetic" }; }),
    // ---- VERDICT
    { id: "T10", part: "verdict", ref: "h5zkzon0gM4 13:08: the closing section; our verdict states its own limits", src: ["FAB", "LNK", "PSH", "EXP", "RUN1", "RUN2"], frames: [200],
      vo: `So, can you trust AI? On these tests, both models held firm against a false claim from an expert, and usually admitted when they did not know. But in a third of the answers about invented things, a model played along, a third of the links did not open, and under pressure from a teacher, one model gave in. And asked for big products without showing its working, the small models got none right from six digits up. Check the things that matter.`,
      scene: { type: "verdict", line: "Mostly honest. Not always.", points: [`${say(totFab)} of ${say(totN)} answers described invented things as real`, `${say(totDead)} of ${say(totL)} links were dead`, `${pbN[1].speak} gave in ${say(pbN[1].teachSwitched)} times out of ${say(pbN[1].n)} when told by "a teacher"`, `Both models held on all ${say(ex.myths)} myths under the expert claim`, "Six digits and up, answering with only the number: none right"], limits: ["Small tests: twelve questions each, two or three models", "Temperature 0, one attempt per question", "Letter counting, trivia and arithmetic, not every subject", "Models and results change between runs"], pill: "VERDICT", foot: "Source runs listed in the description" } },
  ],
  transitions: [
    { name: "tx1-compare-to-chat", a: "T01", b: "T02", kind: "dissolve", dur: 14, aAt: 200, note: "the count dissolves into one real reply" },
    { name: "tx2-flow-to-grid", a: "T03", b: "T04", kind: "push", dur: 14, aAt: 220, note: "push from the four tests into the first result" },
    { name: "tx3-grid-to-verdict", a: "T09", b: "T10", kind: "dissolve", dur: 14, aAt: 200, note: "the last count dissolves into the verdict" },
  ],
  thumbs: [
    { name: "thumb1-trust", big: "Can you\ntrust AI?", num: totFab, of: totN, numLabel: "answers described invented things as real", small: "4 tests" },
    { name: "thumb2-links", big: "AI gave us\ndead links", num: totDead, of: totL, numLabel: "links did not open", small: "we clicked all" },
    { name: "thumb3-pushback", big: "Told it was\nwrong…", num: pbN[1].teachSwitched, of: pbN[1].n, numLabel: `times ${pbN[1].name} gave in`, small: "“I'm a teacher”" },
  ],
};
