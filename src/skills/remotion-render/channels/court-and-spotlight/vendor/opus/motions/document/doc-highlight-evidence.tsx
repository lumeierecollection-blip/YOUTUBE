// Adapted from lemo-opuscar/styles/caption-news/demo/main.js paper()/shotDoc6() + city-symphony render.py page_frame() (MIT, © LemoLab) — see THIRD_PARTY_NOTICES.md
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {clamp, ease, lerp, prog} from '../../core/ease';
import {resolveSrc} from '../../core/asset';
import {useSafeId} from '../../core/image-kit';
import {DOC_DEFAULT, DocText, backOut, docLayout, eo3, lf, seg, spanBox} from '../../core/r2-la1-kit';
import {Svg, useStage} from '../../core/stage';
import {defineMotion} from '../../core/types';

/**
 * A document page lies tilted on a dark desk with a soft shadow and pushes in; a highlighter sweeps over the
 * key sentence (multiply rgba(255,200,30,.88)); the figure it states slams beside the page as a big accent
 * block; vignette tightens. Variant `reading-light`: a soft Gaussian brightness band grows over the quoted
 * line while the page pushes in hard.
 */
type Props = {
  pageSrc: string;
  variant: 'highlighter' | 'reading-light';
  org: string;
  title: string;
  meta: string;
  lines: string[];
  keyLine: number;
  calloutValue: string;
  calloutUnit: string;
  calloutLabel: string;
  accent: string;
  tilt: number;
  markAt: number;
  desk: string;
  quoteMark: boolean;
};

const DocHighlight: React.FC<Props> = (p) => {
  const frame = useCurrentFrame();
  const {w, h, u, portrait} = useStage();
  const id = useSafeId('dochl');
  const L = docLayout(p.lines);
  const kl = Math.min(L.lines.length - 1, Math.max(0, p.keyLine));
  const key = L.lines[kl];
  const reading = p.variant === 'reading-light';
  const pageH = portrait ? h * 0.62 : h * 1.02;
  const k = pageH / L.H;
  const pageW = L.W * k;
  const pcx = portrait ? w / 2 : w * 0.38;
  const pcy = portrait ? h * 0.36 : h * 0.5;
  // push: 0.92 → 1.0 (highlighter) or 1.06 → 1.56 toward the line (reading light)
  const pk = prog(frame, 0, 150, ease.sine);
  const Z = reading ? lerp(1.06, 1.56, pk) : lerp(0.92, 1.0, pk);
  const focusY = reading ? (key.y - L.H / 2) * k * pk * 0.9 : (key.y - L.H / 2) * k * 0.15 * pk;
  const pageT = `translate(${pcx} ${pcy - focusY * Z}) scale(${Z}) rotate(${p.tilt}) translate(${-pageW / 2} ${-pageH / 2}) scale(${k})`;
  const hl = eo3(seg(frame, p.markAt, p.markAt + 12));
  const band = eo3(seg(frame, p.markAt - 6, p.markAt + 24));
  const slam = seg(frame, p.markAt + 30, p.markAt + 34);
  const vg = prog(frame, 0, 60, ease.out);
  const bx = key.x - 8;
  const by = key.y - key.size * 0.95;
  const bw = key.w + 16;
  const bh = key.size * 1.3;
  const blockW = (portrait ? 0.7 : 0.3) * w;
  const blockX = portrait ? (w - blockW) / 2 : w * 0.66;
  const blockY = portrait ? h * 0.7 : h * 0.34;
  const numSize = (portrait ? 150 : 140) * u;

  return (
    <AbsoluteFill style={{background: p.desk}}>
      <Svg>
        <defs>
          <filter id={`${id}-sh`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={50 / k / 2} />
          </filter>
          <radialGradient id={`${id}-vg`} cx="50%" cy="50%" r={lerp(0.28, 1.1, vg)}>
            <stop offset="0.35" stopColor="#000" stopOpacity={0} />
            <stop offset="1" stopColor="#000" stopOpacity={0.55} />
          </radialGradient>
          <radialGradient id={`${id}-band`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#fff6e0" stopOpacity={0.55} />
            <stop offset="1" stopColor="#fff6e0" stopOpacity={0} />
          </radialGradient>
        </defs>
        <g transform={pageT}>
          <rect x={18 / k} y={18 / k} width={L.W} height={L.H} fill="#000" opacity={0.5} filter={`url(#${id}-sh)`} />
          {p.pageSrc ? (
            <image href={resolveSrc(p.pageSrc)} width={L.W} height={L.H} preserveAspectRatio="xMidYMid slice" />
          ) : (
            <>
              <rect width={L.W} height={L.H} fill={reading ? '#f2e6cc' : '#f7f5ef'} />
              <DocText L={L} org={p.org} title={p.title} meta={p.meta} faint="#6b6a64" />
            </>
          )}
          {reading && band > 0 && <ellipse cx={key.x + key.w / 2} cy={key.y - key.size * 0.3} rx={(key.w / 2 + 120) * band} ry={110} fill={`url(#${id}-band)`} style={{mixBlendMode: 'screen'}} />}
          {!reading && hl > 0 && <rect x={bx} y={by} width={bw * hl} height={bh} fill="rgba(255,200,30,0.88)" style={{mixBlendMode: 'multiply'}} />}
          {!reading && hl > 0 && (
            <rect x={bx + bw * hl - 5} y={by - 2} width={10} height={bh + 4} fill="rgba(255,200,30,0.5)" opacity={hl < 1 ? 1 : 0} style={{mixBlendMode: 'multiply'}} />
          )}
        </g>
        <rect width={w} height={h} fill={`url(#${id}-vg)`} />
        <rect width={w} height={h} fill="rgba(255,170,70,0.04)" style={{mixBlendMode: 'soft-light'}} />
        {slam > 0 && (
          <g transform={`translate(${blockX + blockW / 2} ${blockY}) rotate(-1.7) scale(${lerp(1.3, 1, backOut(slam, 1.6))}) translate(${-blockW / 2} 0)`} opacity={clamp(slam * 3)}>
            {p.quoteMark && (
              <text x={-10 * u} y={-20 * u} fontFamily={lf.serif} fontWeight={700} fontSize={180 * u} fill={p.accent} opacity={0.9}>
                “
              </text>
            )}
            <rect width={blockW} height={numSize * 1.75} fill={p.accent} />
            <text x={32 * u} y={numSize * 1.02} fontFamily={lf.sans} fontWeight={800} fontSize={numSize} fill="#0E0E0C" letterSpacing={-0.02 * numSize}>
              {p.calloutValue}
              <tspan fontSize={numSize * 0.32} dx={10 * u}>
                {p.calloutUnit}
              </tspan>
            </text>
            <text x={32 * u} y={numSize * 1.48} fontFamily={lf.sans} fontWeight={600} fontSize={28 * u} letterSpacing={3 * u} fill="#0E0E0C">
              {p.calloutLabel}
            </text>
          </g>
        )}
      </Svg>
    </AbsoluteFill>
  );
};

export const docHighlightEvidence = defineMotion<Props>({
  id: 'doc-highlight-evidence',
  title: 'Document highlight evidence',
  category: 'document',
  description:
    'A document page lies tilted on a dark desk and pushes in; a yellow highlighter sweeps the key sentence (multiply), then the figure it states slams beside the page as a big honey block with a pull-quote mark under a tightening vignette. Variant reading-light: a warm brightness band grows over the line while the page pushes in hard.',
  source: ['lemo-opuscar styles/caption-news demo/main.js paper(), shotDoc6(); city-symphony tools/render.py page_frame() (MIT, LemoLab)', 'analysis/sources/lemo-styles-a.md §8 doc-highlight-evidence'],
  useFor: 'Evidence / receipt beats for explainers, investor updates, legal and policy videos — "the report says it".',
  durationInFrames: 150,
  defaultProps: {
    pageSrc: '',
    variant: 'highlighter',
    org: DOC_DEFAULT.org,
    title: DOC_DEFAULT.title,
    meta: DOC_DEFAULT.meta,
    lines: DOC_DEFAULT.lines,
    keyLine: DOC_DEFAULT.keyLine,
    calloutValue: '1,208',
    calloutUnit: 'm',
    calloutLabel: 'CLEAR SPAN REQUIRED',
    accent: '#FFC21A',
    tilt: -0.7,
    markAt: 24,
    desk: '#23221E',
    quoteMark: true,
  },
  propDocs: {
    pageSrc: 'public/ image of a rendered page (empty = procedural document)',
    variant: 'highlighter = marker sweep + number block; reading-light = brightness band + strong push',
    org: 'letterhead line',
    title: 'document title',
    meta: 'reference / date line',
    lines: 'body lines (one per printed line)',
    keyLine: 'index of the highlighted line',
    calloutValue: 'big number in the accent block',
    calloutUnit: 'unit after the number',
    calloutLabel: 'caps label in the block',
    accent: 'highlighter / block colour',
    tilt: 'page tilt in degrees',
    markAt: 'frame the highlighter starts (block slams ~1 s later)',
    desk: 'desk colour',
    quoteMark: 'show a pull-quote mark on the block',
  },
  component: DocHighlight,
  tags: ['document', 'highlight', 'highlighter', 'evidence', 'report', 'quote', 'news', 'explainer', 'number', 'callout', 'policy', 'legal', 'investor', 'reading light'],
});
