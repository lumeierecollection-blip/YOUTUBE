import React from "react";
import { useCurrentFrame } from "remotion";
import {
  CANVAS_W, CANVAS_H, STAGE_CX, Label, Rule, ease, seeded, variantOf,
  useStateProgress, EASE_OUT, EASE_IN_OUT,
} from "./primitives.jsx";
import { progressOf, reached } from "../../visual/states.js";
import { shotFrame, Plane } from "./stage.jsx";

/**
 * Structure scenes — how things are ARRANGED, rather than how big they are.
 *
 *   when it happened, in order        TimelineScene
 *   what it moves through             ProcessScene
 *   what drives what                  CauseEffectScene
 *   who is connected to whom          RelationshipScene
 *
 * These four are deliberately different geometries — a horizontal dated
 * axis, a left-to-right stage chain with a travelling token, a two-node
 * vertical driver/outcome pair, and a radial node graph. If they shared a
 * layout they'd be aliases (PART 2), which the registry check would catch.
 */

const short = (s, n) => {
  const t = String(s || "").trim().replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};

/** Pull the most meaningful words out of a clause for a node label. */
const STOP = new Set("a an the of and or but not is are was were be been being to from in on at for with by as it its this that these those they them their he she we you i our your his her".split(" "));
function keyPhrase(text, maxWords = 3) {
  const words = String(text || "")
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()));
  return words.slice(0, maxWords).join(" ").toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE — dated events on a real axis.
// ─────────────────────────────────────────────────────────────────────────────
export function TimelineScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};
  const shot = plan.shot || null;
  const years = (sup.years || []).slice(0, 5);

  const pAxis = useStateProgress(states, "axis");
  const pEvents = progressOf(states, "events", frame);
  const pFocus = useStateProgress(states, "focus");
  const pCons = useStateProgress(states, "consequence");

  /**
   * WHAT THIS USED TO BE
   *
   * A 680px hairline at a fixed y=760 with decade ticks, two endpoint dots
   * and year labels. Measured on a rendered frame it covered 0.2% of the
   * picture in a 70x9% band — the thinnest scene in the system. It also
   * shared its whole primitive vocabulary (circle + line) with
   * RELATIONSHIP, so the two were structurally one picture.
   *
   * WHAT IT DRAWS NOW: CHRONOLOGICAL SPACE.
   *
   * Time runs across a receding ground rather than along a rule. Each dated
   * event is a MARKER STANDING IN THAT SPACE — a post with a footing on the
   * ground and a shadow cast along it — so a date has physical presence and
   * the gap between two dates is legible as distance travelled. The
   * decisive event stands taller and carries accent; everything after it
   * sits on ground the consequence has visibly changed.
   *
   * The camera tracks right (composition.js gives TIMELINE the TRACK_RIGHT
   * move), so the frame travels through the period instead of watching it
   * from outside, and the AtmosphereGround behind it supplies the horizon
   * and distance markers the earlier version had no room for.
   *
   * Text stays to dates. A year is one of the few things a viewer genuinely
   * cannot infer from a picture.
   */
  const f = shotFrame(shot);
  // The ground sits on the SAME horizon AtmosphereGround draws (0.6 of
  // frame height). A first version put it at f.cy + 22% of the band and a
  // rendered frame showed two competing horizons in one shot — the shared
  // ground's and the scene's — with the markers stranded below both.
  const groundY = CANVAS_H * 0.6;
  // Inset hard. Spreading the span across the full frame width put 1998 and
  // 2015 on the left and right edges, and the camera track clipped one of
  // them off entirely. Endpoints need room to be endpoints.
  const x0 = f.x + f.w * 0.26;
  const w = f.w * 0.48;

  // A single dated event still gets a real span, so "the law changed in
  // 1998" reads as a moment IN time rather than a caption.
  const span = years.length >= 2
    ? { lo: years[0], hi: years[years.length - 1] }
    : years.length === 1
      ? { lo: years[0] - 12, hi: years[0] + 12 }
      : null;
  if (!span) return null;

  const xFor = (y) => x0 + ((y - span.lo) / (span.hi - span.lo || 1)) * w;
  const focusYear = years.length ? years[years.length - 1] : null;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* FAR — a distant row of markers beyond the period being discussed.
          At parallax 0.14 it barely moves while the camera tracks right,
          which is what tells the eye it is far away rather than small.
          Deterministic from the beat's own seed; no Math.random. */}
      <Plane shot={shot} depth="far" states={states} durationInFrames={beat.durationInFrames}>
        <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0 }}>
          {Array.from({ length: 11 }).map((_, i) => {
            const x = seeded((beat.startFrame || 0) * 3 + i * 29) * CANVAS_W;
            const h = 18 + seeded((beat.startFrame || 0) * 5 + i * 31) * 44;
            return (
              <line key={`far${i}`} x1={x} y1={groundY} x2={x} y2={groundY - h * ease(pAxis)}
                stroke={colors.stroke} strokeWidth={2} opacity={0.4} />
            );
          })}
        </svg>
      </Plane>

      {/* BACKGROUND — the surface itself. The ground lags the camera at
          0.34, so the markers standing on it are visibly nearer than it. */}
      <Plane shot={shot} depth="background" states={states} durationInFrames={beat.durationInFrames}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {/* ── the ground time runs across ──────────────────────────── */}
        <g opacity={ease(pAxis)}>
          {/* Receding bands: the surface has depth, so markers stand ON
              something instead of floating over a rule. */}
          {Array.from({ length: 7 }).map((_, i) => {
            const t = i / 7;
            const y = groundY + Math.pow(t, 1.7) * f.h * 0.42;
            return (
              <line key={`g${i}`} x1={x0 - f.w * 0.1} y1={y} x2={x0 + w + f.w * 0.1} y2={y}
                stroke={colors.stroke} strokeWidth={2} opacity={0.3 * (1 - t * 0.55)} />
            );
          })}
          <line x1={0} y1={groundY} x2={CANVAS_W} y2={groundY}
            stroke={colors.stroke} strokeWidth={4} opacity={0.75} />
          {/* Interval marks: real scale on the ground, not ticks on a rule. */}
          {Array.from({ length: 13 }).map((_, i) => {
            const t = i / 12;
            const x = x0 + w * t;
            const a = ease(Math.max(0, Math.min(1, pAxis * 2 - t)));
            return (
              <line key={`t${i}`} x1={x} y1={groundY} x2={x} y2={groundY + 16}
                stroke={colors.stroke} strokeWidth={2} opacity={0.55 * a} />
            );
          })}
        </g>

        {/* ── the period the sentence is about, as ground between the
               first and last date. A timeline's subject is the SPAN, and
               leaving it as bare floor made the shot read as two posts in
               a void. Derived from the stated dates, not invented. ────── */}
        {years.length >= 2 && pEvents > 0 ? (
          <rect
            x={xFor(years[0])}
            y={groundY}
            width={Math.max(0, (xFor(years[years.length - 1]) - xFor(years[0]))) * ease(pEvents)}
            height={CANVAS_H - groundY}
            fill={colors.stroke}
            opacity={0.07}
          />
        ) : null}

      </svg>
      </Plane>

      {/* SUBJECT — the dated markers. Sharp, at 1.0x: this is what the
          viewer is reading. */}
      <Plane shot={shot} depth="subject" states={states} durationInFrames={beat.durationInFrames}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {/* ── events as markers standing in the space ───────────────── */}
        {years.map((y, i) => {
          const a = ease(Math.max(0, Math.min(1, pEvents * years.length - i)));
          if (a <= 0.01) return null;
          const x = xFor(y);
          const isFocus = y === focusYear && pFocus > 0;
          // Uneven heights: real events are not the same size as each other,
          // and an even row of posts reads as a chart axis again.
          const postH = (f.h * 0.5) * (0.72 + seeded(i * 17 + 3) * 0.5) * (isFocus ? 1.4 : 1);
          const col = isFocus ? colors.accent : colors.stroke;
          return (
            <g key={y} opacity={pFocus > 0 && !isFocus ? 0.42 : 1}>
              {/* Shadow along the ground — the cheapest, most reliable way
                  to say "this object is standing on that surface". */}
              <line x1={x} y1={groundY} x2={x + postH * 0.42} y2={groundY + 13}
                stroke={col} strokeWidth={2} opacity={0.2 * a} />
              <line x1={x} y1={groundY} x2={x} y2={groundY - postH * a}
                stroke={col} strokeWidth={isFocus ? 6 : 4} opacity={0.9} />
              {/* Footing where it meets the ground. */}
              <line x1={x - 11} y1={groundY} x2={x + 11} y2={groundY}
                stroke={col} strokeWidth={isFocus ? 6 : 4} opacity={0.9 * a} />
              {/* The head of the marker carries the weight of the event. */}
              <rect x={x - (isFocus ? 13 : 9)} y={groundY - postH * a - (isFocus ? 15 : 11)}
                width={(isFocus ? 26 : 18)} height={(isFocus ? 15 : 11)}
                fill={col} opacity={a} />
              {isFocus ? (
                <circle cx={x} cy={groundY} r={14 + 40 * ease(pFocus)}
                  fill="none" stroke={colors.accent} strokeWidth={2}
                  opacity={0.5 * (1 - ease(pFocus))} />
              ) : null}
            </g>
          );
        })}

        {/* ── what the decisive moment changed: ground beyond it ────── */}
        {pCons > 0 && focusYear !== null ? (
          <rect
            x={xFor(focusYear)}
            y={groundY}
            width={Math.max(0, (x0 + w - xFor(focusYear))) * ease(pCons)}
            height={CANVAS_H - groundY}
            fill={colors.accent}
            opacity={0.09}
          />
        ) : null}
      </svg>

      {/* Dates sit at the foot of their own marker, in the space, rather
          than in a caption row under an axis. Inside the SUBJECT plane so a
          date travels with the post it belongs to — on the background plane
          it would slide off its own marker as the camera tracks. */}
      {years.map((y, i) => {
        const a = ease(Math.max(0, Math.min(1, pEvents * years.length - i)));
        const isFocus = y === focusYear && pFocus > 0;
        return (
          <Label
            key={y}
            x={xFor(y)}
            y={groundY + 30}
            text={String(y)}
            color={isFocus ? colors.accent : colors.textDim}
            size={isFocus ? 30 : 24}
            weight={800}
            tracking={1.5}
            align="center"
            opacity={a}
            fontFamily={fontFamily}
            halo={colors.bg}
          />
        );
      })}
      </Plane>

      {/* FOREGROUND — the near lip of the ground, passing the camera at
          2.2x. This is the layer that actually sells the track: the far
          markers hold almost still, the posts travel, and this sweeps.
          Blurred, because nothing this close to the lens is in focus. */}
      <Plane shot={shot} depth="foreground" states={states} durationInFrames={beat.durationInFrames}>
        <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0 }}>
          <path
            d={`M-200,${CANVAS_H} L-200,${CANVAS_H - 90 * ease(pAxis)} ${Array.from({ length: 11 })
              .map((_, i) => {
                const x = -200 + (i / 10) * (CANVAS_W + 400);
                const yy = CANVAS_H - (70 + seeded((beat.startFrame || 0) * 7 + i * 13) * 70) * ease(pAxis);
                return `L${x.toFixed(1)},${yy.toFixed(1)}`;
              })
              .join(" ")} L${CANVAS_W + 200},${CANVAS_H} Z`}
            fill={colors.stroke} opacity={0.13} />
        </svg>
      </Plane>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS — stages something actually moves through.
// ─────────────────────────────────────────────────────────────────────────────
export function ProcessScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};
  const shot = plan.shot || null;
  const n = Math.max(2, Math.min(6, Math.round(sup.stages || 3)));

  const pStages = useStateProgress(states, "stages");
  const pAdvance = progressOf(states, "advance", frame);
  const pArrive = useStateProgress(states, "arrive");

  /**
   * WHAT THIS USED TO BE
   *
   * [ STAGE 1 ] -> [ STAGE 2 ] -> [ STAGE 3 ]: n rounded rectangles, a
   * connector line, a triangle arrowhead, a label under each box. Measured
   * on a rendered anchor frame it covered 0.5% of the picture in a 54x11%
   * band. It shared its whole primitive vocabulary (line + polygon + rect)
   * with CAUSE_EFFECT, which is another way of saying they were the same
   * picture. It was a UI flowchart, and the fix was never to restyle the
   * boxes or animate them harder — it was to stop using boxes as the
   * grammar for "process" at all.
   *
   * WHAT IT DRAWS NOW: A MACHINE, SEEN FROM THE SIDE.
   *
   * A track runs the full height of the frame and off both ends, so the
   * process visibly continues beyond the shot rather than being a diagram
   * that starts and stops. Stages are STATIONS on that track — paired
   * rollers that clamp across it — not containers holding a label. A
   * workpiece descends the track under them, and at each station it is
   * physically worked: it narrows through the rollers and comes out
   * changed, carrying accent colour it did not have before.
   *
   * The camera descends with it (composition.js gives PROCESS the DESCEND
   * move), so the frame travels the sequence instead of watching it from
   * outside. Stations already passed keep their state — the machine
   * remembers what it did, which is the difference between a process and a
   * slideshow of steps.
   *
   * Stage labels still exist because a viewer needs to count the stages,
   * but they are set small beside the track, subordinate to the mechanism.
   */
  const cov = shot ? shot.coverage : 0.9;
  const trackX = CANVAS_W * (shot ? shot.anchorX : 0.44);
  // The run is TALLER than the frame on purpose: bleed is what makes a
  // machine read as continuing past the shot.
  const runTop = -CANVAS_H * 0.12;
  const runBot = CANVAS_H * 1.12;
  // The run sits high in the frame because two later transforms push it
  // down: the DESCEND camera travels +6% of frame height, and
  // motion-graphics.jsx drops the whole stage 110px to reclaim the space
  // captions used to occupy. A rendered frame showed the workpiece
  // finishing its run half off the bottom edge with lastY at 0.86.
  const firstY = CANVAS_H * 0.16;
  const lastY = CANVAS_H * 0.68;
  const stationY = (i) => firstY + (i / Math.max(n - 1, 1)) * (lastY - firstY);

  // The channel takes the width the shot actually granted it. At 0.17 the
  // track measured 34% of frame width against a coverage of 0.9 — the
  // scene was ignoring most of the room it had been given, which is the
  // same under-use of the frame the whole audit was about.
  const halfW = CANVAS_W * 0.24 * (cov / 0.9);
  const gapW = halfW * 0.34; // how far the rollers close on the workpiece

  // Where the workpiece is, and how far through the whole run.
  const t = ease(pAdvance, EASE_IN_OUT);
  const pieceY = firstY + t * (lastY - firstY);
  const stagesPassed = Math.floor(t * (n - 1) + 0.5);

  // Worked = narrower and accented. The change is cumulative, so the piece
  // arriving at the end is visibly not the piece that started.
  const workedness = Math.max(0, Math.min(1, t));
  const pieceW = halfW * (1.05 - 0.5 * workedness);
  const pieceH = 72 - 20 * workedness;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {/* ── the track: two rails running off both ends of the frame ── */}
        <g opacity={ease(pStages)}>
          {/* The channel itself. Two rails alone measured 1.0% ink and read
              as a pair of hairlines; a machine has a body, and the fill is
              what gives the track mass without adding another line. */}
          <rect x={trackX - halfW} y={runTop} width={halfW * 2} height={runBot - runTop}
            fill={colors.stroke} opacity={0.05} />
          <line x1={trackX - halfW} y1={runTop} x2={trackX - halfW} y2={runBot}
            stroke={colors.stroke} strokeWidth={5} opacity={0.6} />
          <line x1={trackX + halfW} y1={runTop} x2={trackX + halfW} y2={runBot}
            stroke={colors.stroke} strokeWidth={5} opacity={0.6} />
          {/* Cross-ties, denser than the stations, so the track reads as
              structure rather than as two more lines. */}
          {Array.from({ length: 26 }).map((_, i) => {
            const y = runTop + (i / 26) * (runBot - runTop);
            return (
              <line key={`tie${i}`} x1={trackX - halfW} y1={y} x2={trackX + halfW} y2={y}
                stroke={colors.stroke} strokeWidth={1.5} opacity={0.14} />
            );
          })}
        </g>

        {/* ── stations: rollers that clamp across the track ─────────── */}
        {Array.from({ length: n }).map((_, i) => {
          const y = stationY(i);
          const a = ease(Math.max(0, Math.min(1, pStages * n - i * 0.6)));
          if (a <= 0.01) return null;
          const passed = t * (n - 1) > i + 0.15;
          const working = Math.abs(t * (n - 1) - i) < 0.35 && pAdvance > 0;
          const col = passed || working ? colors.accent : colors.stroke;
          const r = working ? 30 : 25;
          return (
            <g key={i} opacity={a}>
              {/* The pair of rollers. Their inner faces define the gap the
                  workpiece has to pass through — that gap IS the stage. */}
              <circle cx={trackX - gapW - r} cy={y} r={r}
                fill={colors.bg} stroke={col} strokeWidth={working ? 6 : 4} opacity={passed ? 0.95 : 0.7} />
              <circle cx={trackX + gapW + r} cy={y} r={r}
                fill={colors.bg} stroke={col} strokeWidth={working ? 6 : 4} opacity={passed ? 0.95 : 0.7} />
              {/* Roller shafts out to the rails. */}
              <line x1={trackX - halfW} y1={y} x2={trackX - gapW - r * 2} y2={y}
                stroke={col} strokeWidth={4} opacity={0.55} />
              <line x1={trackX + gapW + r * 2} y1={y} x2={trackX + halfW} y2={y}
                stroke={col} strokeWidth={4} opacity={0.55} />
              {/* A station that has done its work keeps a mark. The machine
                  remembers; a slideshow of steps does not. */}
              {passed ? (
                <line x1={trackX - gapW} y1={y + r + 8} x2={trackX + gapW} y2={y + r + 8}
                  stroke={colors.accent} strokeWidth={2} opacity={0.55} />
              ) : null}
            </g>
          );
        })}

        {/* ── the workpiece, descending and being worked ─────────────── */}
        {pAdvance > 0 || pArrive > 0 ? (
          <g>
            <rect
              x={trackX - pieceW / 2}
              y={pieceY - pieceH / 2}
              width={pieceW}
              height={pieceH}
              rx={3}
              fill={colors.accent}
              fillOpacity={0.18 + 0.5 * workedness}
              stroke={colors.accent}
              strokeWidth={3}
            />
            {/* Material still to come, trailing above it up the track. */}
            {/* Unworked material still queued above it — a column with
                width, not a rod: this is the stuff the machine is eating. */}
            <rect x={trackX - halfW * 0.46} y={runTop} width={halfW * 0.92}
              height={Math.max(0, pieceY - pieceH / 2 - runTop)}
              fill={colors.stroke} opacity={0.09} />
          </g>
        ) : null}

        {/* ── arrival: it leaves the machine ────────────────────────── */}
        {pArrive > 0 ? (
          <line x1={trackX} y1={lastY + 34}
            x2={trackX} y2={lastY + 34 + (runBot - lastY) * ease(pArrive)}
            stroke={colors.accent} strokeWidth={9} opacity={0.75} strokeLinecap="round" />
        ) : null}
      </svg>

      {/* Stage numbers, small, beside the track. Subordinate to the
          mechanism — a viewer counts stations by looking at the rollers,
          not by reading a box. */}
      {Array.from({ length: n }).map((_, i) => {
        const y = stationY(i);
        const a = ease(Math.max(0, Math.min(1, pStages * n - i * 0.6)));
        const passed = t * (n - 1) > i + 0.15;
        return (
          <Label
            key={i}
            x={trackX + halfW + 34}
            y={y - 13}
            text={`${i + 1}`}
            color={passed ? colors.accent : colors.textDim}
            size={26}
            weight={800}
            tracking={1}
            opacity={a}
            fontFamily={fontFamily}
            halo={colors.bg}
          />
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CAUSE_EFFECT — one thing driving another, with the link made visible.
// Vertical, so it reads as "this produces that" rather than "these two".
// ─────────────────────────────────────────────────────────────────────────────
export function CauseEffectScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};
  const shot = plan.shot || null;

  const causeText = keyPhrase(sup.cause, 3) || keyPhrase(beat.text, 3);
  const effectText = keyPhrase(sup.effect, 3) || "";
  const marker = String(sup.marker || "").toUpperCase().trim();

  const pCause = useStateProgress(states, "cause");
  const pLink = progressOf(states, "link", frame);
  const pEffect = useStateProgress(states, "effect");
  const pSettle = useStateProgress(states, "settle");

  /**
   * WHAT THIS USED TO BE, AND WHY IT WAS THE WORST SCENE IN THE SYSTEM
   *
   * Two 470x132 rounded rectangles stacked vertically with a line and a
   * triangle between them. Measured on a rendered anchor frame it covered
   * 0.6% of the picture in a 44x7% band, and at the anchor — before the
   * effect box existed — the entire frame was ONE rounded rectangle reading
   * "SECOND STAGE HOLDING". That is not an explanation of causality; it is
   * a label in a box.
   *
   * WHAT IT DRAWS NOW
   *
   * Causality as FLOW THROUGH A CONSTRAINT, left to right, which is the
   * direction the camera also tracks:
   *
   *   upstream lanes  ->  a constriction  ->  what comes out the far side
   *
   * The cause is a bank of lanes carrying flow. The constraint physically
   * narrows them. Downstream, the lanes that survive are visibly fewer and
   * thinner than the ones that went in, and pressure accumulates against
   * the upstream face of the constriction as the effect lands. The viewer
   * reads "throughput collapsed because something was holding" from the
   * geometry, with the sound off, before reading either label.
   *
   * DIRECTION IS NEVER REVERSED. The semantics layer already decides which
   * side is cause (CAUSAL_FORWARD / CAUSAL_BACKWARD in semantics.js);
   * upstream is always drawn left and the flow always moves toward the
   * effect, so a "because" clause cannot render backwards.
   */
  const LANES = 7;
  // Laid out against the SHOT, not against hardcoded pixels. `coverage` is
  // the share of the frame the subject should span and `anchorY` is where
  // its centre belongs — both from visual/composition.js. Hardcoding these
  // per scene is precisely how sixteen scenes ended up centred within a few
  // percent of the same point.
  const cov = shot ? shot.coverage : 0.74;
  const bandH = CANVAS_H * 0.34 * (cov / 0.74);
  const laneGap = bandH / (LANES - 1);
  const laneTop = CANVAS_H * (shot ? shot.anchorY : 0.45) - bandH / 2;
  const inset = CANVAS_W * (1 - cov) * 0.5;
  const xIn = inset;
  const xOut = CANVAS_W - inset;
  const xGate = xIn + (xOut - xIn) * 0.54;

  // How much each lane still carries downstream. Deterministic per lane —
  // an even collapse would read as a wipe rather than as congestion.
  const survives = (i) => {
    const s = seeded(i * 31 + 7);
    return s > 0.55 ? 1 : s > 0.3 ? 0.45 : 0.12;
  };

  const eLink = ease(pLink, EASE_IN_OUT);
  const eEffect = ease(pEffect);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {/* ── upstream: flow arriving, full width ─────────────────────── */}
        {Array.from({ length: LANES }).map((_, i) => {
          const y = laneTop + i * laneGap;
          const a = ease(Math.max(0, Math.min(1, pCause * 1.8 - i * 0.09)));
          if (a <= 0.01) return null;
          // Lanes converge toward the gate: the constriction is geometric,
          // not a label saying "bottleneck".
          const yGate = laneTop + (LANES - 1) * laneGap * 0.5 + (i - (LANES - 1) / 2) * 16;
          return (
            <path
              key={`in${i}`}
              d={`M ${xIn} ${y} L ${xGate - 120} ${y} Q ${xGate - 40} ${y} ${xGate} ${yGate}`}
              fill="none"
              stroke={colors.stroke}
              strokeWidth={9}
              opacity={0.5 * a}
              strokeLinecap="round"
            />
          );
        })}

        {/* ── pressure building against the upstream face ─────────────── */}
        {pLink > 0 ? (
          <g opacity={eLink}>
            {Array.from({ length: 5 }).map((_, i) => (
              <line
                key={`p${i}`}
                x1={xGate - 30 - i * 15 - 26 * eLink}
                y1={laneTop - 26 + i * 8}
                x2={xGate - 30 - i * 15 - 26 * eLink}
                y2={laneTop + (LANES - 1) * laneGap + 26 - i * 8}
                stroke={colors.accent}
                strokeWidth={2}
                opacity={0.16 + 0.1 * i}
              />
            ))}
          </g>
        ) : null}

        {/* ── the constriction itself ─────────────────────────────────── */}
        {pLink > 0 ? (
          <g>
            <path
              d={`M ${xGate} ${laneTop - 70} L ${xGate + 34} ${laneTop + (LANES - 1) * laneGap * 0.5 - 46}`}
              stroke={colors.accent} strokeWidth={7} fill="none" strokeLinecap="round" opacity={eLink} />
            <path
              d={`M ${xGate} ${laneTop + (LANES - 1) * laneGap + 70} L ${xGate + 34} ${laneTop + (LANES - 1) * laneGap * 0.5 + 46}`}
              stroke={colors.accent} strokeWidth={7} fill="none" strokeLinecap="round" opacity={eLink} />
          </g>
        ) : null}

        {/* ── downstream: what actually got through ───────────────────── */}
        {pEffect > 0
          ? Array.from({ length: LANES }).map((_, i) => {
              const carry = survives(i);
              const yGate = laneTop + (LANES - 1) * laneGap * 0.5 + (i - (LANES - 1) / 2) * 16;
              const ySpread = laneTop + i * laneGap;
              const reach = xGate + (xOut - xGate) * eEffect;
              return (
                <path
                  key={`out${i}`}
                  d={`M ${xGate + 36} ${yGate} Q ${xGate + 150} ${ySpread} ${reach} ${ySpread}`}
                  fill="none"
                  stroke={carry > 0.5 ? colors.accent : colors.stroke}
                  strokeWidth={Math.max(1.5, 9 * carry)}
                  opacity={(carry > 0.5 ? 0.85 : 0.3) * eEffect}
                  strokeLinecap="round"
                />
              );
            })
          : null}

        {/* The collapse, stated as a proportion of the section area rather
            than as a word: the downstream band is visibly thinner. */}
        {pSettle > 0 ? (
          <line
            x1={xOut - 8} y1={laneTop - 40} x2={xOut - 8} y2={laneTop + (LANES - 1) * laneGap + 40}
            stroke={colors.stroke} strokeWidth={1.5} strokeDasharray="7 9" opacity={0.4 * ease(pSettle)} />
        ) : null}
      </svg>

      {/* Labels sit ON the thing they name, upstream and downstream — not in
          boxes, and never as the composition. */}
      <Label x={xIn} y={laneTop - 66} text={short(causeText, 22)}
        color={colors.textPrimary} size={34} weight={800} tracking={1}
        opacity={pCause} fontFamily={fontFamily} halo={colors.bg} />
      {/* The causal marker rides ON the constriction, vertically, because
          that is where the causality physically happens. Laying it flat
          under the gate collided with the effect label on a rendered
          frame — "BECAUSE" printed straight through "THROUGHPUT
          COLLAPSED". */}
      {marker ? (
        <div
          style={{
            position: "absolute",
            left: xGate - 118,
            top: laneTop - 54,
            transform: "rotate(-90deg)",
            transformOrigin: "100% 50%",
            color: colors.accent,
            fontFamily,
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: 3,
            opacity: pLink,
            textShadow: `0 0 10px ${colors.bg}, 0 0 5px ${colors.bg}`,
          }}
        >
          {short(marker, 14)}
        </div>
      ) : null}
      {effectText ? (
        <Label x={xOut} y={laneTop + bandH + 46} text={short(effectText, 22)}
          color={colors.accent} size={34} weight={800} tracking={1} align="right"
          opacity={pEffect} fontFamily={fontFamily} halo={colors.bg} />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP — several entities and how they connect. Radial, not linear.
// ─────────────────────────────────────────────────────────────────────────────
export function RelationshipScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];

  const pNodes = progressOf(states, "nodes", frame);
  const pLinks = progressOf(states, "links", frame);
  const pWeight = useStateProgress(states, "weight");

  // Entities named in the beat itself; falls back to an abstract 4-node
  // graph when the text doesn't name enough of them. Extracted on the plan
  // so the node labels count toward the same on-screen word budget as
  // every other scene's text (visual/text-budget.js).
  const labels = (beat.visualPlan && beat.visualPlan.supporting.labels) || [];
  const n = Math.max(3, Math.min(5, labels.length || 4));

  // The party ring is sized to the shot. RELATIONSHIP takes a CLOSE
  // framing, meaning the viewer stands among the parties rather than
  // looking at a diagram of them.
  const f = shotFrame((beat.visualPlan && beat.visualPlan.shot) || null);
  const cx = f.cx, cy = f.cy, R = Math.min(f.w, f.h) * 0.42;

  const nodes = Array.from({ length: n }).map((_, i) => {
    const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R * 0.86, label: labels[i] || "" };
  });

  // Link every pair; the strongest (first-to-second) is emphasized later.
  const links = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) links.push([i, j]);
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {links.map(([i, j], k) => {
          const a = ease(Math.max(0, Math.min(1, pLinks * links.length - k * 0.6)));
          if (a <= 0.01) return null;
          const strongest = k === 0 && pWeight > 0;
          const A = nodes[i], B = nodes[j];
          return (
            <line key={k}
              x1={A.x} y1={A.y}
              x2={A.x + (B.x - A.x) * a} y2={A.y + (B.y - A.y) * a}
              stroke={strongest ? colors.accent : colors.stroke}
              strokeWidth={strongest ? 4 : 1.8}
              opacity={pWeight > 0 && !strongest ? 0.3 : 0.85} />
          );
        })}
        {nodes.map((nd, i) => {
          const a = ease(Math.max(0, Math.min(1, pNodes * n - i * 0.6)));
          if (a <= 0.01) return null;
          return (
            <circle key={i} cx={nd.x} cy={nd.y} r={16 * a}
              fill={colors.bg} stroke={colors.accent} strokeWidth={3} />
          );
        })}
      </svg>
      {nodes.map((nd, i) => {
        const a = ease(Math.max(0, Math.min(1, pNodes * n - i * 0.6)));
        if (a <= 0.01 || !nd.label) return null;
        const below = nd.y > cy;
        return (
          <Label key={i} x={nd.x} y={nd.y + (below ? 30 : -56)} text={short(nd.label.toUpperCase(), 14)}
            color={colors.textDim} size={26} tracking={1.8} align="center" opacity={a} fontFamily={fontFamily} />
        );
      })}
    </div>
  );
}
