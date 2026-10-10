import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { parseFairUse, fairUseInfo, FAIR_USE_MAX_SIDE } = createRequire(import.meta.url)("../lib/fair-use-logo.cjs");

const LOGO_PAGE = `== Summary ==
{{Non-free use rationale logo
| Article = [[Acme Corporation|Acme]]
| Website = https://acme.example
| Description = The logo of Acme.
| Portion = All
| Low_resolution = Yes
| Purpose = To serve as the primary means of '''visual identification''' of the company at the top of the infobox.
| Owner = Acme Corporation
}}
== Licensing ==
{{Non-free logo|category=}}`;

test("a non-free logo with a stated rationale yields the record the credits manifest needs", () => {
  const r = parseFairUse({ wikitext: LOGO_PAGE, categories: ["Category:All non-free logos"] });
  assert.equal(r.article, "Acme");
  assert.match(r.rationale, /visual identification of the company/);
  assert.equal(r.holder, "Acme Corporation");
});

test("a file that is not filed as a non-free logo, or states no rationale, is refused — never given a made-up one", () => {
  assert.match(parseFairUse({ wikitext: "{{Non-free poster}}", categories: ["Category:Non-free posters"] }).refuse, /not file it as a non-free logo/);
  assert.match(parseFairUse({ wikitext: "{{Non-free logo}}", categories: [] }).refuse, /no rationale/);
});

test("fairUseInfo reads the English Wikipedia file page and caps the size at identification scale", async () => {
  let asked = "";
  const getJson = async (u) => { asked = u; return { query: { pages: { 1: { title: "File:Acme logo.png", categories: [{ title: "Category:All non-free logos" }], revisions: [{ slots: { main: { "*": LOGO_PAGE } } }], imageinfo: [{ url: "https://upload.wikimedia.org/a.png", thumburl: "https://upload.wikimedia.org/t.png", width: 900, height: 300, mime: "image/png", descriptionurl: "https://en.wikipedia.org/wiki/File:Acme_logo.png", extmetadata: {} }] } } } }; };
  const r = await fairUseInfo("Acme logo.png", getJson);
  assert.match(asked, new RegExp(`en\\.wikipedia\\.org.*iiurlwidth=${FAIR_USE_MAX_SIDE}`));
  assert.equal(r.fair_use.basis, "fair use");
  assert.equal(r.fair_use.file_page, "https://en.wikipedia.org/wiki/File:Acme_logo.png");
  assert.match(r.info.license, /Fair use/);
});
