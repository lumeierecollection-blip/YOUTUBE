import { delayRender, continueRender } from "remotion";
import { FONT_FACES, FONT_FAMILIES } from "./fonts-loader.js";

if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.setAttribute("data-remotion-fonts", "");
  style.innerHTML = FONT_FACES;
  document.head.appendChild(style);

  // delayRender's own timeout is set astronomically high: if the bundle is
  // evaluated twice in one page (Remotion re-evaluates the entry), the first
  // evaluation's handle is dropped from `remotion_delayRenderHandles`, so its
  // `continueRender` cannot cancel the page-side timer — and an orphaned timer
  // aborts the whole render at timeout-2000ms even though rendering is fine.
  const handle = delayRender("Waiting for channel fonts to load", {
    timeoutInMilliseconds: 24 * 60 * 60 * 1000,
  });
  const loads = FONT_FAMILIES.flatMap((fam) => [
    document.fonts.load(`400 40px "${fam}"`),
    document.fonts.load(`700 40px "${fam}"`),
  ]);
  // Italic faces are requested separately — document.fonts.load() defaults to
  // normal style, so the setup-line italic serif (PART 3.4) needs its own
  // explicit request or it never resolves before the font gate/first frame.
  loads.push(document.fonts.load(`italic 400 40px "Playfair Display"`));
  // A single hung font fetch must never stall the whole render: race the full
  // load against a cap so delayRender always clears. Fonts that arrive late
  // are swapped in via font-display: swap.
  const cap = new Promise((resolve) => setTimeout(resolve, 10000));
  Promise.race([Promise.all(loads), cap])
    .catch(() => {})
    .finally(() => continueRender(handle));
}
