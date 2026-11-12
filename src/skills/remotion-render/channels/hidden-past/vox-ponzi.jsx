// Hidden Past, layered Vox cut at about 30 seconds: Charles Ponzi. Same board, parts and rules as vox-capone.jsx (photographs are never zoomed or
// panned; counts are drawn literally). Every picture is several layers entering in turn. All figures come from one fetched Wikipedia article.
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs } from "../_shared/parts.jsx";
import { K, COND, SHADOW, ramp, Board, Dot, Sticker, Num, Title, Stamp, Strip, Cap } from "./vox-beats.jsx";
import { Dots } from "./vox-crime.jsx";

const MONO = '"JetBrains Mono", "Roboto Mono", ui-monospace, monospace';
const credit = (c, k) => c[k] || "";

function Slip({ text, hl, x, y, w, size = 44, delay = 0, rot = -1 }) {
  const f = useCurrentFrame(), a = ramp(f, delay, delay + 9), m = ramp(f, delay + 14, delay + 28);
  const i = hl ? text.indexOf(hl) : -1, parts = i < 0 ? [text, "", ""] : [text.slice(0, i), hl, text.slice(i + hl.length)];
  return (
    <div style={abs(x, y, w, 560, { transform: `translateX(${(1 - a) * 1000}px) rotate(${rot}deg)`, opacity: a > 0 ? 1 : 0 })}>
      <div style={{ background: K.white, padding: "34px 36px", boxShadow: SHADOW, fontFamily: MONO, fontWeight: 700, fontSize: size, lineHeight: 1.38, color: K.ink }}>
        “{parts[0]}<span style={{ backgroundImage: `linear-gradient(rgba(253,224,71,0.75), rgba(253,224,71,0.75))`, backgroundRepeat: "no-repeat", backgroundSize: `${m * 100}% 100%` }}>{parts[1]}</span>{parts[2]}”
      </div>
    </div>
  );
}

function Name({ images, credits }) {
  return (<>
    <Title size={210} delay={0} w={940}>Charles<br />Ponzi</Title>
    <Sticker src={images.portrait} x={120} y={600} w={520} h={674} rot={-2} from="bottom" delay={4} tapes={[[170, -20, -8, 170]]} credit={credit(credits, "portrait")} />
    <Stamp x={600} y={720} w={420} rot={7} delay={9} size={64}>50% in<br />45 days</Stamp>
    <Strip x={120} y={1370} w={900} delay={12} size={30}>Securities Exchange Company · Boston, 1920</Strip>
    <Dot x={900} y={1170} s={64} delay={8} />
  </>);
}
function Coupons({ images, credits }) {
  return (<>
    <Title size={130} delay={0} w={940}>Reply<br />coupons</Title>
    <Num x={50} y={400} size={280} delay={4} w={620}>160M</Num>
    <Strip x={60} y={700} w={700} delay={10} size={32}>needed in circulation</Strip>
    <Num x={50} y={800} size={220} delay={20} w={620} color={K.ink}>27,000</Num>
    <Strip x={60} y={1020} w={700} delay={28} size={32} bg={K.ink}>actually existed</Strip>
    <Sticker src={images.desk} x={500} y={1090} w={500} h={300} rot={2.2} from="right" delay={14} tapes={[[-20, -10, -30, 120], [400, 250, -26, 120]]} credit={credit(credits, "desk")} />
  </>);
}
function Run({ text }) {
  return (<>
    <Title size={96} delay={0} w={940}>The run</Title>
    <Slip text={text} hl="$2 million in three days" x={70} y={330} w={940} size={48} delay={4} />
    <Num x={50} y={760} size={380} delay={16} w={560}>$2M</Num>
    <Strip x={560} y={880} w={460} delay={22} size={36}>paid out in 3 days</Strip>
    <Strip x={70} y={1250} w={800} delay={14} size={30} bg={K.ink}>Source: Wikipedia, “Charles Ponzi”</Strip>
  </>);
}
function Collapse() {
  return (<>
    <Num x={50} y={90} size={420} delay={0} w={900}>$20M</Num>
    <Strip x={60} y={560} w={940} delay={6} size={36}>lost by investors, in 1920 dollars</Strip>
    <Strip x={60} y={690} w={760} delay={12} size={32} bg={K.ink}>Under 30 cents back per dollar</Strip>
    <Stamp x={140} y={900} w={800} rot={-5} delay={20} size={96}>Bank<br />seized</Stamp>
    <Strip x={60} y={1290} w={900} delay={30} size={32}>Five other banks fell too</Strip>
  </>);
}
function Sentence({ images, credits }) {
  return (<>
    <Num x={50} y={70} size={400} delay={0} w={520}>86</Num>
    <Strip x={500} y={170} w={520} delay={6} size={36}>counts of mail fraud</Strip>
    <Strip x={500} y={290} w={520} delay={12} size={30} bg={K.ink}>pleaded guilty to one</Strip>
    <Dots count={86} accentFrom={85} cols={14} x={64} y={560} gap={65} r={22} delay={8} />
    <Sticker src={images.mug} x={190} y={1060} w={600} h={412} rot={1.5} from="bottom" delay={20} tapes={[[-20, -10, -30, 120], [470, 360, -28, 120]]} credit={credit(credits, "mug")} />
    <Stamp x={560} y={1330} w={470} rot={-6} delay={34} size={50}>Five years<br />in prison</Stamp>
  </>);
}
function End({ images, credits }) {
  return (<>
    <Num x={60} y={70} size={330} delay={0} w={500} color={K.ink}>$75</Num>
    <Strip x={520} y={170} w={500} delay={6} size={36}>estate at his death</Strip>
    <Strip x={520} y={290} w={500} delay={10} size={32} bg={K.ink}>Rio de Janeiro, 1949</Strip>
    <Sticker src={images.face} x={60} y={480} w={430} h={598} rot={-3} from="left" delay={4} filter="grayscale(1) contrast(0.92)" tapes={[[100, -16, -8, 130]]} credit={credit(credits, "face")} />
    <Strip x={540} y={580} w={480} delay={16} size={32}>Deported to Italy, 1934</Strip>
    <Strip x={540} y={720} w={480} delay={24} size={30} bg={K.ink}>Charity ward, one eye blind</Strip>
  </>);
}
function Close({ images }) {
  return (<>
    <Title size={150} delay={0} w={940}>Would you<br />have<br />invested?</Title>
    <Stamp x={120} y={820} w={820} rot={-5} delay={10} size={110}>Tell us<br />below</Stamp>
    <Sticker src={images.portrait} x={690} y={1070} w={290} h={376} rot={4} from="bottom" delay={6} filter="grayscale(1) contrast(0.9)" tapes={[[80, -14, -8, 100]]} />
  </>);
}

const BEATS = { name: Name, coupons: Coupons, run: Run, collapse: Collapse, sentence: Sentence, end: End, close: Close };

export function HiddenPastVoxPonzi({ durationInFrames, scenes, captions, images, credits, runText }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: K.frame }}><style>{FONT_FACES}</style>
      <Board f={f} />
      <div style={abs(80, 1516, 920, 40, { fontFamily: COND, fontWeight: 700, fontSize: 26, letterSpacing: "0.12em", color: K.dim, textTransform: "uppercase" })}>Charles Ponzi · Boston · 1882 to 1949</div>
      {scenes.map((s) => { const B = BEATS[s.kind]; return B ? <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><AbsoluteFill><B images={images} credits={credits} text={runText} /></AbsoluteFill></Sequence> : null; })}
      <Cap captions={captions} />
      <div style={abs(36, 1884, 1008 * (f / durationInFrames), 8, { background: K.ink })} />
    </AbsoluteFill>
  );
}
const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 960, defaultProps: { durationInFrames: 960, scenes: [], captions: [], images: {}, credits: {}, runText: "" } };
export const voxPonziCompositions = [{ id: "HiddenPastVoxPonzi", component: HiddenPastVoxPonzi, ...base }];
