/**
 * Demo compositions for the nine remocn components evaluated in this pass.
 *
 * Every string and every number below is lifted verbatim from a real script
 * already in data/research/ — nothing here is invented copy:
 *
 *   TEXT_LINE   data/research/4/great-fire-of-london-script.json  [hook]
 *   PULL_QUOTE  data/research/4/great-fire-of-london-script.json  [section_2]
 *               (Samuel Pepys, quoted in the script)
 *   3.5 -> 13.6 data/research/1/automatic-savings-vs-willpower-script.json [section_2]
 *   13,600      data/research/1/debt-snowball-vs-debt-avalanche-shorts-script.json [hook]
 *   10,636 / 2,838
 *               data/research/1/debt-snowball-vs-debt-avalanche-shorts-script.json [proof]
 *
 * The three text-entrance candidates receive the IDENTICAL string so the
 * clips are directly comparable, per the brief.
 */
import { Composition } from "remotion";
import { FONT_FACES } from "../fonts-loader.js";
import { LineByLineSlide } from "../components/remocn/line-by-line-slide";
import { SoftBlurIn } from "../components/remocn/soft-blur-in";
import { MicroScaleFade } from "../components/remocn/micro-scale-fade";
import { InlineHighlight } from "../components/remocn/inline-highlight";
import { MarkerHighlight } from "../components/remocn/marker-highlight";
import { SlotMachineRoll } from "../components/remocn/slot-machine-roll";
import { MatrixDecode } from "../components/remocn/matrix-decode";
import { NumberWheel } from "../components/remocn/number-wheel";
import { RollingNumber } from "../components/remocn/rolling-number";

const TEXT_LINE = "In 1666, a single spark in a bakery\ndestroyed 13,000 homes, 87 churches,\nand most of London.";

/**
 * NumberWheel and RollingNumber deliberately paint NO background of their own
 * (the other seven set background:"white" internally). On a bare composition
 * that leaves near-black #171717 digits on black. This wrapper supplies the
 * white ground they expect; it changes nothing inside the components.
 */
const OnWhite = (C: React.FC<any>) => (props: any) => (
  <div style={{ position: "absolute", inset: 0, background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <C {...props} />
  </div>
);

const W = 1280;
const H = 720;
const FPS = 30;

const c = (id: string, component: React.FC<any>, durationInFrames: number, props: object) => (
  <Composition
    id={id}
    component={component as never}
    durationInFrames={durationInFrames}
    fps={FPS}
    width={W}
    height={H}
    defaultProps={props as never}
  />
);

export const RemotionRoot: React.FC = () => (
  <>
    {/* JetBrains Mono is served from public/fonts, not fonts.gstatic.com (blocked). */}
    <style>{FONT_FACES}</style>
    {/* --- text entrance: identical line, three treatments --- */}
    {c("LineByLineSlide", LineByLineSlide, 120, { text: TEXT_LINE, fontSize: 44, color: "#171717" })}
    {c("SoftBlurIn", SoftBlurIn, 120, { text: TEXT_LINE, fontSize: 44, color: "#171717" })}
    {c("MicroScaleFade", MicroScaleFade, 120, { text: TEXT_LINE, fontSize: 44, color: "#171717" })}

    {/* --- pull-quote emphasis: a real quoted line from the script --- */}
    {c("InlineHighlight", InlineHighlight, 90, {
      before: "I saw a fire as one entire ",
      highlight: "arch of fire",
      after: " above a mile long",
      fontSize: 52,
    })}
    {c("MarkerHighlight", MarkerHighlight, 90, {
      before: "I saw a fire as one entire ",
      highlight: "arch of fire",
      after: " above a mile long",
      fontSize: 52,
    })}

    {/* --- number treatment: real figures from real scripts --- */}
    {c("SlotMachineRoll", SlotMachineRoll, 90, { from: "3.5%", to: "13.6%", fontSize: 120 })}
    {c("MatrixDecode", MatrixDecode, 90, { text: "$13,600", fontSize: 120 })}
    {c("NumberWheel", OnWhite(NumberWheel), 90, { from: 0, to: 13600, fontSize: 120 })}
    {c("RollingNumber", OnWhite(RollingNumber), 90, { from: 10636, to: 2838, fontSize: 120 })}
  </>
);
