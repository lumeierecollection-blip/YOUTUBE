// Gray Matter's Short. Anatomy comes from public-domain Gray's plates; cell geometry from the Anima kit.
// Every structure on screen is named, and every scene states how strong its evidence is.
import { loadFont } from "@remotion/fonts";
import React, { useEffect, useState } from "react";
import { AbsoluteFill, Easing, Sequence, cancelRender, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";

const FIG_TOP = 340, FIG_H = 1040;
const ease = Easing.bezier(0.2, 0.7, 0.2, 1);
const ramp = (f, a, b, from = 0, to = 1) => interpolate(f, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

function useFonts(type) {
  const [handle] = useState(() => delayRender("gray-matter fonts"));
  useEffect(() => {
    const faces = Object.values(type).flatMap(({ family, files }) => Object.entries(files).map(([weight, file]) => loadFont({ family, url: staticFile(file), weight })));
    Promise.all(faces).then(() => continueRender(handle)).catch((e) => cancelRender(e));
  }, [handle, type]);
}

const Svg = ({ w, h, width, height, style, children }) => <svg viewBox={`0 0 ${w} ${h}`} width={width} height={height} style={{ display: "block", overflow: "visible", ...style }}>{children}</svg>;
const Raw = ({ html, ...rest }) => <g {...rest} dangerouslySetInnerHTML={{ __html: html }} />;

function Heading({ data, c, type }) {
  const f = useCurrentFrame();
  const o = ramp(f, 0, 10);
  return (
    <div style={{ position: "absolute", top: 130, left: 60, right: 60, opacity: o, transform: `translateY(${(1 - o) * 16}px)` }}>
      <div style={{ fontFamily: type.label.family, fontWeight: 700, fontSize: 34, letterSpacing: 2, color: c.regionText }}>{data.kicker}</div>
      <div style={{ fontFamily: type.display.family, fontWeight: 700, fontSize: 70, lineHeight: 1.08, color: c.ink, marginTop: 10 }}>{data.title}</div>
    </div>
  );
}

function Evidence({ data, c, type, labels }) {
  const f = useCurrentFrame();
  if (!data.status) return null;
  const col = c.status[data.status];
  return (
    <div style={{ position: "absolute", top: 1388, left: 60, right: 60, display: "flex", alignItems: "center", gap: 18, opacity: ramp(f, 6, 16) }}>
      <div style={{ fontFamily: type.label.family, fontWeight: 700, fontSize: 32, color: "#fff", background: col, padding: "8px 18px", borderRadius: 8, whiteSpace: "nowrap" }}>{labels[data.status]}</div>
      <div style={{ fontFamily: type.display.family, fontWeight: 700, fontSize: 36, color: c.ink }}>{data.statusDetail}</div>
    </div>
  );
}

const Tag = ({ x, y, text, c, type, color, size = 32, anchor = "start", o = 1 }) => (
  <text x={x} y={y} textAnchor={anchor} opacity={o} style={{ fontFamily: type.label.family, fontWeight: 700, fontSize: size, fill: color || c.ink, paintOrder: "stroke", stroke: "#fff", strokeWidth: 8, strokeLinejoin: "round" }}>{text}</text>
);

// Head faces left, the same way the Gray's plates face, so the cut to the dissection keeps its orientation.
const HEAD = "M 800 1030 C 785 960 775 900 790 850 C 850 780 895 680 895 570 C 895 340 720 185 520 185 C 370 185 280 270 248 385 C 240 415 238 435 240 455 C 222 480 205 510 190 540 C 180 560 190 572 215 574 C 222 590 222 605 216 618 C 226 630 226 645 218 655 C 232 690 258 712 300 715 C 340 718 370 705 398 690 C 420 760 430 900 425 1030";

function Everyday({ data, dur, c, type, plates }) {
  const f = useCurrentFrame();
  const t = f / dur;
  const hours = interpolate(t, [0, 0.5], [23, 31], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hourAngle = (hours % 12) * 30, minuteAngle = (hours % 1) * 360;
  const shown = Math.floor(hours) % 24;
  const clockText = `${shown % 12 === 0 ? 12 : shown % 12} ${shown >= 12 ? "PM" : "AM"}`;
  const phone = 1 - ramp(t, 0.42, 0.5);
  const notes = ramp(t, 0.46, 0.54) * (1 - ramp(t, 0.78, 0.9));
  const brain = ramp(t, 0.5, 0.64);
  const lobe = ramp(t, 0.68, 0.78);
  const zoom = interpolate(t, [0.82, 1], [1, 1.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  return (
    <div style={{ position: "absolute", top: FIG_TOP, left: 0, width: 1080, height: FIG_H, overflow: "hidden" }}>
      <Svg w={1080} h={1040} width={1080} height={1040}>
        <defs><clipPath id="gm-head"><path d={`${HEAD} Z`} /></clipPath></defs>
        <g transform={`translate(608 504) scale(${zoom}) translate(-608 -504)`}>
          <path d={`${HEAD}`} fill="#FFFFFF" stroke={c.ink} strokeWidth={7} strokeLinecap="round" />
          <circle cx={292} cy={480} r={9} fill={c.ink} />
          <g clipPath="url(#gm-head)">
            <image href={plates.lateral} x={265} y={230} width={600} height={347} opacity={brain} style={{ mixBlendMode: "multiply" }} />
            <ellipse cx={608} cy={504} rx={154} ry={62} transform="rotate(-8 608 504)" fill={c.region} opacity={lobe * (0.32 + 0.1 * Math.sin(f / 5))} />
            <ellipse cx={608} cy={504} rx={154} ry={62} transform="rotate(-8 608 504)" fill="none" stroke={c.regionText} strokeWidth={4} opacity={lobe} />
          </g>
          <g opacity={lobe}>
            <path d="M 608 566 L 608 640" stroke={c.regionText} strokeWidth={4} />
            <Tag x={608} y={684} text="Temporal lobe" c={c} type={type} color={c.regionText} size={40} anchor="middle" />
          </g>
        </g>
        <g opacity={1 - ramp(t, 0.8, 0.86)}>
          <circle cx={920} cy={130} r={92} fill="#fff" stroke={c.ink} strokeWidth={7} />
          {Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return <line key={i} x1={920 + Math.sin(a) * 78} y1={130 - Math.cos(a) * 78} x2={920 + Math.sin(a) * 86} y2={130 - Math.cos(a) * 86} stroke={c.ink} strokeWidth={4} />; })}
          <line x1={920} y1={130} x2={920} y2={76} stroke={c.ink} strokeWidth={9} strokeLinecap="round" transform={`rotate(${hourAngle} 920 130)`} />
          <line x1={920} y1={130} x2={920} y2={54} stroke={c.loss} strokeWidth={5} strokeLinecap="round" transform={`rotate(${minuteAngle} 920 130)`} />
          <Tag x={920} y={270} text={clockText} c={c} type={type} size={44} anchor="middle" />
        </g>
        <g opacity={phone}>
          <rect x={46} y={610} width={128} height={230} rx={20} fill={c.ink} />
          <rect x={58} y={626} width={104} height={196} rx={8} fill="#BFE9F0" opacity={0.9 + 0.1 * Math.sin(f / 3)} />
          <path d="M 174 650 L 262 520 L 262 450 L 174 780 Z" fill="#BFE9F0" opacity={0.35} />
          <Tag x={46} y={892} text="Awake all night" c={c} type={type} size={42} />
        </g>
        <g opacity={notes}>
          <rect x={44} y={610} width={150} height={196} rx={10} fill="#fff" stroke={c.ink} strokeWidth={5} />
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={62 + ramp(t, 0.56 + i * 0.03, 0.74 + i * 0.03) * 40} y={638 + i * 30} width={114} height={10} rx={5} fill={c.muted} opacity={1 - ramp(t, 0.56 + i * 0.03, 0.74 + i * 0.03)} />)}
          <Tag x={44} y={858} text="New information" c={c} type={type} size={42} />
        </g>
      </Svg>
    </div>
  );
}

const PLATE_W = 1040;
function Region({ data, dur, c, type, plates }) {
  const f = useCurrentFrame();
  const t = f / dur;
  const k = PLATE_W / plates.size[0];
  const plateH = plates.size[1] * k;
  const zoom = interpolate(t, [0, 1], [1, 1.05], { extrapolateRight: "clamp" });
  const glow = ramp(t, 0.02, 0.22) * (0.72 + 0.2 * Math.sin(f / 6));
  const card = ramp(t, 0.14, 0.3);
  const leader = [290 * k, 356 * k];
  return (
    <div style={{ position: "absolute", top: FIG_TOP, left: 0, width: 1080, height: FIG_H, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 20, top: -76, width: PLATE_W, height: plateH, transform: `scale(${zoom})`, transformOrigin: `${255 * k}px ${250 * k}px` }}>
        <img src={plates.plate} style={{ position: "absolute", inset: 0, width: PLATE_W, height: plateH }} />
        <div style={{ position: "absolute", inset: 0, background: c.region, opacity: glow, mixBlendMode: "multiply", WebkitMaskImage: `url(${plates.mask})`, WebkitMaskSize: "100% 100%", maskImage: `url(${plates.mask})`, maskSize: "100% 100%" }} />
        {/* Covers the plate's small baked-in caption so the larger label below replaces it. */}
        <div style={{ position: "absolute", left: 291 * k, top: 345 * k, width: 150 * k, height: 34 * k, background: "#fff" }} />
        <div style={{ position: "absolute", left: leader[0] - 2.5, top: leader[1] - 8, width: 5, height: 70, background: c.ink }} />
      </div>
      <div style={{ position: "absolute", left: 40, right: 40, top: 0, display: "flex", justifyContent: "space-between", fontFamily: type.label.family, fontWeight: 700, fontSize: 30, color: c.muted }}><span>FRONT</span><span>{data.region.view}</span><span>BACK</span></div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 736, opacity: card, transform: `translateY(${(1 - card) * 20}px)` }}>
        <div style={{ fontFamily: type.display.family, fontWeight: 700, fontSize: 68, color: c.regionText, lineHeight: 1 }}>{data.region.name}</div>
        <div style={{ fontFamily: type.display.family, fontWeight: 700, fontSize: 40, color: c.ink, marginTop: 8 }}>{data.region.where}</div>
        <div style={{ fontFamily: type.display.family, fontWeight: 400, fontSize: 40, color: c.ink, marginTop: 2 }}>{data.region.does}</div>
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 962, fontFamily: type.display.family, fontWeight: 400, fontSize: 28, color: c.muted, opacity: card }}>{data.region.credit}</div>
    </div>
  );
}

function Activity({ data, dur, c, type, plates }) {
  const f = useCurrentFrame();
  const zoomW = 1400, k = zoomW / plates.size[0], cardW = 960, cardH = 410;
  const offX = cardW / 2 - 255 * k, offY = cardH / 2 - 250 * k;
  return (
    <div style={{ position: "absolute", top: FIG_TOP, left: 60, width: cardW, height: FIG_H }}>
      {data.rows.map((row, i) => {
        const appear = ramp(f, 4 + i * 16, 18 + i * 16);
        const glow = row.level * (0.82 + 0.18 * Math.sin(f / 5));
        return (
          <div key={row.label} style={{ position: "absolute", top: i * 440, width: cardW, height: cardH, borderRadius: 18, overflow: "hidden", border: `3px solid ${c.rule}`, opacity: appear, background: "#fff" }}>
            <img src={plates.plate} style={{ position: "absolute", left: offX, top: offY, width: zoomW, opacity: 0.45 }} />
            <div style={{ position: "absolute", left: offX, top: offY, width: zoomW, height: plates.size[1] * k, background: c.region, opacity: glow, WebkitMaskImage: `url(${plates.mask})`, WebkitMaskSize: "100% 100%", maskImage: `url(${plates.mask})`, maskSize: "100% 100%" }} />
            <div style={{ position: "absolute", left: 22, top: 18, fontFamily: type.display.family, fontWeight: 700, fontSize: 44, color: c.ink, background: "#fff", padding: "4px 14px", borderRadius: 8 }}>{row.label}</div>
            <div style={{ position: "absolute", left: 22, bottom: 18, fontFamily: type.display.family, fontWeight: 700, fontSize: 42, color: row.level < 1 ? c.loss : c.regionText, background: "#fff", padding: "4px 14px", borderRadius: 8 }}>{row.value}</div>
            <div style={{ position: "absolute", right: 22, bottom: 18, fontFamily: type.label.family, fontWeight: 700, fontSize: 34, color: c.regionText, background: "#fff", padding: "4px 14px", borderRadius: 8 }}>Hippocampus</div>
            {row.memory ? <div style={{ position: "absolute", right: 22, top: 18, fontFamily: type.display.family, fontWeight: 700, fontSize: 36, color: c.loss, background: "#fff", padding: "6px 14px", borderRadius: 8 }}>{row.memory}</div> : null}
          </div>
        );
      })}
      <div style={{ position: "absolute", top: 890, width: cardW, fontFamily: type.display.family, fontWeight: 400, fontSize: 36, color: c.muted, textAlign: "center" }}>{data.note}</div>
    </div>
  );
}

function Spines({ fig, shrink }) {
  return fig.spines.map((s, i) => {
    const v = shrink ? shrink(i) : 1;
    if (v <= 0.01) return null;
    return <g key={s.id} opacity={Math.min(1, v * 1.4)} transform={`translate(${s.base[0]} ${s.base[1]}) scale(${v}) translate(${-s.base[0]} ${-s.base[1]})`} dangerouslySetInnerHTML={{ __html: s.svg }} />;
  });
}

const LOST = [1, 4, 6];
function NeuronSpines({ data, dur, c, type, figures }) {
  const f = useCurrentFrame();
  const t = f / dur;
  const { neuron, synapse: fig } = figures;
  const syn = fig.synapse;
  const show = ramp(t, 0.03, 0.14);
  const panel = ramp(t, 0.08, 0.2);
  const shrink = (i) => (LOST.includes(i) ? 1 - ramp(t, 0.56 + LOST.indexOf(i) * 0.08, 0.72 + LOST.indexOf(i) * 0.08) : 1);
  const period = 42;
  const phase = (f % period) / period;
  const particles = [0, 1, 2, 3, 4].map((i) => {
    const p = Math.min(1, Math.max(0, phase * 1.5 - i * 0.08));
    const target = syn.receptors[i % syn.receptors.length].at;
    return { x: syn.release[0] + (target[0] - syn.release[0]) * p, y: syn.release[1] + (target[1] - syn.release[1]) * p, o: p <= 0 || p >= 1 ? 0 : 1 };
  });
  const scale = 1040 / fig.W;
  const label = (x, y, text, anchor, ax, ay, delay) => {
    const o = ramp(t, delay, delay + 0.08);
    return (
      <g opacity={o}>
        <line x1={ax} y1={ay} x2={x + (anchor === "end" ? 10 : -10)} y2={y - 10} stroke={c.ink} strokeWidth={2.5} />
        <circle cx={ax} cy={ay} r={5} fill={c.ink} />
        <Tag x={x} y={y} text={text} c={c} type={type} size={30} anchor={anchor} />
      </g>
    );
  };
  return (
    <div style={{ position: "absolute", top: FIG_TOP, left: 0, width: 1080, height: FIG_H }}>
      <div className="iso" data-theme="light" style={{ position: "absolute", left: 30, top: 0, opacity: show }}>
        <Svg w={neuron.W} h={neuron.H} width={480} height={380}><Raw html={neuron.svg} /></Svg>
      </div>
      <div style={{ position: "absolute", left: 540, top: 96, right: 40, opacity: show }}>
        <div style={{ fontFamily: type.display.family, fontWeight: 700, fontSize: 52, color: c.ink, lineHeight: 1.05 }}>{data.neuronTitle}</div>
        <div style={{ fontFamily: type.display.family, fontWeight: 700, fontSize: 40, color: c.regionText, marginTop: 8 }}>{data.neuronRegion}</div>
        <div style={{ fontFamily: type.display.family, fontWeight: 400, fontSize: 34, color: c.muted, marginTop: 8 }}>One dendrite, magnified below</div>
      </div>
      <svg width={1080} height={420} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: panel }}>
        <circle cx={30 + neuron.anchors.magnified[0]} cy={neuron.anchors.magnified[1]} r={20} fill="none" stroke={c.region} strokeWidth={5} />
        <line x1={30 + neuron.anchors.magnified[0]} y1={neuron.anchors.magnified[1] + 20} x2={60} y2={398} stroke={c.region} strokeWidth={4} />
      </svg>
      <div className="iso" data-theme="light" style={{ position: "absolute", left: 20, top: 396, width: 1040, height: 636, borderRadius: 18, border: `4px solid ${c.region}`, background: "#fff", opacity: panel, overflow: "hidden" }}>
        <Svg w={fig.W} h={fig.H} width={1040} height={fig.H * scale} style={{ marginTop: 6 }}>
          <Raw html={syn.axon} />
          <Spines fig={fig} shrink={shrink} />
          <Raw html={syn.terminal} />
          <Raw html={fig.shaft} />
          {syn.vesicles.map((v, i) => <circle key={i} cx={v.at[0]} cy={v.at[1]} r={v.r} fill={c.transmitter} stroke={c.ink} strokeWidth={1.5} />)}
          {syn.receptors.map((r, i) => <rect key={i} x={r.at[0] - r.w / 2} y={r.at[1] - r.h} width={r.w} height={r.h} rx={2} fill={c.region} stroke={c.ink} strokeWidth={1.2} />)}
          {particles.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={fig.k * 0.9} fill={c.transmitter} opacity={p.o} />)}
          {label(fig.anchors.terminal[0] - 90, fig.anchors.terminal[1] - 40, "Presynaptic terminal", "middle", fig.anchors.terminal[0], fig.anchors.terminal[1], 0.2)}
          {label(fig.anchors.vesicle[0] - 250, fig.anchors.vesicle[1] + 18, "Vesicles", "end", fig.anchors.vesicle[0], fig.anchors.vesicle[1], 0.26)}
          {label(fig.anchors.cleft[0] + 90, fig.anchors.cleft[1] + 8, "Synaptic cleft", "start", fig.anchors.cleft[0], fig.anchors.cleft[1], 0.32)}
          {label(fig.anchors.receptor[0] + 110, fig.anchors.receptor[1] + 66, "Receptors", "start", fig.anchors.receptor[0], fig.anchors.receptor[1], 0.38)}
          {label(fig.anchors.spine[0] - 170, fig.anchors.spine[1] - 52, "Dendritic spine", "end", fig.anchors.spine[0], fig.anchors.spine[1], 0.44)}
          {label(fig.anchors.dendrite[0] - 60, fig.anchors.dendrite[1] + 78, "Dendrite", "middle", fig.anchors.dendrite[0], fig.anchors.dendrite[1], 0.5)}
        </Svg>
        <div style={{ position: "absolute", left: 18, right: 18, bottom: 54, textAlign: "center", fontFamily: type.display.family, fontWeight: 700, fontSize: 42, color: c.loss, opacity: ramp(t, 0.6, 0.72) }}>{data.result}</div>
        <div style={{ position: "absolute", left: 18, right: 18, bottom: 14, textAlign: "center", fontFamily: type.display.family, fontWeight: 400, fontSize: 26, color: c.muted }}>{data.scaleNote}</div>
      </div>
    </div>
  );
}

function Rescue({ data, dur, c, type, figures }) {
  const f = useCurrentFrame();
  const t = f / dur;
  const { bare, actin } = figures;
  const split = ramp(t, 0.12, 0.34) * 34;
  const cofilin = ramp(t, 0.04, 0.12);
  const loss = (i) => (LOST.includes(i) ? 1 - ramp(t, 0.26 + LOST.indexOf(i) * 0.06, 0.46 + LOST.indexOf(i) * 0.06) : 1);
  const figH = 250, panelH = 372;
  return (
    <div style={{ position: "absolute", top: FIG_TOP, left: 0, width: 1080, height: FIG_H }}>
      <div className="iso" data-theme="light" style={{ position: "absolute", left: 40, top: 0, width: 1000 }}>
        <Svg w={actin.W} h={actin.H} width={1000} height={actin.H}>
          <Raw html={actin.left} transform={`translate(${-split} 0)`} />
          <Raw html={actin.right} transform={`translate(${split} 0)`} />
          <circle cx={actin.gap[0]} cy={actin.gap[1] - 52} r={20} fill={c.loss} opacity={cofilin} />
          <Tag x={actin.gap[0] + 32} y={actin.gap[1] - 41} text="Cofilin" c={c} type={type} size={34} color={c.loss} o={cofilin} />
          <Tag x={110} y={actin.gap[1] + 62} text="Actin filament" c={c} type={type} size={30} color={c.muted} o={cofilin} />
        </Svg>
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 150, textAlign: "center", fontFamily: type.display.family, fontWeight: 700, fontSize: 40, color: c.loss }}>{data.actinLabel}</div>
      {data.panels.map((p, i) => (
        <div key={p.label} className="iso" data-theme="light" style={{ position: "absolute", left: 20, top: 224 + i * (panelH + 22), width: 1040, height: panelH, borderRadius: 18, border: `3px solid ${c.rule}`, background: "#fff", opacity: ramp(f, 2 + i * 8, 12 + i * 8), overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 22, top: 12, fontFamily: type.display.family, fontWeight: 700, fontSize: 42, color: c.ink }}>{p.label}</div>
          <div style={{ position: "absolute", left: 22, bottom: 14, fontFamily: type.label.family, fontWeight: 700, fontSize: 30, color: c.muted }}>Dendrite with spines</div>
          <div style={{ position: "absolute", left: 20, top: 68 }}>
            <Svg w={bare.W} h={bare.H} width={1000} height={figH}>
              <Spines fig={bare} shrink={p.loses ? loss : null} />
              <Raw html={bare.shaft} />
            </Svg>
          </div>
          <div style={{ position: "absolute", right: 22, bottom: 10, fontFamily: type.display.family, fontWeight: 700, fontSize: 40, color: p.loses ? c.loss : c.status.established_fact, background: "#fff", padding: "2px 12px", borderRadius: 8, opacity: ramp(t, 0.5, 0.6) }}>{p.outcome}</div>
        </div>
      ))}
    </div>
  );
}

function Ledger({ data, dur, c, type, figures, labels }) {
  const f = useCurrentFrame();
  const t = f / dur;
  const { bare } = figures;
  const regrow = (i) => (LOST.includes(i) ? ramp(t, 0.02 + LOST.indexOf(i) * 0.05, 0.2 + LOST.indexOf(i) * 0.05, 0.02, 1) : 1);
  return (
    <div style={{ position: "absolute", top: FIG_TOP, left: 0, width: 1080, height: FIG_H + 60 }}>
      <div className="iso" data-theme="light" style={{ position: "absolute", left: 40, top: 0 }}>
        <Svg w={bare.W} h={bare.H} width={1000} height={200}>
          <Spines fig={bare} shrink={regrow} />
          <Raw html={bare.shaft} />
        </Svg>
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 208, textAlign: "center", fontFamily: type.display.family, fontWeight: 700, fontSize: 42, color: c.status.causation }}>{data.recoveryLabel}</div>
      {data.ledger.map((row, i) => {
        const a = ramp(t, 0.26 + i * 0.09, 0.36 + i * 0.09);
        const col = c.status[row.status];
        return (
          <div key={row.head} style={{ position: "absolute", left: 40, right: 40, top: 288 + i * 186, minHeight: 170, display: "flex", opacity: a, transform: `translateX(${(1 - a) * 40}px)` }}>
            <div style={{ width: 14, borderRadius: 7, background: col, marginRight: 24 }} />
            <div>
              <div style={{ fontFamily: type.label.family, fontWeight: 700, fontSize: 32, color: col }}>{labels[row.status]}</div>
              <div style={{ fontFamily: type.display.family, fontWeight: 700, fontSize: 46, color: c.ink, lineHeight: 1.1, marginTop: 2 }}>{row.head}</div>
              <div style={{ fontFamily: type.display.family, fontWeight: 400, fontSize: 36, color: c.muted, marginTop: 2 }}>{row.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const TREATMENTS = { "everyday-to-biology": Everyday, "region-highlight": Region, "activity-compare": Activity, "neuron-to-spines": NeuronSpines, "mechanism-rescue": Rescue, "evidence-ledger": Ledger };

function Captions({ captions, c, type }) {
  const f = useCurrentFrame();
  const cue = captions.find((x) => f >= x.from && f < x.to);
  if (!cue) return null;
  return <div style={{ position: "absolute", top: 1474, left: 60, right: 60, textAlign: "center", fontFamily: type.display.family, fontWeight: 700, fontSize: 56, lineHeight: 1.16, color: c.ink }}>{cue.text}</div>;
}

function Short({ scenes, captions, figures, plates, palette: c, type, statusLabels: labels }) {
  useFonts(type);
  return (
    <AbsoluteFill style={{ background: c.paper }}>
      {figures.css ? <style>{figures.css}</style> : null}
      {scenes.map((s) => {
        const Treatment = TREATMENTS[s.treatment];
        return (
          <Sequence key={s.treatment} from={s.from} durationInFrames={s.duration} layout="none">
            <AbsoluteFill style={{ background: c.paper }}>
              <Treatment data={s} dur={s.duration} c={c} type={type} figures={figures} plates={plates} labels={labels} />
              <Heading data={s} c={c} type={type} />
              {s.treatment === "evidence-ledger" ? null : <Evidence data={s} c={c} type={type} labels={labels} />}
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <Captions captions={captions} c={c} type={type} />
    </AbsoluteFill>
  );
}

const EMPTY_TYPE = { display: { family: "sans-serif", files: {} }, label: { family: "monospace", files: {} } };
export const compositions = [{ id: "GrayMatterShort", component: Short, durationInFrames: 840, fps: 30, width: 1080, height: 1920, defaultProps: { scenes: [], captions: [], figures: {}, plates: {}, palette: { paper: "#FFFFFF", ink: "#16181D" }, type: EMPTY_TYPE, statusLabels: {} } }];
