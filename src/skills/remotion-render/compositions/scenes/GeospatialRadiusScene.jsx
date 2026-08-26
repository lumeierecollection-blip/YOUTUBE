import React from "react";
import { useCurrentFrame } from "remotion";
import {
  CANVAS_W, CANVAS_H, STAGE_CX, Label, Figure,
  ease, seeded, useStateProgress, EASE_OUT, EASE_IN_OUT,
} from "./primitives.jsx";
import { progressOf, reached } from "../../visual/states.js";

/**
 * GEOSPATIAL_RADIUS — a geofence warrant drawn on a map.
 *
 * The narration this exists for:
 *   "Police used a geofence warrant to scan a 150 meter radius for
 *    anyone's phone near a crime."
 *
 * WHAT THIS LOOKED LIKE BEFORE, TWICE
 *
 * The original renderer showed `150 / meters` on a card — the DATA, which
 * explains nothing about a geographic dragnet. The rewrite that replaced it
 * showed a perspective floor grid, an ellipse and fourteen scattered
 * rectangles. That was better only in the sense that it was spatial: read
 * cold, it is a grid, an oval and some squares. Nothing in it says CITY, so
 * nothing in it says what a 150-metre radius around a street corner
 * actually contains.
 *
 * WHAT IT DRAWS NOW
 *
 * A map, in plan view, the way anyone who has ever seen a geofence warrant
 * story has seen one: an irregular street network, city blocks, building
 * footprints, and a circle laid over it. The devices are pins standing on
 * BUILDINGS, not points floating in space, because that is where phones
 * are. The circle is a true circle, not an ellipse, because that is what a
 * radius looks like from above.
 *
 * DEPTH is layer order, which is how a real map has depth: block fills sit
 * under building footprints, which sit under the road casing, which sits
 * under the warrant overlay. Nothing is a "3D floor".
 *
 * THE CAMERA HAS A REASON. It opens tight on the incident — the scale at
 * which a crime is a single address — and pulls back as the boundary grows,
 * so the frame itself performs the point: the search is far bigger than the
 * thing it is searching for. It stops when the boundary locks and does not
 * drift afterwards.
 *
 * The 150 stays a DIMENSION on a drawn radius, at supporting scale, never a
 * title card (PART 6). Muted, the frame still says: this corner, this
 * boundary, these buildings inside it.
 *
 * States (strategies.js -> states.js) drive all of it:
 *   establish  the map resolves
 *   origin     the incident pin lands on a specific corner
 *   expand     the boundary grows outward, camera pulls back
 *   lock       it stops at the stated distance            <- ANCHOR
 *   populate   device pins appear across the neighbourhood
 *   select     the ones inside are picked out, outside dimmed
 *   measure    the radius is dimensioned
 */

// Map geometry, in design-space px.
//
// Sized so the network still covers the 1080x1920 frame at the WIDEST point
// of the camera move, after the -7 degree rotation: the first render pulled
// back past the edge of the generated city and put a black wedge in the
// bottom-right corner. 3600 is the diagonal of the frame at minimum zoom
// plus rotation slack.
const MAP_W = 3600;
const MAP_H = 3600;
const LOCK_RADIUS = 300; // drawn px at full lock — this is the "150 m"

/**
 * A deterministic street network.
 *
 * Irregular ON PURPOSE: evenly spaced lines are a grid, and a grid is what
 * the previous version was criticised for. Real street spacing varies, so
 * each avenue and street is offset by a seeded jitter, and one diagonal
 * arterial cuts across — the single most recognisable feature of a street
 * map that is not a lattice.
 *
 * Pure and memoised by the scene: positions must be identical on every
 * frame and every re-render, so nothing here may use Math.random.
 */
function buildStreets() {
  const avenues = [];
  for (let x = -MAP_W / 2, i = 0; x < MAP_W / 2; i++) {
    // Every fourth is an arterial: wider, and spaced further out.
    const arterial = i % 4 === 0;
    avenues.push({ x, arterial });
    x += (arterial ? 250 : 150) + seeded(i * 3 + 11) * 90;
  }
  const streets = [];
  for (let y = -MAP_H / 2, i = 0; y < MAP_H / 2; i++) {
    const arterial = i % 5 === 0;
    streets.push({ y, arterial });
    y += (arterial ? 230 : 140) + seeded(i * 7 + 23) * 80;
  }
  return { avenues, streets };
}

/**
 * Building footprints, one to three per block, inset from the roads.
 *
 * Blocks vary in how built-up they are (a few are left as open ground)
 * because a map where every block is identically filled reads as a texture
 * rather than a place.
 */
function buildBuildings({ avenues, streets }) {
  const out = [];
  let n = 0;
  for (let a = 0; a < avenues.length - 1; a++) {
    for (let s = 0; s < streets.length - 1; s++) {
      const x0 = avenues[a].x + 16;
      const x1 = avenues[a + 1].x - 16;
      const y0 = streets[s].y + 16;
      const y1 = streets[s + 1].y - 16;
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (bw < 40 || bh < 40) continue;
      n += 1;
      const density = seeded(n * 5 + 3);
      if (density < 0.18) continue; // open block — a park, a lot, a gap

      // One big footprint, or two or three smaller ones sharing the block.
      const split = density > 0.72 ? 3 : density > 0.42 ? 2 : 1;
      for (let k = 0; k < split; k++) {
        const pad = 6;
        const cellW = bw / split;
        const bx = x0 + k * cellW + pad;
        const by = y0 + pad;
        const w = cellW - pad * 2 - seeded(n * 11 + k) * (cellW * 0.22);
        const h = bh - pad * 2 - seeded(n * 17 + k) * (bh * 0.3);
        if (w < 14 || h < 14) continue;
        out.push({ x: bx, y: by, w, h, id: out.length });
      }
    }
  }
  return out;
}

export function GeospatialRadiusScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};

  // Optical centre of the stage band, not of the screen.
  const cx = STAGE_CX;
  const cy = 760;

  const pEstablish = useStateProgress(states, "establish");
  const pOrigin = useStateProgress(states, "origin");
  const pExpand = progressOf(states, "expand", frame);
  const pLock = progressOf(states, "lock", frame);
  const pPopulate = useStateProgress(states, "populate");
  const pSelect = useStateProgress(states, "select");
  const pMeasure = useStateProgress(states, "measure");
  const locked = reached(states, "lock", frame);

  const { avenues, streets } = React.useMemo(buildStreets, []);
  const buildings = React.useMemo(() => buildBuildings({ avenues, streets }), [avenues, streets]);

  // The boundary grows through `expand`, then eases to a hard stop through
  // `lock`. It does not keep breathing afterwards: a boundary still moving
  // would say the area is still uncertain, which would be a lie about what
  // a warrant is.
  const growth = locked ? 0.84 + 0.16 * ease(pLock, EASE_OUT) : 0.84 * ease(pExpand, EASE_IN_OUT);
  const r = LOCK_RADIUS * growth;

  // CAMERA. Opens at the scale of one address, pulls back as the boundary
  // grows, holds once it locks. The move is the argument, so it is tied to
  // the same progress the boundary is.
  const pullBack = locked ? 1 : ease(pExpand, EASE_IN_OUT);
  // 1.45 down to 0.95. An earlier 1.9 opening was too tight to read as a
  // neighbourhood at all — at that scale a city block fills a third of the
  // frame and the map looks like abstract rectangles, which is the exact
  // failure this rewrite exists to fix.
  const zoom = 1.45 - 0.5 * pullBack;

  // Slight rotation so the network never reads as a lattice aligned to the
  // frame. Real cities are not square to a phone screen.
  const rotation = -7;

  const road = colors.stroke;
  const accent = colors.accent;

  // VALUE HIERARCHY, all from one ink at three opacities.
  //
  // Not colors.surface / colors.raised: in this token system both resolve to
  // the same flat #000000 as the background (styles/tokens.js), so a block
  // painted with `surface` would be invisible and the map would silently
  // lose its ground. Opacity off the stroke ink is the only thing that
  // actually separates ground from building from road here, and it matches
  // how a dark-mode map is read — roads lightest, buildings above the
  // ground, ground barely above the page.
  const GROUND_ALPHA = 0.055;
  const BUILDING_ALPHA = 0.2;

  // Devices stand on buildings — that is where phones are. Deterministic
  // pick, stable across frames.
  //
  // Weighted toward the incident, not spread evenly. Sampling buildings
  // uniformly across a 3600px map put three pins inside a 300px circle,
  // which draws the opposite of the point: a geofence warrant is
  // objectionable precisely BECAUSE it sweeps up a crowd. Density falling
  // off with distance is also the honest shape — an incident happens where
  // people are.
  const devices = React.useMemo(() => {
    if (buildings.length === 0) return [];
    const near = buildings.filter((b) => Math.hypot(b.x + b.w / 2, b.y + b.h / 2) <= LOCK_RADIUS * 1.15);
    const wide = buildings.filter((b) => {
      const d = Math.hypot(b.x + b.w / 2, b.y + b.h / 2);
      return d > LOCK_RADIUS * 1.15 && d <= LOCK_RADIUS * 4;
    });
    const picked = [];
    const take = (pool, count, salt) => {
      if (pool.length === 0) return;
      for (let k = 0; k < count; k++) {
        const i = picked.length;
        const b = pool[Math.floor(seeded(i * 31 + salt) * pool.length)];
        if (!b) continue;
        const x = b.x + b.w * (0.25 + seeded(i * 13 + 2) * 0.5);
        const y = b.y + b.h * (0.25 + seeded(i * 19 + 5) * 0.5);
        picked.push({ i, x, y, dist: Math.hypot(x, y) });
      }
    };
    take(near, 16, 7);
    take(wide, 18, 41);
    return picked;
  }, [buildings]);

  const caughtCount = devices.filter((d) => d.dist <= LOCK_RADIUS).length;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {/* Everything spatial lives in one transform: the camera move and
            the map rotation are applied once, so nothing can drift out of
            register with anything else. */}
        <g transform={`translate(${cx} ${cy}) scale(${zoom}) rotate(${rotation})`}>
          {/* ── background: block fills ─────────────────────────────── */}
          <g opacity={pEstablish}>
            {avenues.slice(0, -1).map((a, i) =>
              streets.slice(0, -1).map((s, j) => (
                <rect
                  key={`b${i}-${j}`}
                  x={a.x} y={s.y}
                  width={avenues[i + 1].x - a.x}
                  height={streets[j + 1].y - s.y}
                  fill={road}
                  opacity={GROUND_ALPHA}
                />
              ))
            )}
          </g>

          {/* ── midground: building footprints ──────────────────────── */}
          <g opacity={0.9 * pEstablish}>
            {buildings.map((b) => (
              <rect
                key={b.id}
                x={b.x} y={b.y} width={b.w} height={b.h}
                fill={road}
                opacity={BUILDING_ALPHA}
              />
            ))}
          </g>

          {/* ── roads. Drawn OVER the blocks, which is what makes them
                 read as streets between buildings rather than lines on
                 top of a texture. ──────────────────────────────────── */}
          <g opacity={pEstablish}>
            {avenues.map((a, i) => (
              <line
                key={`av${i}`}
                x1={a.x} y1={-MAP_H / 2} x2={a.x} y2={MAP_H / 2}
                stroke={road}
                strokeWidth={a.arterial ? 13 : 7}
                opacity={a.arterial ? 0.55 : 0.38}
              />
            ))}
            {streets.map((s, i) => (
              <line
                key={`st${i}`}
                x1={-MAP_W / 2} y1={s.y} x2={MAP_W / 2} y2={s.y}
                stroke={road}
                strokeWidth={s.arterial ? 13 : 7}
                opacity={s.arterial ? 0.55 : 0.38}
              />
            ))}
            {/* The diagonal arterial. One line, and the map stops being a
                lattice. Routed to pass WELL CLEAR of the origin: on the
                first render it cut straight across the radius dimension and
                the "150 m" sat unreadably on top of it. */}
            <line
              x1={-MAP_W / 2} y1={MAP_H / 2 - 200}
              x2={MAP_W / 2} y2={-MAP_H / 2 + 1500}
              stroke={road} strokeWidth={16} opacity={0.5}
            />
          </g>

          {/* ── foreground: the warrant overlay ─────────────────────── */}
          {pExpand > 0 ? (
            <>
              <circle
                cx={0} cy={0} r={r}
                fill={accent}
                opacity={0.13 * ease(pExpand)}
              />
              <circle
                cx={0} cy={0} r={r}
                fill="none"
                stroke={accent}
                strokeWidth={locked ? 4.5 / zoom : 3 / zoom}
                strokeDasharray={locked ? "none" : `${14 / zoom} ${10 / zoom}`}
                opacity={0.6 + 0.4 * ease(pExpand)}
              />
            </>
          ) : null}

          {/* Device pins. Inside the boundary they are picked out during
              `select`; outside they fall back. The viewer sees WHO IS IN
              RANGE without reading a word. */}
          {devices.map((d) => {
            const appear = ease(Math.max(0, Math.min(1, pPopulate * 1.7 - d.i * 0.035)));
            if (appear <= 0.01) return null;
            const inside = d.dist <= r;
            const caught = inside && pSelect > 0;
            // Contrast checked on a rendered frame, not assumed: markers
            // faded too far vanish against the block fill, and the frame
            // then reads as "some devices" instead of "these are inside,
            // those are not" — which is the entire point of the selection.
            const opacity = appear * (pSelect > 0 ? (inside ? 1 : 0.4) : 0.75);
            const s = 1 / zoom; // pins keep a constant on-screen size
            return (
              <g
                key={d.i}
                transform={`translate(${d.x} ${d.y}) rotate(${-rotation}) scale(${s})`}
                opacity={opacity}
              >
                {/* A map pin, not a square: teardrop over its own point. */}
                <path
                  d="M 0 0 L -7 -13 A 9 9 0 1 1 7 -13 Z"
                  fill={caught ? colors.textPrimary : "none"}
                  stroke={caught ? colors.textPrimary : colors.textDim || road}
                  strokeWidth={2}
                />
                <circle cx={0} cy={-17} r={3.2} fill={caught ? colors.bg : "none"} />
                {caught ? (
                  <circle
                    cx={0} cy={0} r={14 + 16 * ease(pSelect)}
                    fill="none" stroke={colors.textPrimary} strokeWidth={1.5}
                    opacity={0.55 * (1 - ease(pSelect))}
                  />
                ) : null}
              </g>
            );
          })}

          {/* The incident. A pin like the devices, but accent-coloured,
              landed first, and half again their size — it is the one
              address the whole search hangs off, so it must read as the
              subject and not as another device. */}
          {pOrigin > 0 ? (
            <g transform={`rotate(${-rotation}) scale(${1.5 / zoom})`} opacity={ease(pOrigin)}>
              <path
                d="M 0 0 L -10 -19 A 13 13 0 1 1 10 -19 Z"
                fill={accent}
                stroke={accent}
                strokeWidth={2}
              />
              <circle cx={0} cy={-24} r={4.5} fill={colors.bg} />
            </g>
          ) : null}

          {/* The measured radius, drawn ON the boundary it measures, from
              the incident outward. */}
          {pMeasure > 0 ? (
            <line
              x1={0} y1={0} x2={r * ease(pMeasure)} y2={0}
              stroke={accent}
              strokeWidth={2.5 / zoom}
              strokeDasharray={`${8 / zoom} ${8 / zoom}`}
            />
          ) : null}
        </g>
      </svg>

      {/* Supporting measurement. Appears only once the boundary exists, and
          sits on the radius it dimensions — a figure on a drawing, not a
          title card. Screen-space, so the camera never stretches it, and
          haloed because it is set over map detail: on the first render the
          unit glyph disappeared into a building footprint. */}
      {locked && Number.isFinite(sup.value) ? (
        <Figure
          x={cx + (r * zoom) / 2}
          y={cy - 74}
          value={sup.value}
          unit={sup.unit && /^m$|met/i.test(String(sup.unit)) ? "m" : String(sup.unit || "")}
          p={Math.max(ease(pLock), pMeasure)}
          color={accent}
          halo={colors.bg}
          size={52}
          align="center"
          fontFamily={fontFamily}
        />
      ) : null}

      {/* What the boundary caught. Small, tracked, never the hero — but
          textPrimary, not textDim: over building fills textDim measured
          well under the contrast floor on a rendered frame and the count
          could not be read at all. Positioned off the DRAWN radius so it
          stays clear of the circle at every point of the camera move. */}
      {pSelect > 0 ? (
        <Label
          x={cx}
          y={cy + r * zoom + 54}
          text={`${caughtCount} ${sup.subjects && /phone|device/i.test(sup.subjects) ? "DEVICES" : "SUBJECTS"} INSIDE`}
          color={colors.textPrimary}
          halo={colors.bg}
          size={28}
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
