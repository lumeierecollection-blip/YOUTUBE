/**
 * LAYOUT-SYSTEM.md Part 2.2 — the English layer. A ShotSpec[] renders to a
 * one-line-per-layer review artifact, written to
 * `data/shots/<channel>/<slug>.shots.txt` on every run. A human or an agent
 * reads 40 lines and knows the whole video's layout without a renderer.
 *
 *   b07  PROGRESS  412+84
 *     kicker     in kicker                                  rise at 0
 *     chart      in stage, bottom-left                      build at anchor-4, fade at end-6
 *     headline   in headline, left, fit 84/64/2             rise at anchor+8, fade at end-6
 *
 * PURE. No React, no Remotion.
 */

const NONE = /^none$/i;

function locPart(layer) {
  const parts = [`in ${layer.slot}`];
  if (layer.align && layer.align !== "top-left") parts.push(layer.align);
  if (layer.fit) parts.push(`fit ${layer.fit.maxSize}/${layer.fit.minSize}/${layer.fit.maxLines}`);
  return parts.join(", ");
}

function motionPart(layer) {
  const parts = [];
  if (layer.enter && layer.enter.pattern && !NONE.test(layer.enter.pattern)) {
    parts.push(`${layer.enter.pattern.toLowerCase()} at ${layer.enter.atFrame}`);
  }
  if (layer.exit && layer.exit.pattern && !NONE.test(layer.exit.pattern)) {
    parts.push(`${layer.exit.pattern.toLowerCase()} at ${layer.exit.atFrame}`);
  }
  return parts.join(", ");
}

/**
 * Render ShotSpec[] → .shots.txt text. Blank line between shots, trailing
 * newline. Motion is right-aligned to one column per document so the artifact
 * reads as a table.
 */
export function shotsToEnglish(specs) {
  const lines = [];
  for (const spec of specs) {
    lines.push({ header: `${spec.id}  ${spec.archetype}  ${spec.startFrame}+${spec.durationInFrames}` });
    for (const layer of spec.layers) {
      lines.push({ left: `  ${layer.role.padEnd(10)}${locPart(layer)}`, motion: motionPart(layer) });
    }
    lines.push({ blank: true });
  }

  const motionCol = lines.filter((l) => l.motion).reduce((m, l) => Math.max(m, l.left.length + 3), 0);

  const out = [];
  for (const line of lines) {
    if (line.blank) {
      out.push("");
    } else if (line.header) {
      out.push(line.header);
    } else if (line.motion) {
      out.push(line.left.padEnd(motionCol) + line.motion);
    } else {
      out.push(line.left);
    }
  }
  return out.join("\n").replace(/\n+$/, "\n");
}
