/** Treatment index for Hidden Past. The builders live in preview.mjs for this first sample. */
export const SCENES = {
  "archival-photo-ledger": { purposes: ["evidence"], background: "light archival paper", skill: "vox-style-treatment + PhotoTreatment" },
  "archival-photo-card-with-claim-ladder": { purposes: ["evidence", "interpretation"], background: "light archival paper", skill: "vox-style-treatment + PhotoTreatment" },
  "modern-map-locator": { purposes: ["geography"], background: "light archival paper", skill: "scripts/autopilot/map-vox.mjs" },
  "dated-historical-map": { purposes: ["geography", "change over time"], background: "light archival paper", skill: "document treatment + PhotoTreatment" },
  "newspaper-scan": { purposes: ["primary source"], background: "light archival paper", skill: "document treatment + PhotoTreatment" },
  "chapter-opener": { purposes: ["structure"], background: "archival paper, surface tone", skill: "vox-style-treatment" },
};
