import type React from 'react';

export type Category =
  | 'text'
  | 'transition'
  | 'shape'
  | 'illustration'
  | 'camera'
  | 'particles'
  | 'data'
  | 'hud'
  | '3d'
  | 'texture'
  | 'character'
  | 'environment'
  | 'fx'
  | 'image'
  | 'ui'
  | 'music'
  | 'game'
  | 'document'
  | 'product'
  | 'map'
  | 'mascot';

export interface MotionDef<P extends Record<string, unknown> = Record<string, any>> {
  /** kebab-case id used by the CLI and compose specs */
  id: string;
  title: string;
  category: Category;
  /** one-line description of what it looks like */
  description: string;
  /** source sample(s) the motion was reverse-engineered from, e.g. ["video1 0:02-0:12"] */
  source: string[];
  /** what it is good for in a new video */
  useFor: string;
  /** default length in frames at 30 fps */
  durationInFrames: number;
  defaultProps: P;
  /** human-readable notes on each prop */
  propDocs: Partial<Record<keyof P, string>>;
  component: React.FC<P>;
  tags?: string[];
}

export const defineMotion = <P extends Record<string, unknown>>(m: MotionDef<P>) => m;
