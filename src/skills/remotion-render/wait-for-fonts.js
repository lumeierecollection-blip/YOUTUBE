import { delayRender, continueRender } from "remotion";
import { FONT_FACES, FONT_FAMILIES } from "./fonts-loader.js";

if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.setAttribute("data-remotion-fonts", "");
  style.innerHTML = FONT_FACES;
  document.head.appendChild(style);

  const handle = delayRender("Waiting for channel fonts to load");
  Promise.all(
    FONT_FAMILIES.flatMap((fam) => [
      document.fonts.load(`400 40px "${fam}"`),
      document.fonts.load(`700 40px "${fam}"`),
    ])
  )
    .catch(() => {})
    .finally(() => continueRender(handle));
}
