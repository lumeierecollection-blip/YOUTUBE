import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./schema.mjs";

/** Prompts live in prompts/script-engine/<name>.md. {{key}} is replaced; a missing key is an error, never blank. */
export function prompt(name, vars = {}) {
  const text = readFileSync(join(ROOT, "prompts/script-engine", `${name}.md`), "utf8");
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`prompt ${name}: no value for {{${k}}}`);
    const v = vars[k];
    return typeof v === "string" ? v : JSON.stringify(v, null, 1);
  });
}
