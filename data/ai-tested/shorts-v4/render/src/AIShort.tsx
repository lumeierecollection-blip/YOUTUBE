import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { loadFont as loadSG } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: sg } = loadSG();
const { fontFamily: inter } = loadInter();

type Beat = {
  t:number; dur:number; narration:string; visual:string; headline:string; sub?:string;
  accent?:string; bg?:string; anim?:string; assets?:string[]; photo?:string; photo_credit?:string;
  left?:string; right?:string; cta?:string;
};
type Plan = { id:string; slug:string; title:string; concept:string; sources:string[]; cta?:string; beats:Beat[]; duration_target_sec?:number };
export type AIShortProps = { plan: Plan; audioSrc: string; audioDurationSec: number };

const clamp = (v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const txt = (s?:string)=> (s||"").toUpperCase();

const Bg: React.FC<{bg:string; accent:string; dark?:boolean}> = ({bg, accent, dark}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const d = interpolate(frame,[0,durationInFrames],[0,-30]);
  const grid = dark ? "rgba(255,255,255,0.06)" : "rgba(17,17,17,0.045)";
  return <AbsoluteFill style={{background:bg}}>
    <div style={{position:"absolute",inset:-50,transform:`translateY(${d}px)`,backgroundImage:`linear-gradient(${grid} 1px,transparent 1px),linear-gradient(90deg,${grid} 1px,transparent 1px)`,backgroundSize:"72px 72px"}} />
    <div style={{position:"absolute",top:-180,right:-120,width:460,height:460,borderRadius:999,background:accent,opacity:dark?0.18:0.08}} />
    <div style={{position:"absolute",bottom:160,left:-160,width:420,height:420,borderRadius:999,background:accent,opacity:dark?0.12:0.05}} />
  </AbsoluteFill>;
};

const LogoRow: React.FC<{logos?:string[]; dark?:boolean; size?:number}> = ({logos=[],dark,size=110}) => {
  if(!logos.length) return null;
  return <div style={{display:"flex",gap:18,flexWrap:"wrap",justifyContent:"center",alignItems:"center"}}>
    {logos.map(l=> <div key={l} style={{width:size,height:size,borderRadius:28,background:dark?"rgba(255,255,255,0.08)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.14)":"#E2E2DC"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <Img src={staticFile(`logos/${l}-white.svg`)} style={{width:size*0.55,height:size*0.55,objectFit:"contain",filter: dark?"none":"brightness(0)"}} />
    </div>)}
  </div>;
};

const Head: React.FC<{beat:Beat; dark?:boolean}> = ({beat,dark}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame,fps,config:{damping:200},durationInFrames:14});
  const y = interpolate(enter,[0,1],[50,0]);
  const o = interpolate(enter,[0,1],[0,1]);
  const accent = beat.accent||"#111";
  const ink = dark?"#FAFAF8":"#111111";
  const muted = dark?"rgba(250,250,248,0.72)":"#555";
  const size = beat.headline.length>14?108:beat.headline.length>9?128:150;
  return <div style={{transform:`translateY(${y}px)`,opacity:o}}>
    <div style={{display:"inline-block",padding:"10px 18px",background:accent,color:"#fff",fontFamily:inter,fontWeight:800,fontSize:24,letterSpacing:"0.1em"}}>{txt(beat.visual.replace(/_/g," "))}</div>
    <div style={{marginTop:28,fontFamily:sg,fontWeight:800,fontSize:size,lineHeight:0.88,letterSpacing:"-0.04em",color:ink,textTransform:"uppercase"}}>{beat.headline}</div>
    <div style={{marginTop:24,width:interpolate(frame,[2,22],[0,920],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}),maxWidth:"100%",height:10,background:accent}} />
    {beat.sub ? <div style={{marginTop:24,fontFamily:inter,fontWeight:700,fontSize:40,lineHeight:1.2,color:muted,maxWidth:940}}>{beat.sub}</div> : null}
  </div>;
};

const FrameShell: React.FC<{beat:Beat; children:React.ReactNode}> = ({beat,children}) => {
  const dark = (beat.bg||"").toLowerCase() < "#888888" && (beat.bg||"#fff").startsWith("#1" ) || (beat.bg||"").includes("111") || (beat.bg||"").includes("0F") || (beat.bg||"").includes("0f");
  const bg = beat.bg || "#FAFAF8";
  const isDark = ["#111111","#111827","#0F172A","#0f172a","#111"].includes(bg) || bg.toLowerCase()==="#111111";
  const accent = beat.accent||"#111";
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const exit = interpolate(frame,[durationInFrames-7,durationInFrames],[1,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return <AbsoluteFill style={{opacity:exit}}>
    <Bg bg={bg} accent={accent} dark={isDark} />
    <div style={{position:"absolute",inset:0,padding:"72px 62px 88px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,fontFamily:sg,fontWeight:700,fontSize:28,letterSpacing:"0.14em",color:isDark?"#FAFAF8":"#111"}}><div>AI TESTED</div><div style={{fontFamily:inter,fontSize:22,color:isDark?"rgba(250,250,248,0.65)":"#666"}}>V4</div></div>
      <Head beat={beat} dark={isDark} />
      <div style={{position:"absolute",left:62,right:62,top:820,bottom:140,display:"flex",alignItems:"center",justifyContent:"center"}}>{children}</div>
      <div style={{position:"absolute",left:62,right:62,bottom:54,display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-end"}}>
        <div style={{fontFamily:inter,fontSize:20,color:isDark?"rgba(250,250,248,0.65)":"#666",maxWidth:640,lineHeight:1.3}}>{beat.photo_credit || beat.cta || ""}</div>
        {beat.cta ? <div style={{fontFamily:inter,fontWeight:800,fontSize:22,color:accent,maxWidth:360,textAlign:"right"}}>{beat.cta}</div> : null}
      </div>
    </div>
  </AbsoluteFill>;
};

const Stat: React.FC<{beat:Beat; dark:boolean}> = ({beat,dark}) => {
  const frame=useCurrentFrame(); const {durationInFrames}=useVideoConfig();
  const s=interpolate(frame,[0,Math.min(20,durationInFrames-1)],[0.85,1],{extrapolateRight:"clamp"});
  return <div style={{textAlign:"center",transform:`scale(${s})`}}>
    <div style={{fontFamily:sg,fontWeight:800,fontSize:170,lineHeight:0.85,color:beat.accent||"#111",letterSpacing:"-0.05em"}}>{beat.headline}</div>
    <div style={{marginTop:24,fontFamily:inter,fontWeight:800,fontSize:42,color:dark?"#FAFAF8":"#111",lineHeight:1.2,maxWidth:860}}>{beat.sub}</div>
    <div style={{marginTop:30}}><LogoRow logos={beat.assets} dark={dark} size={120} /></div>
  </div>;
};

const CutoutHero: React.FC<{beat:Beat; dark:boolean}> = ({beat,dark}) => {
  const frame=useCurrentFrame(); const {durationInFrames}=useVideoConfig();
  const y=interpolate(frame,[0,durationInFrames],[30,-20]);
  return <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
    <div style={{position:"absolute",width:680,height:680,borderRadius:999,background:beat.accent||"#111",opacity:0.08}} />
    {beat.photo ? <Img src={staticFile(`photos/${beat.photo}`)} style={{maxWidth:"92%",maxHeight:"92%",objectFit:"contain",transform:`translateY(${y}px)`,filter:"drop-shadow(0 28px 40px rgba(17,17,17,0.18))"}} /> : <LogoRow logos={beat.assets} dark={dark} size={160} />}
  </div>;
};

const Split: React.FC<{beat:Beat; dark:boolean}> = ({beat,dark}) => (
  <div style={{width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
    {[{t:beat.left||"",a:beat.assets?.[0]},{t:beat.right||"",a:beat.assets?.[1]}].map((side,i)=>(
      <div key={i} style={{background:dark?"rgba(255,255,255,0.06)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.12)":"#E2E2DC"}`,padding:"34px 24px",minHeight:420,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:28}}>
        {side.a ? <Img src={staticFile(`logos/${side.a}-white.svg`)} style={{width:120,height:120,objectFit:"contain",filter:dark?"none":"brightness(0)"}} /> : null}
        <div style={{fontFamily:sg,fontWeight:800,fontSize:52,lineHeight:0.95,color:i===0?(beat.accent||"#111"):(dark?"#FAFAF8":"#111"),textAlign:"center",textTransform:"uppercase"}}>{side.t}</div>
      </div>
    ))}
  </div>
);

const Stamp: React.FC<{beat:Beat; dark:boolean}> = ({beat,dark}) => {
  const frame=useCurrentFrame(); const rot=interpolate(frame,[0,10],[-8,-2],{extrapolateRight:"clamp"});
  return <div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:26}}>
    <div style={{padding:"26px 34px",border:`8px solid ${beat.accent||"#B91C1C"}`,color:beat.accent||"#B91C1C",fontFamily:sg,fontWeight:800,fontSize:72,letterSpacing:"0.06em",transform:`rotate(${rot}deg)`,background:dark?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.7)"}}>{beat.headline}</div>
    <div style={{width:"100%",padding:"30px",background:dark?"rgba(255,255,255,0.06)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.12)":"#E2E2DC"}`}}>
      <div style={{fontFamily:inter,fontWeight:700,fontSize:42,lineHeight:1.25,color:dark?"#FAFAF8":"#111",textAlign:"center"}}>{beat.sub}</div>
    </div>
    <LogoRow logos={beat.assets} dark={dark} size={110} />
  </div>;
};

const Kinetic: React.FC<{beat:Beat; dark:boolean}> = ({beat,dark}) => {
  const frame=useCurrentFrame(); const {durationInFrames}=useVideoConfig();
  const x=interpolate(frame,[0,durationInFrames],[40,-20]);
  return <div style={{width:"100%",textAlign:"center"}}>
    <div style={{fontFamily:sg,fontWeight:800,fontSize:120,lineHeight:0.88,color:beat.accent||"#111",textTransform:"uppercase",transform:`translateX(${x}px)`}}>{beat.headline}</div>
    <div style={{marginTop:30,fontFamily:inter,fontWeight:700,fontSize:44,color:dark?"#FAFAF8":"#333",lineHeight:1.2}}>{beat.sub}</div>
    <div style={{marginTop:34}}><LogoRow logos={beat.assets} dark={dark} /></div>
  </div>;
};

const Quote: React.FC<{beat:Beat; dark:boolean}> = ({beat,dark}) => (
  <div style={{width:"100%",padding:"44px 40px",background:dark?"rgba(255,255,255,0.06)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.12)":"#E2E2DC"}`,borderLeft:`16px solid ${beat.accent||"#111"}`}}>
    <div style={{fontFamily:sg,fontWeight:800,fontSize:110,lineHeight:0.8,color:beat.accent||"#111"}}>“</div>
    <div style={{marginTop:10,fontFamily:inter,fontWeight:800,fontSize:50,lineHeight:1.2,color:dark?"#FAFAF8":"#111"}}>{beat.sub}</div>
    <div style={{marginTop:28}}><LogoRow logos={beat.assets} dark={dark} size={110} /></div>
  </div>
);

const Card: React.FC<{beat:Beat; dark:boolean; big?:boolean}> = ({beat,dark,big}) => (
  <div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:28}}>
    <LogoRow logos={beat.assets} dark={dark} size={big?150:124} />
    <div style={{width:"100%",padding:"36px",background:dark?"rgba(255,255,255,0.06)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.12)":"#E2E2DC"}`,borderLeft:`14px solid ${beat.accent||"#111"}`}}>
      <div style={{fontFamily:inter,fontWeight:800,fontSize:big?50:44,lineHeight:1.22,color:dark?"#FAFAF8":"#111",textAlign:"center"}}>{beat.sub}</div>
    </div>
  </div>
);

const BeatView: React.FC<{beat:Beat}> = ({beat}) => {
  const bg=beat.bg||"#FAFAF8";
  const dark=["#111111","#111827","#0F172A","#0f172a"].includes(bg);
  const v=beat.visual;
  let inner:React.ReactNode;
  if(v==="hero_cutout") inner=<CutoutHero beat={beat} dark={dark}/>;
  else if(v==="stat_counter") inner=<Stat beat={beat} dark={dark}/>;
  else if(v==="split_compare") inner=<Split beat={beat} dark={dark}/>;
  else if(v==="logo_grid") inner=<div style={{width:"100%"}}><LogoRow logos={beat.assets} dark={dark} size={150}/></div>;
  else if(v==="stamp_document"||v==="legal_stack") inner=<Stamp beat={beat} dark={dark}/>;
  else if(v==="kinetic_type"||v==="full_bleed_type") inner=<Kinetic beat={beat} dark={dark}/>;
  else if(v==="quote_card") inner=<Quote beat={beat} dark={dark}/>;
  else if(v==="evidence_board") inner=<div style={{width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>{(beat.sub||"").split("·").map((s,i)=><div key={i} style={{padding:"24px",background:dark?"rgba(255,255,255,0.06)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.12)":"#E2E2DC"}`,fontFamily:inter,fontWeight:800,fontSize:34,color:dark?"#FAFAF8":"#111"}}>{s.trim()}</div>)}<div style={{gridColumn:"1 / span 2"}}><LogoRow logos={beat.assets} dark={dark} /></div></div>;
  else if(v==="warning_panel") inner=<div style={{width:"100%",padding:"40px",background:beat.accent||"#B91C1C",color:"#fff"}}><div style={{fontFamily:sg,fontWeight:800,fontSize:96,lineHeight:0.9}}>{beat.headline}</div><div style={{marginTop:20,fontFamily:inter,fontWeight:700,fontSize:40,lineHeight:1.2}}>{beat.sub}</div><div style={{marginTop:24}}><LogoRow logos={beat.assets} dark={true} /></div></div>;
  else if(v==="product_card"||v==="tool_card"||v==="final_question") inner=<Card beat={beat} dark={dark} big={v==="final_question"}/>;
  else inner=<Card beat={beat} dark={dark}/>;
  return <FrameShell beat={beat}>{inner}</FrameShell>;
};

export const AIShort: React.FC<AIShortProps> = ({plan, audioSrc, audioDurationSec}) => {
  const {fps}=useVideoConfig();
  const total=Math.max(audioDurationSec+0.6, plan.duration_target_sec||30);
  return <AbsoluteFill style={{background:"#FAFAF8"}}>
    <Audio src={staticFile(audioSrc)} />
    {plan.beats.map((b,i)=>(
      <Sequence key={i} from={Math.round((b.t||0)*fps)} durationInFrames={Math.max(1,Math.round((b.dur||2)*fps))}>
        <BeatView beat={b} />
      </Sequence>
    ))}
    <Sequence from={Math.round(total*fps)-5} durationInFrames={5}><AbsoluteFill style={{background:"#FAFAF8"}} /></Sequence>
  </AbsoluteFill>;
};
