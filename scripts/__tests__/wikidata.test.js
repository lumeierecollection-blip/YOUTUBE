// scripts/lib/wikidata.cjs: an entity's own logo / portrait from Wikidata claims, matched exactly on label or alias.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { find, claimFiles } = createRequire(import.meta.url)("../lib/wikidata.cjs");

const str = (v, extra = {}) => ({ rank: "normal", mainsnak: { datavalue: { type: "string", value: v } }, ...extra });
const item = (id, claims) => ({ [id]: { claims } });
const human = [{ rank: "normal", mainsnak: { datavalue: { type: "wikibase-entityid", value: { id: "Q5" } } } }];
// A fake Wikidata: search results by query, entities by id.
const api = ({ search = [], entities = {} }) => async (url) => (url.includes("wbsearchentities") ? { search } : { entities });

test("an organisation: the exact-label item's P154 logo, current logo before a former one", async () => {
  const getJson = api({
    search: [{ id: "Q1", label: "Financial Stability Board", description: "international body" }],
    entities: item("Q1", { P154: [str("FSB old.svg", { qualifiers: { P582: [{}] } }), str("Financial Stability Board logo.svg")] }),
  });
  const r = await find("Financial Stability Board", { type: "organization", getJson });
  assert.deepEqual(r.logos, ["Financial Stability Board logo.svg", "FSB old.svg"]);
  assert.equal(r.matched, "label");
});

test("an alias finds the item: 'Low Taek Jho' -> Jho Low (a person, P18)", async () => {
  const getJson = api({
    search: [{ id: "Q2", label: "Jho Low", description: "Malaysian financier", aliases: ["Low Taek Jho"], match: { type: "alias", text: "Low Taek Jho" } }],
    entities: item("Q2", { P31: human, P18: [str("Jho Low.jpg")] }),
  });
  const r = await find("Low Taek Jho", { type: "person", getJson });
  assert.deepEqual(r.images, ["Jho Low.jpg"]);
  assert.equal(r.matched, "alias");
});

test("a person's name never reaches an organisation's item, nor the reverse", async () => {
  const getJson = api({ search: [{ id: "Q3", label: "Mercury", description: "x" }], entities: item("Q3", { P31: human, P18: [str("Freddie.jpg")] }) });
  assert.equal(await find("Mercury", { type: "organization", getJson }), null, "a human is not an organisation");
  const getJson2 = api({ search: [{ id: "Q4", label: "Mercury", description: "x" }], entities: item("Q4", { P154: [str("m.svg")] }) });
  assert.equal(await find("Mercury", { type: "person", getJson: getJson2 }), null, "a company is not a person");
});

test("no exact match, a disambiguation page, nothing to show: null (no guessing by closeness)", async () => {
  assert.equal(await find("Treasury Department", { type: "organization", getJson: api({ search: [{ id: "Q5", label: "United States Department of the Treasury", description: "x" }] }) }), null);
  assert.equal(await find("Mercury", { type: "organization", getJson: api({ search: [{ id: "Q6", label: "Mercury", description: "Wikimedia disambiguation page" }] }) }), null);
  assert.equal(await find("Acme", { type: "organization", getJson: api({ search: [{ id: "Q7", label: "Acme", description: "company" }], entities: item("Q7", {}) }) }), null);
});

test("label folding: case, punctuation and 'and' / '&'", async () => {
  const getJson = api({ search: [{ id: "Q8", label: "Johnson & Johnson", description: "company" }], entities: item("Q8", { P154: [str("JNJ.svg")] }) });
  assert.equal((await find("johnson and johnson", { type: "organization", getJson })).logos[0], "JNJ.svg");
});

test("deprecated claims are skipped; a missing fetcher or empty name is null", async () => {
  assert.deepEqual(claimFiles({ P154: [str("bad.svg", { rank: "deprecated" }), str("ok.svg")] }, ["P154"]), ["ok.svg"]);
  assert.equal(await find("X", {}), null);
  assert.equal(await find("", { getJson: api({}) }), null);
});
