// Court & Spotlight registers one composition per format. Formats are chosen by the story, not one fixed template.
import { CourtDossierShort } from "./dossier.jsx";
import { CourtMagazineShort } from "./magazine.jsx";
import { CourtVoxShort } from "./vox.jsx";
import { voxPackCompositions } from "./voxpack.jsx";

const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 780, defaultProps: { durationInFrames: 780, scenes: [], captions: [] } };
export const compositions = [
  ...voxPackCompositions,
  { id: "CourtDossierShort", component: CourtDossierShort, ...base, defaultProps: { ...base.defaultProps, images: {}, credits: {} } },
  { id: "CourtVoxShort", component: CourtVoxShort, ...base, defaultProps: { ...base.defaultProps, images: {}, credits: {}, cut: {} } },
  { id: "CourtMagazineShort", component: CourtMagazineShort, ...base, defaultProps: { ...base.defaultProps, images: {}, credits: {}, dates: {} } },
];
