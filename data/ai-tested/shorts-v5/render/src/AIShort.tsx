import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { loadFont as loadSG } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
const { fontFamily: sg } = loadSG();
const { fontFamily: inter } = loadInter();

type Beat = { t:number; dur:number; narration:string; visual:string; headline:string; sub?:string; kicker?:string; accent?:string; bg?:string; anim?:string; assets?:string[]; photo?:string; photo_credit?:string; left?:string; right?:string; cta?:string; };
type Plan = { id:string; slug:string; title:string; concept?:string; beats:Beat[]; duration_target_sec?:number; cta?:string };
export type AIShortProps = { plan: Plan; audioSrc: string; audioDurationSec: number };

const isDarkBg = (bg?:string) => { const b=(bg||"#FAFAF8").toLowerCase(); return b==="#111111"||b==="#111827"||b==="#0f172a"||b==="#0b0b0f"||b==="#1a1a1a"; };
const Bg: React.FC<{bg:string;accent:string;dark:boolean}> = ({bg,accent,dark}) => {
  const frame=useCurrentFrame(); const {durationInFrames}=useVideoConfig();
  const d=interpolate(frame,[0,durationInFrames],[0,-28]);
  const g=dark?"rgba(255,255,255,0.05)":"rgba(17,17,17,0.04)";
  return <AbsoluteFill style={{background:bg}}>
    <div style={{position:"absolute",inset:-60,transform:`translateY(${d}px)`,backgroundImage:`linear-gradient(${g} 1px,transparent 1px),linear-gradient(90deg,${g} 1px,transparent 1px)`,backgroundSize:"72px 72px"}} />
    <div style={{position:"absolute",top:-180,right:-120,width:520,height:520,borderRadius:999,background:accent,opacity:dark?0.16:0.07}} />
  </AbsoluteFill>;
};
const Logos: React.FC<{logos?:string[];dark:boolean;size?:number}> = ({logos=[],dark,size=112}) => !logos.length?null:<div style={{display:"flex",gap:18,flexWrap:"wrap",justifyContent:"center"}}>
  {logos.map(l=> <div key={l} style={{width:size,height:size,borderRadius:28,background:dark?"rgba(255,255,255,0.08)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.14)":"#E2E2DC"}`,display:"flex",alignItems:"center",justifyContent:"center"}}><Img src={staticFile(`logos/${l}-white.svg`)} style={{width:size*0.56,height:size*0.56,objectFit:"contain",filter:dark?"none":"brightness(0)"}} /></div>)}
</div>;

const Kicker: React.FC<{beat:Beat;dark:boolean}> = ({beat,dark}) => {
  const frame=useCurrentFrame(); const {fps}=useVideoConfig();
  const e=spring({frame,fps,config:{damping:200},durationInFrames:12});
  const accent=beat.accent||"#111"; const ink=dark?"#FAFAF8":"#111";
  return <div style={{opacity:interpolate(e,[0,1],[0,1]),transform:`translateY(${interpolate(e,[0,1],[20,0])}px)`}}>
    <div style={{display:"inline-block",padding:"10px 18px",background:accent,color:"#fff",fontFamily:inter,fontWeight:800,fontSize:22,letterSpacing:"0.08em"}}>{(beat.kicker||"AI TESTED").toUpperCase()}</div>
  </div>;
};

const MainType: React.FC<{beat:Beat;dark:boolean;center?:boolean}> = ({beat,dark,center}) => {
  const frame=useCurrentFrame(); const {fps,durationInFrames}=useVideoConfig();
  const e=spring({frame,fps,config:{damping:200},durationInFrames:14});
  const accent=beat.accent||"#111"; const ink=dark?"#FAFAF8":"#111"; const muted=dark?"rgba(250,250,248,0.72)":"#555";
  const size=beat.headline.length>16?92:beat.headline.length>11?112:132;
  return <div style={{opacity:interpolate(e,[0,1],[0,1]),transform:`translateY(${interpolate(e,[0,1],[35,0])}px)`,textAlign:center?"center":"left"}}>
    <div style={{fontFamily:sg,fontWeight:800,fontSize:size,lineHeight:0.88,letterSpacing:"-0.04em",color:ink,textTransform:"uppercase"}}>{beat.headline}</div>
    <div style={{marginTop:22,width:interpolate(frame,[2,22],[0,920],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}),maxWidth:"100%",height:10,background:accent,marginLeft:center?"auto":undefined,marginRight:center?"auto":undefined}} />
    {beat.sub ? <div style={{marginTop:22,fontFamily:inter,fontWeight:700,fontSize:40,lineHeight:1.2,color:muted,maxWidth:940,marginLeft:center?"auto":undefined,marginRight:center?"auto":undefined}}>{beat.sub}</div> : null}
  </div>;
};

const HeroCutout: React.FC<{beat:Beat;dark:boolean}> = ({beat,dark}) => {
  const frame=useCurrentFrame(); const {durationInFrames}=useVideoConfig();
  const y=interpolate(frame,[0,durationInFrames],[18,-18]);
  return <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
    <div style={{position:"absolute",width:700,height:700,borderRadius:999,background:beat.accent||"#111",opacity:0.07}} />
    {beat.photo ? <Img src={staticFile(`photos/${beat.photo}`)} style={{maxWidth:"94%",maxHeight:"92%",objectFit:"contain",transform:`translateY(${y}px)`,filter:"drop-shadow(0 30px 44px rgba(17,17,17,0.18))"}} /> : <Logos logos={beat.assets} dark={dark} size={160} />}
  </div>;
};

const Stat: React.FC<{beat:Beat;dark:boolean}> = ({beat,dark}) => {
  const frame=useCurrentFrame(); const {durationInFrames}=useVideoConfig();
  const s=interpolate(frame,[0,Math.min(18,durationInFrames-1)],[0.86,1],{extrapolateRight:"clamp"});
  return <div style={{textAlign:"center",transform:`scale(${s})`}}>
    <div style={{fontFamily:sg,fontWeight:800,fontSize:164,lineHeight:0.84,color:beat.accent||"#111",letterSpacing:"-0.05em"}}>{beat.headline}</div>
    {beat.sub ? <div style={{marginTop:24,fontFamily:inter,fontWeight:800,fontSize:42,color:dark?"#FAFAF8":"#111",lineHeight:1.2}}>{beat.sub}</div> : null}
    <div style={{marginTop:30}}><Logos logos={beat.assets} dark={dark} size={116} /></div>
  </div>;
};

const Split: React.FC<{beat:Beat;dark:boolean}> = ({beat,dark}) => (
  <div style={{width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr",gap:22}}>
    {[{t:beat.left||"",a:beat.assets?.[0]},{t:beat.right||"",a:beat.assets?.[1]}].map((side,i)=>(
      <div key={i} style={{background:dark?"rgba(255,255,255,0.06)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.12)":"#E2E2DC"}`,padding:"30px 22px",minHeight:420,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:26}}>
        {side.a ? <Img src={staticFile(`logos/${side.a}-white.svg`)} style={{width:116,height:116,objectFit:"contain",filter:dark?"none":"brightness(0)"}} /> : null}
        <div style={{fontFamily:sg,fontWeight:800,fontSize:48,lineHeight:0.95,color:i===0?(beat.accent||"#111"):(dark?"#FAFAF8":"#111"),textAlign:"center",textTransform:"uppercase"}}>{side.t}</div>
      </div>
    ))}
  </div>
);

const Evidence: React.FC<{beat:Beat;dark:boolean}> = ({beat,dark}) => {
  const items=(beat.sub||"").split("·").map(s=>s.trim()).filter(Boolean);
  return <div style={{width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
    {items.map((s,i)=><div key={i} style={{padding:"22px",background:dark?"rgba(255,255,255,0.06)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.12)":"#E2E2DC"}`,fontFamily:inter,fontWeight:800,fontSize:32,lineHeight:1.2,color:dark?"#FAFAF8":"#111"}}>{s}</div>)}
    <div style={{gridColumn:"1 / span 2",marginTop:10}}><Logos logos={beat.assets} dark={dark} /></div>
  </div>;
};

const BeatView: React.FC<{beat:Beat}> = ({beat}) => {
  const dark=isDarkBg(beat.bg);
  const bg=beat.bg||"#FAFAF8"; const accent=beat.accent||"#111";
  const frame=useCurrentFrame(); const {durationInFrames}=useVideoConfig();
  const exit=interpolate(frame,[durationInFrames-6,durationInFrames],[1,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const v=beat.visual;
  const showMainTop = !["stat_counter","hero_cutout","kinetic_type","full_bleed_type","final_question"].includes(v);
  const centerMain = ["stamp_document","warning_panel","quote_card","product_card","tool_card","legal_stack"].includes(v);
  return <AbsoluteFill style={{opacity:exit}}>
    <Bg bg={bg} accent={accent} dark={dark} />
    <div style={{position:"absolute",inset:0,padding:"70px 62px 86px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:26}}>
        <div style={{fontFamily:sg,fontWeight:700,fontSize:28,letterSpacing:"0.14em",color:dark?"#FAFAF8":"#111"}}>AI TESTED</div>
        <div style={{fontFamily:inter,fontWeight:700,fontSize:22,color:dark?"rgba(250,250,248,0.62)":"#666"}}>V5</div>
      </div>
      <Kicker beat={beat} dark={dark} />
      <div style={{marginTop:24}}>
        {showMainTop ? <MainType beat={beat} dark={dark} center={centerMain} /> : null}
        {v==="stat_counter" ? <div style={{marginTop:10}}><Stat beat={beat} dark={dark} /></div> : null}
        {v==="hero_cutout" ? <div style={{marginTop:10}}><MainType beat={beat} dark={dark} /><div style={{height:760,marginTop:20}}><HeroCutout beat={beat} dark={dark} /></div></div> : null}
        {["kinetic_type","full_bleed_type","final_question"].includes(v) ? <div style={{marginTop:40,textAlign:"center"}}>
          <div style={{fontFamily:sg,fontWeight:800,fontSize:beat.headline.length>14?104:126,lineHeight:0.88,letterSpacing:"-0.04em",color:dark?"#FAFAF8":"#111",textTransform:"uppercase"}}>{beat.headline}</div>
          <div style={{marginTop:28,height:10,width:700,maxWidth:"100%",marginLeft:"auto",marginRight:"auto",background:accent}} />
          <div style={{marginTop:28,fontFamily:inter,fontWeight:700,fontSize:42,lineHeight:1.2,color:dark?"rgba(250,250,248,0.76)":"#555"}}>{beat.sub}</div>
          <div style={{marginTop:40}}><Logos logos={beat.assets} dark={dark} size={v==="final_question"?140:120} /></div>
        </div> : null}
        {v==="split_compare" ? <div style={{marginTop:34}}><Split beat={beat} dark={dark} /></div> : null}
        {v==="logo_grid" ? <div style={{marginTop:60}}><Logos logos={beat.assets} dark={dark} size={150} /></div> : null}
        {v==="evidence_board" ? <div style={{marginTop:34}}><Evidence beat={beat} dark={dark} /></div> : null}
        {v==="warning_panel" ? <div style={{marginTop:34,padding:"40px",background:accent,color:"#fff"}}><div style={{fontFamily:sg,fontWeight:800,fontSize:92,lineHeight:0.9}}>{beat.headline}</div><div style={{marginTop:20,fontFamily:inter,fontWeight:700,fontSize:40,lineHeight:1.2}}>{beat.sub}</div><div style={{marginTop:24}}><Logos logos={beat.assets} dark={true} /></div></div> : null}
        {v==="quote_card" ? <div style={{marginTop:34,padding:"42px",background:dark?"rgba(255,255,255,0.06)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.12)":"#E2E2DC"}`,borderLeft:`16px solid ${accent}`}}><div style={{fontFamily:sg,fontWeight:800,fontSize:100,lineHeight:0.8,color:accent}}>“</div><div style={{fontFamily:inter,fontWeight:800,fontSize:48,lineHeight:1.2,color:dark?"#FAFAF8":"#111"}}>{beat.sub}</div><div style={{marginTop:26}}><Logos logos={beat.assets} dark={dark} /></div></div> : null}
        {["stamp_document","legal_stack","product_card","tool_card"].includes(v) ? <div style={{marginTop:34,display:"flex",flexDirection:"column",gap:26,alignItems:"center"}}>
          {v==="stamp_document"||v==="legal_stack" ? <div style={{padding:"22px 30px",border:`8px solid ${accent}`,color:accent,fontFamily:sg,fontWeight:800,fontSize:64,transform:"rotate(-3deg)"}}>{beat.headline}</div> : <Logos logos={beat.assets} dark={dark} size={132} />}
          <div style={{width:"100%",padding:"32px",background:dark?"rgba(255,255,255,0.06)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.12)":"#E2E2DC"}`,borderLeft:`14px solid ${accent}`}}><div style={{fontFamily:inter,fontWeight:800,fontSize:44,lineHeight:1.22,color:dark?"#FAFAF8":"#111",textAlign:"center"}}>{beat.sub}</div></div>
          {v==="product_card"||v==="tool_card"?null:<Logos logos={beat.assets} dark={dark} />}
        </div> : null}
      </div>
      <div style={{position:"absolute",left:62,right:62,bottom:52,display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-end"}}>
        <div style={{fontFamily:inter,fontSize:20,color:dark?"rgba(250,250,248,0.62)":"#666",maxWidth:640,lineHeight:1.3}}>{beat.photo_credit||""}</div>
        {beat.cta ? <div style={{fontFamily:inter,fontWeight:800,fontSize:22,color:accent,maxWidth:360,textAlign:"right"}}>{beat.cta}</div> : null}
      </div>
    </div>
  </AbsoluteFill>;
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
