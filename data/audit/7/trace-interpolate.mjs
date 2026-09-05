// Trace where remotion's interpolate comes from and whether it supports output:'perceptual-scale'
import { readFileSync } from "fs";

const s = readFileSync("node_modules/remotion/dist/esm/index.mjs", "utf8");
const re = /from ["']@remotion\/[a-z-]+["']/g;
const ims = s.match(re) || [];
console.log("=== remotion/dist/esm/index.mjs imports ===");
console.log(ims.join("\n"));

const ex = s.match(/export \{[^}]*interpolate[^}]*\}/);
console.log("=== export line containing interpolate ===");
console.log(ex ? ex[0].slice(0, 800) : "no export line");
