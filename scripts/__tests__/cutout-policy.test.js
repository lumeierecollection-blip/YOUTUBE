import test from "node:test";
import assert from "node:assert/strict";
import { cutoutPolicy, namesShowableEntity } from "../../src/skills/remotion-render/visual/cutout-policy.js";

test("an object the sentence names stays; a role never gets a stock cutout", () => {
  const r = cutoutPolicy(["gavel", "businessman", "solar panel", "worker"], []);
  assert.deepEqual(r.keep, ["gavel", "solar panel"]);
  assert.deepEqual(r.dropped.map((d) => d.name), ["businessman", "worker"]);
});

test("a drawn symbol is dropped on a beat that names an organisation, a person or a place — kept on one that names none", () => {
  const withOrg = cutoutPolicy(["upward-arrow", "gavel"], [{ name: "Credit Suisse", type: "company" }, { name: "2019", type: "number" }]);
  assert.deepEqual(withOrg.keep, ["gavel"]);
  assert.match(withOrg.dropped[0].why, /stand where the named entity/);
  assert.deepEqual(cutoutPolicy(["upward-arrow"], [{ name: "12%", type: "number" }]).keep, ["upward-arrow"]);
  assert.equal(namesShowableEntity([{ name: "Peru", type: "place" }]), true);
  assert.equal(namesShowableEntity([{ name: "5", type: "number" }]), false);
});
