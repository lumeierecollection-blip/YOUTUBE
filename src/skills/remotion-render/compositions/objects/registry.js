/**
 * THE OBJECT REGISTRY, on its own so the drawings can live in more than one file.
 *
 * index.jsx used to hold both the registry and the drawings, and importing a
 * second drawing file from it made a cycle: library.jsx asked index.jsx for
 * `registerObject` before index.jsx's own `const` bindings had initialised, so
 * the very first registration threw on the temporal dead zone. Splitting the
 * registry out is what breaks that -- both drawing files now depend on this
 * one, and this one depends on nothing.
 */
const OBJECTS = {};
export const registerObject = (name, fn) => { OBJECTS[name] = fn; };
export const hasObject = (name) => Boolean(OBJECTS[name]);
export const knownObjects = () => Object.keys(OBJECTS).sort();

/**
 * Draw one object, or throw. Section 3 forbids a fallback for a missing
 * template, and the same reasoning applies one level down: silently drawing
 * nothing where an object should be is how a scene quietly becomes empty.
 */
/**
 * A stable, unique id fragment for any <clipPath> or <defs> an object needs.
 *
 * Three objects define a clipPath and all three built the id from the box's x
 * and y. Every object is placed by a parent <g transform>, so inside its own
 * drawing x and y are always 0 -- every clipPath in a scene was called "cs00",
 * "pl00", "tk00", and the FIRST definition won for all of them. A planet and a
 * cross-section in one frame clipped each other. Name plus size is unique per
 * object and per copy, and is derived from the arguments, so a re-render is
 * still byte-identical.
 */
const uidFor = (name, box) =>
  `${name.replace(/[^a-z0-9]+/gi, "")}${Math.round(box.w)}x${Math.round(box.h)}`;

export function ObjectShape({ name, box, colors, p = 1 }) {
  const fn = OBJECTS[name];
  if (!fn) {
    throw new Error(
      `no procedural drawing for object "${name}". Known: ${knownObjects().join(", ")}.\n` +
      `Section 3's no-fallback rule applies here too: a scene must not quietly omit its subject.`
    );
  }
  return fn({ box, colors, p, uid: uidFor(name, box) });
}
