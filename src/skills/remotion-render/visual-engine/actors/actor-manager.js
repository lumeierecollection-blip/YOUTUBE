/**
 * THE STAGE — what is on screen, and what each beat does to it.
 *
 * This is the part the old renderer did not have, and its absence is the whole
 * complaint. That renderer composed each beat from nothing, so a run of beats
 * on one strategy drew the same picture from scratch every time and the video
 * read as a slideshow of one slide. Here a beat does not compose a picture: it
 * MUTATES a stage that already exists.
 *
 * SECTION 3.5's CONTINUITY RULES ARE THE WHOLE DESIGN, NOT A CHECK BOLTED ON.
 *
 *   1. An actor present in consecutive beats transforms; it never re-enters.
 *   2. An actor leaving gets an exit behaviour; it never just stops being drawn.
 *   3. A new actor connects to what is already there where it can.
 *   4. Typography flows from beat to beat (handled in the kinetic layer).
 *   5. Complexity builds and then resolves.
 *
 * Rules 1 and 2 are structural here: `advance()` carries the previous stage
 * forward and assigns every surviving actor a behaviour, so "disappear and
 * reappear" is not an outcome the code can produce. Rule 3 is why CONNECT and
 * BUILD attach a line to the nearest existing actor rather than placing a free
 * one. Rule 5 is why RESOLVE collapses the stage instead of adding to it.
 *
 * VOCABULARY IS THE CHANNEL'S. Which objects the actors are made of comes from
 * that channel's `core_objects`; this file decides only how many, where, and
 * what they do. Money Mind and Legal Brief run the same grammar over different
 * nouns, which is the same separation the templates use.
 */

/**
 * How many solid actors may be on stage at once.
 *
 * Five overlapped once the type band was reserved. Four fitted without touching
 * but only by shrinking each object to about a fifth of the frame width, which
 * read as a row of thumbnails rather than a subject. Three, on a triangle, is
 * what lets each one be big enough to recognise in a 9:16 frame.
 *
 * MEASURED against the ring, and against what happened
 * without a cap: run over a 32-beat script the stage reached 33 actors, which
 * is not a composition, it is a pile. Rule 5 says complexity builds and then
 * resolves; without a ceiling it only builds. When a new actor arrives on a
 * full stage the OLDEST leaves, with an exit, so the frame keeps a legible
 * count and the thing that has been on screen longest is the thing that goes.
 */
const MAX_SOLID = 3;

/** Positions on a 0..1 stage. Kept as named slots so arrangements are readable. */
const SLOT = {
  centre: { x: 0.5, y: 0.46 },
  left: { x: 0.28, y: 0.46 },
  right: { x: 0.72, y: 0.46 },
  upper: { x: 0.5, y: 0.28 },
  lower: { x: 0.5, y: 0.66 },
  farLeft: { x: 0.2, y: 0.6 },
  farRight: { x: 0.8, y: 0.6 },
  // A triangle: one above, two below. In a tall frame this is the only
  // arrangement of three that leaves each of them room to be large.
  ring: [
    { x: 0.5, y: 0.2 }, { x: 0.75, y: 0.76 }, { x: 0.25, y: 0.76 },
  ],
};

const clone = (a) => ({ ...a });

/** A new actor drawn from the channel's own vocabulary. */
function makeActor(kind, objectName, slot, extra = {}) {
  return {
    id: `${kind}:${objectName}#${extra.seq ?? 0}`,
    bornAt: extra.seq ?? 0,
    type: kind,
    object: objectName,
    x: slot.x, y: slot.y,
    scale: extra.scale ?? 1,
    opacity: 1,
    state: "active",
    behavior: "APPEAR",
    connectedTo: extra.connectedTo || null,
    value: extra.value ?? null,
    ...extra.overrides,
  };
}

/** Nearest existing actor to a slot, so a new one attaches to what is there. */
function nearest(stage, slot) {
  let best = null, d = Infinity;
  for (const a of stage) {
    if (a.type === "line") continue;
    const dd = (a.x - slot.x) ** 2 + (a.y - slot.y) ** 2;
    if (dd < d) { d = dd; best = a; }
  }
  return best;
}

/**
 * Apply one beat's intent to the stage.
 *
 * @param {Array}  stage    actors left by the previous beat
 * @param {object} beat     { intent, emphasis, value, seq }
 * @param {Array}  objects  the channel's core_objects, in its own order
 * @returns {Array} the new stage; every actor carries the behaviour it performs
 */
export function advance(stage, beat, objects) {
  const { intent, seq = 0 } = beat;
  const obj = (i) => objects[i % objects.length];
  // Rule 1: everything that survives is carried forward, never rebuilt.
  const carried = stage.map(clone);
  const solid = carried.filter((a) => a.type !== "line");
  const next = [];

  const hold = (a, behavior, patch = {}) => { Object.assign(a, { behavior, ...patch }); next.push(a); };

  switch (intent) {
    case "INTRODUCE": {
      // The subject arrives alone. Anything already there steps back rather
      // than vanishing (rule 2).
      for (const a of solid) hold(a, "DE_EMPHASIZE", { opacity: 0.25, scale: a.scale * 0.8, state: "dimmed" });
      next.push(makeActor("object", obj(seq), SLOT.centre, { seq, scale: 1 }));
      break;
    }
    case "BUILD": {
      // A new element joins and the existing ones make room. Complexity grows.
      const ring = SLOT.ring;
      solid.forEach((a, i) => hold(a, "MOVE", { ...ring[i % ring.length], scale: 0.72, state: "active", opacity: 1 }));
      const slot = ring[solid.length % ring.length];
      const anchor = nearest(next, slot);
      next.push(makeActor("object", obj(seq + 1), slot, { seq, scale: 0.72, connectedTo: anchor ? anchor.id : null }));
      // Rule 3: a new actor connects to what is already on stage.
      if (anchor) next.push({ id: `line:${anchor.id}->${seq}`, type: "line", from: anchor.id, to: `object:${obj(seq + 1)}#${seq}`, behavior: "DRAW", opacity: 1, state: "active", x: (anchor.x + slot.x) / 2, y: (anchor.y + slot.y) / 2 });
      break;
    }
    case "CONNECT": {
      // Nothing new arrives; the relationship between what is there is drawn.
      const ring = SLOT.ring;
      solid.forEach((a, i) => hold(a, i === 0 ? "EMPHASIZE" : "HOLD", { ...ring[i % ring.length], scale: 0.7, opacity: 1, state: "active" }));
      // The bound is captured BEFORE the loop. Reading `next.length` in the
      // condition while pushing into `next` was an infinite loop: it ran out of
      // heap after about 125 seconds on a four-beat script.
      const hub = next[0];
      const spokes = next.slice(1);
      for (const s of spokes) {
        next.push({ id: `line:${hub.id}->${s.id}`, type: "line", from: hub.id, to: s.id, behavior: "DRAW", opacity: 1, state: "active", x: (hub.x + s.x) / 2, y: (hub.y + s.y) / 2 });
      }
      if (solid.length < 2) next.push(makeActor("object", obj(seq + 1), SLOT.right, { seq, scale: 0.8 }));
      break;
    }
    case "CONTRAST": {
      // Two sides, one lit and one dimmed. The existing subject takes the left.
      const a0 = solid[0];
      if (a0) hold(a0, "MOVE", { ...SLOT.left, scale: 0.9, opacity: 1, state: "active" });
      else next.push(makeActor("object", obj(seq), SLOT.left, { seq, scale: 0.9 }));
      for (const a of solid.slice(1)) hold(a, "DE_EMPHASIZE", { opacity: 0.18, scale: a.scale * 0.7, state: "dimmed" });
      next.push(makeActor("object", obj(seq + 2), SLOT.right, { seq, scale: 0.9, overrides: { state: "highlighted" } }));
      break;
    }
    case "COMPARE": {
      const [l, r] = [solid[0], solid[1]];
      if (l) hold(l, "MOVE", { ...SLOT.left, scale: 0.86, opacity: 1, state: "active" });
      else next.push(makeActor("object", obj(seq), SLOT.left, { seq, scale: 0.86 }));
      if (r) hold(r, "MOVE", { ...SLOT.right, scale: 0.86, opacity: 1, state: "active" });
      else next.push(makeActor("object", obj(seq + 1), SLOT.right, { seq, scale: 0.86 }));
      for (const a of solid.slice(2)) hold(a, "DE_EMPHASIZE", { opacity: 0.15, state: "dimmed" });
      break;
    }
    case "QUANTIFY": {
      // Section 4.2: a quantity counts. The number is an actor with a value,
      // not a string drawn once.
      solid.forEach((a, i) => hold(a, "MOVE", { ...(i === 0 ? SLOT.lower : SLOT.ring[i % SLOT.ring.length]), scale: 0.62, opacity: i === 0 ? 1 : 0.5, state: i === 0 ? "active" : "dimmed" }));
      // The quantity IS the subject of a QUANTIFY beat, so it takes the centre
      // and the objects move under it rather than the other way round.
      next.push({
        // bornAt matters: without it the eviction sort read this actor as the
        // oldest on stage and threw it out in the same beat it was created, so
        // three of four counts never ran. Measured as CHECK 5 at 1/4.
        id: `number:${seq}`, type: "number", behavior: "COUNT", bornAt: seq,
        x: 0.5, y: 0.34, scale: 1, opacity: 1, state: "highlighted",
        value: beat.value ?? null, text: beat.emphasis || "",
      });
      break;
    }
    case "REVEAL": {
      // What was already there opens up: it scales and something inside it
      // arrives, rather than the frame cutting to a new picture.
      solid.forEach((a, i) => hold(a, i === 0 ? "SCALE" : "DE_EMPHASIZE", i === 0
        ? { ...SLOT.centre, scale: 1.25, opacity: 1, state: "highlighted" }
        : { opacity: 0.16, state: "dimmed" }));
      if (!solid.length) next.push(makeActor("object", obj(seq), SLOT.centre, { seq, scale: 1.25 }));
      next.push(makeActor("object", obj(seq + 3), SLOT.lower, { seq, scale: 0.5, overrides: { behavior: "APPEAR", state: "highlighted" } }));
      break;
    }
    case "EMPHASIZE": {
      // One thing is lit and everything else recedes. Nothing enters or leaves.
      solid.forEach((a, i) => hold(a, i === 0 ? "EMPHASIZE" : "DE_EMPHASIZE", i === 0
        ? { ...SLOT.centre, scale: 1.12, opacity: 1, state: "highlighted" }
        : { opacity: 0.14, scale: a.scale * 0.86, state: "dimmed" }));
      if (!solid.length) next.push(makeActor("object", obj(seq), SLOT.centre, { seq, scale: 1.12 }));
      break;
    }
    case "TRANSFORM": {
      // The same actor becomes a different thing in the same place, which is
      // what makes it a transformation rather than a replacement.
      const a0 = solid[0];
      if (a0) hold(a0, "TRANSFORM", { object: obj(seq + 2), scale: 1, opacity: 1, state: "highlighted", ...SLOT.centre });
      else next.push(makeActor("object", obj(seq + 2), SLOT.centre, { seq, scale: 1 }));
      for (const a of solid.slice(1)) hold(a, "DE_EMPHASIZE", { opacity: 0.18, state: "dimmed" });
      break;
    }
    case "RESOLVE":
    default: {
      // Rule 5: complexity resolves. Everything but the subject collapses.
      const a0 = solid[0];
      if (a0) hold(a0, "EMPHASIZE", { ...SLOT.centre, scale: 1.3, opacity: 1, state: "highlighted" });
      else next.push(makeActor("object", obj(seq), SLOT.centre, { seq, scale: 1.3 }));
      for (const a of solid.slice(1)) hold(a, "COLLAPSE", { ...SLOT.centre, scale: 0.2, opacity: 0, state: "inactive" });
      break;
    }
  }

  /**
   * Rule 5, enforced: over the cap, the longest-serving actors leave.
   *
   * They leave with an EXIT behaviour, never by being dropped, so rule 2 still
   * holds. Lines whose endpoints have gone leave with them — a connection to
   * something no longer on stage is a line to nowhere.
   */
  const solidNext = next.filter((a) => a.type !== "line");
  if (solidNext.length > MAX_SOLID) {
    // An actor born THIS beat is never evicted: it has not been seen yet, and
    // creating something only to throw it out in the same frame is not a stage
    // that is too full, it is a bug.
    const evictable = solidNext.filter((a) => (a.bornAt ?? 0) !== seq);
    const byAge = [...evictable].sort((a, b) => (a.bornAt ?? 0) - (b.bornAt ?? 0));
    const evict = new Set(byAge.slice(0, Math.max(0, solidNext.length - MAX_SOLID)).map((a) => a.id));
    for (const a of next) {
      if (evict.has(a.id)) Object.assign(a, { behavior: "EXIT", opacity: 0, scale: a.scale * 0.6, state: "inactive" });
    }
    const gone = new Set([...evict]);
    for (let i = next.length - 1; i >= 0; i--) {
      const a = next[i];
      if (a.type === "line" && (gone.has(a.from) || gone.has(a.to))) next.splice(i, 1);
    }
  }

  // Rule 2: an actor the beat dropped exits rather than vanishing. Anything at
  // zero opacity has finished exiting and leaves the stage after this beat.
  const kept = new Set(next.map((a) => a.id));
  for (const a of carried) {
    if (kept.has(a.id) || a.type === "line") continue;
    next.push({ ...a, behavior: "EXIT", opacity: 0, scale: a.scale * 0.6, state: "inactive" });
  }
  return next.filter((a) => !(a.state === "inactive" && a.opacity === 0 && a.behavior === "EXIT" && a.exited))
    .map((a) => (a.behavior === "EXIT" ? { ...a, exited: true } : a));
}

/** Run every beat through the stage in order. Returns one stage per beat. */
export function stageTimeline(beats, objects) {
  let stage = [];
  return beats.map((b) => {
    stage = advance(stage, b, objects).filter((a) => !a.exited || a.behavior === "EXIT");
    // An actor that has finished exiting is off the stage for the next beat.
    const out = stage.map(clone);
    stage = stage.filter((a) => a.behavior !== "EXIT");
    return out;
  });
}
