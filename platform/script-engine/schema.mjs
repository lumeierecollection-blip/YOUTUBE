/**
 * Validation against platform/contracts/*.schema.json. A small validator for the JSON-Schema subset those
 * contracts use (type, enum, required, properties, items, minItems, minimum, maximum, $ref to a sibling file),
 * so the engine and its tests run with no node_modules. unknownKeywords() reports any keyword it does not
 * implement; the test suite fails on that rather than letting a changed contract pass silently.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = join(ROOT, "platform/contracts");
const cache = new Map();
export const contract = (name) => {
  if (!cache.has(name)) cache.set(name, JSON.parse(readFileSync(join(DIR, `${name}.schema.json`), "utf8")));
  return cache.get(name);
};

const KNOWN = new Set(["$schema", "title", "description", "type", "enum", "required", "properties", "items", "minItems", "minimum", "maximum", "$ref"]);
export function unknownKeywords(schema, path = "#") {
  const out = [];
  if (!schema || typeof schema !== "object") return out;
  for (const [k, v] of Object.entries(schema)) {
    if (!KNOWN.has(k)) out.push(`${path}/${k}`);
    if (k === "properties") for (const [p, s] of Object.entries(v)) out.push(...unknownKeywords(s, `${path}/properties/${p}`));
    if (k === "items") out.push(...unknownKeywords(v, `${path}/items`));
  }
  return out;
}

const typeOk = (t, v) => [].concat(t).some((x) => (x === "array" ? Array.isArray(v) : x === "null" ? v === null : x === "object" ? !!v && typeof v === "object" && !Array.isArray(v) : x === "number" ? typeof v === "number" && Number.isFinite(v) : typeof v === x));

function walk(schema, value, path, errors) {
  if (schema.$ref) return walk(contract(schema.$ref.replace(/\.schema\.json$/, "")), value, path, errors);
  if (schema.type && !typeOk(schema.type, value)) return void errors.push(`${path}: expected ${[].concat(schema.type).join("|")}, got ${value === null ? "null" : Array.isArray(value) ? "array" : typeof value}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: "${value}" is not one of ${schema.enum.join(", ")}`);
  if (typeof value === "number") {
    if (schema.minimum != null && value < schema.minimum) errors.push(`${path}: ${value} < ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) errors.push(`${path}: ${value} > ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${path}: needs at least ${schema.minItems} items, has ${value.length}`);
    if (schema.items) value.forEach((v, i) => walk(schema.items, v, `${path}[${i}]`, errors));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const r of schema.required || []) if (!(r in value)) errors.push(`${path}: missing "${r}"`);
    for (const [k, s] of Object.entries(schema.properties || {})) if (k in value) walk(s, value[k], `${path}.${k}`, errors);
  }
}

/** Returns an array of problems; empty means valid. */
export function validate(name, value) {
  const errors = [];
  walk(contract(name), value, name, errors);
  return errors;
}
export const assertValid = (name, value) => {
  const e = validate(name, value);
  if (e.length) throw new Error(`${name} invalid:\n  ${e.slice(0, 12).join("\n  ")}`);
  return value;
};
