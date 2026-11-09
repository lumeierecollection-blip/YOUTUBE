import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';

/**
 * Resolution-independent layout. Every motion sizes itself in `u` units
 * (1u = 1px on the short side of a 1080 frame) so the same motion renders
 * correctly at 1920x1080, 1080x1080 and 1080x1920.
 */
export const useStage = () => {
  const {width: w, height: h, fps, durationInFrames} = useVideoConfig();
  const u = Math.min(w, h) / 1080;
  return {w, h, u, fps, durationInFrames, cx: w / 2, cy: h / 2, portrait: h > w, square: w === h};
};

/** SVG that fills the frame in pixel coordinates */
export const Svg: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => {
  const {w, h} = useStage();
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0, overflow: 'visible', ...style}}>
      {children}
    </svg>
  );
};

/** Paper / risograph fibre texture (videos 1, 4, 6, 14, 20, 22). Pure SVG turbulence, multiply-blended. */
export const PaperTexture: React.FC<{opacity?: number; seed?: number; tint?: string; scale?: number}> = ({
  opacity = 0.35,
  seed = 3,
  tint = '#8a7350',
  scale = 0.9,
}) => {
  const {w, h} = useStage();
  const id = `paper${seed}`;
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0, mixBlendMode: 'multiply', opacity, pointerEvents: 'none'}}>
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency={scale} numOctaves={3} seed={seed} />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncA type="table" tableValues="0 0.55" />
        </feComponentTransfer>
      </filter>
      <rect width={w} height={h} fill={tint} opacity={0.12} />
      <rect width={w} height={h} filter={`url(#${id})`} />
    </svg>
  );
};

/** animated film grain, re-seeded every 2 frames (videos 10, 16, 21, 23) */
export const FilmGrain: React.FC<{opacity?: number; every?: number}> = ({opacity = 0.08, every = 2}) => {
  const frame = useCurrentFrame();
  const {w, h} = useStage();
  const seed = Math.floor(frame / every) % 97;
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0, opacity, mixBlendMode: 'overlay', pointerEvents: 'none'}}>
      <filter id={`grain${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency={0.85} numOctaves={2} seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width={w} height={h} filter={`url(#grain${seed})`} />
    </svg>
  );
};

export const Vignette: React.FC<{strength?: number; color?: string}> = ({strength = 0.55, color = '0,0,0'}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(ellipse at center, rgba(${color},0) 45%, rgba(${color},${strength}) 100%)`,
    }}
  />
);

/** Scanlines / CRT lines (video21 pixel-art, video18 halftone) */
export const Scanlines: React.FC<{gap?: number; opacity?: number}> = ({gap = 4, opacity = 0.18}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      opacity,
      backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.9) 0px, rgba(0,0,0,0.9) 1px, transparent 1px, transparent ${gap}px)`,
    }}
  />
);

/**
 * Virtual camera. Wraps children and applies pan (x,y in px), zoom and roll
 * around an anchor. All motions that "push in" / "drift" go through this.
 */
export const Camera: React.FC<{
  x?: number;
  y?: number;
  zoom?: number;
  rotate?: number;
  originX?: number;
  originY?: number;
  children: React.ReactNode;
}> = ({x = 0, y = 0, zoom = 1, rotate = 0, originX = 0.5, originY = 0.5, children}) => (
  <AbsoluteFill
    style={{
      transform: `translate(${-x}px, ${-y}px) scale(${zoom}) rotate(${rotate}deg)`,
      transformOrigin: `${originX * 100}% ${originY * 100}%`,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** handheld micro-shake (video16 film shots, video12 comic camera) */
export const useHandheld = (amp = 4, speed = 0.03, seed = 1) => {
  const frame = useCurrentFrame();
  const t = frame * speed;
  return {
    x: (Math.sin(t * 1.7 + seed) + Math.sin(t * 2.9 + seed * 3) * 0.5) * amp,
    y: (Math.cos(t * 1.3 + seed * 2) + Math.sin(t * 3.7 + seed) * 0.4) * amp,
    r: Math.sin(t * 0.9 + seed) * amp * 0.03,
  };
};
