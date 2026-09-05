// Scratch: verify installed remotion version + Layer.jsx line count (erratum checks).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url)); // data/audit/7
const root = path.join(here, "..", "..", ".."); // YOUTUBE

const require = createRequire(import.meta.url);
const pkg = require("remotion/package.json");
console.log("node_modules/remotion version:", pkg.version);

const lock = fs.readFileSync(path.join(root, "package-lock.json"), "utf8");
const m = lock.match(/"node_modules\/remotion":\s*\{\s*"version":\s*"([^"]+)"/);
console.log("package-lock node_modules/remotion:", m ? m[1] : "not found");
const m2 = lock.match(/"remotion":\s*\{\s*"version":\s*"([^"]+)"/);
console.log("package-lock top remotion:", m2 ? m2[1] : "not found");

const layerPath = path.join(root, "src", "skills", "remotion-render", "layers", "Layer.jsx");
const layer = fs.readFileSync(layerPath, "utf8");
console.log("Layer.jsx lines (split \\n):", layer.split("\n").length);
console.log("Layer.jsx bytes:", Buffer.byteLength(layer));

const dist = fs.readFileSync(
  path.join(root, "node_modules", "remotion", "dist", "esm", "index.mjs"),
  "utf8"
);
console.log('dist mentions "perceptual-scale":', (dist.match(/perceptual-scale/g) || []).length);
