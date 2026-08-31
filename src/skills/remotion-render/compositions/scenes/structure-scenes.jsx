import React from "react";
import { useCurrentFrame } from "remotion";
import {
  CANVAS_W, CANVAS_H, CAPTION_RESERVE_Y, Label, ease, seeded,
  useStateProgress, useValueProgress, EASE_IN_OUT, EASE_OUT,
} from "./primitives.jsx";
import { MG_TYPE as TYPE } from "../beats.js";
import { progressOf } from "../../visual/states.js";
import { shotFrame, Plane } from "./stage.jsx";
import { MachineBody, Gate, MaterialSlug } from "./elements/machine.jsx";
import { CircuitNode, CircuitTrace, SignalPacket } from "./elements/circuit.jsx";
import { ATMOSPHERE_HORIZON_Y } from "../../layout/slots.js";

/**
 * Which OBJECT FAMILY a process is built from — a deterministic keyword
 * read of the beat's own text, the same technique VisualMetaphorScene
 * already uses to pick its physical behaviour (never a fabricated label,
 * only a different vocabulary for a stage COUNT that carries no names —
 * see director.js: PROCESS's only real data is `stages`, a bare number).
 *
 * "REQUEST -> SERVER -> DATABASE -> RESPONSE" and "RAW MATERIAL -> MACHINE
 * -> TRANSFORMED MATERIAL" should not be the same picture (visual-system-
 * reset PART 12). Two families, not one universal template: "circuit" for
 * a digital/software subject, "mechanism" (the existing roller-and-gate
 * machine) for everything else, which is the more defensible default for
 * an unspecified physical process.
 */
const DIGITAL_PROCESS = /\b(server|database|api|request|software|source code|network|algorithm|quer(y|ies)|cache|cloud|app|application|computer|program|processor|upload|download|login|log in|authenticat|browser|website|platform|encrypt|packet|router|firewall|endpoint)\b/i;
function processFamily(beat) {
  return DIGITAL_PROCESS.test(String(beat && beat.text || "")) ? "circuit" : "mechanism";
}

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

/**
 * Keep a drawn label above the band YouTube's own UI covers.
 *
 * Two things push scene content down that a scene cannot see from its own
 * coordinates: DesignSpace translates the whole stage down by
 * CAPTION_RESERVE_Y (110px) whenever narration captions are off, which is
 * the default, and a DESCEND-style camera adds its own travel on top. A
 * label placed at a y that looks fine in scene coordinates can therefore
 * land in the bottom fifth of the delivered frame, which is exactly where
 * the title, channel row and progress bar sit.
 *
 * Confirmed on a rendered arrive frame: the PROCESS claim, placed just
 * under the board at y=1456, delivered at ~1745/1920 (91% of frame
 * height). `size` is the label's font size, since the anchor is its TOP
 * edge and the text hangs below it.
 */
const BOTTOM_SAFE_FRACTION = 0.79;
function aboveUiBand(y, size) {
  const limit = CANVAS_H * BOTTOM_SAFE_FRACTION - CAPTION_RESERVE_Y - size * 1.15;
  return Math.min(y, limit);
}

/**
 * The largest house-scale size a phrase can be drawn at and still fit the
 * safe width.
 *
 * The floors are the repo's own, not invented here: MG_TYPE.headline (84)
 * and MG_TYPE.support (44) are registered as TYP-03 and TYP-04 in
 * CHECK-REGISTER.md ("Remotion floor. Never lower."), and both are recorded
 * there as currently FAILING. A fixed size cannot satisfy both that floor
 * and the safe rect — "STOPS THE WHOLE LINE" at the full 84 measures ~940px
 * against 886px of safe width — so the size is fitted to the string and
 * then clamped into the house range instead of being picked by hand.
 *
 * Width is estimated from glyph count because Label has no measurement pass
 * (unlike HeadlineBox, which uses measureText). The estimate only has to be
 * good enough to choose between house steps.
 */
const GLYPH_W = 0.56;
function fitPhraseSize(text, maxWidth, max = TYPE.headline, min = TYPE.support) {
  const n = String(text || "").length || 1;
  return Math.max(min, Math.min(max, Math.floor(maxWidth / (n * GLYPH_W))));
}

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
  // The ground sits on the SAME horizon AtmosphereGround draws
  // (ATMOSPHERE_HORIZON_Y, layout/slots.js). A first version put it at
  // f.cy + 22% of the band and a rendered frame showed two competing
  // horizons in one shot — the shared ground's and the scene's — with the
  // markers stranded below both.
  const groundY = ATMOSPHERE_HORIZON_Y;
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
  // Fitted into the house range rather than a hand-picked size, so a long
  // event still clears TYP-04's 44px floor without leaving the safe rect.
  const eventSize = fitPhraseSize(sup.event, CANVAS_W * 0.82);

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
            opacity={0.14}
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
              {/* The head of the marker — a pennant, not a bare cap, so the
                  event reads as a real waypoint object planted in the
                  ground rather than a post with a rectangle glued on. */}
              <path
                d={`M ${x} ${groundY - postH * a} L ${x + (isFocus ? 30 : 21)} ${groundY - postH * a + (isFocus ? 9 : 6)} L ${x} ${groundY - postH * a + (isFocus ? 18 : 12)} Z`}
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
            opacity={0.16}
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

      {/* WHAT HAPPENED, not just when.
          Two dated posts tell the viewer a span existed and nothing else —
          the event that makes the span worth showing lived only in the
          audio. This sets it against the focus year's own marker, so the
          date and the event read as one object (aesthetic-rules C3), and
          it is the scene's dominant text per scene-director rule 3. */}
      {sup.event && plan.runLast && pFocus > 0 ? (
        <Label
          /* Centred on the focus marker, but clamped so a long event never
             runs off the safe rect. On the first render of this label
             "BATCHING RULE REMOVED" centred on the 2015 post reached
             x=992 against a 983px safe edge — a real margin violation,
             caught on the frame rather than reasoned about. Width is
             estimated from the glyph count (this is a Label, which has no
             measurement pass); the estimate only has to be good enough to
             keep a centred string off the edge. */
          x={(() => {
            const halfW = (sup.event.length * eventSize * GLYPH_W) / 2;
            const lo = CANVAS_W * 0.09 + halfW;
            const hi = CANVAS_W * 0.91 - halfW;
            // When the string is too wide for the safe rect at all, centre
            // it rather than pinning it to a nonsense position.
            return lo > hi ? CANVAS_W / 2 : Math.max(lo, Math.min(hi, xFor(focusYear)));
          })()}
          y={aboveUiBand(groundY + 78, eventSize)}
          text={sup.event}
          align="center"
          color={colors.textPrimary}
          size={eventSize}
          weight={900}
          tracking={0}
          opacity={ease(Math.min(1, pFocus * 2))}
          fontFamily={fontFamily}
          halo={colors.bg}
        />
      ) : null}
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

  // Shared staging math both families lay out against — same physical
  // space either way, only the OBJECTS built in it differ.
  const cov = shot ? shot.coverage : 0.9;
  const trackX = CANVAS_W * (shot ? shot.anchorX : 0.44);
  const firstY = CANVAS_H * 0.16;
  const lastY = CANVAS_H * 0.68;

  if (processFamily(beat) === "circuit") {
    return (
      <CircuitProcess
        n={n} trackX={trackX} firstY={firstY} lastY={lastY}
        pStages={pStages} pAdvance={pAdvance} pArrive={pArrive}
        colors={colors} fontFamily={fontFamily}
        // Both come from the director, counted against the text budget
        // there. The scene places them; it never derives them.
        // The claim is drawn only on the LAST beat of a same-strategy run
        // (mg-package.js runLast) so it lands once, as the sentence ends,
        // instead of restarting on each 2.5s chunk of that sentence.
        subject={sup.subject || ""} phrase={plan.runLast ? sup.phrase || "" : ""}
      />
    );
  }

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
  // The run is TALLER than the frame on purpose: bleed is what makes a
  // machine read as continuing past the shot.
  const runTop = -CANVAS_H * 0.12;
  const runBot = CANVAS_H * 1.12;
  // The run sits high in the frame because two later transforms push it
  // down: the DESCEND camera travels +6% of frame height, and
  // motion-graphics.jsx drops the whole stage 110px to reclaim the space
  // captions used to occupy. A rendered frame showed the workpiece
  // finishing its run half off the bottom edge with lastY at 0.86.
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
              what gives the track mass without adding another line.
              0.05 -> 0.11: stage.jsx's own Ground comment documents that 5%
              opacity lands ~12/255 from the background, under the threshold
              the frame audit counts as ink at all — this rect covered the
              whole run and still measured as if it were not there. */}
          <rect x={trackX - halfW} y={runTop} width={halfW * 2} height={runBot - runTop}
            fill={colors.stroke} opacity={0.11} />
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
              fill={colors.stroke} opacity={0.16} />
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

/**
 * PROCESS's "circuit" family — a request/signal moving through a chain of
 * system components, for beats whose own words are about software/digital
 * systems rather than physical material (`processFamily` above).
 *
 * Same track geometry as the mechanism family (same trackX/firstY/lastY),
 * so the two families occupy the same physical space differently rather
 * than each inventing its own layout — but the OBJECTS are a different
 * vocabulary: circuit nodes with status lights, right-angle traces, and a
 * travelling signal packet, not rollers and a workpiece.
 */
function CircuitProcess({ n, trackX, firstY, lastY, pStages, pAdvance, pArrive, colors, fontFamily, subject, phrase }) {
  // ZIGZAG, not a single vertical column. A rendered frame (CHECK-REGISTER
  // §3.12.15) showed this family collapsing into the exact grammar the
  // whole rebuild bans: three boxes joined by one straight line, because
  // every node shared trackX — CircuitTrace's "right-angle" path degenerates
  // to a straight line whenever x1 === x2. Offsetting alternate nodes left
  // and right of the centreline is what makes the traces actually bend, and
  // it is also a real PCB convention (routing around components), not
  // decoration added to make the line look busier.
  /**
   * The zigzag takes the width the frame actually has, instead of a flat
   * 140px cap.
   *
   * Measured on a rendered arrive frame, the board spanned x=135..578 of a
   * 1080-wide frame: the entire right 45% was empty black, with the whole
   * mechanism squeezed into a column on the left. That is the "hairline
   * diagram floating in a void" the repo's own pixel audit is about, and
   * the cap was the cause — a 140px zag makes a ~420px board no matter how
   * much room the shot granted.
   *
   * Bounded by the safe rect on the side the board is nearest, so widening
   * can never push a node or its pins off frame.
   */
  /**
   * THE COMPONENTS SCALE WITH THE BOARD, not just the board with the frame.
   *
   * Widening the zigzag alone made the board bigger and left the same three
   * 108px chips sitting in it — measured ink rose, but the rendered frame
   * showed a larger empty container rather than a fuller picture, which is
   * the same defect one level up. `r` was a flat 54 whatever the shot
   * granted.
   *
   * Sized from the space that actually exists: no more than a third of the
   * gap to the next station (so a 6-stage chain still reads as separate
   * components, not a stack), and never wider than the safe rect once its
   * own pins are counted. CircuitNode derives its body, pins and notch from
   * `r`, so this scales the whole component, not just a circle.
   */
  const safeHalf = Math.min(trackX - CANVAS_W * 0.09, CANVAS_W * 0.91 - trackX);
  const spacing = (lastY - firstY) / Math.max(n - 1, 1);
  const NODE_HALF_SPAN = 1.17; // bodyW/2 + pinLen, as multiples of r (circuit.jsx)
  const r = Math.max(54, Math.min(100, spacing * 0.3, (safeHalf - 110) / NODE_HALF_SPAN));
  const room = safeHalf - r * NODE_HALF_SPAN - 20;
  const zag = Math.max(90, Math.min(room, spacing * 0.42, 210));
  const nodeX = (i) => trackX + (i % 2 === 0 ? -1 : 1) * zag;
  /**
   * THE CLAIM GETS ITS OWN BAND, taken out of the chain's run.
   *
   * With the nodes scaled up, the last station's own body reached the y the
   * claim was placed at, and aboveUiBand() — which only knows about the
   * bottom of the FRAME, not about what the scene has already drawn —
   * clamped the text upward straight into it. A rendered arrive frame
   * showed "STOPS THE WHOLE LINE" printed across station 3 and its numeral.
   *
   * Two constraints cannot both be met by moving text alone: the claim must
   * clear the station above it AND stay out of the bottom fifth. So the
   * chain gives up the room instead — it ends higher when there is a claim
   * to land, and keeps its full run when there is not.
   */
  const CLAIM_BAND = 180;
  const runBottom = phrase ? lastY - CLAIM_BAND : lastY;
  const nodeY = (i) => firstY + (i / Math.max(n - 1, 1)) * (runBottom - firstY);

  /**
   * STAGE-BY-STAGE, NOT ONE SLIDE DOWN THE WHOLE CHAIN.
   *
   * This was `ease(pAdvance, EASE_IN_OUT)` scaled across the entire chain:
   * one interpolation from the first node to the last, so the packet
   * crossed every station at a near-constant speed and never registered
   * arriving anywhere. That is mograph-critic's defect #1 (linear
   * interpolation — measured as velocity_linearity, where >= 0.80 is a
   * hard defect) and it is also a lie about the mechanism: the narration
   * says a request is WORKED at each of three stages, and a thing that is
   * worked stops while that happens.
   *
   * So the run is split into per-segment hops: each hop eases out into its
   * station (fast departure, decelerating arrival) and then DWELLS there
   * while the station works. Per aesthetic-rules R2, speed comes from
   * acceleration rather than from a uniformly fast slide, and the dwell is
   * the "0.5s pause after the batch lands" that rule asks for.
   */
  const HOP = 0.62; // of each segment's time budget spent moving; rest dwells
  const segCount = Math.max(1, n - 1);
  const raw = Math.max(0, Math.min(1, pAdvance)) * segCount;
  const seg = Math.min(segCount - 1, Math.floor(raw));
  const within = raw - seg;
  // ease-out inside the hop, then hold at 1 for the dwell.
  const segT = within >= HOP ? 1 : ease(within / HOP, EASE_OUT);
  const posIdx = seg + segT;
  const t = posIdx / segCount;
  // True while the packet is parked at a station being worked — drives the
  // station's own reaction below, so the mechanism and the motion agree.
  const dwelling = within >= HOP && pAdvance < 1;
  const packetX = nodeX(seg) + (nodeX(seg + 1) - nodeX(seg)) * segT;
  const packetY = nodeY(seg) + (nodeY(seg + 1) - nodeY(seg)) * segT;

  const boardW = zag * 2 + r * 2.6;
  // Same fitting rule as TimelineScene's event: never below TYP-04's floor,
  // never wider than the safe rect, never a hand-picked number.
  const phraseSize = fitPhraseSize(phrase, CANVAS_W * 0.82);
  // One source of truth for where the claim sits: the Label below draws
  // at it, and the arrival trace stops short of it.
  const claimY = aboveUiBand(runBottom + r + 96, phraseSize);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {/* The board the chain is mounted on — a circuit needs a board the
            same way a machine needs a casing; without it the nodes were
            three squares floating with nothing around them (1.5% ink on a
            rendered frame, thinner than the mechanism family it sits
            beside in the same strategy). */}
        <MachineBody x={trackX - boardW / 2} y={firstY - r - 50} w={boardW} h={(runBottom - firstY) + r * 2 + 100}
          colors={colors} opacity={ease(pStages)} ribs={14} vertical />
        {/* traces between consecutive nodes — now genuinely bent, since
            consecutive nodes no longer share an x-coordinate. */}
        {Array.from({ length: n - 1 }).map((_, i) => {
          const a = ease(Math.max(0, Math.min(1, pStages * n - i * 0.6)));
          if (a <= 0.01) return null;
          const lit = posIdx > i + 0.5 || pArrive > 0;
          return (
            <g key={i} opacity={a}>
              <CircuitTrace x1={nodeX(i)} y1={nodeY(i) + r * 0.9} x2={nodeX(i + 1)} y2={nodeY(i + 1) - r * 0.9}
                colors={colors} progress={1} lit={lit} />
            </g>
          );
        })}
        {/* the signal itself, travelling node to node along the same bend */}
        {pAdvance > 0 && posIdx < n - 1 ? (
          <SignalPacket x={packetX} y={packetY} colors={colors} opacity={ease(pAdvance) > 0.02 ? 1 : 0} />
        ) : null}
        {/* the nodes */}
        {Array.from({ length: n }).map((_, i) => {
          const a = ease(Math.max(0, Math.min(1, pStages * n - i * 0.6)));
          const lit = posIdx > i + 0.15 || (pArrive > 0 && i === n - 1);
          // While the packet is parked at a station, THAT station is the one
          // working — the dwell and the station's reaction are the same
          // event seen twice, which is the point of splitting the run into
          // hops. Between hops it falls back to proximity so a station still
          // reacts as the packet passes through it.
          const working = pAdvance > 0 && (dwelling ? i === Math.round(posIdx) : Math.abs(posIdx - i) < 0.4);
          return <CircuitNode key={i} x={nodeX(i)} y={nodeY(i)} r={r} colors={colors} lit={lit} working={working} appear={a} />;
        })}
        {/* arrival: the response leaving the chain.
            Stopped short of the claim when there is one. The trace runs to
            30% of the way off frame, and the claim sits at the bottom of
            the same column, so on a rendered arrive frame the line went
            straight through the glyphs of "STOPS THE WHOLE LINE" — hidden
            on a dark channel by the text's halo, plainly visible on a
            white one (ch-09). */}
        {pArrive > 0 ? (
          <CircuitTrace x1={nodeX(n - 1)} y1={runBottom + r * 0.9} x2={trackX}
            y2={Math.min(
              runBottom + r + (CANVAS_H * 1.12 - runBottom) * ease(pArrive) * 0.3,
              phrase ? claimY - 14 : Infinity
            )}
            colors={colors} progress={1} lit />
        ) : null}
      </svg>
      {Array.from({ length: n }).map((_, i) => {
        const a = ease(Math.max(0, Math.min(1, pStages * n - i * 0.6)));
        const lit = posIdx > i + 0.15 || (pArrive > 0 && i === n - 1);
        const rightSide = i % 2 !== 0;
        return (
          <Label key={i} x={nodeX(i) + (rightSide ? r * 0.75 + 30 : -(r * 0.75 + 30))} y={nodeY(i) - 20}
            text={`${i + 1}`} align={rightSide ? "left" : "right"}
            // WAS 26px. Q11 puts the floor for auxiliary text at 32px /
            // 3% of frame height, measured on the rendered frame — these
            // numerals were the ONLY text in the entire scene and sat
            // under it, which is how a shot ends up with nothing legible
            // in it at all.
            color={lit ? colors.accent : colors.textDim} size={TYPE.support} weight={800} tracking={1}
            opacity={a} fontFamily={fontFamily} halo={colors.bg} />
        );
      })}

      {/* The travelling thing, NAMED, riding along with it.
          A packet moving between anonymous boxes is a screensaver; the
          same packet labelled with the script's own subject is the
          process the line is describing. Typography carried by the moving
          object rather than parked in a caption band — aesthetic-rules C3. */}
      {subject && pAdvance > 0 && posIdx < n - 1 ? (
        <Label
          /* UNDER the packet, centred on it — not beside it. Beside it the
             label sat on top of the node's own pins AND collided with the
             stage numeral, which is parked at nodeX ± (r*0.75 + 30) on the
             same side (confirmed on a rendered advance frame: "REQUEST"
             printed straight through station 2's right-hand pins). Below
             the packet is the one side that carries neither. */
          x={packetX} y={packetY + 62} align="center"
          text={subject}
          color={colors.accent} size={TYPE.support} weight={800} tracking={1.5}
          opacity={ease(Math.min(1, pAdvance * 6))}
          fontFamily={fontFamily} halo={colors.bg}
        />
      ) : null}

      {/* The claim of the line, landing when the run completes. This is the
          scene's dominant element per scene-director rule 3 — one thing the
          viewer must see, at a size nothing else competes with — and it is
          placed against the board rather than centred in a title bar. */}
      {phrase && pArrive > 0 ? (
        <Label
          /* Centred on the BOARD's column, not the canvas's.
             scene-director's consistency pass: a scene's dominant element
             sits on the same column as the composition, because two
             competing alignments in one frame is what reads as "everything
             is everywhere". On a rendered arrive frame the board was
             centred at x≈356 and this phrase at x=540 — two axes, one
             picture. Clamped so a long claim still cannot leave the safe
             rect (width estimated from glyph count; Label has no
             measurement pass). */
          x={(() => {
            const halfW = (phrase.length * phraseSize * GLYPH_W) / 2;
            const lo = CANVAS_W * 0.09 + halfW;
            const hi = CANVAS_W * 0.91 - halfW;
            return lo > hi ? CANVAS_W / 2 : Math.max(lo, Math.min(hi, trackX));
          })()}
          y={claimY}
          text={phrase} align="center"
          color={colors.textPrimary} size={phraseSize} weight={900} tracking={-0.5}
          opacity={ease(Math.min(1, pArrive * 2.2))}
          fontFamily={fontFamily} halo={colors.bg}
        />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CAUSE_EFFECT — one thing driving another, with the link made visible.
// Vertical, so it reads as "this produces that" rather than "these two".
// ─────────────────────────────────────────────────────────────────────────────
export function CauseEffectScene({ beat, colors, fontFamily }) {
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};
  const shot = plan.shot || null;

  const causeText = keyPhrase(sup.cause, 3) || keyPhrase(beat.text, 3);
  const effectText = keyPhrase(sup.effect, 3) || "";
  const marker = String(sup.marker || "").toUpperCase().trim();

  const pCause = useStateProgress(states, "cause");
  const pEffect = useStateProgress(states, "effect");
  // `settle` ("the whole relationship is readable at once") has no visual
  // delta of its own on purpose: by the time it starts, `link` and `effect`
  // are already at progress 1, so the gate is closed, the backlog is at its
  // built level and the downstream slugs are in place. Settle is the HOLD
  // on that resolved picture, not a fifth thing to draw.

  /**
   * REBUILT, NOT POLISHED (visual-system-reset PART 11).
   *
   * The previous two passes made this scene's LINES thicker and gave it
   * filled-adjacent stroke weight (0.6% ink -> 4.1% in the earlier pass),
   * but read cold it was still curved strokes converging through two
   * chevron strokes — primitives with more width, not an object. The
   * "colored wireframe" test (PART 10) fails it: recolouring or thickening
   * those same paths would not change what it is.
   *
   * WHAT IT DRAWS NOW: an actual gated duct (`elements/machine.jsx`).
   *
   *   MachineBody   the casing — a real object with wall and floor, not a
   *                 background the flow happens to sit on
   *   MaterialSlug  discrete filled bodies of material, not stroked lines
   *                 standing in for "flow"
   *   Gate          two facing jaws that physically narrow the channel —
   *                 the constraint is a mechanical part with a visible
   *                 aperture, not a symbol for a constraint
   *
   * The backlog is the upstream slugs themselves compressing toward the
   * gate as it closes (see the upstream block below) rather than a
   * separate "pressure level" indicator — an earlier version tried a
   * pooling-liquid shape here and it read as an unrelated blob sitting
   * under a horizontal duct, not congestion. Downstream material is
   * fewer, thinner slugs than went in — the same "throughput collapsed"
   * argument as before, now carried by objects instead of stroke width.
   */
  const cov = shot ? shot.coverage : 0.74;
  const channelHalfH = (CANVAS_H * 0.34 * (cov / 0.74)) / 2;
  const cy = CANVAS_H * (shot ? shot.anchorY : 0.45);
  const inset = CANVAS_W * (1 - cov) * 0.5;
  const xIn = inset;
  const xOut = CANVAS_W - inset;
  const xGate = xIn + (xOut - xIn) * 0.54;

  const eEffect = ease(pEffect);
  // The gate's own close amount is NOT driven by raw `link` progress — that
  // is 0 at the exact frame `link` (the anchored state) BEGINS, which is
  // the anchor frame itself, so a rendered anchor frame showed no gate at
  // all: the causal word spoken with nothing on screen enacting it.
  // `useValueProgress` counts from the beat's first frame and reaches
  // exactly 1 at the anchor (primitives.jsx), the same technique
  // GEOSPATIAL_RADIUS uses for its boundary lock — the mechanism is already
  // closing while material arrives, and is closed by the time the sentence
  // names it.
  const pValue = useValueProgress(states);
  const gateClose = pValue;

  const UP_SLUGS = 6;
  const DOWN_SLUGS = 3; // fewer than went in — the collapse, as a count of objects

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <MachineBody
          x={xIn - 30} y={cy - channelHalfH - 54} w={xOut - xIn + 60} h={channelHalfH * 2 + 108}
          colors={colors} opacity={ease(pCause)} />

        {/* ── upstream: a queue that visibly compresses as the gate closes ──
            Evenly spaced while the gate is open (material flowing through at
            its own pace); as `pValue` rises toward the gate closing, the
            SAME objects compress into a crowd just short of the gate. That
            compression IS the backlog — material queuing because the gate
            ahead of it is closing — carried by the positions of real
            objects rather than a separate "pressure level" indicator, which
            in a horizontal duct read as an unrelated blob rather than
            congestion. */}
        {Array.from({ length: UP_SLUGS }).map((_, i) => {
          const a = ease(Math.max(0, Math.min(1, pCause * 1.6 - i * 0.12)));
          if (a <= 0.01) return null;
          const phase = seeded(i * 13 + 5);
          const slotsFrom = xIn + 70;
          const slotsTo = xGate - 60;
          const evenX = slotsFrom + (slotsTo - slotsFrom) * (i / Math.max(UP_SLUGS - 1, 1));
          const crowdedX = slotsTo - (UP_SLUGS - 1 - i) * 34;
          const x = evenX + (crowdedX - evenX) * ease(pValue);
          const y = cy + (phase - 0.5) * channelHalfH * 1.1;
          return <MaterialSlug key={i} x={x} y={y} w={54} h={30} colors={colors} opacity={a} />;
        })}

        {/* ── the gate itself ──────────────────────────────────────────── */}
        {pValue > 0.02 ? (
          <Gate cx={xGate} cy={cy} channelHalfH={channelHalfH} close={gateClose} colors={colors} working />
        ) : null}

        {/* ── downstream: fewer, thinner slugs got through ─────────────── */}
        {pEffect > 0
          ? Array.from({ length: DOWN_SLUGS }).map((_, i) => {
              const a = ease(Math.max(0, Math.min(1, pEffect * 2.2 - i * 0.4)));
              if (a <= 0.01) return null;
              const phase = seeded(i * 19 + 41);
              const reach = xGate + 60 + (xOut - xGate - 100) * eEffect * (0.55 + phase * 0.45);
              const y = cy + (phase - 0.5) * channelHalfH * 1.1;
              return <MaterialSlug key={i} x={reach} y={y} w={30} h={17} colors={colors} accent opacity={a} />;
            })
          : null}
      </svg>

      {/* Labels sit ON the thing they name, upstream and downstream — not in
          boxes, and never as the composition. */}
      <Label x={xIn} y={cy - channelHalfH - 90} text={short(causeText, 22)}
        color={colors.textPrimary} size={34} weight={800} tracking={1}
        opacity={pCause} fontFamily={fontFamily} halo={colors.bg} />
      {/* The causal marker rides ON the gate, vertically, because that is
          where the causality physically happens. */}
      {marker ? (
        <div
          style={{
            position: "absolute",
            left: xGate - 160,
            top: cy - channelHalfH * 0.6,
            transform: "rotate(-90deg)",
            transformOrigin: "100% 50%",
            color: colors.accent,
            fontFamily,
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: 3,
            opacity: ease(pValue),
            textShadow: `0 0 10px ${colors.bg}, 0 0 5px ${colors.bg}`,
          }}
        >
          {short(marker, 14)}
        </div>
      ) : null}
      {effectText ? (
        <Label x={xOut} y={cy + channelHalfH + 78} text={short(effectText, 22)}
          color={colors.accent} size={34} weight={800} tracking={1} align="right"
          opacity={pEffect} fontFamily={fontFamily} halo={colors.bg} />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP — several entities and how they connect. Radial, not linear.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * A physical chain link: a stadium-ring cross-section (thick stroke, open
 * centre), not a filled disc. Rendered as a ring because the OBJECT is a
 * ring — a real link — not because a circle is standing in for "a node".
 */
function ChainLink({ cx, cy, w, h, rotateDeg, colors, opacity }) {
  return (
    <g transform={`translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${rotateDeg})`} opacity={opacity}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2}
        fill="none" stroke={colors.stroke} strokeWidth={h * 0.34} />
    </g>
  );
}

/**
 * RELATIONSHIP — entities as physical links interlocking into one chain,
 * not a node graph.
 *
 * SECOND REBUILD OF THIS STRATEGY. The first rebuild (entities converging
 * into a bound mass via curved strands) was rejected on inspection: it
 * still reduced to "labelled things + connectors + one shared convergence
 * point" — a node-and-line diagram with the lines bowed and the node
 * de-circled. Curving the line and de-circling the node changed the
 * geometry, not the IDEA (visual-system-reset PART 29: "curved lines...
 * thicker lines... camera movement... would still be the same idea").
 * The fix has to be a different visual THINKING, not a different render
 * of the same one — this version has no connector element at all: the
 * entities themselves interlock directly, the way real chain links do.
 *
 * WHAT THE REAL DATA SUPPORTS, UNCHANGED FROM THE FIRST REBUILD.
 * `supporting.labels` (director.js) is `entityLabels()` (text-budget.js):
 * distinct content words in first-mention order, no frequency, no
 * strength, no direction. A chain claims exactly that: N things linked
 * into one continuous structure, in the order they were named, with no
 * entity singled out as more important than another — a chain of custody,
 * a settlement chain, a supply chain are real, common, non-decorative
 * readings of "several institutions/things involved together."
 *
 * THE MECHANISM. Each entity is a `ChainLink` — alternating orientation
 * (even links horizontal, odd links vertical, exactly how real chain
 * links interlock at 90 degrees to each other) — starting spread apart
 * with visible gaps and pulling together into an overlapping, interlocked
 * row as the beat plays. The FORMATION of contact between the links IS
 * the connection; nothing is drawn between them because nothing needs to
 * be. If every label were removed, the frame would still read as "several
 * distinct pieces locking into one chain", not "a diagram".
 */
export function RelationshipScene({ beat, colors, fontFamily }) {
  const states = beat.visualStates || [];

  const pEntities = useStateProgress(states, "nodes");
  const pLock = useValueProgress(states);
  const pSettle = useStateProgress(states, "weight");

  const labels = (beat.visualPlan && beat.visualPlan.supporting.labels) || [];
  const n = Math.max(3, Math.min(5, labels.length || 4));

  const f = shotFrame((beat.visualPlan && beat.visualPlan.shot) || null);

  const linkW = Math.min(f.w * 0.24, 190);
  const linkH = linkW * 0.5;
  // 40% overlap merged the chain into one unreadable white mass at this
  // stroke weight (rendered frame: ch-02 RELATIONSHIP weight f657 — four
  // parties, one blob). Links still interlock, but far enough apart that
  // a viewer can count them.
  const spacing = linkW * 0.78;
  const midY = f.cy + f.h * 0.02;
  const sag = f.h * 0.05; // a slight droop toward the centre, like a real hanging chain

  const lockedX = (i) => f.cx - ((n - 1) * spacing) / 2 + i * spacing;
  const spreadX = (i) => f.cx - ((n - 1) * spacing * 2.1) / 2 + i * spacing * 2.1;

  const links = Array.from({ length: n }).map((_, i) => {
    const t = n <= 1 ? 0 : i / (n - 1);
    const droop = Math.sin(t * Math.PI) * sag;
    const x = spreadX(i) + (lockedX(i) - spreadX(i)) * ease(pLock);
    const y = midY + droop * ease(pLock);
    return { x, y, rotate: i % 2 === 0 ? 0 : 90, label: labels[i] || "" };
  });

  // A shared settle once the chain is fully formed — the whole chain
  // reads slightly denser/inked at once, not one link singled out as
  // "the strongest", because nothing in the real data says any of them is.
  const SETTLE_MAX = 1.22;
  const settleTint = 1 + (SETTLE_MAX - 1) * ease(pSettle);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {links.map((l, i) => {
          const appear = ease(Math.max(0, Math.min(1, pEntities * n - i * 0.6)));
          if (appear <= 0.01) return null;
          return (
            <ChainLink key={i} cx={l.x} cy={l.y}
              w={linkW * settleTint} h={linkH * settleTint} rotateDeg={l.rotate}
              colors={colors} opacity={appear} />
          );
        })}
      </svg>

      {links.map((l, i) => {
        const appear = ease(Math.max(0, Math.min(1, pEntities * n - i * 0.6)));
        if (appear <= 0.01 || !l.label) return null;
        // Alternating baselines, same fix the first rebuild needed:
        // real names vary a lot in length ("REGULATOR" vs "BANK"), and
        // interlocked links sit closer together than the first layout's
        // spread row did.
        //
        // CLEARANCE MUST USE THE TALLEST ANY LINK GETS (a rotated link
        // stands linkW tall on screen, not linkH) at its FULLY SETTLED
        // size, not the current animated one, and not just this link's
        // OWN rotation — a rendered frame caught all three misses. Links
        // overlap heavily by design (spacing is 60% of linkW), so a
        // horizontal link's "above" label sits close enough to its
        // ROTATED neighbours that their much-taller vertical extent, not
        // its own shorter one, is what the label actually has to clear.
        const halfExtent = (linkW * SETTLE_MAX) / 2;
        const above = i % 2 === 0;
        return (
          <Label key={i} x={l.x} y={l.y + (above ? -halfExtent - 52 : halfExtent + 74)}
            /* 12 chars truncated real party names to "CLEARING HO…"; 22px was
               under the house label step. Clearance raised because a label
               was landing ON the chain (white on white) at the old offset. */
            text={short(l.label.toUpperCase(), 16)}
            color={colors.textPrimary} size={TYPE.label} weight={800} tracking={1.4} align="center"
            opacity={appear} fontFamily={fontFamily} halo={colors.bg} />
        );
      })}
    </div>
  );
}
