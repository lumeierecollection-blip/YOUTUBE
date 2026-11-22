import React from "react";
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";

const colors = { ink: "#101820", paper: "#F1EEE7", muted: "#A9B2B8", gold: "#D5A84F", grass: "#4D9A70" };
const asset = (p) => staticFile(String(p || "").replace(/^\/+/, ""));

function Pitch({ tactical = {}, frame = 0 }) {
  const points = Array.isArray(tactical.points) ? tactical.points : [];
  const paper = tactical.style === "whiteboard";
  const path = points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const dash = interpolate(frame, [0, 20], [150, 0], { extrapolateRight: "clamp" });
  return <svg viewBox="0 0 1000 620" style={{ width: "100%", height: "100%" }} aria-label="Tactical pitch">
    <rect x="8" y="8" width="984" height="604" rx="18" fill={paper ? "#f8f4eb" : "#17352C"} stroke={paper ? "#17202a" : "#C9D5C8"} strokeWidth="4" />
    <line x1="500" y1="8" x2="500" y2="612" stroke={paper ? "#17202a" : "#C9D5C8"} strokeWidth="3" />
    <circle cx="500" cy="310" r="82" fill="none" stroke={paper ? "#17202a" : "#C9D5C8"} strokeWidth="3" />
    <rect x="8" y="175" width="145" height="270" fill="none" stroke={paper ? "#17202a" : "#C9D5C8"} strokeWidth="3" />
    <rect x="847" y="175" width="145" height="270" fill="none" stroke={paper ? "#17202a" : "#C9D5C8"} strokeWidth="3" />
    {path && <path d={path} fill="none" stroke={colors.gold} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="150" strokeDashoffset={dash} markerEnd="url(#arrow)" />}
    <defs><marker id="arrow" markerWidth="12" markerHeight="12" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10" fill="none" stroke={colors.gold} strokeWidth="2" /></marker></defs>
    {points.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r="19" fill={p.team === "opponent" ? "#E8ECE7" : colors.gold} stroke={colors.ink} strokeWidth="4" /><text x={p.x} y={p.y + 6} textAnchor="middle" fill={colors.ink} fontSize="17" fontWeight="800">{p.number || ""}</text></g>)}
  </svg>;
}

function MatchLayer({ scene, opacity = 1 }) {
  const media = scene.media || {};
  if (media.kind === "match-footage" && media.path) {
    return <OffthreadVideo src={asset(media.path)} startFrom={media.trim_start_frames || 0} endAt={media.trim_end_frames || undefined} muted style={{ width: "100%", height: "100%", objectFit: "cover", opacity }} />;
  }
  if (media.kind === "player-photo" && media.path) {
    return <Img src={asset(media.path)} style={{ width: "100%", height: "100%", objectFit: "cover", opacity }} />;
  }
  if (media.kind === "stadium" && media.path) return <Img src={asset(media.path)} style={{ width: "100%", height: "100%", objectFit: "cover", opacity }} />;
  return null;
}

function EvidencePanel({ scene, frame }) {
  const e = scene.evidence || {};
  const pulse = interpolate(frame, [0, 18], [0.94, 1], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: e.background || "#073b3a", color: "#f4f0e8" }}>
    <div style={{ position: "absolute", inset: e.fullBleed ? "0%" : "8% 8% 18%", borderRadius: e.fullBleed ? 0 : 28, overflow: "hidden", background: e.panel || "linear-gradient(135deg,#194b4b,#0c252e)", boxShadow: e.fullBleed ? "none" : "0 20px 60px #0008", transform: `scale(${pulse})` }}>
      {scene.media?.kind === "match-footage" && scene.media.path && <OffthreadVideo src={asset(scene.media.path)} startFrom={scene.media.trim_start_frames || 0} muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "saturate(.88) contrast(1.08)" }} />}
      {e.image && <Img src={asset(e.image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "saturate(.82) contrast(1.08)" }} />}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 35%, #5eaa75aa, transparent 42%), repeating-linear-gradient(0deg,#ffffff08 0 2px,transparent 2px 7px)" }} />
      {e.kind === "split" && <>{e.image && <Img src={asset(e.image)} style={{ position: "absolute", left: 0, top: 0, width: e.image2 ? "50%" : "100%", height: "100%", objectFit: "cover", filter: "saturate(.85) contrast(1.1)" }} />}{e.image2 && <Img src={asset(e.image2)} style={{ position: "absolute", right: 0, top: 0, width: "50%", height: "100%", objectFit: "cover", filter: "saturate(.85) contrast(1.1)" }} />}<div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,#07151caa 0%,#07151c22 48%,#07151caa 100%)" }} /><div style={{ position: "absolute", left: "5%", top: "12%", fontSize: 110, fontWeight: 900 }}>A</div><div style={{ position: "absolute", right: "5%", top: "12%", fontSize: 110, fontWeight: 900 }}>B</div><div style={{ position: "absolute", left: "8%", right: "8%", top: "34%", height: 4, background: "#f0cf72" }} /><div style={{ position: "absolute", left: "43%", top: "39%", fontSize: 36, fontWeight: 800, letterSpacing: 4 }}>OR</div></>}
      {e.kind === "stats" && <><div style={{ position: "absolute", left: "8%", top: "12%", fontSize: 38, letterSpacing: 5, textTransform: "uppercase", color: "#e7c96b" }}>BETWEEN THE LINES</div><div style={{ position: "absolute", left: "10%", right: "10%", bottom: "20%", height: 18, background: "#ffffff22", borderRadius: 12 }}><div style={{ width: "72%", height: "100%", background: "#e7c96b", borderRadius: 12 }} /></div><div style={{ position: "absolute", left: "10%", bottom: "25%", fontSize: 112, fontWeight: 900 }}>22 → 31</div></>}
      {e.kind === "table" && <><div style={{ position: "absolute", left: "8%", right: "8%", top: "18%", bottom: "16%", background: "#07151dcc", border: "2px solid #d8e2df" }} /><div style={{ position: "absolute", left: "10%", right: "10%", top: "24%", display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16, fontSize: 28, fontWeight: 800 }}>{[["PLAYER","BETWEEN","BREAKING"],["Jones","14","19"],["Mac Allister","9","11"],["Gravenberch","6","8"]].map((row,i)=>row.map((v,j)=><div key={`${i}-${j}`} style={{ color: i===1 ? "#e7c96b" : "#f4f0e8", borderBottom: "2px solid #ffffff33", padding: "12px 0" }}>{v}</div>))}</div><div style={{ position: "absolute", left: "10%", top: "10%", fontSize: 34, fontWeight: 800 }}>PLAYER / RECEPTIONS / PASSES</div></>}
      {e.kind === "chart" && <><div style={{ position: "absolute", left: "10%", right: "10%", bottom: "20%", height: 4, background: "#f4f0e8" }} /><div style={{ position: "absolute", left: "10%", top: "20%", bottom: "20%", width: 4, background: "#f4f0e8" }} /><svg viewBox="0 0 700 300" style={{ position: "absolute", left: "12%", top: "24%", width: "76%", height: "50%" }}><polyline points="0,250 110,190 210,210 330,100 450,160 570,60 700,110" fill="none" stroke="#e7c96b" strokeWidth="8" /></svg><div style={{ position: "absolute", left: "10%", top: "10%", fontSize: 38, fontWeight: 800 }}>LINE-BREAKING PASSES</div></>}
      {e.kind === "comparison" && <><div style={{ position: "absolute", left: "12%", right: "52%", top: "22%", bottom: "22%", background: "#f4f0e822", border: "2px solid #f4f0e8" }} /><div style={{ position: "absolute", left: "52%", right: "12%", top: "22%", bottom: "22%", background: "#e7c96b33", border: "2px solid #e7c96b" }} /><div style={{ position: "absolute", left: "45%", top: "42%", fontSize: 56, fontWeight: 900 }}>VS</div></>}
      {e.kind === "incident" && <><div style={{ position: "absolute", inset: "18% 12%", border: "5px solid #f4f0e8", transform: "perspective(500px) rotateX(16deg)" }} /><div style={{ position: "absolute", left: "12%", bottom: "16%", fontSize: 34, fontWeight: 800 }}>ANFIELD / SECOND HALF</div></>}
      {e.kind === "map" && <><div style={{ position: "absolute", inset: "18% 14%", border: "3px solid #f4f0e8" }} /><div style={{ position: "absolute", left: "24%", top: "54%", width: "50%", height: 5, background: "#e7c96b", transform: "rotate(-16deg)" }} /><div style={{ position: "absolute", right: "18%", top: "28%", fontSize: 52, fontWeight: 900 }}>2 + 1</div></>}
    </div>
    <div style={{ position: "absolute", left: "8%", bottom: "7%", fontSize: 25, color: "#f1d27a", letterSpacing: 4, textTransform: "uppercase" }}>{e.label || "ORIGINAL EDITORIAL RECONSTRUCTION"}</div>
    <div style={{ position: "absolute", right: "8%", bottom: "7%", fontSize: 20, color: "#c9d5c8" }}>RIVAL LINES / EVIDENCE</div>
  </AbsoluteFill>;
}

function ReferenceOpeningScene({ scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(frame, [0, Math.max(1, Math.round(fps * 0.35))], [0, 1], { extrapolateRight: "clamp" });
  const zoom = interpolate(frame, [0, Math.max(1, Math.round(fps * 4))], [1.02, 1.08], { extrapolateRight: "clamp" });
  const media = scene.media || {};
  return <AbsoluteFill style={{ background: scene.visual?.background || "#101820", color: colors.paper, opacity: fade, overflow: "hidden", fontFamily: "Inter, Arial, sans-serif" }}>
    <div style={{ position: "absolute", left: "8%", right: "8%", top: "9%", height: "67%", borderRadius: 24, overflow: "hidden", boxShadow: "0 24px 70px #000b", background: "#17242b" }}>
      {media.path && <OffthreadVideo src={asset(media.path)} startFrom={media.trim_start_frames || 0} muted style={{ width: "100%", height: "100%", objectFit: "cover", scale: zoom, filter: "saturate(.86) contrast(1.1)" }} />}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,#07151caa,transparent 58%,#07151c44), linear-gradient(0deg,#07151ccc 0%,transparent 46%)" }} />
      <div style={{ position: "absolute", left: "4%", top: "5%", fontSize: 18, letterSpacing: 4, fontWeight: 800, color: colors.gold }}>{scene.reference_label || "REFERENCE-LOCKED OPENING"}</div>
    </div>
    <div style={{ position: "absolute", left: "8%", right: "8%", bottom: "8%", padding: "18px 26px 20px", background: "rgba(7,18,24,.94)", borderLeft: `6px solid ${colors.gold}`, boxShadow: "0 12px 35px #0009" }}>
      <div style={{ color: colors.gold, fontSize: 18, letterSpacing: 4, fontWeight: 800, textTransform: "uppercase", marginBottom: 8 }}>{scene.kicker || "RIVAL LINES"}</div>
      <div style={{ fontSize: 52, lineHeight: 1.02, fontWeight: 900 }}>{scene.title}</div>
      {scene.caption && <div style={{ marginTop: 8, fontSize: 21, color: "#e8ebe6" }}>{scene.caption}</div>}
    </div>
    <div style={{ position: "absolute", left: "8%", top: "4%", color: colors.paper, fontSize: 17, letterSpacing: 3 }}>RIVAL LINES / REFERENCE ADAPTATION</div>
  </AbsoluteFill>;
}

function AdaptationVideo({ scene, frame }) {
  const treatment = scene.visual?.treatment || "rounded-action";
  const media = scene.media || {};
  const zoom = interpolate(frame, [0, 150], [1.02, 1.08], { extrapolateRight: "clamp" });
  const video = media.path ? <OffthreadVideo src={asset(media.path)} startFrom={media.trim_start_frames || 0} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})`, filter: "saturate(.82) contrast(1.1)" }} /> : null;
  const bg = treatment === "argument-card" || treatment === "scatter-graph" || treatment === "comparison-table" ? "#521d38" : "#101820";
  const label = <div style={{ position: "absolute", left: "6%", top: "5%", color: colors.gold, fontSize: 21, letterSpacing: 4, fontWeight: 800, textTransform: "uppercase" }}>RIVAL LINES / EDITORIAL RECONSTRUCTION</div>;
  const lower = <div style={{ position: "absolute", left: "6%", right: "6%", bottom: "6%", padding: "18px 26px", background: "#071218dd", borderLeft: `6px solid ${colors.gold}`, boxShadow: "0 12px 30px #0008" }}><div style={{ color: colors.gold, fontSize: 20, letterSpacing: 4, fontWeight: 800 }}>{scene.kicker}</div><div style={{ marginTop: 8, fontSize: 52, lineHeight: 1.02, fontWeight: 900 }}>{scene.title}</div><div style={{ marginTop: 8, fontSize: 22, color: "#e8ebe6" }}>{scene.caption}</div></div>;
  const footage = <div style={{ position: "absolute", left: "7%", right: "7%", top: "12%", height: "55%", borderRadius: 28, overflow: "hidden", boxShadow: "0 22px 70px #000b", background: "#17242b" }}>{video}<div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg,#071218cc,transparent 55%)" }} /></div>;
  const bars = <div style={{ position: "absolute", left: "10%", right: "10%", top: "29%" }}>{[["OPEN-PLAY CHANCE",61,"#a9b2b8"],["PENALTY",79,"#d5a84f"],["PREMIER LEAGUE PENALTY",90,"#4d9a70"]].map(([name,value,color],i)=><div key={name} style={{ marginBottom: 28 }}><div style={{ display:"flex", justifyContent:"space-between", fontSize:24, fontWeight:800 }}><span>{name}</span><span>{value}%</span></div><div style={{ height:22, marginTop:8, background:"#ffffff22", borderRadius:14, overflow:"hidden" }}><div style={{ width:`${value}%`, height:"100%", background:color, transformOrigin:"left", transform:`scaleX(${interpolate(frame,[0,35],[0,1],{extrapolateRight:"clamp"})})` }} /></div></div>)}</div>;
  const graph = <svg viewBox="0 0 900 460" style={{ position:"absolute", left:"9%", right:"9%", top:"20%", height:"52%" }}><rect x="70" y="20" width="780" height="360" fill="#07121888" stroke="#f1eee7" strokeWidth="3"/><line x1="110" y1="340" x2="810" y2="60" stroke="#d5a84f" strokeWidth="5"/><text x="80" y="410" fill="#f1eee7" fontSize="22">OPEN-PLAY GOALS →</text><text x="20" y="180" fill="#f1eee7" fontSize="22" transform="rotate(-90 20 180)">TOTAL GOALS</text>{[[180,260,"PALMER"],[330,210,"KANE"],[500,170,"SALAH"],[670,110,"BRUNO"]].map(([x,y,n])=><g key={n}><circle cx={x} cy={y} r="16" fill="#d5a84f"/><text x={x+24} y={y+8} fill="#f1eee7" fontSize="22" fontWeight="700">{n}</text></g>)}</svg>;
  const timeline = <div style={{ position:"absolute", left:"10%", right:"10%", top:"30%", height:8, background:"#d5a84f" }}>{[[0,"1891"],[.34,"1995"],[.7,"2017 / VAR"],[1,"NOW"]].map(([x,t])=><div key={t} style={{ position:"absolute", left:`${x*100}%`, top:-14, width:28, height:36, borderRadius:20, background:"#f1eee7", border:"6px solid #d5a84f" }}><div style={{ position:"absolute", top:48, left:-24, width:150, fontSize:23, fontWeight:800 }}>{t}</div></div>)}</div>;
  const shootout = <div style={{ position:"absolute", left:"10%", right:"10%", top:"22%", display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:18 }}>{["1","2","3","4","5"].map((n,i)=><div key={n} style={{ aspectRatio:"1", borderRadius:"50%", border:`5px solid ${i<3?colors.gold:"#a9b2b8"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:52, fontWeight:900, background:i<3?"#d5a84f33":"#ffffff11" }}>{n}</div>)}</div>;
  return <AbsoluteFill style={{ background:bg, color:colors.paper, overflow:"hidden", fontFamily:"Inter, Arial, sans-serif" }}>{label}{treatment === "split-hook" ? <><div style={{ position:"absolute", left:"6%", right:"6%", top:"13%", height:"58%", display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>{[0,1].map((i)=><div key={i} style={{ borderRadius:28, overflow:"hidden", position:"relative", background:"#17242b" }}>{media.path && <OffthreadVideo src={asset(media.path)} startFrom={(media.trim_start_frames||0)+i*45} muted style={{ width:"100%", height:"100%", objectFit:"cover", filter:"saturate(.8) contrast(1.1)" }}/>}<div style={{ position:"absolute", left:"5%", top:"5%", fontSize:84, fontWeight:900 }}>{i?"B":"A"}</div></div>)}</div><div style={{ position:"absolute", left:"48%", top:"39%", fontSize:34, fontWeight:900, letterSpacing:5 }}>OR</div></> : treatment === "xg-bars" || treatment === "solution-ladder" ? <>{footage}<div style={{ position:"absolute", left:"8%", right:"8%", top:"12%", padding:"16px 22px", background:"#071218dd", fontSize:28, fontWeight:800 }}>THE VALUE OF THE RESTART</div>{bars}</> : treatment === "history-timeline" || treatment === "var-timeline" ? <>{footage}<div style={{ position:"absolute", left:"8%", right:"8%", top:"13%", padding:"16px 22px", background:"#071218dd", fontSize:28, fontWeight:800 }}>THE PENALTY / A RULE THAT CHANGED FOOTBALL</div>{timeline}</> : treatment === "scatter-graph" ? graph : treatment === "shootout" ? <>{footage}{shootout}</> : treatment === "split-comparison" || treatment === "player-comparison" || treatment === "comparison-table" ? <>{footage}<div style={{ position:"absolute", left:"10%", right:"10%", top:"27%", display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}><div style={{ padding:24, background:"#f1eee722", border:"2px solid #f1eee7" }}><div style={{ fontSize:24, color:colors.gold }}>OPEN PLAY</div><div style={{ fontSize:72, fontWeight:900 }}>0.15</div><div style={{ fontSize:22 }}>many possible outcomes</div></div><div style={{ padding:24, background:"#d5a84f33", border:"2px solid #d5a84f" }}><div style={{ fontSize:24, color:colors.gold }}>PENALTY</div><div style={{ fontSize:72, fontWeight:900 }}>0.79</div><div style={{ fontSize:22 }}>one rehearsed outcome</div></div></div></> : treatment === "freeze-counterfactual" || treatment === "var-freeze" || treatment === "pressure-freeze" ? <>{footage}<div style={{ position:"absolute", left:"12%", right:"12%", top:"25%", height:"34%", border:"5px solid #d5a84f", transform:"perspective(500px) rotateX(8deg)" }} /><div style={{ position:"absolute", right:"12%", top:"29%", padding:"14px 20px", background:"#d5a84f", color:colors.ink, fontSize:25, fontWeight:900 }}>FREEZE / REVIEW</div></> : treatment === "league-density" ? <>{footage}{bars}</> : <>{footage}<div style={{ position:"absolute", left:"10%", right:"10%", top:"28%", padding:28, background:"#071218dd", border:"2px solid #f1eee7" }}><div style={{ fontSize:28, color:colors.gold }}>THE ARGUMENT</div><div style={{ marginTop:12, fontSize:50, fontWeight:900 }}>LET THE ATTACK CONTINUE</div></div></>}{lower}</AbsoluteFill>;
}

function RivalLinesScene({ scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(frame, [0, Math.max(1, Math.round(fps * 0.45))], [0, 1], { extrapolateRight: "clamp" });
  const isTactical = scene.visual?.type === "tactical";
  const isEvidence = scene.visual?.type === "evidence";
  if (scene.visual?.type === "reference-opening") return <ReferenceOpeningScene scene={scene} />;
  if (scene.visual?.type === "reference-adaptation") return <AdaptationVideo scene={scene} frame={frame} />;
  return <AbsoluteFill style={{ backgroundColor: colors.ink, color: colors.paper, opacity: fade, overflow: "hidden", fontFamily: "Inter, Arial, sans-serif" }}>
    {!isTactical && scene.media?.path && <MatchLayer scene={scene} opacity={scene.media?.kind === "player-photo" ? 0.82 : 1} />}
    {!isTactical && !scene.media?.path && <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", border: "8px solid #b54848", background: "#260f13" }}><div style={{ color: "#ffd9d5", fontSize: 30, fontWeight: 800, letterSpacing: 3 }}>UNRESOLVED MEDIA — NOT APPROVABLE</div></AbsoluteFill>}
    {!isTactical && scene.media?.path && <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(8,14,20,.86) 0%, rgba(8,14,20,.48) 48%, rgba(8,14,20,.05) 100%)" }} />}
    {isTactical && <AbsoluteFill style={{ background: scene.visual?.tactical?.style === "whiteboard" ? "#eee9de" : "radial-gradient(ellipse at 50% 45%, #213e32 0%, #101820 72%)" }}>
      {scene.media?.kind === "match-footage" && scene.media.path && <OffthreadVideo src={asset(scene.media.path)} startFrom={scene.media.trim_start_frames || 0} muted style={{ position: "absolute", left: "8%", right: "8%", top: "9%", height: "43%", width: "84%", objectFit: "cover", borderRadius: 22, filter: "saturate(.84) contrast(1.08)" }} />}
      <div style={{ position: "absolute", left: "10%", right: "10%", top: scene.media?.path ? "55%" : "12%", bottom: "18%", color: scene.visual?.tactical?.style === "whiteboard" ? "#17202a" : "#f4f0e8" }}>
        <div style={{ position: "absolute", left: 0, top: scene.media?.path ? -36 : -10, color: scene.visual?.tactical?.style === "whiteboard" ? "#17202a" : "#f4f0e8", fontSize: 28, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase" }}>{scene.visual?.tactical?.style === "whiteboard" ? "SECOND-HALF STRUCTURE / ORIGINAL DRAWING" : "TACTICAL MAP"}</div>
        <Pitch tactical={scene.visual.tactical} frame={frame} />
      </div>
    </AbsoluteFill>}
    {isEvidence && <EvidencePanel scene={scene} frame={frame} />}
    {scene.branding?.crest_path && <Img src={asset(scene.branding.crest_path)} style={{ position: "absolute", top: "6%", right: "7%", width: "8%", height: "auto", objectFit: "contain", filter: "drop-shadow(0 4px 12px #0009)" }} />}
    {scene.branding?.competition_path && <Img src={asset(scene.branding.competition_path)} style={{ position: "absolute", top: "7%", right: "17%", width: "6%", height: "auto", objectFit: "contain" }} />}
    <div style={{ position: "absolute", left: "8%", bottom: "8%", width: "76%", opacity: fade }}>
      <div style={{ display: "inline-block", padding: "14px 22px 16px", borderRadius: 8, background: "rgba(7,18,24,.88)", boxShadow: "0 8px 28px #0008" }}>
        {scene.kicker && <div style={{ color: colors.gold, fontSize: 19, letterSpacing: 4, fontWeight: 800, textTransform: "uppercase", marginBottom: 10 }}>{scene.kicker}</div>}
        {scene.title && <div style={{ fontFamily: "Inter, Arial, sans-serif", fontSize: 58, lineHeight: 1.02, fontWeight: 900, maxWidth: "100%", letterSpacing: -1 }}>{scene.title}</div>}
        {scene.scoreline && <div style={{ marginTop: 12, fontSize: 24, fontWeight: 800, color: colors.paper }}>{scene.scoreline}</div>}
        {scene.caption && <div style={{ marginTop: 10, fontSize: 20, color: "#e8ebe6", maxWidth: "82%" }}>{scene.caption}</div>}
      </div>
    </div>
    <div style={{ position: "absolute", left: "8%", top: "7%", color: colors.paper, fontSize: 17, letterSpacing: 3, textTransform: "uppercase", opacity: 0.88 }}>{scene.player?.name || "RIVAL LINES"}{scene.match?.short_label ? `  /  ${scene.match.short_label}` : ""}</div>
  </AbsoluteFill>;
}

export function RivalLinesVideo({ storyboard, onlySceneId = null }) {
  const scenes = (storyboard?.scenes || []).filter((s) => !onlySceneId || s.id === onlySceneId);
  let cursor = 0;
  return <AbsoluteFill style={{ backgroundColor: colors.ink }}>{scenes.map((scene) => {
    const duration = Math.max(1, Number(scene.duration_frames) || 1);
    const start = cursor;
    cursor += duration;
    return <Sequence key={scene.id} from={start} durationInFrames={duration} name={`scene:${scene.id}`}><RivalLinesScene scene={scene} /></Sequence>;
  })}{!onlySceneId && storyboard?.voiceover?.render_path && <Audio src={asset(storyboard.voiceover.render_path)} />}</AbsoluteFill>;
}

export function rivalLinesComposition(storyboard) {
  const scenes = storyboard?.scenes || [];
  return { id: "RivalLinesVideo", component: RivalLinesVideo,
    width: Number(storyboard?.width) || 1920, height: Number(storyboard?.height) || 1080,
    fps: Number(storyboard?.fps) || 30,
    durationInFrames: Math.max(1, scenes.reduce((n, s) => n + Math.max(1, Number(s.duration_frames) || 1), 0)),
    defaultProps: { storyboard, onlySceneId: null },
  };
}

export { RivalLinesScene, Pitch, ReferenceOpeningScene };
