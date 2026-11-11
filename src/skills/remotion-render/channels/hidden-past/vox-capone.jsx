// Hidden Past, layered Vox cut at about 30 seconds: Al Capone. Same board, parts and rules as vox-beats.jsx / vox-crime.jsx (photographs are never
// zoomed or panned; counts are drawn literally; the route is drawn from Natural Earth). Every picture is several layers entering in turn.
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs } from "../_shared/parts.jsx";
import { K, COND, SHADOW, ramp, over, Board, Tri, Dot, Sticker, Num, Title, Stamp, Strip, MapBoard, Cap } from "./vox-beats.jsx";
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
    <Title size={210} delay={0} w={940}>Al<br />Capone</Title>
    <Sticker src={images.portrait} x={140} y={560} w={540} h={698} rot={-2} from="bottom" delay={4} tapes={[[170, -20, -8, 170]]} credit={credit(credits, "portrait")} />
    <Stamp x={600} y={690} w={400} rot={7} delay={9} size={54}>Jailed by<br />income<br />tax</Stamp>
    <Strip x={140} y={1350} w={880} delay={12} size={32}>Boss of the Chicago Outfit, 1925 to 1931</Strip>
    <Dot x={880} y={1130} s={64} delay={8} />
  </>);
}
function Massacre({ images, credits }) {
  return (<>
    <Num x={50} y={90} size={330} delay={0} w={400}>7</Num>
    <Strip x={380} y={190} w={640} delay={6} size={34}>Gangsters slain · Chicago</Strip>
    <Strip x={380} y={310} w={640} delay={10} size={30} bg={K.ink}>New York Times, Feb 15, 1929</Strip>
    <Sticker src={images.press} x={90} y={520} w={900} h={715} rot={1} from="right" delay={4} tapes={[[-30, -14, -34, 170], [760, 690, -30, 170]]} credit={credit(credits, "press")} />
    <Stamp x={470} y={1010} w={560} rot={-7} delay={44} size={60}>Public Enemy<br />No. 1</Stamp>
  </>);
}
function Counts() {
  return (<>
    <Title size={116} delay={0} w={940}>Income tax</Title>
    <Strip x={60} y={270} w={940} delay={6} size={32}>Treasury + Justice Departments planned the prosecutions</Strip>
    <Num x={60} y={380} size={360} delay={4} w={500}>22</Num>
    <Strip x={500} y={470} w={510} delay={10} size={32}>Counts of tax evasion</Strip>
    <Strip x={500} y={580} w={510} delay={26} size={32} bg={K.ink}>5 convicted</Strip>
    <Dots count={22} accentFrom={17} cols={8} x={110} y={900} gap={108} r={38} delay={6} />
  </>);
}
function Evidence() {
  return (<>
    <Title size={96} delay={0} w={940}>His own words</Title>
    <Slip text="the judge admitted as evidence Capone's admissions of his income and unpaid taxes" hl="admissions of his income" x={70} y={330} w={940} size={48} delay={4} />
    <Strip x={70} y={1010} w={760} delay={14} size={30} bg={K.ink}>Source: Wikipedia, “Al Capone”</Strip>
  </>);
}
function Sentence({ images, credits }) {
  return (<>
    <Num x={50} y={80} size={470} delay={0} w={560}>11</Num>
    <Strip x={560} y={190} w={450} delay={6} size={38}>Years, federal prison</Strip>
    <Strip x={560} y={310} w={450} delay={10} size={30} bg={K.ink}>Fined $50,000</Strip>
    <Sticker src={images.bop} x={90} y={700} w={900} h={522} rot={1.4} from="bottom" delay={4} tapes={[[-24, -12, -32, 160], [760, 480, -28, 160]]} credit={credit(credits, "bop")} />
    <Strip x={90} y={1330} w={760} delay={14} size={30}>Convicted on five counts, 1931</Strip>
  </>);
}
function Prisons({ images, credits, map }) {
  return (<>
    <Title y={92} size={96} w={960}>Atlanta, then Alcatraz</Title>
    <MapBoard geo={map} delay={0} />
    <Sticker src={images.atlanta} x={60} y={1070} w={470} h={320} rot={-2} from="left" delay={18} tapes={[[-20, -10, -28, 120]]} credit={credit(credits, "atlanta")} />
    <Sticker src={images.alcatraz} x={560} y={1070} w={470} h={320} rot={2} from="right" delay={24} tapes={[[360, -10, 24, 120]]} credit={credit(credits, "alcatraz")} />
  </>);
}
function End({ images, credits }) {
  return (<>
    <Num x={440} y={60} size={300} delay={0} w={600} color={K.ink}>1947</Num>
    <Sticker src={images.later} x={60} y={300} w={400} h={480} rot={-3} from="left" delay={4} filter="grayscale(1) contrast(0.92)" tapes={[[100, -16, -8, 130]]} credit={credit(credits, "later")} />
    <Sticker src={images.death} x={420} y={640} w={600} h={502} rot={2.5} from="right" delay={8} tapes={[[-20, -10, -30, 130], [470, 410, -26, 130]]} credit={credit(credits, "death")} />
    <Strip x={60} y={1260} w={760} delay={14} size={32}>Died 1947</Strip>
  </>);
}
function Close({ images }) {
  return (<>
    <Title size={150} delay={0} w={940}>Right way to stop him?</Title>
    <Stamp x={120} y={720} w={820} rot={-5} delay={10} size={110}>Tell us<br />below</Stamp>
    <Sticker src={images.portrait} x={690} y={1000} w={290} h={375} rot={4} from="bottom" delay={6} filter="grayscale(1) contrast(0.9)" tapes={[[80, -14, -8, 100]]} />
  </>);
}

const BEATS = { name: Name, massacre: Massacre, counts: Counts, evidence: Evidence, sentence: Sentence, prisons: Prisons, end: End, close: Close };

export function HiddenPastVoxCapone({ durationInFrames, scenes, captions, images, credits, map }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: K.frame }}><style>{FONT_FACES}</style>
      <Board f={f} />
      <div style={abs(80, 1516, 920, 40, { fontFamily: COND, fontWeight: 700, fontSize: 26, letterSpacing: "0.12em", color: K.dim, textTransform: "uppercase" })}>Al Capone · Chicago · 1899 to 1947</div>
      {scenes.map((s) => { const B = BEATS[s.kind]; return B ? <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><AbsoluteFill><B images={images} credits={credits} map={map} /></AbsoluteFill></Sequence> : null; })}
      <Cap captions={captions} />
      <div style={abs(36, 1884, 1008 * (f / durationInFrames), 8, { background: K.ink })} />
    </AbsoluteFill>
  );
}
const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 960, defaultProps: { durationInFrames: 960, scenes: [], captions: [], images: {}, credits: {}, map: null } };
export const voxCaponeCompositions = [{ id: "HiddenPastVoxCapone", component: HiddenPastVoxCapone, ...base }];
