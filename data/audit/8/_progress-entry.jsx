import React, { useEffect } from "react";
import { AbsoluteFill, Composition, delayRender, continueRender, registerRoot, useCurrentFrame } from "remotion";
import Layer from "../../../src/skills/remotion-render/layers/Layer.jsx";
import { Progress } from "../../../src/skills/remotion-render/beats/Progress.jsx";

const RECTS = [{"rect":{"role":"kicker","x":48,"y":288,"w":168,"h":32,"from":0,"to":90,"structural":false,"persistent":true},"role":"kicker","enter":{"pattern":"RISE"},"exit":{"pattern":"NONE"},"text":"01 FIXTURE","fontSize":28,"fontFamily":"Inter"},{"rect":{"role":"rail","x":48,"y":288,"w":4,"h":960,"from":0,"to":90,"structural":true,"persistent":true},"role":"rail","enter":{"pattern":"NONE"},"exit":{"pattern":"NONE"},"text":"","fontSize":null,"fontFamily":null},{"rect":{"role":"caption","x":88,"y":1104,"w":760,"h":144,"from":0,"to":90,"structural":false,"persistent":true},"role":"caption","enter":{"pattern":"RISE"},"exit":{"pattern":"NONE"},"text":"Rates grew from 12 percent in 2019 to 47 percent in 2024.","fontSize":64,"fontFamily":"Inter"},{"rect":{"role":"headline","x":48,"y":1004,"w":656,"h":96,"from":18,"to":84,"structural":false,"persistent":false},"role":"headline","enter":{"pattern":"RISE"},"exit":{"pattern":"FADE"},"text":"12 percent in","fontSize":84,"fontFamily":"Inter"},{"rect":{"role":"chart","x":88,"y":432,"w":760,"h":464,"from":0,"to":90,"structural":false,"persistent":false},"role":"chart","enter":{"pattern":"CHART_BUILD"},"exit":{"pattern":"NONE"},"text":"","fontSize":null,"fontFamily":null,"chart":{"axisY":896,"gridX":88,"barAreaTop":432,"barW":376,"gutter":8,"bars":[{"label":"2019","value":12,"x":88,"w":376,"h":120,"y":776,"bottom":896,"highlight":false},{"label":"2024","value":47,"x":472,"w":376,"h":464,"y":432,"bottom":896,"highlight":true}],"gutters":[8,8],"highlightIndex":1,"axisLabelRight":76},"unit":"%","anchorFrame":10}];
const G5 = {"rect":{"role":"chart","x":88,"y":432,"w":760,"h":464,"from":0,"to":90,"structural":false,"persistent":false},"chart":{"axisY":896,"gridX":88,"barAreaTop":432,"barW":376,"gutter":8,"bars":[{"label":"2019","value":850,"x":88,"w":376,"h":320,"y":576,"bottom":896,"highlight":false},{"label":"2024","value":1240,"x":472,"w":376,"h":464,"y":432,"bottom":896,"highlight":true}],"gutters":[8,8],"highlightIndex":1,"axisLabelRight":76},"unit":"views","anchorFrame":10};
const SAFE = {"top":288,"bottom":1248,"left":48,"right":888};
const COLORS = {"bg":"#001114","surface":"#092124","raised":"#183033","stroke":"#4F686C","textPrimary":"#D0E2E5","textDim":"#768789","accent":"#D24D47"};

function contentFor(r) {
  switch (r.role) {
    case "chart":
      return <Progress chart={r.chart} colors={COLORS} unit={r.unit} anchorFrame={r.anchorFrame} data-chart-instance="main" />;
    case "rail":
      return <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", backgroundColor: COLORS.stroke }} />;
    default:
      return <span style={{ fontSize: r.fontSize, fontFamily: r.fontFamily, color: COLORS.textPrimary, whiteSpace: "nowrap" }}>{r.text}</span>;
  }
}

function Scene() {
  const frame = useCurrentFrame();
  useEffect(() => {
    const handle = delayRender("progress-probe");
    try {
      console.log("=====PROBE-BEGIN=====");
      console.log("FRAME|" + frame);
      const root = document.getElementById("probe-root");
      const rr = root.getBoundingClientRect();
      const scale = rr.width / 1080;
      console.log("ROOT|scale=" + scale.toFixed(6) + "|" + rr.width + "x" + rr.height + "|docleft=" + rr.left.toFixed(1) + "|doctop=" + rr.top.toFixed(1));
      document.querySelectorAll("[data-rect-id]").forEach((el) => {
        const id = Number(el.getAttribute("data-rect-id"));
        const r = el.getBoundingClientRect();
        const m = { x: (r.left - rr.left) / scale, y: (r.top - rr.top) / scale, w: r.width / scale, h: r.height / scale };
        const e = RECTS[id];
        console.log("LAYER|" + id + "|" + e.role + "|" + m.x.toFixed(2) + "|" + m.y.toFixed(2) + "|" + m.w.toFixed(2) + "|" + m.h.toFixed(2) + "|" + e.rect.x + "|" + e.rect.y + "|" + e.rect.w + "|" + e.rect.h + "|" + (m.x - e.rect.x).toFixed(2) + "|" + (m.y - e.rect.y).toFixed(2) + "|" + (m.w - e.rect.w).toFixed(2) + "|" + (m.h - e.rect.h).toFixed(2));
        const cross = Math.max(0, SAFE.left - m.x, m.x + m.w - SAFE.right, SAFE.top - m.y, m.y + m.h - SAFE.bottom);
        const cs = getComputedStyle(el);
        const selfFlex = cs.display === "flex" ? 1 : 0;
        const parentFlex = getComputedStyle(el.parentElement).display === "flex" ? 1 : 0;
        console.log("SAFE|" + id + "|" + e.role + "|" + cross.toFixed(2));
        console.log("FLEX|" + id + "|" + e.role + "|self=" + selfFlex + "|parent=" + parentFlex);
        console.log("OPACITY|" + id + "|" + e.role + "|" + Number(cs.opacity).toFixed(3));
      });
      document.querySelectorAll("[data-chart-instance=main] [data-bar-id]").forEach((el) => {
        const id = Number(el.getAttribute("data-bar-id"));
        const r = el.getBoundingClientRect();
        const m = { x: (r.left - rr.left) / scale, y: (r.top - rr.top) / scale, w: r.width / scale, h: r.height / scale };
        const val = el.querySelector("[data-value-id]");
        const fill = getComputedStyle(el).backgroundColor;
        console.log("BAR|" + id + "|" + m.x.toFixed(2) + "|" + m.y.toFixed(2) + "|" + m.w.toFixed(2) + "|" + m.h.toFixed(2) + "|" + (val ? val.textContent : "-") + "|" + fill);
      });
      document.querySelectorAll("[data-chart-instance=main] [data-role=gridline]").forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const m = { x: (r.left - rr.left) / scale, y: (r.top - rr.top) / scale, w: r.width / scale, h: r.height / scale };
        console.log("GRIDLINE|" + i + "|" + m.x.toFixed(2) + "|" + m.y.toFixed(2) + "|" + m.w.toFixed(2) + "|" + m.h.toFixed(2));
      });
      const bl = document.querySelector("[data-chart-instance=main] [data-role=baseline]");
      if (bl) { const r = bl.getBoundingClientRect(); console.log("BASELINE|" + ((r.left - rr.left) / scale).toFixed(2) + "|" + ((r.top - rr.top) / scale).toFixed(2) + "|" + (r.width / scale).toFixed(2) + "|" + (r.height / scale).toFixed(2)); }
      const al = document.querySelector("[data-chart-instance=main] [data-role=axis-label]");
      if (al) { const r = al.getBoundingClientRect(); const cs = getComputedStyle(al); console.log("AXISLABEL|" + ((r.left - rr.left) / scale).toFixed(2) + "|" + ((r.top - rr.top) / scale).toFixed(2) + "|" + (r.width / scale).toFixed(2) + "|" + (r.height / scale).toFixed(2) + "|op=" + Number(cs.opacity).toFixed(3)); }
      document.querySelectorAll("[data-chart-instance=g5] [data-value-id]").forEach((el) => {
        const id = Number(el.getAttribute("data-value-id"));
        console.log("GVALUE|" + id + "|" + el.textContent);
      });
      console.log("=====PROBE-END=====");
      continueRender(handle);
    } catch (err) {
      console.log("PROBE ERROR: " + String(err && err.message ? err.message : err));
      continueRender(handle);
    }
  }, [frame]);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <div id="probe-root" style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920 }}>
        {RECTS.map((r, i) => (
          <Layer key={i} data-rect-id={i} rect={r.rect} enter={r.enter} exit={r.exit}>
            {contentFor(r)}
          </Layer>
        ))}
        <Layer rect={G5.rect} enter={{ pattern: 'CHART_BUILD', atFrame: 0 }} exit={{ pattern: 'NONE' }}>
          <Progress chart={G5.chart} colors={COLORS} unit={G5.unit} anchorFrame={G5.anchorFrame} data-chart-instance="g5" />
        </Layer>
      </div>
    </AbsoluteFill>
  );
}

const Root = () => <Composition id="ProgressProbe" component={Scene} durationInFrames={90} fps={30} width={1080} height={1920} />;
registerRoot(Root);
