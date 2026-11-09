import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {clamp} from '../../core/ease';
import {fonts} from '../../core/fonts';
import {useStage} from '../../core/stage';
import {Backdrop, BackdropKind, eioc, eoc, monotone, tfonts} from '../../core/text-kit';
import {defineMotion} from '../../core/types';

/**
 * Big animated counter (video23 depth-counter-hud, video19 era-dial counter roll, video17 gauge %).
 * The value follows monotone-cubic keyframes (so dwells near landmarks read as slow-downs), renders in
 * tabular light mono with thin-space thousands, either ticking per frame or as an odometer whose digit
 * strips roll with motion blur. Optional derived readouts (pressure / light / temperature / percent) and
 * a semicircle gauge. Extra modes: lock / scramble (digits spin and lock one by one), flap (split-flap tiles), clock (time-lapse clock).
 */

type Readout = 'pressure' | 'light' | 'temp' | 'percent' | 'rate';
type Props = {
  keyframes: [number, number][];
  mode: 'tick' | 'roll' | 'lock' | 'scramble' | 'flap' | 'clock';
  label: string;
  unit: string;
  prefix: string;
  decimals: number;
  separator: string;
  readouts: Readout[];
  readoutLabels: string[];
  layout: 'center' | 'hud';
  gauge: boolean;
  size: number;
  labelSize: number;
  labelColor: string;
  numberColor: string;
  accent: string;
  backdrop: BackdropKind;
  linkBackdrop: boolean;
  src: string;
  lockStart: number;
  lockStep: number;
  lockOrder: 'ltr' | 'rtl';
  glyphs: string;
  accentOnLock: boolean;
  flashFrame: boolean;
  progressBar: boolean;
  flapFrom: number | null;
  flapStagger: number;
  flipFrames: number;
  tileColor: string;
  callout: string;
  clockStart: number;
  clockRate: [number, number][];
  speedTag: boolean;
  block: string;
  blockColor: string;
  kicker: string;
  rollDuration: number;
};

const fmtInt = (n: number, sep: string) => {
  const s = Math.abs(Math.round(n)).toString();
  return (n < 0 ? '−' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
};
const fmt = (v: number, dec: number, sep: string) => {
  if (dec <= 0) return fmtInt(v, sep);
  const [i, f] = v.toFixed(dec).split('.');
  return `${fmtInt(Number(i), sep)}.${f}`;
};

const TEMP: [number, number][] = [
  [0, 19],
  [Math.log10(301), 11],
  [Math.log10(851), 5.8],
  [Math.log10(11001), 2.2],
];
const readoutValue = (r: Readout, v: number, max: number, rate: number, sep: string) => {
  switch (r) {
    case 'pressure':
      return `×${fmtInt(1 + v / 10, sep)}`;
    case 'light': {
      const l = 100 * Math.exp(-v / 14);
      return `${l >= 1 ? Math.round(l) : l >= 0.01 ? l.toFixed(2) : '0'} %`;
    }
    case 'temp':
      return `${monotone(TEMP, Math.log10(1 + Math.max(0, v))).toFixed(1)} °C`;
    case 'percent':
      return `${Math.round((100 * v) / Math.max(1e-9, max))} %`;
    case 'rate':
      return `${fmtInt(rate * 30, sep)} /s`;
  }
};
const DEFAULT_LABELS: Record<Readout, string> = {pressure: 'PRESSURE', light: 'LIGHT', temp: 'TEMP.', percent: 'PROGRESS', rate: 'RATE'};

/** odometer digit strip for place k */
const RollDigits: React.FC<{v: number; speed: number; places: number; sep: string; fs: number; color: string}> = ({v, speed, places, sep, fs, color}) => {
  const cols: React.ReactNode[] = [];
  const vv = Math.max(0, v);
  for (let k = places - 1; k >= 0; k--) {
    const p10 = Math.pow(10, k);
    const base = vv / p10;
    const lower = vv - Math.floor(base) * p10;
    // digits tick: each roll happens in the last 35 % of a unit step (reads cleanly when slow)
    const roll = eioc((vv - Math.floor(vv) - 0.65) / 0.35);
    const carry = k === 0 ? roll : lower >= p10 - 1 ? roll : 0;
    const pos = (Math.floor(base) % 10) + carry;
    const visible = k === 0 || vv >= p10 - 0.5 ? 1 : 0;
    const blur = Math.min(fs * 0.045, (speed / p10) * fs * 0.01);
    cols.push(
      <span key={`d${k}`} style={{display: visible ? 'inline-block' : 'none', height: fs * 1.05, overflow: 'hidden', verticalAlign: 'top'}}>
        <span style={{display: 'flex', flexDirection: 'column', transform: `translateY(${-pos * fs * 1.05}px)`, filter: blur > 0.3 ? `blur(0px) blur(${blur}px)` : undefined, color}}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => (
            <span key={i} style={{height: fs * 1.05, lineHeight: `${fs * 1.05}px`}}>
              {d}
            </span>
          ))}
        </span>
      </span>,
    );
    if (k > 0 && k % 3 === 0 && visible) cols.push(<span key={`s${k}`} style={{display: 'inline-block', width: sep === ' ' || sep === ' ' ? fs * 0.25 : undefined}}>{sep === ' ' || sep === ' ' ? '' : sep}</span>);
  }
  return <>{cols}</>;
};


const DIGITS = '0123456789';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%/+*';
const isDigit = (c: string) => c >= '0' && c <= '9';
const spring = (t: number) => (t <= 0 ? 0 : 1 - Math.exp(-t * 0.35) * Math.cos(t * 0.9));

/** character slots that spin through random glyphs and lock one by one (mode lock / scramble) */
const LockText: React.FC<{str: string; frame: number; p: Props; fs: number}> = ({str, frame, p, fs}) => {
  const n = str.length;
  const slot = fs * 0.6;
  return (
    <>
      {str.split('').map((c, i) => {
        const order = p.lockOrder === 'rtl' ? n - 1 - i : i;
        const lockAt = p.lockStart + order * p.lockStep;
        const locked = frame >= lockAt;
        const age = frame - lockAt;
        const fixed = !/[0-9A-Za-z]/.test(c);
        let ch = c;
        if (!locked && !fixed) {
          const useSet = isDigit(c) ? (p.mode === 'scramble' && p.glyphs ? p.glyphs : DIGITS) : LETTERS;
          ch = useSet[Math.floor(random(`lk${i}-${frame}`) * useSet.length)];
        }
        const drop = locked && p.mode === 'scramble' ? (1 - spring(Math.min(age, 40))) * fs * 0.12 : 0;
        const flash = locked && age >= 0 && age < 6 && p.accentOnLock;
        const unlockedAlpha = locked ? 1 : 0.8;
        const trail = !locked && p.mode === 'scramble';
        return (
          <span key={i} style={{display: 'inline-block', width: fixed ? slot * 0.5 : slot, textAlign: 'center', position: 'relative', transform: `translateY(${drop}px)`, color: flash ? p.accent : p.block ? p.blockColor : p.numberColor, opacity: unlockedAlpha, filter: p.flashFrame && locked && age === 0 ? 'brightness(3)' : undefined}}>
            {trail && (
              <>
                <span style={{position: 'absolute', left: 0, right: 0, top: -fs * 0.09, opacity: 0.3}}>{ch}</span>
                <span style={{position: 'absolute', left: 0, right: 0, top: -fs * 0.18, opacity: 0.14}}>{ch}</span>
              </>
            )}
            {ch}
          </span>
        );
      })}
    </>
  );
};

/** departure-board tile: old top folds down (scaleY 1 -> 0) revealing the new top, then the new bottom unfolds (0 -> 1) */
const FlapTile: React.FC<{from: string; to: string; t: number; fs: number; color: string; tile: string}> = ({from, to, t, fs, color, tile}) => {
  const w = fs * 0.72;
  const h = fs * 1.05;
  const half = h / 2;
  const first = t < 0.5;
  const k = first ? 1 - t * 2 : (t - 0.5) * 2;
  const Half: React.FC<{ch: string; bot: boolean; style?: React.CSSProperties}> = ({ch, bot, style}) => (
    <div style={{position: 'absolute', left: 0, width: w, height: half, overflow: 'hidden', top: bot ? half : 0, background: tile, filter: bot ? 'brightness(0.92)' : undefined, ...style}}>
      <div style={{position: 'absolute', left: 0, width: w, height: h, top: bot ? -half : 0, lineHeight: `${h}px`, textAlign: 'center', color}}>{ch}</div>
    </div>
  );
  return (
    <span style={{display: 'inline-block', position: 'relative', width: w, height: h, margin: `0 ${fs * 0.03}px`, verticalAlign: 'top', borderRadius: fs * 0.05}}>
      <Half ch={to} bot={false} />
      <Half ch={first ? from : to} bot />
      {first ? <Half ch={from} bot={false} style={{transformOrigin: '50% 100%', transform: `scaleY(${k})`}} /> : <Half ch={to} bot style={{transformOrigin: '50% 0%', transform: `scaleY(${k})`}} />}
      <div style={{position: 'absolute', left: 0, right: 0, top: half - 1.5, height: 3, background: 'rgba(0,0,0,0.6)'}} />
    </span>
  );
};

const NumberCounter: React.FC<Props> = (p) => {
  const frame = useCurrentFrame();
  const {w, h, u, portrait} = useStage();
  const keys = p.keyframes.length ? p.keyframes : ([[0, 0]] as [number, number][]);
  const v = monotone(keys, frame);
  const rate = monotone(keys, frame + 0.5) - monotone(keys, frame - 0.5);
  const max = Math.max(...keys.map((k) => k[1]));
  const places = Math.max(1, Math.floor(Math.log10(Math.max(1, max))) + 1);
  const appear = eoc((frame - 4) / 9);
  const hud = p.layout === 'hud';
  const maxStr = fmt(max, p.decimals, p.separator) + p.unit;
  const fsBase = (hud ? 110 : p.size) * u;
  const fs = Math.min(fsBase, (w * (hud ? 0.5 : 0.82)) / (0.6 * maxStr.length + (p.unit ? 0.6 : 0)));
  const depth = p.linkBackdrop ? Math.pow(clamp(Math.log10(1 + Math.max(0, v)) / 4.1), 1.8) : 0.4;
  const statFs = (hud ? 26 : 34) * u;
  const labFs = (hud ? 22 : p.labelSize) * u;
  const lockStr = fmt(max, p.decimals, p.separator === ' ' ? ',' : p.separator);
  const clockT = (() => {
    let acc = p.clockStart;
    const ks = p.clockRate.length ? p.clockRate : ([[0, 1]] as [number, number][]);
    for (let i = 0; i < frame; i++) acc += monotone(ks, i) / 30;
    return acc;
  })();
  const clockRateNow = monotone(p.clockRate.length ? p.clockRate : [[0, 1]], frame);
  const pad2 = (x: number) => String(Math.floor(x)).padStart(2, '0');
  const clockStr = `${pad2((clockT / 3600) % 24)}:${pad2((clockT / 60) % 60)}`;
  const flapTo = fmt(max, p.decimals, p.separator === ' ' ? ',' : p.separator);
  const flapFrom = fmt(p.flapFrom ?? keys[0][1], p.decimals, p.separator === ' ' ? ',' : p.separator).padStart(flapTo.length, ' ');
  const number = p.mode === 'lock' || p.mode === 'scramble' ? (
    <LockText str={lockStr} frame={frame} p={p} fs={fs} />
  ) : p.mode === 'flap' ? (
    <>
      {flapTo.split('').map((c, i) => {
        const t0 = p.lockStart + i * p.flapStagger;
        const t = clamp((frame - t0) / Math.max(1, p.flipFrames));
        const fc = flapFrom[i] ?? ' ';
        if (!/[0-9A-Za-z]/.test(c)) return <span key={i} style={{display: 'inline-block', width: fs * 0.3, textAlign: 'center'}}>{c}</span>;
        // cycle through intermediate digits while flipping to a new value (one flip per step)
        return <FlapTile key={i} from={fc === ' ' ? '0' : fc} to={c} t={fc === c ? 1 : t} fs={fs} color={p.numberColor} tile={p.tileColor} />;
      })}
    </>
  ) : p.mode === 'clock' ? (
    <>
      <span>{clockStr}</span>
      <span style={{fontSize: fs * 0.4, marginLeft: fs * 0.1, opacity: 0.8}}>{`:${pad2(clockT % 60)}`}</span>
    </>
  ) : p.mode === 'roll' && p.decimals <= 0 ? <RollDigits v={v} speed={Math.abs(rate)} places={places} sep={p.separator} fs={fs} color={p.numberColor} /> : fmt(v, p.decimals, p.separator);
  const gaugeR = fs * 1.6;
  const gp = clamp(v / Math.max(1e-9, max));
  return (
    <AbsoluteFill>
      <Backdrop kind={p.backdrop} src={p.src || undefined} depth={depth} />
      <div
        style={{
          position: 'absolute',
          ...(hud ? {left: (portrait ? 56 : 64) * u, top: (portrait ? 120 : 56) * u} : {left: 0, right: 0, top: h * (portrait ? 0.4 : 0.5), transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center'}),
          opacity: appear,
        }}
      >
        {p.gauge && !hud && (
          <svg width={gaugeR * 2 + 40 * u} height={gaugeR + 30 * u} style={{marginBottom: -fs * 0.2, overflow: 'visible'}}>
            <g transform={`translate(${gaugeR + 20 * u} ${gaugeR + 10 * u})`}>
              <path d={`M ${-gaugeR} 0 A ${gaugeR} ${gaugeR} 0 0 1 ${gaugeR} 0`} fill="none" stroke={p.labelColor} strokeWidth={2 * u} opacity={0.5} />
              <path d={`M ${-gaugeR} 0 A ${gaugeR} ${gaugeR} 0 0 1 ${gaugeR} 0`} fill="none" stroke={p.accent} strokeWidth={8 * u} strokeLinecap="round" strokeDasharray={Math.PI * gaugeR} strokeDashoffset={Math.PI * gaugeR * (1 - gp)} />
              {Array.from({length: 7}, (_, i) => {
                const a = Math.PI + (i / 6) * Math.PI;
                return <line key={i} x1={Math.cos(a) * (gaugeR - 14 * u)} y1={Math.sin(a) * (gaugeR - 14 * u)} x2={Math.cos(a) * (gaugeR - 26 * u)} y2={Math.sin(a) * (gaugeR - 26 * u)} stroke={p.labelColor} strokeWidth={2 * u} />;
              })}
              <circle cx={Math.cos(Math.PI + gp * Math.PI) * gaugeR} cy={Math.sin(Math.PI + gp * Math.PI) * gaugeR} r={9 * u} fill={p.accent} />
            </g>
          </svg>
        )}
        {p.kicker && (
          <div style={{fontFamily: fonts.mono, fontWeight: 600, fontSize: labFs * 1.1, letterSpacing: '0.18em', color: p.numberColor, marginBottom: labFs * 0.5, transform: `translateY(${(1 - eoc((frame - 2) / 8)) * -20 * u}px)`, opacity: eoc((frame - 2) / 8)}}>{p.kicker}</div>
        )}
        <div style={{fontFamily: fonts.mono, fontWeight: 500, fontSize: labFs, letterSpacing: '0.3em', color: p.labelColor, paddingLeft: hud ? 0 : '0.3em'}}>{p.label}</div>
        <div style={{display: 'flex', alignItems: 'baseline', fontFamily: tfonts.monoLight, fontWeight: 200, fontSize: fs, color: p.block ? p.blockColor : p.numberColor, lineHeight: 1.05, marginTop: fs * 0.05, fontVariantNumeric: 'tabular-nums', whiteSpace: 'pre', textShadow: p.block ? 'none' : `0 0 ${fs * 0.15}px rgba(151,206,232,0.25)`, ...(p.block ? {background: p.block, padding: `${fs * 0.08}px ${fs * 0.22}px`, fontWeight: 700, transform: `scale(${1 + 0.45 * (1 - clamp((frame - 4) / Math.max(1, p.rollDuration * 30), 0, 1)) * (1 - eoc((frame - 4) / 6))})`} : {})}}>
          {p.prefix && <span>{p.prefix}</span>}
          <span style={{display: 'inline-flex', alignItems: 'flex-start'}}>{number}</span>
          {p.unit && <span style={{fontSize: fs * 0.3, marginLeft: fs * 0.12, color: p.numberColor, opacity: 0.85}}>{p.unit}</span>}
        </div>
        {p.progressBar && (
          <div style={{width: fs * 0.6 * lockStr.length, height: 3 * u, background: 'rgba(255,255,255,0.15)', marginTop: fs * 0.1}}>
            <div style={{width: `${clamp((frame - p.lockStart) / Math.max(1, p.lockStep * lockStr.length)) * 100}%`, height: '100%', background: p.accent}} />
          </div>
        )}
        {p.mode === 'flap' && p.callout && (
          <div style={{fontFamily: fonts.mono, fontWeight: 700, fontSize: fs * 0.3, color: p.accent, marginTop: fs * 0.1, opacity: eoc((frame - p.lockStart - p.flapStagger * lockStr.length - p.flipFrames) / 8)}}>{p.callout}</div>
        )}
        {p.mode === 'clock' && p.speedTag && (
          <div style={{fontFamily: fonts.mono, fontWeight: 600, fontSize: fs * 0.14, letterSpacing: '0.15em', marginTop: fs * 0.08, color: clockRateNow < 2 ? '#4fd68a' : '#ffb347'}}>{clockRateNow < 2 ? '×1 REAL TIME' : `×${Math.round(clockRateNow)} TIME-LAPSE`}</div>
        )}
        {p.readouts.length > 0 && (
          <div style={{display: 'flex', gap: (hud ? 48 : 72) * u, marginTop: fs * 0.18}}>
            {p.readouts.map((r, i) => (
              <div key={i} style={{fontFamily: fonts.mono, minWidth: statFs * 4.2}}>
                <div style={{fontSize: labFs * 0.85, letterSpacing: '0.2em', color: p.labelColor}}>{p.readoutLabels[i] ?? DEFAULT_LABELS[r]}</div>
                <div style={{fontSize: statFs * 1.15, color: p.numberColor, marginTop: 8 * u, whiteSpace: 'pre'}}>{readoutValue(r, v, max, rate, p.separator)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const numberCounter = defineMotion<Props>({
  id: 'number-counter',
  title: 'Number counter',
  category: 'text',
  description: 'Huge thin-mono counter that ticks or odometer-rolls through dwell keyframes, with unit, label and derived readouts (pressure, light, temperature, percent).',
  source: ['video23 0:03-1:20', 'video19 0:13.6-0:14.3', 'video17 0:03.0-0:04.4'],
  useFor: 'Depth/altitude/speed meters, growing stats, countdowns, progress percentages and scoreboards.',
  durationInFrames: 180,
  defaultProps: {
    keyframes: [
      [0, 0],
      [14, 0],
      [62, 760],
      [96, 868],
      [168, 10935],
      [180, 10935],
    ],
    mode: 'roll',
    label: 'DEPTH',
    unit: 'm',
    prefix: '',
    decimals: 0,
    separator: ' ',
    readouts: ['pressure', 'light', 'temp'],
    readoutLabels: [],
    layout: 'center',
    gauge: false,
    size: 300,
    labelSize: 28,
    labelColor: '#6c95ac',
    numberColor: '#a9d8ee',
    accent: '#ED3821',
    backdrop: 'ocean',
    linkBackdrop: true,
    src: '',
    lockStart: 14,
    lockStep: 5,
    lockOrder: 'ltr',
    glyphs: '',
    accentOnLock: false,
    flashFrame: false,
    progressBar: false,
    flapFrom: null,
    flapStagger: 3,
    flipFrames: 8,
    tileColor: '#2B3038',
    callout: '',
    clockStart: 25200,
    clockRate: [
      [0, 24],
      [90, 24],
      [120, 1],
    ],
    speedTag: true,
    block: '',
    blockColor: '#111111',
    kicker: '',
    rollDuration: 0.45,
  },
  propDocs: {
    keyframes: '[[frame, value], …] monotone-cubic; put two close keys to dwell (slow down) near a landmark',
    mode: 'roll (odometer digit strips with motion blur) | tick (re-typeset each frame) | lock (digits spin, lock one by one) | scramble (glyph noise + trail + drop) | flap (split-flap tiles) | clock (time-lapse clock)',
    label: 'small tracked label above the number',
    unit: 'unit after the number ("" = none)',
    prefix: 'text before the number (e.g. "$", "×")',
    decimals: 'decimal places (tick mode; roll mode uses integers)',
    separator: 'thousands separator (" " thin space, ",", "")',
    readouts: 'derived stats under the number: pressure | light | temp | percent | rate',
    readoutLabels: 'override the readout labels (same order)',
    layout: 'center (big, standalone) | hud (top-left overlay block like video23)',
    gauge: 'semicircle gauge above the number (video17 anticipation meter); centre layout only',
    size: 'number size in px at 1080p (auto-shrinks to fit)',
    labelSize: 'label size in px at 1080p (centre layout)',
    backdrop: 'ocean | ink | dunes | … scene behind',
    linkBackdrop: 'ocean backdrop darkens with the value (log scale) like a dive',
    src: 'optional public/ image behind',
    lockStart: 'lock / scramble / flap modes: frame the first character locks (or flips)',
    lockStep: 'lock mode: frames between one character locking and the next (a sixteenth note at your tempo)',
    lockOrder: 'lock / scramble: ltr | rtl character lock order',
    glyphs: 'scramble: glyph set the unlocked digits flicker through (empty = digits)',
    accentOnLock: 'locked characters flash in the accent colour for 6 frames',
    flashFrame: 'one-frame brightness flash when a character locks',
    progressBar: 'thin accent progress bar under the number while it locks',
    flapFrom: 'flap mode: starting value (default = first keyframe value); ends on the max keyframe',
    flapStagger: 'flap mode: frames between tiles starting to flip',
    flipFrames: 'flap mode: frames one tile flip takes (0.26 s = 8)',
    tileColor: 'flap mode: tile colour',
    callout: 'flap mode: text that pops under the number after the last flip (e.g. "×2")',
    clockStart: 'clock mode: start time in seconds since midnight (25200 = 07:00)',
    clockRate: 'clock mode: [[frame, rate]] time-lapse speed; the clock integrates it',
    speedTag: 'clock mode: show ×N TIME-LAPSE / ×1 REAL TIME tag',
    block: 'block background colour behind the number (hook look, e.g. #FFD60A); "" = none',
    blockColor: 'number colour on the block',
    kicker: 'hook line slamming in above the number',
    rollDuration: 'block hook: seconds of the scale slam',
  },
  component: NumberCounter,
  tags: ['counter', 'number', 'hud', 'odometer', 'stats', 'scramble', 'lock', 'digit lock', 'split flap', 'departure board', 'clock', 'time-lapse', 'hook', 'kpi', 'glyph'],
});
