import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {resolveSrc} from '../../core/asset';
import {ease, lerp, prog, springAt} from '../../core/ease';
import {fonts} from '../../core/fonts';
import {IconBox, clamp01, smoothstep} from '../../core/r2-pr1-kit';
import {Svg, useStage} from '../../core/stage';
import {defineMotion} from '../../core/types';

/**
 * A ruler of years scrolls past a fixed playhead; each event pins a card (date, image, title, one line) that pops with
 * a spring while the camera pans between events (eased ~26 f) and holds (~58 f). The big year counter is an odometer
 * that rolls through every year between events. Horizontal on landscape / square, vertical on portrait (or forced).
 */

type Ev = {date: string; title: string; body?: string; image?: string; icon?: string};
type Props = {
  events: Ev[];
  orientation: 'auto' | 'horizontal' | 'vertical';
  scale: 'linear' | 'even';
  cardStyle: 'light' | 'dark';
  panFrames: number;
  holdFrames: number;
  showCounter: boolean;
  background: string;
  ink: string;
  accent: string;
};

const parseYear = (d: string, fallback: number) => {
  const m = /(\d{4})/.exec(d) ?? /(\d+(?:\.\d+)?)/.exec(d);
  return m ? parseFloat(m[1]) : fallback;
};
const niceStep = (span: number) => (span <= 12 ? 1 : span <= 30 ? 2 : span <= 60 ? 5 : span <= 150 ? 10 : span <= 400 ? 25 : 50);

const TimelineRuler: React.FC<Props> = ({events, orientation, scale, cardStyle, panFrames, holdFrames, showCounter, background, ink, accent}) => {
  const frame = useCurrentFrame();
  const {w, h, u, fps, portrait} = useStage();
  const vertical = orientation === 'vertical' || (orientation === 'auto' && portrait);
  const main = vertical ? h : w;
    const evs = events.length >= 2 ? events : [...events, {date: '2030', title: 'Next'}];
  const years = evs.map((e, i) => parseYear(e.date, 2000 + i * 5));
  const n = evs.length;

  // world positions along the ruler
  const G = main * (vertical ? 0.5 : 0.62);
  const dys = years.slice(1).map((y, i) => Math.max(0.0001, y - years[i]));
  const avg = dys.reduce((a, b) => a + b, 0) / dys.length;
  const gaps = dys.map((d) => (scale === 'even' ? G : Math.min(G * 1.7, Math.max(G * 0.6, (d / avg) * G))));
  const pos = [0];
  gaps.forEach((g) => pos.push(pos[pos.length - 1] + g));
  const yearToA = (yr: number) => {
    if (yr <= years[0]) return pos[0] + ((yr - years[0]) / dys[0]) * gaps[0];
    if (yr >= years[n - 1]) return pos[n - 1] + ((yr - years[n - 1]) / dys[n - 2]) * gaps[n - 2];
    for (let i = 0; i < n - 1; i++) if (yr <= years[i + 1]) return pos[i] + ((yr - years[i]) / dys[i]) * gaps[i];
    return pos[n - 1];
  };

  // camera schedule
  const intro = 16;
  const per = panFrames + holdFrames;
  let camA = pos[0];
  let yearNow = years[0];
  let active = 0;
  for (let i = 1; i < n; i++) {
    // events: the first hold is `holdFrames`, each later hold follows its pan
    const t0 = intro + holdFrames + (i - 1) * per;
    const pp = prog(frame, t0, t0 + panFrames, ease.inOut);
    camA = lerp(camA, pos[i], pp);
    yearNow = lerp(yearNow, years[i], pp);
    if (pp > 0.5) active = i;
  }
  const arriveAt = (i: number) => (i === 0 ? 4 : intro + holdFrames + (i - 1) * per + panFrames - 6);

  const anchor = main * 0.5;
  const A = (a: number) => a - camA + anchor; // world -> screen along ruler
  const rulerC = vertical ? w * 0.17 : h * 0.585; // ruler cross position
  const P = (a: number, c: number): [number, number] => (vertical ? [c, a] : [a, c]);

  // ticks
  const ticks: {a: number; yr: number; major: boolean}[] = [];
  const addSeg = (y0: number, y1: number) => {
    const st = niceStep(Math.abs(y1 - y0));
    const lab = st === 1 ? 5 : st * 2;
    const lo = Math.ceil(Math.min(y0, y1) / st) * st;
    for (let yr = lo; yr <= Math.max(y0, y1); yr += st) ticks.push({a: yearToA(yr), yr, major: yr % lab === 0});
  };
  addSeg(years[0] - (years[1] - years[0]), years[0]);
  for (let i = 0; i < n - 1; i++) addSeg(years[i], years[i + 1]);
  addSeg(years[n - 1], years[n - 1] + (years[n - 1] - years[n - 2]));

  const dark = cardStyle === 'dark';
  const cardBg = dark ? '#1B1C20' : '#FFFFFF';
  const cardInk = dark ? '#F1EEE6' : '#1A1A1F';
  const cardMute = dark ? 'rgba(241,238,230,0.62)' : 'rgba(26,26,31,0.62)';

  const cardW = vertical ? w * 0.7 : Math.min(560 * u, w * 0.3);
  const cardH = vertical ? h * 0.27 : h * 0.29;
  const imgH = vertical ? cardH * 0.3 : cardH * 0.44;

  const digits = String(Math.round(Math.max(...years))).length;
  const lineH = 118 * u;
  const odo = (place: number) => {
    // lowest digit rolls continuously; a higher digit only rolls through the last year before its carry
    const mod = Math.pow(10, place);
    const lower = yearNow % mod;
    const roll = place === 0 ? 0 : smoothstep(mod - 1, mod, lower);
    const whole = Math.floor(yearNow / mod - (place === 0 ? 0 : lower / mod)) ;
    const base = place === 0 ? yearNow % 10 : Math.floor(yearNow / mod) % 10;
    void whole;
    return place === 0 ? base : base + roll;
  };

  const intro0 = prog(frame, 0, 14, ease.out);

  return (
    <AbsoluteFill style={{background, overflow: 'hidden'}}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 40%, ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.5)'} 0%, rgba(0,0,0,0) 70%)`}} />
      <Svg>
        {/* ruler line */}
        {(() => {
          const [x1, y1] = P(0, rulerC);
          const [x2, y2] = P(main, rulerC);
          return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ink} strokeOpacity={0.35 * intro0} strokeWidth={2.5 * u} strokeLinecap="round" />;
        })()}
        {ticks.map((t, i) => {
          const a = A(t.a);
          if (a < -80 * u || a > main + 80 * u) return null;
          const len = (t.major ? 26 : 13) * u;
          const [x1, y1] = P(a, rulerC);
          const [x2, y2] = P(a, rulerC + (vertical ? -len : len));
          const [lx, ly] = P(a, rulerC + (vertical ? -(len + 14 * u) : len + 28 * u));
          return (
            <g key={i} opacity={intro0}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ink} strokeOpacity={t.major ? 0.6 : 0.3} strokeWidth={2 * u} strokeLinecap="round" />
              {t.major ? (
                <text x={lx} y={ly} fill={ink} fillOpacity={0.5} fontFamily={fonts.mono} fontSize={(vertical ? 27 : 19) * u} textAnchor={vertical ? 'end' : 'middle'} dominantBaseline={vertical ? 'middle' : 'auto'}>
                  {t.yr}
                </text>
              ) : null}
            </g>
          );
        })}
        {/* event markers */}
        {evs.map((e, i) => {
          const a = A(pos[i]);
          if (a < -80 * u || a > main + 80 * u) return null;
          const [x, y] = P(a, rulerC);
          const s = springAt(frame, fps, arriveAt(i) - 8, 'pop');
          return <circle key={i} cx={x} cy={y} r={(i === active ? 11 : 8) * u * clamp01(s * 1.1)} fill={background} stroke={accent} strokeWidth={4 * u} />;
        })}
        {/* playhead */}
        {(() => {
          const [x, y] = P(anchor, rulerC);
          return (
            <g opacity={intro0}>
              <circle cx={x} cy={y} r={26 * u} fill={accent} opacity={0.18} />
              <circle cx={x} cy={y} r={14 * u} fill={accent} />
              <circle cx={x} cy={y} r={5 * u} fill="#fff" />
            </g>
          );
        })()}
      </Svg>

      {/* cards */}
      {evs.map((e, i) => {
        const a = A(pos[i]);
        if (a < -cardW || a > main + cardW) return null;
        const s = springAt(frame, fps, arriveAt(i), 'pop');
        if (s <= 0.001) return null;
        const side = vertical ? 1 : i % 2 === 0 ? -1 : 1;
        const cc = vertical ? rulerC + 40 * u + cardW / 2 : rulerC + side * (cardH / 2 + 62 * u);
        const [cx, cy] = P(a, cc);
        // dim cards that are not the current one
        const cur = Math.abs(pos[i] - camA);
        const dim = lerp(1, 0.42, smoothstep(G * 0.25, G * 0.9, cur));
        const sc = lerp(0.82, 1, clamp01(s)) * lerp(1, 0.94, (1 - dim) / 0.58);
        const kb = 1 + 0.07 * prog(frame, arriveAt(i), arriveAt(i) + holdFrames + panFrames, ease.sine);
        const hue = (i * 47 + 190) % 360;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: cx - cardW / 2,
              top: cy - cardH / 2,
              width: cardW,
              height: cardH,
              borderRadius: 22 * u,
              background: cardBg,
              boxShadow: dark ? '0 18px 50px rgba(0,0,0,0.5)' : '0 18px 44px rgba(40,30,10,0.16), 0 2px 6px rgba(40,30,10,0.08)',
              opacity: clamp01(s * 1.4) * dim,
              transform: `translate(${vertical ? -(1 - clamp01(s)) * 30 * u : 0}px, ${vertical ? 0 : -side * (1 - clamp01(s)) * 26 * u}px) scale(${sc})`,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{height: imgH, overflow: 'hidden', position: 'relative', background: `linear-gradient(135deg, hsl(${hue} 62% 62%), hsl(${(hue + 40) % 360} 58% 46%))`}}>
              {e.image ? (
                <img src={resolveSrc(e.image)} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${kb})`}} />
              ) : (
                <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="xMidYMid slice" style={{transform: `scale(${kb})`}}>
                  <circle cx={22} cy={14} r={16} fill="#fff" opacity={0.14} />
                  <circle cx={78} cy={36} r={26} fill="#fff" opacity={0.12} />
                  <path d="M0 34 Q25 22 50 30 T100 24 V40 H0Z" fill="#fff" opacity={0.18} />
                </svg>
              )}
              <div style={{position: 'absolute', left: 14 * u, bottom: 12 * u, width: 40 * u, height: 40 * u, borderRadius: 12 * u, background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <IconBox name={e.icon ?? ['spark', 'bolt', 'globe', 'chart', 'star', 'shield'][i % 6]} size={26 * u} color={`hsl(${hue} 60% 38%)`} sw={2} />
              </div>
            </div>
            <div style={{padding: `${14 * u}px ${20 * u}px`, display: 'flex', flexDirection: 'column', gap: 4 * u, flex: 1, minHeight: 0}}>
              <div style={{fontFamily: fonts.mono, fontSize: (vertical ? 26 : 18) * u, letterSpacing: '0.12em', color: accent, fontWeight: 700}}>{e.date}</div>
              <div style={{fontFamily: fonts.sans, fontWeight: 800, fontSize: (vertical ? 44 : 30) * u, lineHeight: 1.1, color: cardInk, letterSpacing: '-0.02em'}}>{e.title}</div>
              {e.body ? <div style={{fontFamily: fonts.sans, fontSize: (vertical ? 30 : 20) * u, lineHeight: 1.3, color: cardMute}}>{e.body}</div> : null}
            </div>
          </div>
        );
      })}

      {/* odometer year counter */}
      {showCounter ? (
        <div
          style={{
            position: 'absolute',
            left: vertical ? w * 0.34 : 0,
            right: vertical ? 40 * u : 0,
            top: vertical ? h * 0.075 : h * 0.045,
            display: 'flex',
            justifyContent: vertical ? 'flex-start' : 'center',
            opacity: intro0,
          }}
        >
          <div style={{display: 'flex', height: lineH, overflow: 'hidden', fontFamily: fonts.sans, fontWeight: 800, fontSize: 104 * u, letterSpacing: '-0.03em', color: ink, WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 18%, #000 82%, transparent 100%)', maskImage: 'linear-gradient(180deg, transparent 0%, #000 18%, #000 82%, transparent 100%)'}}>
            {Array.from({length: digits}, (_, k) => {
              const place = digits - 1 - k;
              const m = odo(place);
              return (
                <div key={k} style={{width: 66 * u, height: lineH, position: 'relative'}}>
                  <div style={{position: 'absolute', left: 0, right: 0, top: 0, transform: `translateY(${-m * lineH}px)`}}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, j) => (
                      <div key={j} style={{height: lineH, lineHeight: `${lineH}px`, textAlign: 'center'}}>{d}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const timelineRuler = defineMotion<Props>({
  id: 'timeline-ruler',
  title: 'Timeline ruler with event cards',
  category: 'data',
  description:
    'A ruler of years glides under a fixed playhead dot; every event pins a card (date, image or gradient, title, one line) with a spring pop while the camera pans between events and the big odometer year counter rolls through the years in between. Horizontal on 16:9/1:1, vertical on 9:16.',
  source: ['prompt-corpus: timeline-ruler (44 cases)', 'awesome-opus5-5-videos prompts (MIT) — technique only'],
  useFor: 'Company history, product roadmaps, "history of X" videos and about-us sections: pass `events` (date, title, body, optional image).',
  durationInFrames: 16 + 58 + 5 * (26 + 58) + 30,
  defaultProps: {
    events: [
      {date: '1998', title: 'The first sketch', body: 'Two people, one whiteboard, a very large idea.', icon: 'spark'},
      {date: '2004', title: 'First product ships', body: 'The beta goes out to a hundred early users.', icon: 'bolt'},
      {date: '2009', title: 'Going global', body: 'Offices open on three continents.', icon: 'globe'},
      {date: '2015', title: 'A million customers', body: 'Growth that nobody planned for.', icon: 'chart'},
      {date: '2020', title: 'Rebuilt from scratch', body: 'A new platform for the next decade.', icon: 'cog'},
      {date: '2025', title: 'Today', body: 'Still sketching on the same whiteboard.', icon: 'star'},
    ],
    orientation: 'auto',
    scale: 'linear',
    cardStyle: 'light',
    panFrames: 26,
    holdFrames: 58,
    showCounter: true,
    background: '#F1ECE2',
    ink: '#1A1A1F',
    accent: '#E4572E',
  },
  propDocs: {
    events: '[{date: "1998" (a 4-digit year is parsed), title, body?, image?: public path, icon?: name}]',
    orientation: "'auto' (vertical on portrait) | 'horizontal' | 'vertical'",
    scale: "'linear' = gaps proportional to years (clamped) · 'even' = equal gaps",
    cardStyle: "'light' | 'dark'",
    panFrames: 'camera pan between events (20-30)',
    holdFrames: 'hold on each event (45-75)',
    showCounter: 'show the odometer year counter',
    background: 'background colour',
    ink: 'ruler / counter colour',
    accent: 'playhead, markers and dates',
  },
  component: TimelineRuler,
  tags: ['timeline', 'history', 'roadmap', 'ruler', 'years', 'milestones', 'events', 'cards', 'odometer', 'counter', 'company', 'about', 'data', 'chronology'],
});
