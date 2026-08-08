
import React from "react";
import { registerRoot, Composition, AbsoluteFill, useCurrentFrame } from "remotion";
import "../../../src/skills/remotion-render/wait-for-fonts.js";
import { HeroNumber } from "../../../src/skills/remotion-render/beats/HeroNumber.jsx";
import { reserveCounterWidth, HEADLINE_FONT } from "../../../src/skills/remotion-render/layout/measure.js";

const WIRED = [{"id":"t11-13600-inter","value":13600,"unit":"","fontFamily":"Inter","stage":{"x":48,"y":392,"w":840,"h":548},"colors":{"bg":"#0B0F19","surface":"#141A26","accent":"#22D3EE","textPrimary":"#F1F5F9","textDim":"#94A3B8","stroke":"#334155"},"anchorFrame":10},{"id":"t11-1986-inter","value":1986,"unit":"","fontFamily":"Inter","stage":{"x":48,"y":392,"w":840,"h":548},"colors":{"bg":"#0B0F19","surface":"#141A26","accent":"#22D3EE","textPrimary":"#F1F5F9","textDim":"#94A3B8","stroke":"#334155"},"anchorFrame":10},{"id":"t11-2000-dmsans","value":2000,"unit":"","fontFamily":"DM Sans","stage":{"x":48,"y":392,"w":840,"h":548},"colors":{"bg":"#0B0F19","surface":"#141A26","accent":"#22D3EE","textPrimary":"#F1F5F9","textDim":"#94A3B8","stroke":"#334155"},"anchorFrame":10},{"id":"t11-800-dmsans","value":800,"unit":"","fontFamily":"DM Sans","stage":{"x":48,"y":392,"w":840,"h":548},"colors":{"bg":"#0B0F19","surface":"#141A26","accent":"#22D3EE","textPrimary":"#F1F5F9","textDim":"#94A3B8","stroke":"#334155"},"anchorFrame":10}];

function Measure({ compId, frame, fontFamily }) {
  React.useEffect(() => {
    const root = document.querySelector("[data-root]");
    const rr = root ? root.getBoundingClientRect() : { x: 0, y: 0 };
    const el = document.querySelector('[data-role="numeral"]');
    const rows = [];
    if (el) {
      const r = el.getBoundingClientRect();
      rows.push({
        id: "numeral",
        role: "numeral",
        x: r.x - rr.x,
        y: r.y - rr.y,
        w: r.width,
        h: r.height,
        ow: el.offsetWidth,
        oh: el.offsetHeight,
        text: el.textContent ? el.textContent.trim() : "",
      });
    }
    console.log("TYPE_MEASURE:" + compId + "@f" + frame + ":" + JSON.stringify(rows));
    if (el) {
      // A1.1 direct check: the reserved width for the CURRENT string must be
      // a grid multiple (ceil8) and cover the rendered box (>= DOM width).
      // Try/catch: a measurement throw must never hang the render — log it.
      try {
        const rect = el.getBoundingClientRect();
        const finalStr = el.textContent.trim();
        // Reserve with the numeral's ACTUAL render font size (fit-computed by
        // HeroNumber) — measuring without fontSize returns ~16px default and
        // is physically meaningless (probe finding, see report).
        const fontSize = Number.parseFloat(window.getComputedStyle(el).fontSize);
        // Rule 5.2: the measurement must use the SAME font properties as the
        // render — the numeral span carries fontVariantNumeric:"tabular-nums"
        // (HeroNumber.jsx), so the reserve must too; without it, Inter
        // measures narrower than it renders and the slot wouldn't fit.
        const fontStyle = { fontFamily, ...HEADLINE_FONT, fontVariantNumeric: "tabular-nums" };
        const reserved = reserveCounterWidth(finalStr, fontStyle, fontSize);
        console.log("TYPE_RESERVE:" + compId + ":" + JSON.stringify({
          str: finalStr,
          fontSize,
          reserved,
          domW: rect.width,
          fits: reserved >= rect.width - 0.001,
        }));
      } catch (err) {
        console.log("TYPE_RESERVE:" + compId + ":{\"error\":\"" + String(err && err.message ? err.message : err).replace(/"/g, "'") + "\"}");
      }
    }
  }, []);
  return null;
}

function Run({ run }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill data-root style={{ backgroundColor: run.colors.bg }}>
      {/* HeroNumber destructures fontFamily but never applies it (finding 4-1);
          the wrapper sets it so the numeral inherits the REAL face. */}
      <div style={{ fontFamily: run.fontFamily, position: "absolute", inset: 0 }}>
        <HeroNumber
          rects={{}}
          stage={run.stage}
          colors={run.colors}
          anchorFrame={run.anchorFrame}
          frame={frame}
          value={run.value}
          unit={run.unit}
        />
      </div>
      <Measure compId={run.id} frame={frame} fontFamily={run.fontFamily} />
    </AbsoluteFill>
  );
}

export const RemotionRoot = () => (
  <>
    {WIRED.map((run) => (
      <Composition
        key={run.id}
        id={run.id}
        component={Run}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ run }}
      />
    ))}
  </>
);

registerRoot(RemotionRoot);
