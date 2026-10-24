// validate-discovery's pre-research source check. Regressions covered:
//  - checkTwoDomains shadowed its own result array (`for (const d of d)`): a temporal-dead-zone
//    ReferenceError on any topic whose first search returned a source;
//  - the DuckDuckGo-only proxy could not realistically reach two domains.
// Every lookup is injected; nothing touches the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registrableDomain, independentDomains, urlsFromDuckDuckGo, urlsFromWikipediaExtlinks, collectSourceDomains,
} from "../lib/source-domains.mjs";
import { checkTwoDomains } from "../validate-discovery.js";

const topic = { topic: "Emergency fund", angle: "median savings" };
const q = (u) => decodeURIComponent(new URL(u).searchParams.get("q") ?? new URL(u).searchParams.get("srsearch") ?? "");
const ddg = (AbstractURL, extra = {}) => ({ Abstract: "x", AbstractURL, ...extra });

// A getJson stub: routes by URL. `ddgBy` maps the query string to a DDG body; `wiki`/`ext` are the two wiki replies.
function stub({ ddgBy = {}, wiki = null, ext = null, fail = false } = {}) {
  const calls = [];
  const get = async (url) => {
    calls.push(url);
    if (fail) throw new Error("network down");
    if (url.includes("duckduckgo")) return ddgBy[q(url)] ?? null;
    if (url.includes("list=search")) return wiki;
    if (url.includes("prop=extlinks")) return ext;
    return null;
  };
  return { get, calls };
}

test("registrableDomain: subdomains and www collapse; multi-part suffixes keep three labels", () => {
  assert.equal(registrableDomain("https://www.example.org/a"), "example.org");
  assert.equal(registrableDomain("https://data.example.org/a"), "example.org");
  assert.equal(registrableDomain("https://www.ons.gov.uk/x"), "ons.gov.uk");
  assert.equal(registrableDomain("https://news.bbc.co.uk/x"), "bbc.co.uk");
  assert.equal(registrableDomain("//cdn.example.net/a.png"), "example.net");
});

test("registrableDomain: empty, malformed, missing, non-http, IP and host-less values are rejected", () => {
  for (const bad of [undefined, null, "", "   ", "not a url", "mailto:a@b.com", "ftp://example.org", "javascript:alert(1)", "http://localhost/x", "http://127.0.0.1/x", "https://", "http://[::1]/x", 42, {}]) {
    assert.equal(registrableDomain(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});

test("independentDomains: duplicates and same-domain URLs count once; machinery and resolvers never count", () => {
  const out = independentDomains([
    "https://example.org/a", "https://www.example.org/b", "https://data.example.org/c",
    "https://web.archive.org/web/1/https://example.org", "https://doi.org/10.1/x", "https://commons.wikimedia.org/x",
    "https://www.wikidata.org/wiki/Q1", "https://duckduckgo.com/?q=x", "garbage", "",
  ]);
  assert.deepEqual(out, ["example.org"]);
});

test("urlsFromDuckDuckGo: reads AbstractURL, Results and nested RelatedTopics; ignores other shapes", () => {
  const body = {
    AbstractURL: "https://a.org/x",
    Results: [{ FirstURL: "https://b.org/y" }, { FirstURL: 7 }, null],
    RelatedTopics: [{ FirstURL: "https://c.org/z" }, { Name: "g", Topics: [{ FirstURL: "https://d.org/w" }] }, "str"],
  };
  assert.deepEqual(urlsFromDuckDuckGo(body), ["https://a.org/x", "https://b.org/y", "https://c.org/z", "https://d.org/w"]);
  for (const odd of [null, undefined, "x", 5, [], { Results: "no", RelatedTopics: 3 }]) assert.deepEqual(urlsFromDuckDuckGo(odd), []);
});

test("urlsFromWikipediaExtlinks: both formatversion shapes, protocol-relative links kept, odd shapes ignored", () => {
  const v2 = { query: { pages: [{ extlinks: [{ url: "https://a.org/x" }, { url: 5 }] }, { title: "no links" }] } };
  const v1 = { query: { pages: { 12: { extlinks: [{ "*": "//b.org/y" }] } } } };
  assert.deepEqual(urlsFromWikipediaExtlinks(v2), ["https://a.org/x"]);
  assert.deepEqual(urlsFromWikipediaExtlinks(v1), ["//b.org/y"]);
  for (const odd of [null, {}, { query: {} }, { query: { pages: "x" } }]) assert.deepEqual(urlsFromWikipediaExtlinks(odd), []);
});

test("two independent domains from DuckDuckGo alone pass (the original TDZ crash path)", async () => {
  const { get } = stub({ ddgBy: { "Emergency fund median savings": ddg("https://www.example.org/a"), "Emergency fund median savings study": ddg("https://data.example.net/b") } });
  const r = await checkTwoDomains(topic, get);
  assert.equal(r.status, "ok");
  assert.equal(r.pass, true);
  assert.deepEqual(r.domains.sort(), ["example.net", "example.org"]);
});

test("DuckDuckGo giving only the encyclopedia is topped up by the articles' cited references", async () => {
  const { get, calls } = stub({
    ddgBy: { "Emergency fund median savings": ddg("https://en.wikipedia.org/wiki/Emergency_fund") },
    wiki: { query: { search: [{ title: "Emergency fund" }, { title: "Savings account" }] } },
    ext: { query: { pages: [{ extlinks: [{ url: "https://www.federalreserve.gov/report.pdf" }, { url: "https://web.archive.org/x" }] }] } },
  });
  const r = await checkTwoDomains(topic, get);
  assert.equal(r.status, "ok");
  assert.deepEqual(r.domains.sort(), ["federalreserve.gov", "wikipedia.org"]);
  assert.ok(calls.some((u) => u.includes("prop=extlinks")), "the reference lookup ran");
});

test("only one independent domain, however many URLs it has, is 'insufficient'", async () => {
  const { get } = stub({
    ddgBy: { "Emergency fund median savings": ddg("https://www.example.org/a", { Results: [{ FirstURL: "https://example.org/b" }, { FirstURL: "https://sub.example.org/c" }] }) },
    wiki: { query: { search: [] } },
  });
  const r = await checkTwoDomains(topic, get);
  assert.equal(r.status, "insufficient");
  assert.equal(r.pass, false);
  assert.deepEqual(r.domains, ["example.org"]);
});

test("no results at all, from lookups that did answer, is 'insufficient' with zero domains", async () => {
  const r = await checkTwoDomains({ topic: "Nothing", angle: "" }, async (u) => (u.includes("duckduckgo") ? {} : { query: { search: [] } }));
  assert.equal(r.status, "insufficient");
  assert.deepEqual(r.domains, []);
});

test("network failure is 'lookup_failed', not a silent zero-domain verdict, and never throws", async () => {
  const { get } = stub({ fail: true });
  const r = await checkTwoDomains(topic, get);
  assert.equal(r.status, "lookup_failed");
  assert.equal(r.pass, false);
  assert.equal(r.answered, 0);
  assert.ok(r.lookups > 0);
});

test("unexpected response formats (strings, arrays, numbers) are survived as 'lookup_failed'", async () => {
  for (const body of ["<html>blocked</html>", 42, null, undefined, true]) {
    const r = await collectSourceDomains(topic, async () => body);
    assert.equal(r.pass, false, `body ${JSON.stringify(body)}`);
    assert.ok(["lookup_failed", "insufficient"].includes(r.status));
  }
});

test("a topic with no text at all is 'lookup_failed' without any lookup", async () => {
  const { get, calls } = stub();
  const r = await collectSourceDomains({}, get);
  assert.equal(r.status, "lookup_failed");
  assert.equal(calls.length, 0);
});

test("stops asking once two domains are found (no needless lookups)", async () => {
  const { get, calls } = stub({ ddgBy: { "Emergency fund median savings": ddg("https://a.org/x", { Results: [{ FirstURL: "https://b.org/y" }] }) } });
  const r = await checkTwoDomains(topic, get);
  assert.equal(r.status, "ok");
  assert.equal(calls.length, 1);
});
