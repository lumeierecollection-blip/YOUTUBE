// Court & Spotlight registers one composition per format. Formats are chosen by the story, not one fixed template.
import { CourtDossierShort } from "./dossier.jsx";

const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 780, defaultProps: { durationInFrames: 780, scenes: [], captions: [] } };
export const compositions = [
  { id: "CourtDossierShort", component: CourtDossierShort, ...base },
];
