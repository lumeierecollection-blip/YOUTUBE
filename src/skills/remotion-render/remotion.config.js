import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setPublicDir("public");
// MOTION-GRAPHICS-MANUAL.md A2.6/A6.1 — the flat bg + dotGrid + grain treatment
// uses @remotion/effects, which requires an OpenGL renderer (angle on Windows).
Config.setChromiumOpenGlRenderer("angle");
