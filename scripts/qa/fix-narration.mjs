#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
let c = readFileSync("scripts/qa/repetition-detector.mjs", "utf8");
c = c.replace(/b\.narration\.slice\(0,60\)/g, '(b.narration || b._narration || "").slice(0,60)');
writeFileSync("scripts/qa/repetition-detector.mjs", c);
console.log("fixed:", c.includes("_narration"));
