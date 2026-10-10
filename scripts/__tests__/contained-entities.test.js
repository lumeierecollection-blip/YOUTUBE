// An entity named only inside a longer entity's name is part of it (board 38044082797 ch 2, beat 8).
import { test } from "node:test";
import assert from "node:assert/strict";
import { dropContainedEntities } from "../lib/contained-entities.mjs";

const org = { type: "organization", name: "San Francisco Anti-Displacement Coalition" };
const sf = { type: "place", name: "San Francisco" };
const names = (l) => l.map((e) => e.name);

test("a place that is only part of an organization's name is dropped (ch 2 beat 8)", () => {
  assert.deepEqual(names(dropContainedEntities([org, sf], "Contact the San Francisco Anti-Displacement Coalition today.")), [org.name]);
});

test("a place the sentence also names on its own stays", () => {
  assert.deepEqual(names(dropContainedEntities([org, sf], "The San Francisco Anti-Displacement Coalition meets in San Francisco on Friday.")), [org.name, sf.name]);
});

test("nothing is dropped when the container is not in the sentence verbatim (an alias: we cannot know)", () => {
  assert.deepEqual(names(dropContainedEntities([org, sf], "The coalition meets in town on Friday.")), [org.name, sf.name]);
});

test("unrelated entities are untouched, and order is kept", () => {
  const p = { type: "person", name: "Myrna Melgar" }, c = { type: "organization", name: "Asian Law Caucus" };
  assert.deepEqual(dropContainedEntities([p, c, sf], "Myrna Melgar and the Asian Law Caucus spoke in San Francisco."), [p, c, sf]);
});

test("a person inside an organization's name is dropped the same way", () => {
  const m = { type: "person", name: "Martin Luther King" }, f = { type: "organization", name: "Martin Luther King Foundation" };
  assert.deepEqual(names(dropContainedEntities([m, f], "The Martin Luther King Foundation gave grants.")), [f.name]);
});

test("empty and punctuation-only names are kept (not this helper's job)", () => {
  const e = { type: "place", name: "" };
  assert.deepEqual(dropContainedEntities([e, org], "Contact the San Francisco Anti-Displacement Coalition."), [e, org]);
});
