import {staticFile} from 'remotion';

/**
 * public/ path, absolute URL, root-relative URL or data:/blob: URL -> loadable URL.
 * - "demo/owl.jpg"            -> staticFile("demo/owl.jpg")  (served from the host's web root, or window.remotion_staticBase)
 * - "https://cdn.x/owl.jpg"   -> unchanged
 * - "data:…" / "blob:…"       -> unchanged
 */
export const resolveSrc = (src: string) => (/^(https?:|data:|blob:)/.test(src) ? src : staticFile(src.replace(/^\/+/, '')));
