import React from "react";

/**
 * PROCEDURAL OBJECTS — the things a template's `core_objects` actually draw.
 *
 * Section 4.1 permits exactly three kinds of visual: real photographs from the
 * approved sources, PROCEDURAL GRAPHICS, and typography. No generative AI. The
 * photo path is unreachable (all four asset APIs return 000 from here and no
 * keys are set), so these are procedural — and procedural is not a compromise
 * here, it is the second-ranked option in the addendum's own hierarchy.
 *
 * THE RULE EVERY OBJECT IN THIS FILE FOLLOWS. A bank statement is drawn as a
 * sheet of paper with ruled entries and a torn perforation. It is not a
 * rounded rectangle with the word "STATEMENT" on it. The whole complaint that
 * started this rebuild was that the renderer turned every idea into a labelled
 * box, so an object whose identity depends on its label is not an object.
 *
 * Every object takes the same contract: a resolved box in frame pixels, the
 * channel's palette, and `p` from 0 to 1 for how far into the beat it is. None
 * of them decides where it sits or how big it is; the plan does.
 */

const OBJECTS = {};
export const registerObject = (name, fn) => { OBJECTS[name] = fn; };
export const hasObject = (name) => Boolean(OBJECTS[name]);
export const knownObjects = () => Object.keys(OBJECTS).sort();

/**
 * Draw one object, or throw. Section 3 forbids a fallback for a missing
 * template, and the same reasoning applies one level down: silently drawing
 * nothing where an object should be is how a scene quietly becomes empty.
 */
export function ObjectShape({ name, box, colors, p = 1 }) {
  const fn = OBJECTS[name];
  if (!fn) {
    throw new Error(
      `no procedural drawing for object "${name}". Known: ${knownObjects().join(", ")}.\n` +
      `Section 3's no-fallback rule applies here too: a scene must not quietly omit its subject.`
    );
  }
  return fn({ box, colors, p });
}

// ─────────────────────────────────────────────────────────────────────────────
// ch-01 — the desk. Paper, ruled lines, a keypad. Nothing here is a card.
// ─────────────────────────────────────────────────────────────────────────────

registerObject("bank statement", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const rows = 7;
  return (
    <g>
      {/* the sheet, with one corner turned so it reads as paper on a surface */}
      <path
        d={`M${x},${y} L${x + w - h * 0.12},${y} L${x + w},${y + h * 0.12} L${x + w},${y + h} L${x},${y + h} Z`}
        fill={colors.paper} stroke={colors.ink} strokeWidth={1.5} strokeOpacity={0.35}
      />
      <path d={`M${x + w - h * 0.12},${y} L${x + w - h * 0.12},${y + h * 0.12} L${x + w},${y + h * 0.12}`}
        fill="none" stroke={colors.ink} strokeWidth={1.5} strokeOpacity={0.35} />
      {/* the perforated stub every printed statement has down one edge */}
      {Array.from({ length: 12 }).map((_, i) => (
        <circle key={i} cx={x + w * 0.055} cy={y + h * (0.08 + i * 0.075)} r={Math.max(1, h * 0.008)}
          fill={colors.ink} opacity={0.18} />
      ))}
      {/* ruled entries, arriving in order so the sheet fills as the beat runs */}
      {Array.from({ length: rows }).map((_, i) => {
        const a = Math.max(0, Math.min(1, p * rows - i));
        if (a <= 0) return null;
        const ry = y + h * (0.24 + i * 0.1);
        return (
          <g key={i} opacity={a}>
            <rect x={x + w * 0.14} y={ry} width={w * 0.44 * a} height={Math.max(1.5, h * 0.012)} fill={colors.ink} opacity={0.5} />
            <rect x={x + w * 0.7} y={ry} width={w * 0.16} height={Math.max(1.5, h * 0.012)} fill={colors.accent} opacity={0.85} />
          </g>
        );
      })}
    </g>
  );
});

registerObject("calculator", ({ box, colors }) => {
  const { x, y, w, h } = box;
  const keyW = w * 0.2, keyH = h * 0.11;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={w * 0.06} fill={colors.onGround} opacity={0.1} />
      <rect x={x} y={y} width={w} height={h} rx={w * 0.06} fill="none" stroke={colors.onGround} strokeWidth={2} strokeOpacity={0.4} />
      {/* the display: a recessed strip, not a text box */}
      <rect x={x + w * 0.1} y={y + h * 0.07} width={w * 0.8} height={h * 0.16} rx={2}
        fill={colors.onGround} opacity={0.22} />
      {Array.from({ length: 4 }).map((_, r) =>
        Array.from({ length: 4 }).map((_, c) => (
          <rect key={`${r}-${c}`}
            x={x + w * 0.1 + c * keyW * 1.0} y={y + h * 0.32 + r * keyH * 1.5}
            width={keyW * 0.78} height={keyH} rx={2}
            fill={colors.onGround} opacity={r === 3 && c === 3 ? 0 : 0.28} />
        ))
      )}
      <rect x={x + w * 0.1 + 3 * keyW} y={y + h * 0.32 + 3 * keyH * 1.5}
        width={keyW * 0.78} height={keyH} rx={2} fill={colors.accent} opacity={0.9} />
    </g>
  );
});

registerObject("ledger notebook", ({ box, colors }) => {
  const { x, y, w, h } = box;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={colors.paper} stroke={colors.ink} strokeWidth={1.5} strokeOpacity={0.3} />
      {/* the spiral binding is what makes it a notebook rather than a page */}
      {Array.from({ length: 9 }).map((_, i) => (
        <rect key={i} x={x - w * 0.03} y={y + h * (0.06 + i * 0.1)} width={w * 0.09} height={Math.max(2, h * 0.014)}
          rx={2} fill={colors.ink} opacity={0.45} />
      ))}
      {/* a ruled column, the thing a ledger is */}
      <line x1={x + w * 0.62} y1={y + h * 0.05} x2={x + w * 0.62} y2={y + h * 0.95}
        stroke={colors.accent} strokeWidth={1.5} opacity={0.6} />
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={i} x1={x + w * 0.14} y1={y + h * (0.14 + i * 0.1)} x2={x + w * 0.88} y2={y + h * (0.14 + i * 0.1)}
          stroke={colors.ink} strokeWidth={1} opacity={0.2} />
      ))}
    </g>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ch-02 — the file. Set type, a folder tab, a highlighted clause.
// ─────────────────────────────────────────────────────────────────────────────

registerObject("legal document", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const lines = 14;
  // The clause the camera comes for. Which line is highlighted is fixed by the
  // template's own composition, not chosen at render time.
  const clause = 8;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={colors.paper} stroke={colors.ink} strokeWidth={1.5} strokeOpacity={0.3} />
      {/* a numbered margin: legal instruments are line-numbered */}
      {Array.from({ length: lines }).map((_, i) => (
        <rect key={`n${i}`} x={x + w * 0.05} y={y + h * (0.1 + i * 0.058)} width={w * 0.02} height={Math.max(1, h * 0.008)}
          fill={colors.ink} opacity={0.35} />
      ))}
      {Array.from({ length: lines }).map((_, i) => {
        const isClause = i === clause;
        const len = isClause ? 0.74 : 0.62 + ((i * 37) % 23) / 100;
        return (
          <g key={i}>
            {isClause && (
              <rect x={x + w * 0.1} y={y + h * (0.1 + i * 0.058) - h * 0.012}
                width={w * len * Math.max(0, Math.min(1, p * 2))} height={h * 0.032}
                fill={colors.accent} opacity={0.22} />
            )}
            <rect x={x + w * 0.11} y={y + h * (0.1 + i * 0.058)} width={w * len} height={Math.max(1.5, h * 0.009)}
              fill={isClause ? colors.accent : colors.ink} opacity={isClause ? 0.9 : 0.42} />
          </g>
        );
      })}
    </g>
  );
});

registerObject("case file folder", ({ box, colors }) => {
  const { x, y, w, h } = box;
  const tabW = w * 0.3;
  return (
    <g>
      {/* the tab is the whole reason a folder reads as a folder */}
      <path d={`M${x},${y + h * 0.14} L${x + tabW * 0.08},${y} L${x + tabW},${y} L${x + tabW * 1.08},${y + h * 0.14} Z`}
        fill={colors.ink} opacity={0.34} />
      <rect x={x} y={y + h * 0.14} width={w} height={h * 0.86} rx={4} fill={colors.ink} opacity={0.26} />
      <rect x={x} y={y + h * 0.14} width={w} height={h * 0.86} rx={4} fill="none"
        stroke={colors.ink} strokeWidth={2} strokeOpacity={0.45} />
      <line x1={x + w * 0.06} y1={y + h * 0.07} x2={x + tabW * 0.9} y2={y + h * 0.07}
        stroke={colors.accent} strokeWidth={3} opacity={0.8} />
    </g>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ch-09 — the map. Terrain, a drawn border, a fill, a date.
//
// Everything below draws STRAIGHT ONTO THE ENVIRONMENT GROUND — a map has no
// sheet of paper under it — so every mark here uses `onGround`, not `ink`.
// Drawn with `ink` these rendered #050F1A on a #050F1A ground: a frame with a
// subject in it that was, pixel for pixel, an empty background.
// ─────────────────────────────────────────────────────────────────────────────

/** One deterministic territory outline. Seeded, so a re-render is identical. */
function territoryPath(x, y, w, h, seed) {
  const n = 11;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wob = 0.62 + (((seed * (i + 3) * 2654435761) >>> 8) % 100) / 320;
    pts.push([x + w / 2 + Math.cos(a) * (w / 2) * wob, y + h / 2 + Math.sin(a) * (h / 2) * wob]);
  }
  return pts.map((pt, i) => `${i ? "L" : "M"}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(" ") + " Z";
}

registerObject("territory fill", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const d = territoryPath(x, y, w, h, 7);
  return (
    <g>
      <path d={d} fill={colors.accent} opacity={0.3 * Math.max(0, Math.min(1, p * 1.4))} />
      <path d={d} fill="none" stroke={colors.accent} strokeWidth={3} opacity={0.9} />
    </g>
  );
});

registerObject("national border line", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const d = territoryPath(x, y, w * 1.24, h * 1.24, 3);
  // The border DRAWS itself, which is the one motion ch-09's references name
  // as carrying a real factual change.
  return (
    <path
      d={d} fill="none" stroke={colors.onGround} strokeWidth={2.5} opacity={0.55}
      strokeDasharray="1400" strokeDashoffset={1400 * (1 - Math.max(0, Math.min(1, p)))}
    />
  );
});

registerObject("satellite terrain", ({ box, colors }) => {
  const { x, y, w, h } = box;
  const cells = 9;
  return (
    <g opacity={0.5}>
      {Array.from({ length: cells }).map((_, r) =>
        Array.from({ length: cells }).map((_, c) => {
          const v = ((r * 31 + c * 17) * 2654435761) >>> 24;
          return (
            <rect key={`${r}-${c}`}
              x={x + (c * w) / cells} y={y + (r * h) / cells}
              width={w / cells + 1} height={h / cells + 1}
              fill={colors.onGround} opacity={0.04 + (v % 40) / 620} />
          );
        })
      )}
      {/* two rivers, so the ground reads as land rather than a grid */}
      {[0.32, 0.68].map((f, i) => (
        <path key={i}
          d={`M${x},${y + h * f} Q${x + w * 0.3},${y + h * (f - 0.12)} ${x + w * 0.55},${y + h * (f + 0.05)} T${x + w},${y + h * (f - 0.04)}`}
          fill="none" stroke={colors.onGround} strokeWidth={2} opacity={0.16} />
      ))}
    </g>
  );
});

registerObject("date marker", ({ box, colors }) => {
  const { x, y, w, h } = box;
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + h} stroke={colors.accent} strokeWidth={3} opacity={0.9} />
      <rect x={x} y={y} width={w * 0.5} height={Math.max(3, h * 0.1)} fill={colors.accent} opacity={0.9} />
    </g>
  );
});
