import test from "node:test";
import assert from "node:assert/strict";
import { creditEntries } from "../../src/skills/remotion-render/credits.js";

const fair = { basis: "fair use", purpose: "identification of the organisation named in the sentence only", rationale: "Primary visual identification at the top of the infobox.", article: "Acme", holder: "Acme Corporation", file_page: "https://en.wikipedia.org/wiki/File:Acme_logo.png", retrieved: "2026-10-10", entity: "Acme" };

test("each fair-use mark is recorded per use, with its basis, rationale, holder and file page; free and CC0 images are not", () => {
  const plan = { beats: [
    { index: 0, canvas: { art: { kind: "plates", items: [{ name: "Acme", asset: "a.png", license: "Fair use (non-free logo, identification only)", fair_use: fair }] } } },
    { index: 1, canvas: { photo: { asset: "p.jpg", entity: "Ada", credit: "Photo: B. Smith / Wikimedia Commons, CC BY-SA 4.0", license: "CC BY-SA 4.0", source_url: "https://commons/p" } } },
    { index: 2, canvas: { photo: { asset: "q.jpg", entity: "Grace", license: "CC0", source_url: "https://commons/q" } } },
    { index: 3, canvas: { concept_visuals: [{ name: "Acme", class: "cutout", logo: true, asset: "a2.png", license: "Fair use (non-free logo, identification only)", fair_use: fair }] } },
  ] };
  const r = creditEntries(plan);
  assert.equal(r.fair_use.length, 2);                       // two uses (beat 0 and beat 3), recorded per use
  assert.deepEqual(r.fair_use.map((u) => u.beat), [0, 3]);
  assert.equal(r.fair_use[0].holder, "Acme Corporation");
  assert.match(r.lines.join("\n"), /Acme logo — shown only to identify it \(fair use\)\. © Acme Corporation/);
  assert.match(r.lines.join("\n"), /B\. Smith \/ Wikimedia Commons, CC BY-SA 4\.0/);
  assert.ok(!r.lines.some((l) => /Grace|CC0/.test(l)));
});

test("a plan with no fair-use mark yields an empty record (the file still confirms the check ran)", () => {
  assert.deepEqual(creditEntries({ beats: [{ index: 0, canvas: {} }] }), { lines: [], fair_use: [] });
});
