/**
 * An entity named only INSIDE a longer entity's name in the same sentence is part of that name, not a second subject
 * (board 38044082797 ch 2, beat 8: "the San Francisco Anti-Displacement Coalition" named an organization AND a place; the place found a
 * stock skyline photo, the gate counted the beat as drawn, and the organization was never shown — the entity check then failed the
 * video). Dropped here, the organization is the beat's only subject and gets its own mark or its name in type.
 *
 * It only drops an entity when its longer container appears VERBATIM in the sentence and the shorter name is nowhere outside it. A place the
 * sentence also names on its own ("...Coalition, in San Francisco") stays.
 */
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function dropContainedEntities(entities, sentence = "") {
  const text = ` ${norm(sentence)} `;
  return entities.filter((e) => {
    const n = norm(e?.name);
    if (!n) return true;
    const containers = entities.filter((f) => f !== e && norm(f?.name).length > n.length && ` ${norm(f.name)} `.includes(` ${n} `) && text.includes(` ${norm(f.name)} `));
    if (!containers.length) return true;
    let rest = text;
    for (const f of containers) rest = rest.split(` ${norm(f.name)} `).join(" ");
    return rest.includes(` ${n} `);
  });
}
