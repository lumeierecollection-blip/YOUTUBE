import React, { createContext, useContext } from "react";
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadSerif } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadSans } from "@remotion/google-fonts/InterTight";
import { loadFont as loadHand } from "@remotion/google-fonts/PlayfairDisplay";

const serif = loadSerif("normal", { weights: ["400", "600", "700", "900"], subsets: ["latin"] }).fontFamily;
const sans = loadSans("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;
const hand = loadHand("italic", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];

type Ctx = { theme: any; data: any; images: any; dark: boolean };
const C = createContext<Ctx>({ theme: {}, data: {}, images: {}, dark: false });
const useCtx = () => useContext(C);
const useT = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return f / fps;
};
const pg = (t: number, at: number, dur = 0.5) => ease((t - at) / dur);
const pct = (p: number) => (p >= 0.995 && p < 1 ? (p * 100).toFixed(1) : String(Math.round(p * 100))) + "%";
const fmt = (n: number) => n.toLocaleString("en-GB");

const Fill: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080 }}>{children}</div>
);

const Head: React.FC<{ title: string; sub?: string; top?: number }> = ({ title, sub, top = 100 }) => {
  const { dark } = useCtx();
  return (
    <div style={{ position: "absolute", left: 110, top, right: 110 }}>
      <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 64, lineHeight: 1.1, textTransform: "lowercase" }}>{title}</div>
      {sub ? <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 24, marginTop: 8, opacity: dark ? 0.6 : 0.5 }}>{sub}</div> : null}
    </div>
  );
};

const Src: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", left: 110, bottom: 34, right: 300, fontFamily: sans, fontWeight: 500, fontSize: 22, opacity: 0.55 }}>{text}</div>
);

const SRC_WIKI = "Source: Wikipedia, Cristiano Ronaldo, career statistics, revision of 24 Nov 2026 (CC BY-SA 4.0)";

/* ---------- photo ---------- */
const PhotoScene: React.FC<{ scene: any; idx: number }> = ({ scene, idx }) => {
  const { theme, images } = useCtx();
  const t = useT();
  const { durationInFrames, fps } = useVideoConfig();
  const v = scene.visual;
  const im = images[v.img];
  const stats: any[] = v.stats || [];
  const has = stats.length > 0;
  const maxW = 1180;
  const maxH = 800;
  const s = Math.min(maxW / im.w, maxH / im.h);
  const w = Math.round(im.w * s);
  const h = Math.round(im.h * s);
  const left = Math.round((1920 - w) / 2);
  const top = Math.round((1080 - h) / 2) - 14;
  const dur = durationInFrames / fps;
  const cutW = 880;
  const cutH = 960;
  const cutLeft = idx % 2 === 0 ? 90 : 1920 - 90 - cutW;
  const panelLeft = idx % 2 === 0 ? cutLeft + cutW + 70 : 110;
  const panelW = has ? 1920 - cutW - 90 - 70 - 110 : 0;
  const cut = staticFile(`ep/images/cutout-${v.img}.png`);
  const dir = idx % 2 === 0 ? -1 : 1;
  const slide = (1 - ease(t / 0.7)) * 40 * dir;
  const smear = (k: number, color: string, op: number, blur: number): React.CSSProperties => ({
    position: "absolute", left: 0, top: 0, width: cutW, height: cutH, background: color, opacity: op, filter: `blur(${blur}px)`,
    WebkitMaskImage: `url(${cut})`, maskImage: `url(${cut})`, WebkitMaskSize: "contain", maskSize: "contain",
    WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center bottom", maskPosition: "center bottom",
    transform: `translateX(${dir * k * 26 + slide}px)`,
  });
  return (
    <Fill>
      {has ? (
        <div style={{ position: "absolute", left: cutLeft, top: 1080 - cutH, width: cutW, height: cutH }}>
          <div style={smear(2, theme.accent2, 0.55, 8)} />
          <div style={smear(1, theme.accent, 0.85, 3)} />
          <Img src={cut} style={{ position: "absolute", left: 0, top: 0, width: cutW, height: cutH, objectFit: "contain", objectPosition: "center bottom", transform: `translateX(${slide * 0.4}px)` }} />
        </div>
      ) : (
        <>
          <Img src={staticFile(im.file)} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, objectFit: "cover", filter: "blur(40px) brightness(0.32)", transform: "scale(1.15)" }} />
          <div style={{ position: "absolute", left, top, width: w, height: h, boxShadow: `0 24px 70px color-mix(in srgb, ${theme.ink} 80%, black)`, overflow: "hidden", background: theme.ink }}>
            <Img src={staticFile(im.file)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1 + 0.06 * (t / dur)})` }} />
          </div>
        </>
      )}
      {has ? (
        <div style={{ position: "absolute", left: panelLeft, top: 0, width: panelW, height: 1080, display: "flex", flexDirection: "column", justifyContent: "center", gap: 46 }}>
          {stats.map((st, i) => {
            const p = pg(t, st.cue ?? 0.4, 0.45);
            const len = String(st.value).length;
            const size = len <= 4 ? 220 : len <= 8 ? 140 : 84;
            return (
              <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 26}px)` }}>
                <div style={{ display: "inline-block", fontFamily: serif, fontWeight: 900, fontSize: size, lineHeight: 1.02 }}>{st.value}</div>
                <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 36, opacity: 0.78, marginTop: 6 }}>{st.label}</div>
              </div>
            );
          })}
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 80, bottom: 26, right: 300, fontFamily: sans, fontWeight: 500, fontSize: 21, opacity: 0.6, zIndex: 2 }}>Photo: {im.credit}</div>
    </Fill>
  );
};

/* ---------- 14 matches, 11 goals ---------- */
const Dots2: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme } = useCtx();
  const t = useT();
  const v = scene.visual;
  const cg = v.cues?.[0] ?? 0.5;
  const cm = v.cues?.[1] ?? 1.5;
  const size = 70;
  const gap = 14;
  const x0 = 110 + 330;
  return (
    <Fill>
      <Head title="Al-Nassr, 2026 to 27 season so far" sub="official matches and goals, all competitions" />
      <div style={{ position: "absolute", left: 110, top: 430, fontFamily: serif, fontWeight: 700, fontSize: 120, lineHeight: 1 }}>{v.goals}</div>
      <div style={{ position: "absolute", left: 110, top: 560, fontFamily: sans, fontWeight: 500, fontSize: 34, opacity: 0.75 }}>goals</div>
      <div style={{ position: "absolute", left: 110, top: 700, fontFamily: serif, fontWeight: 700, fontSize: 120, lineHeight: 1 }}>{v.matches}</div>
      <div style={{ position: "absolute", left: 110, top: 830, fontFamily: sans, fontWeight: 500, fontSize: 34, opacity: 0.75 }}>matches</div>
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {Array.from({ length: v.goals }).map((_, i) => {
          const p = pg(t, cg + i * 0.1, 0.35);
          return <circle key={i} cx={x0 + i * (size + gap) + size / 2} cy={500} r={(size / 2 - 4) * p} fill={theme.accent} stroke={theme.ink} strokeWidth={4} />;
        })}
        {Array.from({ length: v.matches }).map((_, i) => {
          const p = pg(t, cm + i * 0.07, 0.3);
          return <rect key={i} x={x0 + i * (size + gap)} y={770 - 0} width={size} height={size * 0.75 * p + 0.1} rx={12} fill="none" stroke={theme.ink} strokeWidth={5} opacity={p} />;
        })}
      </svg>
      <Src text={SRC_WIKI} />
    </Fill>
  );
};

/* ---------- month strip ---------- */
const MonthStrip: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme, data } = useCtx();
  const t = useT();
  const v = scene.visual;
  const sc = data.results[v.result].scenarios[v.scenario];
  const idxs = [1, 2, 3, 4, 5, 6, 7];
  const x0 = 200;
  const bw = 150;
  const gap = 80;
  const y0 = 860;
  const hMax = 520;
  return (
    <Fill>
      <Head title="Chance he has reached 1,000 by the 27th of each month" sub="scenario: his last two seasons hold, 13 goals needed (Wikipedia count)" />
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        <line x1={x0 - 40} x2={1800} y1={y0} y2={y0} stroke={theme.ink} strokeWidth={4} />
        {idxs.map((m, i) => {
          const p = sc.p_by_month[m];
          const mark = (v.marks || []).find((k: any) => k.m === m);
          const cue = mark ? mark.cue ?? 1 : 99;
          const grow = pg(t, 0.3 + i * 0.12, 0.6);
          const on = mark ? pg(t, cue, 0.4) : 0;
          const h = hMax * p * grow;
          const x = x0 + i * (bw + gap);
          const name = MONTHS[(m + 0) % 13];
          return (
            <g key={m}>
              <rect x={x} y={y0 - h} width={bw} height={h} fill={mark ? (on > 0.5 ? theme.accent : theme.accent2) : theme.accent2} opacity={mark ? 0.55 + 0.45 * on : 0.55} stroke={theme.ink} strokeWidth={4} />
              <text x={x + bw / 2} y={y0 - h - 18} textAnchor="middle" fontFamily={sans} fontWeight={700} fontSize={mark ? 30 + 20 * on : 30} fill={theme.ink} opacity={grow}>{pct(p)}</text>
              <text x={x + bw / 2} y={y0 + 50} textAnchor="middle" fontFamily={serif} fontWeight={600} fontSize={38} fill={theme.ink}>27 {name}</text>
            </g>
          );
        })}
      </svg>
      <Src text="Source: scenario model built from the Wikipedia career statistics table, 40,000 simulations, fixed seed. Not a forecast of injuries, retirement or fixtures." />
    </Fill>
  );
};

/* ---------- ruler ---------- */
const Ruler: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme } = useCtx();
  const t = useT();
  const v = scene.visual;
  const x0 = 160;
  const x1 = 1760;
  const y = 600;
  const X = (val: number) => x0 + ((val - v.min) / (v.max - v.min)) * (x1 - x0);
  const place = [{ above: true, dx: 70 }, { above: false, dx: 0 }, { above: true, dx: -150 }];
  return (
    <Fill>
      <Head title="Three sources, three totals" sub="official goals for club and country, scale 980 to 1,000" />
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        <line x1={x0} x2={x1} y1={y} y2={y} stroke={theme.ink} strokeWidth={6} />
        {Array.from({ length: v.max - v.min + 1 }).map((_, i) => {
          const val = v.min + i;
          return (
            <g key={val}>
              <line x1={X(val)} x2={X(val)} y1={y - (val % 5 === 0 ? 22 : 12)} y2={y + (val % 5 === 0 ? 22 : 12)} stroke={theme.ink} strokeWidth={3} />
              {val % 2 === 0 && !v.markers.some((m: any) => m.v === val) ? <text x={X(val)} y={y + 60} textAnchor="middle" fontFamily={sans} fontWeight={500} fontSize={24} fill={theme.ink} opacity={0.6}>{val === 1000 ? "1,000" : val}</text> : null}
            </g>
          );
        })}
        <g opacity={pg(t, 0.3, 0.5)}>
          <line x1={X(1000)} x2={X(1000)} y1={y - 300} y2={y} stroke={theme.accent} strokeWidth={5} strokeDasharray="14 10" />
          <text x={X(1000) - 10} y={y - 316} textAnchor="end" fontFamily={serif} fontWeight={700} fontSize={46} fill={theme.accent}>1,000</text>
        </g>
        {v.markers.map((m: any, i: number) => {
          const p = pg(t, m.cue, 0.45);
          const pl = place[i % 3];
          const cy = pl.above ? y - 190 : y + 170;
          return (
            <g key={m.v} opacity={p}>
              <line x1={X(m.v)} x2={X(m.v) + pl.dx} y1={y} y2={cy + (pl.above ? 70 : -70)} stroke={theme.ink} strokeWidth={3} />
              <circle cx={X(m.v)} cy={y} r={16 * p + 1} fill={theme.accent2} stroke={theme.ink} strokeWidth={4} />
              <text x={X(m.v) + pl.dx} y={cy - 10} textAnchor="middle" fontFamily={serif} fontWeight={700} fontSize={84} fill={theme.ink}>{m.v}</text>
              <text x={X(m.v) + pl.dx} y={cy + 32} textAnchor="middle" fontFamily={sans} fontWeight={700} fontSize={30} fill={theme.ink}>{m.name}</text>
              <text x={X(m.v) + pl.dx} y={cy + 66} textAnchor="middle" fontFamily={sans} fontWeight={500} fontSize={24} fill={theme.ink} opacity={0.65}>{m.sub}</text>
            </g>
          );
        })}
      </svg>
      <Src text="Sources: Wikipedia (revision 1387620804), messixronaldo.com, ronaldogoalscore.com, all fetched 27 Nov 2026." />
    </Fill>
  );
};

/* ---------- three source cards ---------- */
const Cards3: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme } = useCtx();
  const t = useT();
  const v = scene.visual;
  return (
    <Fill>
      <Head title="Appearances differ too" sub="official goals and official matches, as each source states them" />
      <div style={{ position: "absolute", left: 110, right: 110, top: 330, display: "flex", gap: 50 }}>
        {v.cards.map((c: any, i: number) => {
          const p = pg(t, c.cue - 0.2, 0.5);
          return (
            <div key={i} style={{ flex: 1, height: 560, border: `2px solid ${theme.ink}`, boxShadow: `0 12px 34px color-mix(in srgb, ${theme.ink} 16%, transparent)`, background: theme.paper, padding: 36, opacity: p, transform: `translateY(${(1 - p) * 40}px) rotate(${(i - 1) * 0.8}deg)` }}>
              <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 48 }}>{c.name}</div>
              <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 170, lineHeight: 1.05, marginTop: 20 }}>{c.goals}</div>
              <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 30, opacity: 0.7 }}>official goals</div>
              <div style={{ marginTop: 40, display: "inline-block", fontFamily: serif, fontWeight: 700, fontSize: 80 }}>{fmt(c.matches)}</div>
              <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 30, opacity: 0.7 }}>official matches</div>
            </div>
          );
        })}
      </div>
      <Src text="Sources: Wikipedia (revision 1387620804), messixronaldo.com (20 Nov 2026), ronaldogoalscore.com (26 Nov 2026)." />
    </Fill>
  );
};

/* ---------- stacked total ---------- */
const Stack: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme } = useCtx();
  const t = useT();
  const v = scene.visual;
  const total = v.parts.reduce((a: number, p: any) => a + p.v, 0);
  const x0 = 140;
  const W = 1640;
  let acc = 0;
  return (
    <Fill>
      <Head title="How Wikipedia's 987 splits" sub="official goals by team, career total" />
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {v.parts.map((p: any, i: number) => {
          const w = (p.v / total) * W * pg(t, p.cue - 0.2, 0.8);
          const x = x0 + (acc / total) * W;
          acc += p.v;
          const col = i === 0 ? theme.accent2 : theme.accent;
          const cx = x + ((p.v / total) * W) / 2;
          return (
            <g key={i}>
              <rect x={x} y={470} width={w} height={200} fill={col} stroke={theme.ink} strokeWidth={5} />
              <text x={cx} y={430} textAnchor="middle" fontFamily={serif} fontWeight={700} fontSize={90} fill={theme.ink} opacity={pg(t, p.cue, 0.4)}>{p.v}</text>
              <text x={cx} y={730} textAnchor="middle" fontFamily={sans} fontWeight={700} fontSize={36} fill={theme.ink} opacity={pg(t, p.cue, 0.4)}>{p.name}</text>
            </g>
          );
        })}
        <g opacity={pg(t, v.parts[1].cue + 2, 0.6)}>
          <path d={`M ${x0} 800 L ${x0} 830 L ${x0 + W} 830 L ${x0 + W} 800`} fill="none" stroke={theme.ink} strokeWidth={5} />
          <text x={x0 + W / 2} y={900} textAnchor="middle" fontFamily={serif} fontWeight={700} fontSize={64} fill={theme.ink}>987</text>
        </g>
      </svg>
      <Src text={SRC_WIKI} />
    </Fill>
  );
};

/* ---------- goals per season bars ---------- */
const SeasonBars: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme, data } = useCtx();
  const t = useT();
  const v = scene.visual;
  const rows = data.by_season;
  const n = rows.length;
  const x0 = 140;
  const x1 = 1780;
  const y0 = 880;
  const y1 = 260;
  const bw = (x1 - x0) / n;
  const max = 80;
  const hi = rows.findIndex((r: any) => r.season === v.highlight);
  const cue = v.cues?.[0] ?? 3;
  return (
    <Fill>
      <Head title="Goals for his clubs, season by season" sub="all official club competitions" top={130} />
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {[0, 20, 40, 60, 80].map((g) => {
          const yy = y0 - (g / max) * (y0 - y1);
          return (
            <g key={g}>
              <line x1={x0} x2={x1} y1={yy} y2={yy} stroke={theme.ink} strokeWidth={g === 0 ? 4 : 1.5} opacity={g === 0 ? 1 : 0.25} />
              <text x={x0 - 14} y={yy + 8} textAnchor="end" fontFamily={sans} fontWeight={500} fontSize={24} fill={theme.ink} opacity={0.6}>{g}</text>
            </g>
          );
        })}
        {rows.map((r: any, i: number) => {
          const p = ease((t - 0.2 - i * 0.07) / 0.5);
          const h = (r.goals / max) * (y0 - y1) * p;
          const isHi = i === hi;
          const on = isHi ? pg(t, cue - 0.3, 0.4) : 0;
          return (
            <g key={r.season}>
              <rect x={x0 + i * bw + 6} y={y0 - h} width={bw - 12} height={h} fill={isHi && on > 0.5 ? theme.accent : theme.ink} opacity={isHi && on > 0.5 ? 1 : 0.8} />
              {i % 4 === 0 ? <text x={x0 + i * bw + bw / 2} y={y0 + 40} textAnchor="middle" fontFamily={sans} fontWeight={500} fontSize={24} fill={theme.ink} opacity={0.7}>{r.season.slice(0, 4)}</text> : null}
              {i === n - 1 ? <text x={x0 + i * bw + bw / 2} y={y0 - h - 12} textAnchor="middle" fontFamily={sans} fontWeight={500} fontSize={20} fill={theme.ink} opacity={0.7 * p}>so far</text> : null}
            </g>
          );
        })}
        {hi >= 0 ? (() => {
          const bx = x0 + hi * bw + bw / 2;
          const top = y0 - (rows[hi].goals / max) * (y0 - y1);
          return (
            <g opacity={pg(t, cue, 0.5)}>
              <path d={`M ${bx - 150} ${top - 20} Q ${bx - 40} ${top - 30} ${bx - 6} ${top - 10}`} fill="none" stroke={theme.accent} strokeWidth={5} />
              <text x={bx - 160} y={top - 14} textAnchor="end" fontFamily={hand} fontStyle="italic" fontWeight={500} fontSize={64} fill={theme.accent}>{rows[hi].goals} goals in {rows[hi].apps} matches</text>
            </g>
          );
        })() : null}
      </svg>
      <Src text={SRC_WIKI + ". Clubs sharing a season are added together." } />
    </Fill>
  );
};

/* ---------- rate against age ---------- */
const AgeCurve: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme, data } = useCtx();
  const t = useT();
  const v = scene.visual;
  const rows = data.by_season;
  const x0 = 170;
  const x1 = 1770;
  const y0 = 860;
  const y1 = 270;
  const X = (a: number) => x0 + ((a - 17) / 25) * (x1 - x0);
  const Y = (g: number) => y0 - (g / 1.2) * (y0 - y1);
  const d = rows.map((r: any, i: number) => `${i ? "L" : "M"} ${X(r.age_aug)} ${Y(r.per_match)}`).join(" ");
  const p = ease((t - 0.3) / 3.4);
  const mk = rows.find((r: any) => r.season === v.markSeason);
  const c33 = v.cues?.[0] ?? 3;
  const cLow = v.cues?.[1] ?? 6;
  return (
    <Fill>
      <Head title="Goals a match, by age" sub="his club seasons, age measured in August of the season" top={130} />
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {[0, 0.5, 1.0].map((g) => (
          <g key={g}>
            <line x1={x0} x2={x1} y1={Y(g)} y2={Y(g)} stroke={theme.ink} strokeWidth={g === 0 ? 4 : 1.5} opacity={g === 0 ? 1 : 0.25} />
            <text x={x0 - 14} y={Y(g) + 8} textAnchor="end" fontFamily={sans} fontWeight={500} fontSize={24} fill={theme.ink} opacity={0.6}>{g.toFixed(1)}</text>
          </g>
        ))}
        {[20, 25, 30, 35, 40].map((a) => (
          <text key={a} x={X(a)} y={y0 + 44} textAnchor="middle" fontFamily={sans} fontWeight={500} fontSize={26} fill={theme.ink} opacity={0.7}>{a}</text>
        ))}
        <g opacity={pg(t, c33 - 0.3, 0.5)}>
          <line x1={X(33)} x2={X(33)} y1={y1 - 20} y2={y0} stroke={theme.accent2} strokeWidth={4} strokeDasharray="12 10" />
          <text x={X(33) + 12} y={y1 + 10} fontFamily={hand} fontStyle="italic" fontWeight={500} fontSize={50} fill={theme.accent2}>age 33</text>
        </g>
        <path d={d} fill="none" stroke={theme.ink} strokeWidth={7} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
        {rows.map((r: any, i: number) => {
          const dp = clamp((p * rows.length - i) / 1);
          return <circle key={i} cx={X(r.age_aug)} cy={Y(r.per_match)} r={7 * dp} fill={theme.paper} stroke={theme.ink} strokeWidth={4} />;
        })}
        {mk ? (
          <g opacity={pg(t, cLow - 0.2, 0.5)}>
            <circle cx={X(mk.age_aug)} cy={Y(mk.per_match)} r={18} fill={theme.accent} stroke={theme.ink} strokeWidth={4} />
            <text x={X(mk.age_aug)} y={Y(mk.per_match) + 74} textAnchor="middle" fontFamily={hand} fontStyle="italic" fontWeight={500} fontSize={64} fill={theme.accent}>{mk.per_match.toFixed(2)}</text>
            <text x={X(mk.age_aug)} y={Y(mk.per_match) + 112} textAnchor="middle" fontFamily={sans} fontWeight={500} fontSize={24} fill={theme.ink} opacity={0.7}>{mk.season.replace("–", " to ")}</text>
          </g>
        ) : null}
        <text x={x1} y={y0 + 90} textAnchor="end" fontFamily={sans} fontWeight={500} fontSize={24} fill={theme.ink} opacity={0.6}>age</text>
      </svg>
      <Src text={SRC_WIKI + ". Rate = goals divided by appearances." } />
    </Fill>
  );
};

/* ---------- four recent seasons ---------- */
const Recent4: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme, data } = useCtx();
  const t = useT();
  const v = scene.visual;
  const rows = v.seasons.map((s: string) => data.by_season.find((r: any) => r.season === s));
  return (
    <Fill>
      <Head title="Al-Nassr, season by season" sub="goals, matches and goals a match" />
      <div style={{ position: "absolute", left: 110, right: 110, top: 320, display: "flex", gap: 36 }}>
        {rows.map((r: any, i: number) => {
          const p = pg(t, (v.cues?.[i] ?? i * 2) - 0.25, 0.5);
          const last = i === rows.length - 1;
          return (
            <div key={r.season} style={{ flex: 1, height: 600, border: `2px solid ${theme.ink}`, boxShadow: `0 12px 34px color-mix(in srgb, ${theme.ink} 16%, transparent)`, padding: 28, opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
              <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 44 }}>{r.season.replace("–", " to ")}{last ? " so far" : ""}</div>
              <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 190, lineHeight: 1.05, marginTop: 12 }}>{r.goals}</div>
              <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 30, opacity: 0.7 }}>goals in {r.apps} matches</div>
              <div style={{ marginTop: 40, fontFamily: sans, fontWeight: 700, fontSize: 52 }}>{r.per_match.toFixed(2)}<span style={{ fontSize: 26, fontWeight: 500, opacity: 0.7 }}> a match</span></div>
              <div style={{ marginTop: 18, height: 26, background: theme.grid, border: `3px solid ${theme.ink}` }}>
                <div style={{ width: `${clamp(r.per_match / 1.2) * 100 * p}%`, height: "100%", background: last ? theme.accent : theme.accent2 }} />
              </div>
            </div>
          );
        })}
      </div>
      <Src text={SRC_WIKI + ". Bar scale: 0 to 1.2 goals a match."} />
    </Fill>
  );
};

/* ---------- 16 match tiles ---------- */
const MatchTiles: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme, data } = useCtx();
  const t = useT();
  const v = scene.visual;
  const c0 = v.cues?.[0] ?? 1;
  const c1 = v.cues?.[1] ?? 4;
  const tile = 150;
  const gp = 22;
  const gx = 140;
  const gy = 300;
  const rate = data.assumptions.club_rate.toFixed(2);
  return (
    <Fill>
      <Head title="Matches needed" sub="13 goals at his club rate of the last two seasons" />
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {Array.from({ length: v.tiles }).map((_, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const x = gx + col * (tile + gp);
          const y = gy + row * (tile + gp);
          const appear = pg(t, 0.3 + i * 0.05, 0.3);
          const ball = i < v.goals ? pg(t, c0 + i * 0.13, 0.3) : 0;
          return (
            <g key={i} opacity={appear}>
              <rect x={x} y={y} width={tile} height={tile} rx={14} fill={theme.paper} stroke={theme.ink} strokeWidth={5} />
              <circle cx={x + tile / 2} cy={y + tile / 2} r={44 * ball} fill={theme.accent} stroke={theme.ink} strokeWidth={5} />
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: 960, top: 330, width: 840 }}>
        <div style={{ opacity: pg(t, c0 - 0.2, 0.5), fontFamily: serif, fontWeight: 700, fontSize: 110, lineHeight: 1.05 }}>{rate}</div>
        <div style={{ opacity: pg(t, c0 - 0.2, 0.5), fontFamily: sans, fontWeight: 500, fontSize: 36, opacity: undefined, marginBottom: 60 }}>goals a match, 2024 to 25 and 2025 to 26</div>
        <div style={{ opacity: pg(t, c1 - 0.2, 0.5), fontFamily: serif, fontWeight: 700, fontSize: 150, lineHeight: 1.05, display: "inline-block" }}>about {Math.round(data.matches_needed_at_club_rate)}</div>
        <div style={{ opacity: pg(t, c1 - 0.2, 0.5), fontFamily: sans, fontWeight: 500, fontSize: 36 }}>matches for 13 goals</div>
      </div>
      <Src text={SRC_WIKI + ". Each tile is one match; each ball is one goal at the average rate."} />
    </Fill>
  );
};

/* ---------- required rate bars ---------- */
const RequiredBars: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme, data } = useCtx();
  const t = useT();
  const v = scene.visual;
  const rows = [
    { label: "in 3 months", val: data.per_match_needed["3"] },
    { label: "in 6 months", val: data.per_match_needed["6"] },
    { label: "in 12 months", val: data.per_match_needed["12"] },
  ];
  const x0 = 520;
  const W = 1200;
  const max = 1.2;
  const ref = data.assumptions.club_rate;
  return (
    <Fill>
      <Head title="Goals a match he needs to reach 1,000" sub="13 goals spread over the matches he is assumed to play" />
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {rows.map((r, i) => {
          const y = 380 + i * 190;
          const p = pg(t, v.cues?.[i] ?? 1 + i, 0.7);
          const over = r.val > ref;
          return (
            <g key={i}>
              <text x={x0 - 30} y={y + 62} textAnchor="end" fontFamily={serif} fontWeight={600} fontSize={52} fill={theme.ink}>{r.label}</text>
              <rect x={x0} y={y} width={(r.val / max) * W * p} height={100} fill={over ? theme.accent : theme.accent2} stroke={theme.ink} strokeWidth={5} />
              <text x={x0 + (r.val / max) * W * p + 24} y={y + 72} fontFamily={serif} fontWeight={700} fontSize={64} fill={theme.ink} opacity={p}>{r.val.toFixed(2)}</text>
            </g>
          );
        })}
        <line x1={x0 + (ref / max) * W} x2={x0 + (ref / max) * W} y1={300} y2={940} stroke={theme.ink} strokeWidth={5} strokeDasharray="14 10" />
        <text x={x0 + (ref / max) * W + 16} y={940} fontFamily={hand} fontStyle="italic" fontWeight={500} fontSize={50} fill={theme.ink}>last two seasons: {ref.toFixed(2)}</text>
        <line x1={x0} x2={x0} y1={300} y2={940} stroke={theme.ink} strokeWidth={4} />
      </svg>
      <Src text="Model assumption: about 4.7 matches a month (club and Portugal). Source of rates: Wikipedia career statistics, revision of 24 Nov 2026." />
    </Fill>
  );
};

/* ---------- probability curve ---------- */
const SCN_COLOR = (theme: any) => ({ hold: theme.highlight, decline: theme.paper, sharp: theme.accent });
const Curve: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme, data } = useCtx();
  const t = useT();
  const v = scene.visual;
  const res = data.results[v.result];
  const x0 = 200;
  const x1 = 1780;
  const y0 = 900;
  const y1 = 290;
  const X = (m: number) => x0 + (m / 12) * (x1 - x0);
  const Y = (p: number) => y0 - p * (y0 - y1);
  const colors: any = SCN_COLOR(theme);
  const last = v.show[v.show.length - 1];
  const draw = ease((t - 0.3) / 3.2);
  const path = (k: string) => res.scenarios[k].p_by_month.slice(0, 13).map((p: number, m: number) => `${m ? "L" : "M"} ${X(m)} ${Y(p)}`).join(" ");
  return (
    <Fill>
      <Head title="Chance he has reached 1,000 by each date" sub={`baseline: Wikipedia count, ${res.needed} goals needed. 40,000 simulations per line, fixed seed.`} top={110} />
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={x0} x2={x1} y1={Y(g)} y2={Y(g)} stroke={theme.paper} strokeWidth={g === 0 ? 4 : 1.5} opacity={g === 0 ? 0.9 : 0.25} />
            <text x={x0 - 16} y={Y(g) + 9} textAnchor="end" fontFamily={sans} fontWeight={500} fontSize={26} fill={theme.paper} opacity={0.75}>{Math.round(g * 100)}%</text>
          </g>
        ))}
        {Array.from({ length: 13 }).map((_, m) => (
          <text key={m} x={X(m)} y={y0 + 44} textAnchor="middle" fontFamily={sans} fontWeight={500} fontSize={26} fill={theme.paper} opacity={0.75}>{MONTHS[m]}</text>
        ))}
        <text x={X(0)} y={y0 + 82} textAnchor="middle" fontFamily={sans} fontWeight={500} fontSize={22} fill={theme.paper} opacity={0.55}>2026</text>
        <text x={X(2)} y={y0 + 82} textAnchor="middle" fontFamily={sans} fontWeight={500} fontSize={22} fill={theme.paper} opacity={0.55}>2027</text>
        {v.show.map((k: string) => {
          const isLast = k === last;
          const pp = isLast ? draw : 1;
          return (
            <path key={k} d={path(k)} fill="none" stroke={colors[k]} strokeWidth={k === "decline" ? 6 : 9} strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray={k === "decline" ? "0.02 0.012" : 1} strokeDashoffset={k === "decline" ? 1 - pp : 1 - pp} opacity={k === "decline" ? 0.9 : 1} />
          );
        })}
        {(v.marks || []).map((mk: any, i: number) => {
          const p = res.scenarios[mk.scn].p_by_month[mk.m];
          const a = pg(t, v.cues?.[mk.c] ?? 1, 0.4);
          return (
            <g key={i} opacity={a}>
              <line x1={X(mk.m)} x2={X(mk.m)} y1={Y(p)} y2={y0} stroke={colors[mk.scn]} strokeWidth={3} strokeDasharray="8 8" />
              <circle cx={X(mk.m)} cy={Y(p)} r={16} fill={colors[mk.scn]} stroke={theme.ink} strokeWidth={4} />
              {mk.m >= 11 ? (
                <text x={X(mk.m) - 26} y={Y(p) + 70} textAnchor="end" fontFamily={serif} fontWeight={700} fontSize={56} fill={colors[mk.scn]}>{pct(p)}</text>
              ) : (
                <text x={p < 0.2 ? X(mk.m) - 26 : X(mk.m) + 26} y={p < 0.2 ? Y(p) - 30 : Y(p) + 58} textAnchor={p < 0.2 ? "end" : "start"} fontFamily={serif} fontWeight={700} fontSize={56} fill={colors[mk.scn]}>{pct(p)}</text>
              )}
            </g>
          );
        })}
        <g>
          {v.show.map((k: string, i: number) => (
            <g key={k} transform={`translate(1060 ${770 + i * 54})`}>
              <line x1={0} x2={70} y1={0} y2={0} stroke={colors[k]} strokeWidth={k === "decline" ? 6 : 9} strokeDasharray={k === "decline" ? "8 6" : undefined} />
              <text x={90} y={9} fontFamily={sans} fontWeight={500} fontSize={28} fill={theme.paper}>{res.scenarios[k].label}</text>
            </g>
          ))}
        </g>
      </svg>
      <Src text="Not modelled: injuries, retirement or contract end, fixture list, penalty share, minutes. Source: scenario model, Wikipedia career statistics." />
    </Fill>
  );
};

/* ---------- median dumbbell ---------- */
const Dumbbell: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme, data } = useCtx();
  const t = useT();
  const v = scene.visual;
  const rows = [
    { k: "hold", label: "rate holds" },
    { k: "decline", label: "rate keeps falling" },
    { k: "sharp", label: "sharp drop" },
  ];
  const x0 = 620;
  const x1 = 1760;
  const X = (m: number) => x0 + (m / 8) * (x1 - x0);
  const cue16 = v.cues?.[0] ?? 1;
  const cueJune = v.cues?.[1] ?? 3;
  const cuePct = v.cues?.[2] ?? 5;
  return (
    <Fill>
      <Head title="Middle date, with 13 goals needed and with 16" sub="the month by which the chance first passes one in two" />
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        <g transform="translate(110 285)">
          <circle cx={14} cy={0} r={14} fill={theme.accent2} stroke={theme.ink} strokeWidth={4} />
          <text x={42} y={9} fontFamily={sans} fontWeight={500} fontSize={28} fill={theme.ink}>13 needed (Wikipedia, 987)</text>
          <g opacity={pg(t, cue16 - 0.2, 0.4)}>
            <circle cx={640} cy={0} r={14} fill={theme.accent} stroke={theme.ink} strokeWidth={4} />
            <text x={668} y={9} fontFamily={sans} fontWeight={500} fontSize={28} fill={theme.ink}>16 needed (lowest count, 984)</text>
          </g>
        </g>
        {Array.from({ length: 9 }).map((_, m) => (
          <g key={m}>
            <line x1={X(m)} x2={X(m)} y1={360} y2={890} stroke={theme.ink} strokeWidth={1.5} opacity={0.2} />
            <text x={X(m)} y={925} textAnchor="middle" fontFamily={sans} fontWeight={500} fontSize={26} fill={theme.ink} opacity={0.7}>27 {MONTHS[m]}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = 450 + i * 160;
          const a = data.results.wikipedia.scenarios[r.k];
          const b = data.results.tracker_low.scenarios[r.k];
          const pb = pg(t, k16(r.k, cue16, cueJune), 0.5);
          const same = a.median_month === b.median_month;
          return (
            <g key={r.k}>
              <text x={110} y={y + 12} fontFamily={serif} fontWeight={600} fontSize={46} fill={theme.ink}>{r.label}</text>
              <line x1={X(a.median_month)} x2={X(a.median_month + (b.median_month - a.median_month) * pb)} y1={y} y2={y} stroke={theme.ink} strokeWidth={6} />
              <circle cx={X(a.median_month)} cy={y} r={20} fill={theme.accent2} stroke={theme.ink} strokeWidth={5} />
              <text x={X(a.median_month)} y={y - 34} textAnchor="middle" fontFamily={sans} fontWeight={700} fontSize={28} fill={theme.ink}>27 {MONTHS[a.median_month]}</text>
              <circle cx={X(b.median_month)} cy={y} r={same ? 11 * pb : 20 * pb} fill={theme.accent} stroke={theme.ink} strokeWidth={5} />
              {same ? <text x={X(a.median_month)} y={y + 62} textAnchor="middle" fontFamily={sans} fontWeight={500} fontSize={24} fill={theme.ink} opacity={pb * 0.75}>same with 16</text> : <text x={X(b.median_month)} y={y + 62} textAnchor="middle" fontFamily={sans} fontWeight={700} fontSize={28} fill={theme.ink} opacity={pb}>27 {MONTHS[b.median_month]}</text>}
            </g>
          );
        })}
        <g opacity={pg(t, cuePct - 0.2, 0.5)}>
          <text x={1760} y={985} textAnchor="end" fontFamily={hand} fontStyle="italic" fontWeight={500} fontSize={54} fill={theme.accent}>sharp drop, late May: {pct(data.results.wikipedia.scenarios.sharp.p6)} at 13 needed, {pct(data.results.tracker_low.scenarios.sharp.p6)} at 16</text>
        </g>
      </svg>
      <Src text="Source: scenario model, 40,000 simulations per case, fixed seed. Dates are 27th of the month, 27 Nov 2026 plus whole months." />
    </Fill>
  );
};
const k16 = (k: string, c16: number, cj: number) => (k === "sharp" ? cj : k === "decline" ? (c16 + cj) / 2 : c16);

/* ---------- icons ---------- */
const Icon: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme } = useCtx();
  const t = useT();
  const v = scene.visual;
  const p = pg(t, 0.2, 0.6);
  const sw = 8;
  return (
    <Fill>
      <div style={{ position: "absolute", left: 160, top: 230, width: 620, height: 620, background: theme.grid, border: `2px solid ${theme.ink}`, boxShadow: `0 12px 34px color-mix(in srgb, ${theme.ink} 16%, transparent)`, transform: `rotate(-1.5deg) scale(${0.9 + 0.1 * p})`, opacity: p }}>
        <svg viewBox="0 0 400 400" width={620} height={620}>
          {v.kind === "injury" ? (
            <g transform="rotate(-35 200 200)">
              <rect x={40} y={140} width={320} height={120} rx={60} fill={theme.highlight} stroke={theme.ink} strokeWidth={sw} />
              <rect x={140} y={140} width={120} height={120} fill={theme.paper} stroke={theme.ink} strokeWidth={sw} />
              {[185, 215].flatMap((y) => [75, 105, 295, 325].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={6} fill={theme.ink} />))}
            </g>
          ) : null}
          {v.kind === "door" ? (
            <g>
              <rect x={90} y={50} width={180} height={300} fill={theme.paper} stroke={theme.ink} strokeWidth={sw} />
              <polygon points="90,50 210,85 210,335 90,350" fill={theme.muted} stroke={theme.ink} strokeWidth={sw} />
              <circle cx={190} cy={210} r={9} fill={theme.ink} />
              <line x1={250} x2={370} y1={210} y2={210} stroke={theme.accent} strokeWidth={14} />
              <polygon points="360,170 398,210 360,250" fill={theme.accent} />
            </g>
          ) : null}
          {v.kind === "calendar" ? (
            <g>
              <rect x={50} y={70} width={300} height={290} rx={18} fill={theme.paper} stroke={theme.ink} strokeWidth={sw} />
              <rect x={50} y={70} width={300} height={70} rx={18} fill={theme.accent} stroke={theme.ink} strokeWidth={sw} />
              <rect x={105} y={40} width={18} height={55} rx={9} fill={theme.ink} />
              <rect x={277} y={40} width={18} height={55} rx={9} fill={theme.ink} />
              {[0, 1, 2].flatMap((r) => [0, 1, 2, 3, 4].map((c) => <rect key={`${r}-${c}`} x={78 + c * 50} y={170 + r * 60} width={34} height={38} fill={(r === 1 && c === 2) || (r === 2 && c === 4) ? theme.highlight : theme.grid} stroke={theme.ink} strokeWidth={4} />))}
            </g>
          ) : null}
        </svg>
      </div>
      <div style={{ position: "absolute", left: 900, top: 330, width: 900, opacity: pg(t, 0.5, 0.6), transform: `translateX(${(1 - pg(t, 0.5, 0.6)) * 40}px)` }}>
        <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 112, lineHeight: 1.05 }}>{v.label}</div>
        <div style={{ fontFamily: hand, fontStyle: "italic", fontWeight: 500, fontSize: 64, color: theme.accent, marginTop: 26 }}>not in the model</div>
      </div>
    </Fill>
  );
};

/* ---------- range bar ---------- */
const RangeBar: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme, data } = useCtx();
  const t = useT();
  const v = scene.visual;
  const hold = data.results.wikipedia.scenarios.hold;
  const x0 = 200;
  const x1 = 1740;
  const X = (m: number) => x0 + (m / 8) * (x1 - x0);
  const y = 560;
  const cMid = v.cues?.[0] ?? 1;
  const cLo = v.cues?.[1] ?? 3;
  const cHi = v.cues?.[2] ?? 5;
  return (
    <Fill>
      <Head title="Where it lands" sub="13 goals needed, his last two seasons hold, he keeps playing" />
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        <line x1={x0} x2={x1} y1={y} y2={y} stroke={theme.ink} strokeWidth={6} />
        {Array.from({ length: 9 }).map((_, m) => (
          <g key={m}>
            <line x1={X(m)} x2={X(m)} y1={y - 14} y2={y + 14} stroke={theme.ink} strokeWidth={4} />
            <text x={X(m)} y={y + 100} textAnchor="middle" fontFamily={sans} fontWeight={500} fontSize={26} fill={theme.ink} opacity={0.7}>27 {MONTHS[m]}</text>
          </g>
        ))}
        <rect x={X(3)} y={y - 45} width={(X(6) - X(3)) * pg(t, cLo, 0.9)} height={90} fill={theme.highlight} stroke={theme.ink} strokeWidth={5} opacity={0.9} />
        <g opacity={pg(t, cLo, 0.4)}>
          <text x={X(3)} y={y - 75} textAnchor="middle" fontFamily={serif} fontWeight={700} fontSize={60} fill={theme.ink}>{pct(hold.p_by_month[3])}</text>
        </g>
        <g opacity={pg(t, cHi, 0.4)}>
          <text x={X(6)} y={y - 75} textAnchor="middle" fontFamily={serif} fontWeight={700} fontSize={60} fill={theme.ink}>{pct(hold.p_by_month[6])}</text>
        </g>
        <g opacity={pg(t, cMid, 0.5)}>
          <line x1={X(4)} x2={X(4)} y1={y - 70} y2={y + 70} stroke={theme.accent} strokeWidth={10} />
          <circle cx={X(4)} cy={y} r={20} fill={theme.accent} stroke={theme.ink} strokeWidth={5} />
          <text x={X(4)} y={y + 230} textAnchor="middle" fontFamily={hand} fontStyle="italic" fontWeight={500} fontSize={72} fill={theme.accent}>middle: end of March 2027</text>
        </g>
        <text x={X(3)} y={y + 160} textAnchor="middle" fontFamily={sans} fontWeight={700} fontSize={28} fill={theme.ink} opacity={pg(t, cLo, 0.4)}>by late Feb</text>
        <text x={X(6)} y={y + 160} textAnchor="middle" fontFamily={sans} fontWeight={700} fontSize={28} fill={theme.ink} opacity={pg(t, cHi, 0.4)}>by late May</text>
      </svg>
      <Src text="Source: scenario model, Wikipedia baseline. A range from assumptions, not a prediction." />
    </Fill>
  );
};

/* ---------- sources collage ---------- */
const Collage: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme, images } = useCtx();
  const t = useT();
  const v = scene.visual;
  const rot = [-4, 3, -2, 4, -3, 2];
  const lines = [
    "Wikipedia, Cristiano Ronaldo, revision 1387620804, 24 Nov 2026 (CC BY-SA 4.0)",
    "Wikidata Q11571, birth date (CC0)",
    "ronaldogoalscore.com, as of 26 Nov 2026",
    "messixronaldo.com, updated 20 Nov 2026",
    "Photos: Wikimedia Commons, authors and licences in the description",
  ];
  return (
    <Fill>
      <div style={{ position: "absolute", left: 90, top: 120, width: 1000, height: 840 }}>
        {v.imgs.map((id: string, i: number) => {
          const im = images[id];
          const p = pg(t, 0.2 + i * 0.25, 0.5);
          const col = i % 3;
          const row = Math.floor(i / 3);
          return (
            <div key={id} style={{ position: "absolute", left: col * 330, top: row * 420 + 20, width: 300, height: 380, background: theme.paper, border: `1px solid ${theme.grid}`, boxShadow: `0 8px 22px color-mix(in srgb, ${theme.ink} 20%, transparent)`, padding: 12, transform: `rotate(${rot[i]}deg) scale(${0.85 + 0.15 * p})`, opacity: p }}>
              <Img src={staticFile(im.file)} style={{ width: 274, height: 300, objectFit: "cover" }} />
              <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 16, marginTop: 8, opacity: 0.7 }}>{im.author.slice(0, 34)}</div>
              <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 16, opacity: 0.7 }}>{im.license}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 1130, top: 220, width: 700 }}>
        <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 70, marginBottom: 30 }}>data and images</div>
        {lines.map((l, i) => (
          <div key={i} style={{ fontFamily: sans, fontWeight: 500, fontSize: 28, lineHeight: 1.3, marginBottom: 20, opacity: pg(t, 0.5 + i * 0.35, 0.4) }}>{l}</div>
        ))}
      </div>
    </Fill>
  );
};

/* ---------- scene shell ---------- */
const Visual: React.FC<{ scene: any; idx: number }> = ({ scene, idx }) => {
  switch (scene.visual.type) {
    case "photo": return <PhotoScene scene={scene} idx={idx} />;
    case "dots2": return <Dots2 scene={scene} />;
    case "monthstrip": return <MonthStrip scene={scene} />;
    case "ruler": return <Ruler scene={scene} />;
    case "cards3": return <Cards3 scene={scene} />;
    case "stack": return <Stack scene={scene} />;
    case "seasonbars": return <SeasonBars scene={scene} />;
    case "agecurve": return <AgeCurve scene={scene} />;
    case "recent4": return <Recent4 scene={scene} />;
    case "matchtiles": return <MatchTiles scene={scene} />;
    case "requiredbars": return <RequiredBars scene={scene} />;
    case "curve": return <Curve scene={scene} />;
    case "dumbbell": return <Dumbbell scene={scene} />;
    case "icon": return <Icon scene={scene} />;
    case "rangebar": return <RangeBar scene={scene} />;
    case "collage": return <Collage scene={scene} />;
    default: return null;
  }
};

const PaperBg: React.FC = () => {
  const { theme, dark } = useCtx();
  const vignette = dark
    ? `radial-gradient(ellipse at 50% 46%, color-mix(in srgb, ${theme.ink} 82%, ${theme.paper}) 0%, ${theme.ink} 55%, color-mix(in srgb, ${theme.ink} 55%, black) 100%)`
    : `radial-gradient(ellipse at 50% 46%, transparent 55%, color-mix(in srgb, ${theme.muted} 40%, transparent) 100%)`;
  return (
    <>
      {dark ? <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: vignette }} /> : null}
      {dark ? null : (
        <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
          <defs>
            <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" /><feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0.55 0" /></filter>
          </defs>
          <rect width={1920} height={1080} filter="url(#n)" opacity={0.28} />
        </svg>
      )}
      {dark ? null : <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: vignette }} />}
    </>
  );
};

const ChapterTitle: React.FC<{ ch: any }> = ({ ch }) => {
  const { theme } = useCtx();
  const t = useT();
  const a = pg(t, 0.1, 0.5) * (1 - pg(t, 4.4, 0.6));
  if (a <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 110, top: 30, opacity: a * 0.7, fontFamily: serif, fontStyle: "italic", fontWeight: 400, fontSize: 38, textTransform: "lowercase" }}>
      {ch.title}.
    </div>
  );
};

const SceneShell: React.FC<{ scene: any; idx: number }> = ({ scene, idx }) => {
  const { theme, data, images } = useCtx();
  const t = useT();
  const dark = !!scene.visual.dark || scene.visual.type === "photo";
  const fade = pg(t, 0, 0.3);
  return (
    <C.Provider value={{ theme, data, images, dark }}>
      <AbsoluteFill style={{ background: dark ? theme.ink : theme.paper, color: dark ? theme.paper : theme.ink }}>
        <PaperBg />
        <div style={{ opacity: fade }}>
          <Visual scene={scene} idx={idx} />
        </div>
        {scene.chapter ? <ChapterTitle ch={scene.chapter} /> : null}
      </AbsoluteFill>
    </C.Provider>
  );
};

export const Episode: React.FC<any> = ({ theme, scenes, images, data, audioSrc, fps }) => {
  return (
    <C.Provider value={{ theme, data, images, dark: false }}>
    <AbsoluteFill style={{ background: theme.paper }}>
      {scenes.map((s: any, i: number) => (
        <Sequence key={s.id} from={Math.round(s.t0 * fps)} durationInFrames={Math.max(1, Math.round((s.t1 - s.t0) * fps))}>
          <SceneShell scene={s} idx={i} />
        </Sequence>
      ))}
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
    </AbsoluteFill>
    </C.Provider>
  );
};
