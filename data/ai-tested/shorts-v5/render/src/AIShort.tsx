import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { loadFont as loadSG } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
const { fontFamily: sg } = loadSG();
const { fontFamily: inter } = loadInter();

type ChartPoint = { label:string; value:number; color?:string };
type Beat = { t:number; dur:number; narration:string; visual:string; headline:string; sub?:string; kicker?:string; accent?:string; bg?:string; anim?:string; assets?:string[]; photo?:string; photo_credit?:string; left?:string; right?:string; cta?:string; chart?:{type?:string; points?:ChartPoint[]; max?:number; unit?:string}; timeline?:{steps?:string[]}; sfx?:{src:string; at?:number; volume?:number}[] };
type Plan = { id:string; slug:string; title:string; concept?:string; beats:Beat[]; duration_target_sec?:number; cta?:string; audio?:{sfx?:{src:string;t:number;volume?:number;dur?:number}[]} };
export type AIShortProps = { plan: Plan; audioSrc: string; audioDurationSec: number };

const isDarkBg = (bg?:string) => { const b=(bg||"#FAFAF8").toLowerCase(); return ["#111111","#111827","#0f172a","#0b0b0f","#1a1a1a","#0f172a"].includes(b); };
const num = (v:any,d=0)=>{const n=Number(v); return Number.isFinite(n)?n:d;};

const Bg: React.FC<{bg:string;accent:string;dark:boolean}> = ({bg,accent,dark}) => {
  const frame=useCurrentFrame(); const {durationInFrames}=useVideoConfig();
  const d=interpolate(frame,[0,durationInFrames],[0,-24]);
  const g=dark?"rgba(255,255,255,0.045)":"rgba(17,17,17,0.035)";
  return <AbsoluteFill style={{background:bg}}>
    <div style={{position:"absolute",inset:-60,transform:`translateY(${d}px)`,backgroundImage:`linear-gradient(${g} 1px,transparent 1px),linear-gradient(90deg,${g} 1px,transparent 1px)`,backgroundSize:"68px 68px"}} />
    <div style={{position:"absolute",top:-160,right:-120,width:520,height:520,borderRadius:999,background:accent,opacity:dark?0.14:0.06}} />
    <div style={{position:"absolute",bottom:220,left:-140,width:420,height:420,borderRadius:999,background:accent,opacity:dark?0.1:0.04}} />
  </AbsoluteFill>;
};

const Logos: React.FC<{logos?:string[];dark:boolean;size?:number}> = ({logos=[],dark,size=108}) => !logos.length?null:<div style={{display:"flex",gap:18,flexWrap:"wrap",justifyContent:"center",alignItems:"center"}}>
  {logos.map(l=> <div key={l} style={{width:size,height:size,borderRadius:28,background:dark?"rgba(255,255,255,0.08)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.14)":"#E2E2DC"}`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:dark?"none":"0 10px 30px rgba(17,17,17,0.06)"}}><Img src={staticFile(`logos/${l}-white.svg`)} style={{width:size*0.56,height:size*0.56,objectFit:"contain",filter:dark?"none":"brightness(0)"}} /></div>)}
</div>;

const Kicker: React.FC<{beat:Beat;dark:boolean}> = ({beat,dark}) => {
  const frame=useCurrentFrame(); const {fps}=useVideoConfig();
  const e=spring({frame,fps,config:{damping:200},durationInFrames:12});
  return <div style={{opacity:interpolate(e,[0,1],[0,1]),transform:`translateY(${interpolate(e,[0,1],[18,0])}px)`}}>
    <div style={{display:"inline-block",padding:"10px 18px",background:beat.accent||"#111",color:"#fff",fontFamily:inter,fontWeight:800,fontSize:22,letterSpacing:"0.08em"}}>{(beat.kicker||"AI TESTED").toUpperCase()}</div>
  </div>;
};

const MainType: React.FC<{beat:Beat;dark:boolean;center?:boolean}> = ({beat,dark,center}) => {
  const frame=useCurrentFrame(); const {fps}=useVideoConfig();
  const e=spring({frame,fps,config:{damping:200},durationInFrames:14});
  const ink=dark?"#FAFAF8":"#111"; const muted=dark?"rgba(250,250,248,0.72)":"#555";
  const size=beat.headline.length>16?90:beat.headline.length>11?110:128;
  return <div style={{opacity:interpolate(e,[0,1],[0,1]),transform:`translateY(${interpolate(e,[0,1],[30,0])}px)`,textAlign:center?"center":"left"}}>
    <div style={{fontFamily:sg,fontWeight:800,fontSize:size,lineHeight:0.88,letterSpacing:"-0.04em",color:ink,textTransform:"uppercase"}}>{beat.headline}</div>
    <div style={{marginTop:20,width:interpolate(frame,[2,20],[0,860],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}),maxWidth:"100%",height:10,background:beat.accent||"#111",marginLeft:center?"auto":undefined,marginRight:center?"auto":undefined}} />
    {beat.sub ? <div style={{marginTop:20,fontFamily:inter,fontWeight:700,fontSize:38,lineHeight:1.22,color:muted,maxWidth:920,marginLeft:center?"auto":undefined,marginRight:center?"auto":undefined}}>{beat.sub}</div> : null}
  </div>;
};

const Stat: React.FC<{beat:Beat;dark:boolean}> = ({beat,dark}) => {
  const frame=useCurrentFrame(); const {durationInFrames}=useVideoConfig();
  const s=interpolate(frame,[0,Math.min(16,durationInFrames-1)],[0.88,1],{extrapolateRight:"clamp"});
  return <div style={{textAlign:"center",transform:`scale(${s})`,width:"100%"}}>
    <div style={{fontFamily:sg,fontWeight:800,fontSize:156,lineHeight:0.84,color:beat.accent||"#111",letterSpacing:"-0.05em"}}>{beat.headline}</div>
    {beat.sub ? <div style={{marginTop:22,fontFamily:inter,fontWeight:800,fontSize:40,color:dark?"#FAFAF8":"#111",lineHeight:1.2}}>{beat.sub}</div> : null}
    <div style={{marginTop:28}}><Logos logos={beat.assets} dark={dark} size={112} /></div>
  </div>;
};

const BarChart: React.FC<{beat:Beat;dark:boolean}> = ({beat,dark}) => {
  const frame=useCurrentFrame(); const {durationInFrames}=useVideoConfig();
  const pts=(beat.chart?.points||[]).slice(0,5);
  const max=Math.max(1, beat.chart?.max || ...pts.map(p=>num(p.value,0)));
  const prog=interpolate(frame,[0,Math.min(24,durationInFrames-1)],[0,1],{extrapolateRight:"clamp"});
  const ink=dark?"#FAFAF8":"#111"; const muted=dark?"rgba(250,250,248,0.68)":"#555";
  return <div style={{width:"100%"}}>
    <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:18,height:520,padding:"20px 10px 0"}}>
      {pts.map((p,i)=>{
        const h=(num(p.value)/max)*460*prog;
        return <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
          <div style={{fontFamily:inter,fontWeight:800,fontSize:28,color:ink}}>{p.value}{beat.chart?.unit||""}</div>
          <div style={{width:"100%",maxWidth:120,height:460,display:"flex",alignItems:"flex-end",background:dark?"rgba(255,255,255,0.06)":"#EFEFEA",borderRadius:18,overflow:"hidden"}}>
            <div style={{width:"100%",height:h,background:p.color||beat.accent||"#111",borderRadius:18}} />
          </div>
          <div style={{fontFamily:inter,fontWeight:700,fontSize:24,color:muted,textAlign:"center",lineHeight:1.2,minHeight:56}}>{p.label}</div>
        </div>;
      })}
    </div>
  </div>;
};

const Timeline: React.FC<{beat:Beat;dark:boolean}> = ({beat,dark}) => {
  const frame=useCurrentFrame(); const {durationInFrames}=useVideoConfig();
  const steps=(beat.timeline?.steps||[]).slice(0,5);
  const reveal=Math.floor(interpolate(frame,[0,Math.min(30,durationInFrames-1)],[1,steps.length+0.99],{extrapolateRight:"clamp"}));
  const ink=dark?"#FAFAF8":"#111";
  return <div style={{width:"100%",display:"flex",flexDirection:"column",gap:18}}>
    {steps.map((s,i)=>{ const on=i<reveal; return <div key={i} style={{display:"flex",gap:18,alignItems:"center",opacity:on?1:0.2}}>
      <div style={{width:54,height:54,borderRadius:999,background:on?(beat.accent||"#111"):(dark?"rgba(255,255,255,0.12)":"#DDD"),color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:inter,fontWeight:800,fontSize:24}}>{i+1}</div>
      <div style={{flex:1,padding:"20px 22px",background:dark?"rgba(255,255,255,0.06)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.12)":"#E2E2DC"}`,fontFamily:inter,fontWeight:700,fontSize:32,color:ink}}>{s}</div>
    </div>; })}
  </div>;
};

const Split: React.FC<{beat:Beat;dark:boolean}> = ({beat,dark}) => (
  <div style={{width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr",gap:22}}>
    {[{t:beat.left||"",a:beat.assets?.[0]},{t:beat.right||"",a:beat.assets?.[1]}].map((side,i)=>(
      <div key={i} style={{background:dark?"rgba(255,255,255,0.06)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.12)":"#E2E2DC"}`,padding:"30px 22px",minHeight:420,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:26}}>
        {side.a ? <Img src={staticFile(`logos/${side.a}-white.svg`)} style={{width:112,height:112,objectFit:"contain",filter:dark?"none":"brightness(0)"}} /> : null}
        <div style={{fontFamily:sg,fontWeight:800,fontSize:46,lineHeight:0.95,color:i===0?(beat.accent||"#111"):(dark?"#FAFAF8":"#111"),textAlign:"center",textTransform:"uppercase"}}>{side.t}</div>
      </div>
    ))}
  </div>
);

const HeroCutout: React.FC<{beat:Beat;dark:boolean}> = ({beat,dark}) => {
  const frame=useCurrentFrame(); const {durationInFrames}=useVideoConfig();
  const y=interpolate(frame,[0,durationInFrames],[14,-14]);
  return <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
    <div style={{position:"absolute",width:680,height:680,borderRadius:999,background:beat.accent||"#111",opacity:0.07}} />
    {beat.photo ? <Img src={staticFile(`photos/${beat.photo}`)} style={{maxWidth:"94%",maxHeight:"94%",objectFit:"contain",transform:`translateY(${y}px)`,filter:"drop-shadow(0 30px 44px rgba(17,17,17,0.18))"}} /> : <Logos logos={beat.assets} dark={dark} size={160} />}
  </div>;
};

const BeatView: React.FC<{beat:Beat}> = ({beat}) => {
  const dark=isDarkBg(beat.bg); const bg=beat.bg||"#FAFAF8"; const accent=beat.accent||"#111";
  const frame=useCurrentFrame(); const {durationInFrames}=useVideoConfig();
  const exit=interpolate(frame,[durationInFrames-6,durationInFrames],[1,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const v=beat.visual;
  const centralTypes=["stat_counter","bar_chart","line_graph","timeline","hero_cutout","split_compare","logo_grid","evidence_board"];
  const topType = !["hero_cutout","stat_counter","bar_chart","line_graph","timeline","kinetic_type","full_bleed_type","final_question"].includes(v);
  return <AbsoluteFill style={{opacity:exit}}>
    <Bg bg={bg} accent={accent} dark={dark} />
    <div style={{position:"absolute",inset:0,padding:"68px 60px 84px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div style={{fontFamily:sg,fontWeight:700,fontSize:28,letterSpacing:"0.14em",color:dark?"#FAFAF8":"#111"}}>AI TESTED</div>
        <div style={{fontFamily:inter,fontWeight:700,fontSize:20,color:dark?"rgba(250,250,248,0.62)":"#666"}}>{(beat.kicker||"V5").toUpperCase()}</div>
      </div>
      {topType ? <MainType beat={beat} dark={dark} center={["stamp_document","warning_panel","quote_card","product_card","tool_card","legal_stack"].includes(v)} /> : <Kicker beat={beat} dark={dark} />}
      <div style={{position:"absolute",left:60,right:60,top:topType?500:260,bottom:150,display:"flex",alignItems:"center",justifyContent:"center"}}>
        {v==="hero_cutout" ? <HeroCutout beat={beat} dark={dark} /> : null}
        {v==="stat_counter" ? <Stat beat={beat} dark={dark} /> : null}
        {v==="bar_chart" || v==="line_graph" ? <BarChart beat={beat} dark={dark} /> : null}
        {v==="timeline" ? <Timeline beat={beat} dark={dark} /> : null}
        {v==="split_compare" ? <Split beat={beat} dark={dark} /> : null}
        {v==="logo_grid" ? <Logos logos={beat.assets} dark={dark} size={148} /> : null}
        {v==="evidence_board" ? <Timeline beat={{...beat, timeline:{steps:(beat.sub||"").split("·").map(s=>s.trim()).filter(Boolean)}}} dark={dark} /> : null}
        {v==="warning_panel" ? <div style={{width:"100%",padding:"40px",background:accent,color:"#fff"}}><div style={{fontFamily:sg,fontWeight:800,fontSize:90,lineHeight:0.9,textTransform:"uppercase"}}>{beat.headline}</div><div style={{marginTop:20,fontFamily:inter,fontWeight:700,fontSize:40,lineHeight:1.2}}>{beat.sub}</div><div style={{marginTop:24}}><Logos logos={beat.assets} dark={true} /></div></div> : null}
        {v==="quote_card" ? <div style={{width:"100%",padding:"42px",background:dark?"rgba(255,255,255,0.06)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.12)":"#E2E2DC"}`,borderLeft:`16px solid ${accent}`}}><div style={{fontFamily:sg,fontWeight:800,fontSize:96,lineHeight:0.8,color:accent}}>“</div><div style={{fontFamily:inter,fontWeight:800,fontSize:46,lineHeight:1.2,color:dark?"#FAFAF8":"#111"}}>{beat.sub}</div><div style={{marginTop:26}}><Logos logos={beat.assets} dark={dark} /></div></div> : null}
        {["stamp_document","legal_stack","product_card","tool_card"].includes(v) ? <div style={{width:"100%",display:"flex",flexDirection:"column",gap:24,alignItems:"center"}}>
          {(v==="stamp_document"||v==="legal_stack") ? <div style={{padding:"22px 30px",border:`8px solid ${accent}`,color:accent,fontFamily:sg,fontWeight:800,fontSize:62,transform:"rotate(-3deg)",textTransform:"uppercase"}}>{beat.headline}</div> : <Logos logos={beat.assets} dark={dark} size={132} />}
          <div style={{width:"100%",padding:"32px",background:dark?"rgba(255,255,255,0.06)":"#fff",border:`2px solid ${dark?"rgba(255,255,255,0.12)":"#E2E2DC"}`,borderLeft:`14px solid ${accent}`}}><div style={{fontFamily:inter,fontWeight:800,fontSize:42,lineHeight:1.22,color:dark?"#FAFAF8":"#111",textAlign:"center"}}>{beat.sub}</div></div>
        </div> : null}
        {["kinetic_type","full_bleed_type","final_question"].includes(v) ? <div style={{width:"100%",textAlign:"center"}}>
          <div style={{fontFamily:sg,fontWeight:800,fontSize:beat.headline.length>14?100:122,lineHeight:0.88,letterSpacing:"-0.04em",color:dark?"#FAFAF8":"#111",textTransform:"uppercase"}}>{beat.headline}</div>
          <div style={{marginTop:26,height:10,width:680,maxWidth:"100%",marginLeft:"auto",marginRight:"auto",background:accent}} />
          <div style={{marginTop:26,fontFamily:inter,fontWeight:700,fontSize:40,lineHeight:1.22,color:dark?"rgba(250,250,248,0.76)":"#555"}}>{beat.sub}</div>
          <div style={{marginTop:36}}><Logos logos={beat.assets} dark={dark} size={v==="final_question"?136:116} /></div>
        </div> : null}
      </div>
      <div style={{position:"absolute",left:60,right:60,bottom:50,display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-end"}}>
        <div style={{fontFamily:inter,fontSize:20,color:dark?"rgba(250,250,248,0.62)":"#666",maxWidth:640,lineHeight:1.3}}>{beat.photo_credit||""}</div>
        {beat.cta ? <div style={{fontFamily:inter,fontWeight:800,fontSize:22,color:accent,maxWidth:360,textAlign:"right"}}>{beat.cta}</div> : null}
      </div>
    </div>
  </AbsoluteFill>;
};

export const AIShort: React.FC<AIShortProps> = ({plan, audioSrc, audioDurationSec}) => {
  const {fps}=useVideoConfig();
  const total=Math.max(audioDurationSec+0.6, plan.duration_target_sec||30);
  const sfxEvents = (plan.audio?.sfx||[]).filter(s=>s && s.src);
  return <AbsoluteFill style={{background:"#FAFAF8"}}>
    <Audio src={staticFile(audioSrc)} />
    {sfxEvents.map((s,i)=> <Sequence key={`sfx-${i}`} from={Math.round(num(s.t,0)*fps)} durationInFrames={Math.max(1,Math.round(num(s.dur,0.4)*fps))}><Audio src={staticFile(s.src)} volume={num(s.volume,0.25)} /></Sequence>)}
    {plan.beats.map((b,i)=>(
      <Sequence key={i} from={Math.round((b.t||0)*fps)} durationInFrames={Math.max(1,Math.round((b.dur||2)*fps))}>
        <BeatView beat={b} />
      </Sequence>
    ))}
    <Sequence from={Math.round(total*fps)-5} durationInFrames={5}><AbsoluteFill style={{background:"#FAFAF8"}} /></Sequence>
  </AbsoluteFill>;
};