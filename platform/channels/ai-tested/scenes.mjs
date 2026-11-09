// Treatment id -> purpose, background, driving skill, and the composition scene that builds it.
export const SCENES = {
  "contrast-hook": { purposes: ["hook", "comparison"], background: "white", skill: "motion-graphics (kinetic type + comparison, wording from the docs table)", build: "Hook" },
  "annotated-capture": { purposes: ["evidence", "feature callout"], background: "white + browser mock-up holding a real capture", skill: "article-highlights (marker stroke, source citation) on real headless-Chrome pixels", build: "Reference / Controls" },
  "terminal-demo": { purposes: ["demonstration"], background: "white page, dark terminal inset", skill: "terminal-inserts (typed command, cursor, real stdout)", build: "Terminal" },
  "process-diagram": { purposes: ["process", "explanation"], background: "white", skill: "motion-graphics (nodes, drawn connectors, travelling dot)", build: "Pipe" },
  "close-card": { purposes: ["conclusion"], background: "white", skill: "motion-graphics", build: "Close" },
};
