/**
 * Builds Gray Matter's neuron, dendrite and synapse geometry with the Anima kit (MIT, pinned in
 * channel.json). Anima's own pages are interactive and time-based, so they cannot be rendered frame by
 * frame. Its kit is pure Node and returns SVG strings, so we use the kit here and let Remotion do the
 * motion. Every figure is schematic and not to scale, and is labelled so on screen.
 */
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const r1 = (v) => Math.round(v * 10) / 10;

export async function loadKit(animaDir) {
  const load = (f) => import(pathToFileURL(join(animaDir, "kit", f)).href);
  const [blob, branch, isoKit, chem, audit] = await Promise.all(["blob.mjs", "branch.mjs", "iso-kit.mjs", "chem.mjs", "bio-audit.mjs"].map(load));
  return { ...blob, ...branch, ...isoKit, ...chem, ...audit };
}

const ring = (cx, y, cz, rx, rz, phase = 0.4, n = 28) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  const w = 1 + 0.045 * Math.sin(a * 3 + phase) + 0.02 * Math.cos(a * 5 - phase);
  return [cx + Math.cos(a) * rx * w, y, cz + Math.sin(a) * rz * w];
});

// Near side-on, so "up" on screen is +z and the membrane gap at the synapse stays readable.
const VIEW = { azimuth: 88, elevation: 14 };

function tubes(kit, P, paths, radius, tone = "mid") {
  return paths
    .flatMap((points) => kit.branchPieces(points, (t) => radius * (1 - 0.68 * t), P, { maxLength: 18, spacing: 1.6 }))
    .sort((a, b) => a.depth - b.depth)
    .map((piece) => kit.branchSvg(piece, { tone }))
    .join("");
}

/** A CA1 pyramidal neuron: triangular soma, one apical dendrite upward, basal dendrites downward, axon. */
function neuronFigure(kit) {
  const W = 480, H = 380;
  const apical = [[0, 0, 22], [2, 1, 62], [-3, -1, 104], [3, 1, 150]];
  const oblique = [
    [[1, 1, 58], [24, 3, 78], [40, 2, 104]],
    [[-1, -1, 76], [-24, -3, 94], [-42, -2, 118]],
    [[-2, 0, 104], [14, 2, 128], [26, 1, 156]],
    [[1, 0, 138], [-16, -2, 160], [-28, -1, 176]],
    [[3, 1, 150], [14, 2, 172], [18, 1, 188]],
  ];
  const basal = [
    [[-11, 0, -8], [-34, 2, -30], [-50, 1, -56]],
    [[11, 0, -8], [34, -2, -30], [52, -1, -54]],
    [[-5, 1, -11], [-14, 2, -42], [-22, 1, -70]],
    [[6, -1, -11], [18, -2, -40], [26, -1, -72]],
  ];
  const axon = [[0, 0, -12], [2, 0, -46], [-2, 0, -82], [1, 0, -112]];
  const all = [apical, ...oblique, ...basal, axon].flat();
  const P = kit.fitProjection(all, W, H, { pad: 18, ...VIEW });
  const at = (p) => kit.iso(p, P).map(r1);
  const somaRing = [[0, 0, 24], [8, 0, 10], [14, 0, -4], [15, 0, -11], [0, 0, -13], [-15, 0, -11], [-14, 0, -4], [-8, 0, 10]];
  const soma = kit.blobOf(somaRing, P, { tone: "hi", id: "soma" });
  const nucleus = kit.blobOf(ring(0, 0, -1, 5.5, 5, 1.1, 18), P, { tone: "mid", id: "nucleus" });
  const svg = [tubes(kit, P, basal, 2), tubes(kit, P, [axon], 1.1, "lo"), tubes(kit, P, oblique, 1.7), tubes(kit, P, [apical], 3), kit.blobSvg(soma), kit.blobSvg(nucleus)].join("");
  return { W, H, svg, anchors: { magnified: at([-3, -1, 104]), soma: at([0, 0, 4]) }, parts: ["soma", "nucleus", "apical-dendrite", "basal-dendrites", "axon"] };
}

/** One magnified dendrite segment. Each spine is its own group so the scene can retract it. */
function dendriteFigure(kit, { W, H, withSynapse }) {
  const axis = (x) => 3 * Math.sin(x / 28);
  const specs = [[-84, 1, 18, 5.2, 2], [-62, -1, 16, 4.6, -2], [-40, 1, 22, 5.6, 3], [-14, 1, 24, 7, 0], [10, -1, 19, 5, -3], [30, 1, 18, 4.8, 2], [52, -1, 17, 5.2, 1], [76, 1, 21, 6, -2]];
  const synIdx = 3, cleft = 3.6;
  const [sx, , sLen, sR] = specs[synIdx];
  const headZ = axis(sx) + 4 + sLen + sR * 0.7;
  const headTop = headZ + sR * 0.86;
  const termRx = 17, termRz = 11.5, termZ = headTop + cleft + termRz * 1.08;
  const shaftPts = Array.from({ length: 25 }, (_, i) => { const x = -108 + i * 9; return [x, 0, axis(x)]; });
  const bounds = [...shaftPts, [-108, 0, -36], [108, 0, 36]];
  if (withSynapse) bounds.push([sx + 96, 0, termZ + 34], [sx - termRx - 4, 0, termZ + termRz + 2]);
  const P = kit.fitProjection(bounds, W, H, { pad: 26, ...VIEW });
  const at = (p) => kit.iso(p, P).map(r1);
  const k = kit.cameraOf(P).k;

  const heads = [];
  const spines = specs.map(([x, dir, len, r, y], i) => {
    const base = axis(x) + dir * 4;
    const tipZ = axis(x) + dir * (4 + len);
    const neck = [[x, y, base], [x + dir * 0.8, y, axis(x) + dir * (4 + len * 0.55)], [x + dir * 1.4, y, tipZ]];
    const pieces = kit.branchPieces(neck, (t) => 1.5 - 0.4 * t, P, { maxLength: 12, spacing: 1.2 }).map((piece) => kit.branchSvg(piece, { tone: "mid" })).join("");
    const headPts = ring(x + dir * 1.4, y, axis(x) + dir * (4 + len + r * 0.7), r, r * 0.86, i * 0.7, 26);
    const head = kit.blobOf(headPts, P, { tone: "hi", id: `spine-${i}` });
    heads.push({ id: `spine-${i}`, boundary: headPts });
    return { id: `spine-${i}`, svg: pieces + kit.blobSvg(head), base: at([x, y, base]), head: at([x + dir * 1.4, y, axis(x) + dir * (4 + len + r * 0.7)]) };
  });

  const shaft = kit.branchPieces(shaftPts, () => 5.6, P, { maxLength: 22, spacing: 1.6 }).sort((a, b) => a.depth - b.depth).map((piece) => kit.branchSvg(piece, { tone: "hi" })).join("");
  const out = { W, H, shaft, spines, synapseSpine: synIdx, k: r1(k), anchors: { dendrite: at([66, 0, axis(66)]), spine: spines[synIdx].head }, membranes: heads, parts: ["dendrite", ...spines.map((s) => s.id)] };

  if (withSynapse) {
    const cx = sx + 1.4;
    const outer = ring(cx, 0, termZ, termRx, termRz, 0.9, 40);
    const inner = ring(cx, 0, termZ, termRx - 1.5, termRz - 1.5, 0.9, 40);
    const terminal = kit.membraneOf(outer, inner, P, { tone: "hi", id: "presynaptic-terminal" });
    const axonPts = [[cx + 96, 0, termZ + 32], [cx + 62, 0, termZ + 26], [cx + 34, 0, termZ + 14], [cx + termRx - 3, 0, termZ + 5]];
    const vesicleSpots = [[-8, 3.5], [-2.5, 6], [4, 4.2], [9, 1.8], [-5, -2], [1.5, -3.8], [7.5, -4.4]];
    const receptorXs = [-4, -1.3, 1.3, 4];
    out.synapse = {
      axon: tubes(kit, P, [axonPts], 2.6, "mid"),
      terminal: `<path fill="var(--anatomy-paper)" d="${terminal.d}"/>${kit.membraneSvg(terminal)}`,
      vesicles: vesicleSpots.map(([dx, dz]) => ({ at: at([cx + dx, 0, termZ + dz]), r: r1(k * 2.1) })),
      receptors: receptorXs.map((dx) => ({ at: at([cx + dx, 0, headTop + 0.1]), w: r1(k * 1.5), h: r1(k * 1.9) })),
      release: at([cx, 0, termZ - termRz + 0.8]),
      cleft: at([cx, 0, headTop + cleft / 2]),
    };
    out.anchors = { ...out.anchors, terminal: at([cx - 8, 0, termZ + termRz - 1]), vesicle: out.synapse.vesicles[1].at, cleft: at([cx + 15, 0, headTop + cleft / 2]), receptor: out.synapse.receptors[3].at, axon: at([cx + 66, 0, termZ + 26]) };
    out.membranes.push({ id: "presynaptic-terminal", boundary: outer });
    out.parts.push("presynaptic-terminal", "vesicles", "synaptic-cleft", "receptors", "axon");
  }
  return out;
}

/** Actin filament in two halves, so the scene can show cofilin breaking it. */
function actinFigure(kit) {
  const W = 1000, H = 150;
  const P = kit.fitProjection([[-92, 0, -12], [92, 0, 12]], W, H, { pad: 20, azimuth: 90, elevation: 8 });
  const half = (x0) => {
    const h = kit.helixOf({ center: [x0, 0, 0], axis: [1, 0, 0], radius: 5.4, turns: 5, rise: 16, strands: 2 }, P);
    return kit.helixSvg(h, P, { tone: "hi", rungTone: "lo", width: 3 });
  };
  return { W, H, left: half(-46), right: half(46), gap: kit.iso([0, 0, 0], P).map(r1) };
}

export async function buildFigures(animaDir, palette) {
  const kit = await loadKit(animaDir);
  const neuron = neuronFigure(kit);
  const synapse = dendriteFigure(kit, { W: 1000, H: 620, withSynapse: true });
  const bare = dendriteFigure(kit, { W: 1000, H: 250, withSynapse: false });
  const actin = actinFigure(kit);

  // Labels are declared against part ids so Anima's audit fails if a label has no real part behind it.
  const labels = [["Dendrite", "dendrite"], ["Dendritic spine", `spine-${synapse.synapseSpine}`], ["Presynaptic terminal", "presynaptic-terminal"], ["Vesicles", "vesicles"], ["Synaptic cleft", "synaptic-cleft"], ["Receptors", "receptors"], ["Axon", "axon"]].map(([text, target]) => ({ text, target }));
  // unitsPerMicron is required by the audit but no measurement is passed: nothing here asserts a scale.
  const audit = kit.bioAudit({ membranes: synapse.membranes, labels, parts: synapse.parts, unitsPerMicron: 1, measurements: [], intersectionTolerance: 0.2 });

  const css = `${kit.ISO_CSS}${kit.BIO_CSS}.iso[data-theme="light"]{--anatomy-hi:${palette.ink};--anatomy-mid:${palette.anatomyMid};--anatomy-shade-2:#DDE5EC;--anatomy-shade-0:#C4D0DA;--anatomy-weight:1.4px;}`;
  return { css, neuron, synapse, bare, actin, labels, audit };
}
