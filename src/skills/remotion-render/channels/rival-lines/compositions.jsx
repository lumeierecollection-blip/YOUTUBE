// Rival Lines registers one composition per format. The two formats look different on purpose.
import { RivalMatchShort } from "./match.jsx";
import { RivalPlayerShort } from "./player.jsx";

const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 780, defaultProps: { durationInFrames: 780, scenes: [], captions: [], images: {}, credits: {}, data: { score: {}, penalties: {}, formation: {}, stats: { Argentina: { xg_series: [[0, 0]], goal_minutes: [] }, France: { xg_series: [[0, 0]], goal_minutes: [] } }, seasons: { "2009/10": {}, "2018/19": {} } } } };
export const compositions = [
  { id: "RivalMatchShort", component: RivalMatchShort, ...base },
  { id: "RivalPlayerShort", component: RivalPlayerShort, ...base },
];
