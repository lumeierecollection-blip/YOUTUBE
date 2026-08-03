/**
 * Shared voiceover audio for compositions.
 *
 * render.js copies the current voiceover to ./vo.mp3 before every render,
 * so this static import always bundles the active audio file.
 */
import voiceover from "./vo.mp3";

export const currentAudio = voiceover;
