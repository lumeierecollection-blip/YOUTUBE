import React, { useEffect } from "react";
import { AbsoluteFill, Composition, delayRender, continueRender, registerRoot, useCurrentFrame } from "remotion";
import Layer from "../../../src/skills/remotion-render/layers/Layer.jsx";
import Rule from "./probe-prims/Rule.jsx";
import Chip from "./probe-prims/Chip.jsx";
import Node from "./probe-prims/Node.jsx";
import Panel from "./probe-prims/Panel.jsx";
import Icon from "./probe-prims/Icon.jsx";

const RECTS = [{"rect":{"role":"kicker","x":48,"y":288,"w":400,"h":72,"from":0,"to":90,"structural":false,"persistent":true},"role":"kicker","enter":{"pattern":"RISE"},"exit":{"pattern":"NONE"},"text":"02 THE PROBE","fontSize":64,"fontFamily":"ProbeSans"},{"rect":{"role":"chart","x":88,"y":432,"w":760,"h":464,"from":0,"to":84,"structural":false,"persistent":false},"role":"chart","enter":{"pattern":"POP"},"exit":{"pattern":"FADE"},"text":"","fontSize":null,"fontFamily":null},{"rect":{"role":"headline","x":48,"y":964,"w":760,"h":96,"from":0,"to":84,"structural":false,"persistent":false},"role":"headline","enter":{"pattern":"RISE"},"exit":{"pattern":"FADE"},"text":"THE PROBE SETTLED","fontSize":84,"fontFamily":"ProbeSans"},{"rect":{"role":"caption","x":148,"y":1176,"w":640,"h":72,"from":0,"to":90,"structural":false,"persistent":true},"role":"caption","enter":{"pattern":"RISE"},"exit":{"pattern":"NONE"},"text":"A probe caption line","fontSize":64,"fontFamily":"ProbeSans"},{"rect":{"role":"rail","x":48,"y":288,"w":4,"h":960,"from":0,"to":90,"structural":true,"persistent":true},"role":"rail","enter":{"pattern":"NONE"},"exit":{"pattern":"NONE"},"text":"","fontSize":null,"fontFamily":null},{"rect":{"role":"support","x":48,"y":908,"w":304,"h":32,"from":0,"to":84,"structural":false,"persistent":false},"role":"support","enter":{"pattern":"NONE"},"exit":{"pattern":"FADE"},"text":"SOURCE: TIER 2 PROBE","fontSize":32,"fontFamily":"ProbeSans"},{"rect":{"role":"accent","x":48,"y":1060,"w":760,"h":4,"from":0,"to":84,"structural":true,"persistent":false},"role":"accent","enter":{"pattern":"FADE"},"exit":{"pattern":"FADE"},"text":"","fontSize":null,"fontFamily":null},{"rect":{"role":"caption","x":148,"y":1096,"w":640,"h":72,"from":0,"to":84,"structural":false,"persistent":false},"role":"caption-test","enter":{"pattern":"RISE"},"exit":{"pattern":"FADE"},"text":"CAPTION EXIT BRANCH","fontSize":64,"fontFamily":"ProbeSans"}];
const SAFE = {"left":48,"right":888,"top":288,"bottom":1248};
const COLORS = {"bg":"#001114","surface":"#092124","raised":"#183033","stroke":"#4F686C","textPrimary":"#D0E2E5","textDim":"#768789","accent":"#D24D47"};

function contentFor(r) {
  switch (r.role) {
    case "kicker":
      return <Icon name="flame" color={COLORS.accent} size={64} />;
    case "chart":
      return <Panel colors={COLORS}><Node colors={COLORS} active /><Chip colors={COLORS} active>PROBE</Chip></Panel>;
    case "rail":
      return <Rule colors={COLORS} x1={2} y1={0} x2={2} y2={100} thickness={4} />;
    case "accent":
      return <Rule colors={COLORS} thickness={4} color={COLORS.accent} />;
    default:
      return <span style={{ fontSize: r.fontSize, fontFamily: r.fontFamily, color: r.role === "headline" ? COLORS.textPrimary : COLORS.textDim }}>{r.text}</span>;
  }
}

function Scene() {
  const frame = useCurrentFrame();
  useEffect(() => {
    const handle = delayRender("tier2-probe");
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
      </div>
    </AbsoluteFill>
  );
}

const Root = () => <Composition id="Tier2Probe" component={Scene} durationInFrames={90} fps={30} width={1080} height={1920} />;
registerRoot(Root);
