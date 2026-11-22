// Pure tests for visual/transitions.js (run: node scripts/test-transitions.mjs)
import assert from "node:assert/strict";
import { enterKind, enterState, cameraPush, ENTER, W, H } from "../src/skills/remotion-render/visual/transitions.js";
import { popGroups, POP } from "../src/skills/remotion-render/visual/pop-groups.js";

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log(`ok   ${name}`); };

ok("a band holding a cutout or a portrait rises; the photo zooms; text, charts, numbers cut", () => {
  assert.equal(enterKind({ key: "photo" }), "photo");
  assert.equal(enterKind({ key: "middle" }, [["cutout0", { role: "concept" }]]), "rise");
  assert.equal(enterKind({ key: "middle" }, [["portrait", { role: "portrait" }]]), "rise");
  assert.equal(enterKind({ key: "top" }, [["headline", { role: "headline" }], ["rule", { role: "rule" }]]), "cut");
  assert.equal(enterKind({ key: "middle" }, [["number", { role: "number" }], ["chart", { role: "chart" }]]), "cut");
});
ok("nothing is drawn before its arrival frame; text is fully there on it (a hard cut, no fade)", () => {
  for (const k of ["cut", "rise", "photo"]) assert.equal(enterState(k, -1).o, 0);
  assert.deepEqual(enterState("cut", 0), { o: 1, s: 1, tx: 0, ty: 0, blur: 0 });
});
ok("a rise is opaque from frame 0, starts below its place with motion blur, and lands still", () => {
  const f0 = enterState("rise", 0);
  assert.equal(f0.o, 1);
  assert.ok(Math.abs(f0.ty - ENTER.RISE_FROM * H) < 1e-6);
  assert.equal(f0.blur, ENTER.BLUR_MAX);
  assert.deepEqual(enterState("rise", ENTER.RISE), { o: 1, s: 1, tx: 0, ty: 0, blur: 0 });
});
ok("a rise decelerates (ease-out): most of the travel is covered in the first third", () => {
  const third = enterState("rise", Math.round(ENTER.RISE / 3)).ty;
  assert.ok(third < 0.35 * ENTER.RISE_FROM * H, `ty ${third}`);
  let last = Infinity;
  for (let f = 0; f <= ENTER.RISE; f++) { const t = enterState("rise", f).ty; assert.ok(t <= last); last = t; }
});
ok("side -1 enters from the bottom-left, side 0 straight up", () => {
  assert.ok(enterState("rise", 0, { side: -1 }).tx < -0.1 * W);
  assert.equal(enterState("rise", 0, { side: 0 }).tx, 0);
});
ok("a photo settles from a slight zoom to 1", () => {
  assert.ok(Math.abs(enterState("photo", 0).s - ENTER.ZOOM_FROM) < 1e-9);
  assert.equal(enterState("photo", ENTER.ZOOM).s, 1);
});
ok("the camera push runs 1 -> 1+PUSH across the beat, monotonic", () => {
  assert.equal(cameraPush(0, 90), 1);
  assert.ok(Math.abs(cameraPush(90, 90) - (1 + ENTER.PUSH)) < 1e-9);
  let last = 0;
  for (let f = 0; f <= 90; f++) { const s = cameraPush(f, 90); assert.ok(s >= last); last = s; }
});
ok("the first group of a beat is on screen on the cut frame (POP.START 0)", () => {
  assert.equal(POP.START, 0);
});
ok("popGroups tags every group with an entrance kind", () => {
  const L = { composition: "TYPE-FULL", boxes: { headline: { x: 60, y: 200, w: 900, h: 200, role: "headline" }, cutout0: { x: 200, y: 800, w: 600, h: 600, role: "concept" } } };
  const gs = popGroups({}, L);
  assert.ok(gs.length >= 2);
  for (const g of gs) assert.ok(["cut", "rise", "photo"].includes(g.enter), g.key);
  assert.equal(gs.find((g) => g.key === "middle").enter, "rise");
});
ok("an unknown kind is an error, not a silent cut", () => assert.throws(() => enterState("morph", 3)));
console.log(`all pass (${n})`);
