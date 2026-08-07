import fs from "node:fs";
const p = "src/skills/remotion-render/primitives";
let bad = 0;
for (const f of fs.readdirSync(p)) {
  const s = fs.readFileSync(p + "/" + f, "utf8");
  const flex = (s.match(/display:\s*["']?flex/g) || []).length;
  const shadow = (s.match(/boxShadow|dropShadow|filter:\s*g/i) || []).length;
  const grad = (s.match(/gradient/i) || []).length;
  const position = (s.match(/position\s*:\s*["']?(absolute|relative|fixed)/i) || []).length;
  console.log(`${f}: flex=${flex} shadow=${shadow} gradient=${grad} self-position=${position}`);
  if (flex + shadow + grad + position > 0) bad++;
}
console.log("primitives clean:", bad === 0);
