// Football shirt drawn as vector art: stripes in the club or national colours, collar and cuffs, a back number and a surname.
// It is original artwork. It carries no club crest, manufacturer mark or sponsor, so it imitates no trademark; the colours and the
// number are what make it recognisable. Kits: "barca" (blue and garnet stripes) and "arg" (sky blue and white stripes).
import React from "react";

const KITS = {
  barca: { a: "#004D98", b: "#A50044", collar: "#EDBB00", trim: "#EDBB00", text: "#EDBB00", outline: "#0B1220" },
  arg: { a: "#75AADB", b: "#FFFFFF", collar: "#0B1B33", trim: "#0B1B33", text: "#0B1B33", outline: "#FFFFFF" },
};
const SHIRT = "M60 10 L85 10 Q100 30 115 10 L140 10 L192 46 L166 88 L146 74 L146 204 Q146 212 138 212 L62 212 Q54 212 54 204 L54 74 L34 88 L8 46 Z";

export function Jersey({ kit = "barca", number = "10", name = "MESSI", id = "j", style }) {
  const K = KITS[kit], clip = `${id}-clip`;
  const stripes = Array.from({ length: 11 }, (_, i) => <rect key={i} x={6 + i * 18} y="0" width="18" height="230" fill={i % 2 ? K.b : K.a} />);
  return (
    <svg viewBox="0 0 200 224" style={{ width: "100%", height: "100%", overflow: "visible", ...style }}>
      <defs>
        <clipPath id={clip}><path d={SHIRT} /></clipPath>
        <linearGradient id={`${id}-shade`} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#000" stopOpacity="0.18" /><stop offset="0.35" stopColor="#fff" stopOpacity="0.08" /><stop offset="0.7" stopColor="#000" stopOpacity="0.04" /><stop offset="1" stopColor="#000" stopOpacity="0.2" /></linearGradient>
      </defs>
      <path d={SHIRT} fill="#000" opacity="0.22" transform="translate(5 8)" />
      <g clipPath={`url(#${clip})`}>
        {stripes}
        <rect x="0" y="0" width="200" height="230" fill={`url(#${id}-shade)`} />
        <path d="M8 46 L34 88 L24 94 L0 52 Z" fill={K.trim} opacity="0.95" />
        <path d="M192 46 L166 88 L176 94 L200 52 Z" fill={K.trim} opacity="0.95" />
        <path d="M54 74 L54 204 M146 74 L146 204" stroke="#000" strokeOpacity="0.12" strokeWidth="2" fill="none" />
      </g>
      <path d="M85 10 Q100 30 115 10" fill="none" stroke={K.collar} strokeWidth="9" strokeLinecap="round" />
      <path d={SHIRT} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="2" />
      <text x="100" y="78" textAnchor="middle" fontFamily='"Archivo Black", "Inter", sans-serif' fontSize="19" letterSpacing="2" fill={K.text} stroke={K.outline} strokeWidth="0.8" paintOrder="stroke">{name}</text>
      <text x="100" y="150" textAnchor="middle" fontFamily='"Archivo Black", "Inter", sans-serif' fontSize="86" fill={K.text} stroke={K.outline} strokeWidth="2" paintOrder="stroke">{number}</text>
    </svg>
  );
}
