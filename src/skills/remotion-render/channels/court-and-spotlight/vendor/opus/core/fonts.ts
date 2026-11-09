import {loadFont as inter} from '@remotion/google-fonts/Inter';
import {loadFont as archivo} from '@remotion/google-fonts/ArchivoBlack';
import {loadFont as mono} from '@remotion/google-fonts/JetBrainsMono';
import {loadFont as serif} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as comic} from '@remotion/google-fonts/Bangers';
import {loadFont as hand} from '@remotion/google-fonts/Caveat';
import {loadFont as grotesk} from '@remotion/google-fonts/SpaceGrotesk';

/** Font roles seen across the 23 samples. Load once; every motion refers to roles, not families. */
export const fonts = {
  /** clean UI sans (captions, labels, web hero) */
  sans: inter('normal', {weights: ['400', '600', '800'], subsets: ['latin']}).fontFamily,
  /** heavy display caps (video17 principle titles, video12 stamps) */
  display: archivo('normal', {weights: ['400'], subsets: ['latin']}).fontFamily,
  /** HUD / code / data overlays (videos 8, 17, 19, 23) */
  mono: mono('normal', {weights: ['400', '700'], subsets: ['latin']}).fontFamily,
  /** editorial serif (video10 place names, video23 depth labels, video3 titles) */
  serif: serif('normal', {weights: ['500', '700'], subsets: ['latin']}).fontFamily,
  /** comic SFX bursts (video12) */
  comic: comic('normal', {weights: ['400'], subsets: ['latin']}).fontFamily,
  /** handwriting (video22 ballpoint) */
  hand: hand('normal', {weights: ['400', '700'], subsets: ['latin']}).fontFamily,
  /** geometric grotesk for titles */
  grotesk: grotesk('normal', {weights: ['500', '700'], subsets: ['latin']}).fontFamily,
};

export type FontRole = keyof typeof fonts;
