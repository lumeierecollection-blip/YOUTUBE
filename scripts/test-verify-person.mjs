#!/usr/bin/env node
// Unit tests for the person-photo gate: scripts/verify-person-image.cjs (the
// verdict rule, answer parsing) and scripts/entity-assets.cjs (candidate
// filters). No network, no model: the model's answers are given.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const V = require("./verify-person-image.cjs");
const E = require("./entity-assets.cjs");

let fail = 0;
const yes = (name, ok) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}`); if (!ok) fail++; };
const ans = (o) => V.normalize({ has_face: true, identity: "MATCH", framing: "PORTRAIT", face_fraction: 0.2, text_overlay: false, ...o });
const verdict = (o) => V.rejectReason(ans(o));

yes("a face, MATCH, PORTRAIT, face >= 15%, no text: passes", verdict({}) === null);
yes("UNSURE rejects", verdict({ identity: "UNSURE" }) === "UNSURE");
yes("NO_MATCH rejects", verdict({ identity: "NO_MATCH" }) === "NO_MATCH");
yes("SCENE rejects even when the face matches", verdict({ framing: "SCENE" }) === "SCENE");
yes("GROUP rejects even when the face matches", verdict({ framing: "GROUP" }) === "GROUP");
yes("no visible face rejects", verdict({ has_face: false }) === "no visible face");
yes("a face under 15% of the image rejects", /face covers/.test(verdict({ face_fraction: 0.08 })));
yes("a watermark / text overlay rejects", /watermark/.test(verdict({ text_overlay: true })));
yes("a missing face size rejects", verdict({ face_fraction: undefined }) === "face size not reported");
yes("YES / NO strings are read as booleans", V.normalize({ has_face: "YES", identity: "MATCH", framing: "PORTRAIT", face_fraction: 0.3, text_overlay: "false" }).has_face === true);
yes("a malformed answer is null (-> next provider, then reject)", V.normalize({ verdict: "looks right" }) === null && V.normalize({ source: "groq", error: "no_key" }) === null);
yes("an unknown identity value is malformed", V.normalize({ has_face: true, identity: "PROBABLY", framing: "PORTRAIT" }) === null);
yes("the prompt names the person and asks the three questions", /Person: Jerome Powell/.test(V.promptFor("Jerome Powell")) && /MATCH, NO_MATCH, or UNSURE/.test(V.promptFor("x")) && /PORTRAIT, SCENE, or GROUP/.test(V.promptFor("x")));

// Candidate filters (file names, before any download).
const info = (title, o = {}) => ({ title, mime: "image/jpeg", license: "Public domain", width: 900, height: 1200, ...o });
yes("an official portrait JPEG passes the file check", E.checkFile(info("File:Jerome H. Powell, Federal Reserve Chair.jpg")) === null);
yes("a painted portrait is refused", /artwork/.test(E.checkFile(info("File:Elon Musk, painted portrait DDC2289.jpg"))));
yes("a caricature / statue / wax figure is refused", ["File:X caricature.jpg", "File:X statue.jpg", "File:X wax figure.jpg"].every((t) => E.checkFile(info(t))));
yes("a file under 500 px is refused", /too small/.test(E.checkFile(info("File:X.jpg", { width: 300, height: 400 }))));
yes("a non-free file is refused", /not free/.test(E.checkFile(info("File:X.jpg", { license: "Non-free fair use" }))));

console.log(fail ? `${fail} FAILED` : "all pass");
process.exit(fail ? 1 : 0);
