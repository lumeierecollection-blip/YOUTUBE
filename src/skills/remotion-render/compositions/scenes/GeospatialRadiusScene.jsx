import React from "react";
import { useCurrentFrame } from "remotion";
import {
  CANVAS_W, CANVAS_H, STAGE_CX, GroundPlane, Label, Figure, MeasureBracket,
  ease, seeded, useStateProgress, EASE_OUT, EASE_IN_OUT,
} from "./primitives.jsx";
import { progressOf, reached } from "../../visual/states.js";

/**
 * GEOSPATIAL_RADIUS — the PART 10 / PART 23 hard gate.
 *
 * The narration this exists for:
 *   "Police used a geofence warrant to scan a 150 meter radius for
 *    anyone's phone near a crime."
 *
 * The old renderer showed:  150 / meters      (HeroNumberScene)
 * That is the DATA. It explains nothing about a geographic dragnet.
 *
 * What this shows, driven entirely by the visual states in
 * strategies.js -> states.js:
 *
 *   establish  ground plane resolves (real space, not a slide)
 *   origin     the event point lands on that ground
 *   expand     a radius grows outward from it
 *   lock       the boundary stops at the stated distance   <- ANCHOR
 *   populate   device markers appear across the area
 *   select     the ones INSIDE the boundary are caught, outside dimmed
 *   measure    the measurement resolves across the radius
 *
 * The number is a measurement label on a drawn radius (PART 6: the counter
 * is subordinate to the concept). Muting the narration still leaves:
 * a point, a boundary, and which devices fell inside it.
 */
export function GeospatialRadiusScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};

  const cx = STAGE_CX;
  const cy = 780;               // sits on the ground plane, not screen centre
  const maxR = 340;             // px at full lock — the drawn 150m
  const horizonY = 450;

  const pEstablish = useStateProgress(states, "establish");
  const pOrigin = useStateProgress(states, "origin");
  const pExpand = progressOf(states, "expand", frame);
  const pLock = progressOf(states, "lock", frame);
  const pPopulate = useStateProgress(states, "populate");
  const pSelect = useStateProgress(states, "select");
  const pMeasure = useStateProgress(states, "measure");
  const locked = reached(states, "lock", frame);

  // The radius grows during `expand`, then eases to a hard stop through
  // `lock`. After lock it does NOT keep breathing — a boundary that keeps
  // moving would say the area is still uncertain, which would be a lie.
  const growth = locked
    ? 0.86 + 0.14 * ease(pLock, EASE_OUT)
    : 0.86 * ease(pExpand, EASE_IN_OUT);
  const r = maxR * growth;

  // Perspective squash: the circle lies ON the ground, so it reads as an
  // ellipse, not a flat disc on a slide.
  const ry = r * 0.42;

  // Devices scattered over the ground. Stable positions (seeded), fixed
  // count, and each one's real distance from the origin decides whether it
  // is caught — the selection is geometry, not decoration.
  const devices = React.useMemo(() => {
    const out = [];
    for (let i = 0; i < 14; i++) {
      const ang = seeded(i * 7 + 1) * Math.PI * 2;
      const dist = 0.25 + seeded(i * 13 + 5) * 1.05; // in units of maxR
      out.push({
        i,
        dx: Math.cos(ang) * dist * maxR,
        dy: Math.sin(ang) * dist * maxR * 0.42,
        dist,
      });
    }
    return out;
  }, []);

  const strokeCol = colors.stroke;
  const accent = colors.accent;
  const dim = colors.textDim || colors.stroke;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <GroundPlane p={pEstablish} color={strokeCol} cx={cx} horizonY={horizonY} />

      <svg
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {/* The scanned area. Fill stays very low — this is a boundary, not
            a glowing blob (PART 17 bans meaningless glow). */}
        {pExpand > 0 ? (
          <>
            <ellipse
              cx={cx} cy={cy} rx={r} ry={ry}
              fill={accent}
              opacity={0.1 * ease(pExpand)}
            />
            <ellipse
              cx={cx} cy={cy} rx={r} ry={ry}
              fill="none"
              stroke={accent}
              strokeWidth={locked ? 4 : 2.5}
              strokeDasharray={locked ? "none" : "10 8"}
              opacity={0.55 + 0.45 * ease(pExpand)}
            />
          </>
        ) : null}

        {/* Sweep line while expanding — this represents the scan actually
            being performed, and it STOPS once the boundary locks. */}
        {pExpand > 0 && !locked ? (
          <line
            x1={cx} y1={cy}
            x2={cx + Math.cos(frame * 0.16) * r}
            y2={cy + Math.sin(frame * 0.16) * ry}
            stroke={accent} strokeWidth={2} opacity={0.5}
          />
        ) : null}

        {/* Origin: the event point. Lands before the radius exists. */}
        {pOrigin > 0 ? (
          <>
            <line
              x1={cx} y1={cy - 12 - 46 * ease(pOrigin)} x2={cx} y2={cy - 10}
              stroke={accent} strokeWidth={3} opacity={ease(pOrigin)}
            />
            <circle cx={cx} cy={cy} r={7} fill={accent} opacity={ease(pOrigin)} />
            <circle
              cx={cx} cy={cy - 58} r={9}
              fill="none" stroke={accent} strokeWidth={3}
              opacity={ease(pOrigin)}
            />
          </>
        ) : null}

        {/* Devices. Inside-the-boundary ones are picked out during `select`;
            outside ones fade back. The viewer sees WHO GOT CAUGHT. */}
        {devices.map((d) => {
          const appear = ease(Math.max(0, Math.min(1, pPopulate * 1.6 - d.i * 0.055)));
          if (appear <= 0.01) return null;
          const inside = d.dist * maxR <= r;
          const caught = inside && pSelect > 0;
          // Contrast, checked on a real rendered frame rather than assumed:
          // at 0.22 the un-caught markers were invisible against the dark
          // ground, so the frame read as "some devices" instead of "these
          // were caught, those were not" — which is the entire point of the
          // selection. Un-caught markers stay clearly present but plainly
          // secondary; caught markers get a light fill so they read against
          // the accent area wash underneath them.
          const opacity = appear * (pSelect > 0 ? (inside ? 1 : 0.45) : 0.8);
          const px = cx + d.dx;
          const py = cy + d.dy;
          return (
            <g key={d.i} opacity={opacity}>
              <rect
                x={px - 8} y={py - 12} width={16} height={24} rx={3}
                fill={caught ? colors.textPrimary : "none"}
                stroke={caught ? colors.textPrimary : dim}
                strokeWidth={caught ? 2 : 2.5}
              />
              {caught ? (
                <circle
                  cx={px} cy={py} r={15 + 10 * ease(pSelect)}
                  fill="none" stroke={colors.textPrimary} strokeWidth={1.5}
                  opacity={0.6 * (1 - ease(pSelect))}
                />
              ) : null}
            </g>
          );
        })}

        {/* The measured radius, drawn ON the boundary it measures. */}
        {pMeasure > 0 ? (
          <line
            x1={cx} y1={cy}
            x2={cx + r * ease(pMeasure)} y2={cy}
            stroke={accent} strokeWidth={2} strokeDasharray="6 6"
          />
        ) : null}
      </svg>

      {pMeasure > 0 ? (
        <MeasureBracket x1={cx} x2={cx + r} y={cy + ry + 42} color={accent} p={pMeasure} />
      ) : null}

      {/* Supporting measurement — appears only once the boundary exists,
          reading as a dimension on a drawing rather than a title card. */}
      {locked && Number.isFinite(sup.value) ? (
        <Figure
          x={cx + r / 2}
          y={cy + ry + 58}
          value={sup.value}
          unit={sup.unit && /^m$|met/i.test(String(sup.unit)) ? "m" : String(sup.unit || "")}
          p={Math.max(ease(pLock), pMeasure)}
          color={accent}
          size={54}
          align="center"
          fontFamily={fontFamily}
        />
      ) : null}

      {/* What the boundary is FOR. Small, tracked, never the hero. */}
      {pSelect > 0 ? (
        <Label
          x={cx}
          y={cy + ry + 130}
          text={
            devices.filter((d) => d.dist * maxR <= r).length +
            " " +
            String(sup.subjects && /phone|device/i.test(sup.subjects) ? "DEVICES" : "SUBJECTS") +
            " INSIDE THE BOUNDARY"
          }
          color={colors.textDim}
          size={26}
          weight={700}
          tracking={2.4}
          align="center"
          opacity={pSelect}
          fontFamily={fontFamily}
        />
      ) : null}
    </div>
  );
}

export default GeospatialRadiusScene;
