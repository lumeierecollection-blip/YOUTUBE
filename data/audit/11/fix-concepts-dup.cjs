// Fix: merge the duplicated concepts bullets in prompts/style-contract.md.
const fs = require("fs");
const f = "prompts/style-contract.md";
let t = fs.readFileSync(f, "utf8");
const nl = t.includes("\r\n") ? "\r\n" : "\n";
const dup =
  "- Check your channel's `concepts` allocation (if given in context): primary" + nl +
  "  archetypes should be ≥50% of the video's beats, secondary ≤35%, excluded" + nl +
  "  archetypes 0%." + nl +
  "- Check your channel's `concepts` allocation (if given in context): primary" + nl +
  "  archetypes must be 50% or more of the video's beats, secondary 35% or" + nl +
  "  less, excluded 0%. Before finishing, COUNT the beats by archetype and" + nl +
  "  adjust the beat mix until the split meets these bounds — it's" + nl +
  "  gate-checked.";
const merged =
  "- Check your channel's `concepts` allocation (if given in context): primary" + nl +
  "  archetypes must be 50% or more of the video's beats, secondary 35% or" + nl +
  "  less, excluded 0%. Before finishing, COUNT the beats by archetype and" + nl +
  "  adjust the beat mix until the split meets these bounds — it's" + nl +
  "  gate-checked.";
if (!t.includes(dup)) {
  console.error("DUP BLOCK NOT FOUND — no change");
  process.exit(1);
}
t = t.replace(dup, merged);
fs.writeFileSync(f, t);
console.log("merged concepts bullets");
