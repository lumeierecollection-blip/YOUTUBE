// Shared Three.js pieces for Red Space Facts. Three.js through @remotion/three is the PROVISIONAL
// implementation of the owner's "SOLSYS" selection (identity unconfirmed; see platform/channels/red-space-facts/SKILLS.md).
// Nothing here is from any repository named SOLSYS.
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import channel from "../../../../../platform/channels/red-space-facts/channel.json";
import figures from "../../../../../platform/channels/red-space-facts/figures.json";

export const P = channel.palette;
export const W = 1080;
export const H = 1920;
export const R_EQ = figures.saturn.equatorial_radius_km;
export const OBLATE = figures.saturn.polar_radius_km / figures.saturn.equatorial_radius_km; // 0.902
export const OBLIQUITY = (figures.saturn.obliquity_deg * Math.PI) / 180;

export const rand = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Loads an image as a texture, holding the render until it is ready. */
export function useImageTexture(url) {
  const [handle] = useState(() => delayRender(`texture ${url}`, { timeoutInMilliseconds: 60000 }));
  const [tex, setTex] = useState(null);
  useEffect(() => {
    new THREE.TextureLoader().load(
      url,
      (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; setTex(t); continueRender(handle); },
      undefined,
      (e) => { console.error("texture failed", url, e); continueRender(handle); },
    );
  }, [url, handle]);
  return tex;
}

/** Camera placed from plain numbers so the 2D overlay can project the same points. */
export function Rig({ cam }) {
  const { camera } = useThree();
  useLayoutEffect(() => {
    camera.position.set(...cam.pos);
    camera.fov = cam.fov;
    camera.near = 0.05;
    camera.far = 800;
    camera.lookAt(...cam.look);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  });
  return null;
}

export function project(cam, world) {
  const c = new THREE.PerspectiveCamera(cam.fov, W / H, 0.05, 800);
  c.position.set(...cam.pos);
  c.lookAt(...cam.look);
  c.updateMatrixWorld();
  const v = new THREE.Vector3(...world).project(c);
  return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
}

/** Saturn-local point to world, for the tilt group used by SaturnSystem. */
export function satWorld(local, roll = OBLIQUITY) {
  return new THREE.Vector3(...local).applyEuler(new THREE.Euler(0, 0, roll)).toArray();
}

export function Stars({ seed = 7, count = 1400, radius = 300 }) {
  const geo = useMemo(() => {
    const r = rand(seed), a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      a.set([radius * s * Math.cos(th), radius * u, radius * s * Math.sin(th)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(a, 3));
    return g;
  }, [seed, count, radius]);
  return (
    <points geometry={geo}>
      <pointsMaterial color={P.star} size={2.4} sizeAttenuation={false} />
    </points>
  );
}

const noise1 = (x) => Math.sin(x * 0.00091) * 0.5 + Math.sin(x * 0.0043 + 1.3) * 0.3 + Math.sin(x * 0.0171 + 2.1) * 0.2;

/**
 * Ring colour/opacity strip built from figures.json (ring edges, optical depth ranges, albedo).
 * Radial fine structure inside each sourced tau range is invented texture (artistic_interpretation).
 */
export function makeRingStrip() {
  const Wd = 2048, c = document.createElement("canvas");
  c.width = Wd; c.height = 2;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(Wd, 2);
  const regs = figures.rings.regions;
  const inner = regs[0].inner_km, outer = regs[regs.length - 1].outer_km;
  const tint = new THREE.Color(P.ring_tint);
  for (let x = 0; x < Wd; x++) {
    const rkm = inner + ((outer - inner) * x) / (Wd - 1);
    const reg = regs.find((g) => rkm >= g.inner_km && rkm <= g.outer_km) || regs[regs.length - 1];
    const n = 0.5 + 0.5 * noise1(rkm);
    let tau = reg.tau_min + (reg.tau_max - reg.tau_min) * n;
    for (const g of figures.rings.gaps) if (rkm >= g.inner_km && rkm <= g.inner_km + g.width_km_illustrative) tau = 0;
    const alpha = Math.min(1, 1 - Math.exp(-tau * 1.7));
    const shade = 0.55 + reg.albedo * 0.9;
    for (let y = 0; y < 2; y++) {
      const o = (y * Wd + x) * 4;
      img.data[o] = Math.min(255, tint.r * 255 * shade);
      img.data[o + 1] = Math.min(255, tint.g * 255 * shade);
      img.data[o + 2] = Math.min(255, tint.b * 255 * shade);
      img.data[o + 3] = alpha * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, inner: inner / R_EQ, outer: outer / R_EQ };
}

function ringGeometry(inner, outer) {
  const g = new THREE.RingGeometry(inner, outer, 256, 1);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  g.rotateX(-Math.PI / 2); // lie in the XZ plane, Y up
  return g;
}

/** Latitude band shell: dark between latMin and latMax in both hemispheres (hemisphere drawn on both sides is illustrative). */
function makeBandTexture(latMin, latMax) {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 512;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(4, 512);
  const col = new THREE.Color(P.dark_band);
  for (let y = 0; y < 512; y++) {
    const lat = Math.abs(90 - (180 * y) / 511);
    const e = 4;
    let a = 0;
    if (lat > latMin - e && lat < latMax + e) a = Math.min(1, (lat - (latMin - e)) / e, ((latMax + e) - lat) / e);
    for (let x = 0; x < 4; x++) {
      const o = (y * 4 + x) * 4;
      img.data[o] = col.r * 255; img.data[o + 1] = col.g * 255; img.data[o + 2] = col.b * 255; img.data[o + 3] = Math.max(0, a) * 235;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Saturn from the NASA texture, oblate by the fact-sheet radii, with the sourced ring system. */
export function SaturnSystem({ tex, ringOpacity = 1, bands = 0, rotation = 0, children, roll = OBLIQUITY }) {
  const ring = useMemo(() => makeRingStrip(), []);
  const geo = useMemo(() => ringGeometry(ring.inner, ring.outer), [ring]);
  const bandTex = useMemo(() => makeBandTexture(figures.ring_rain.dark_band_lat_min_deg, figures.ring_rain.dark_band_lat_max_deg), []);
  return (
    <group rotation={[0, 0, roll]}>
      <group scale={[1, OBLATE, 1]} rotation={[0, rotation, 0]}>
        <mesh>
          <sphereGeometry args={[1, 96, 64]} />
          <meshStandardMaterial map={tex || null} color={tex ? P.saturn_grade : P.saturn_atmosphere} roughness={1} metalness={0} />
        </mesh>
        {bands > 0.01 && (
          <mesh>
            <sphereGeometry args={[1.006, 96, 64]} />
            <meshBasicMaterial map={bandTex} transparent opacity={bands} depthWrite={false} />
          </mesh>
        )}
      </group>
      {ringOpacity > 0.01 && (
        <mesh geometry={geo}>
          <meshBasicMaterial map={ring.tex} transparent opacity={ringOpacity} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      {children}
    </group>
  );
}

export function SunLight({ pos = [-14, 6, 10], intensity = 3.2, ambient = 0.28 }) {
  return (
    <>
      <ambientLight intensity={ambient} color={"#9fb0d4"} />
      <directionalLight position={pos} intensity={intensity} color={"#fff4e0"} />
    </>
  );
}

/** Dipole field line r = L cos^2(lat), stopped where it meets the oblate surface. Simplified model, not the measured field. */
export function fieldLine(L, phi, sign = 1, n = 40) {
  const surf = (lat) => 1 / Math.sqrt(Math.cos(lat) ** 2 + (Math.sin(lat) / OBLATE) ** 2);
  let latMax = 0;
  for (let l = 0; l < Math.PI / 2; l += 0.002) { if (L * Math.cos(l) ** 2 <= surf(l)) { latMax = l; break; } }
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const lat = sign * latMax * (i / n);
    const r = L * Math.cos(lat) ** 2;
    pts.push(new THREE.Vector3(r * Math.cos(lat) * Math.cos(phi), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(phi)));
  }
  return { pts, latMax };
}
