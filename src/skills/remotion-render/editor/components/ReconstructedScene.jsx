/**
 * Visual Storytelling Engine - ReconstructedScene Component
 * 
 * Renders layered cinematic compositions using historical photographs,
 * architectural elements, and atmospheric effects. Creates depth through
 * parallax movement and lighting overlays.
 */

import React from 'react';
import { useCurrentFrame, useSpring } from 'remotion';
import { clamp01, interpolate } from '../../../editor/layer-math.js';

export function ReconstructedScene({ 
  layers,               // Array of {src, x, y, width, height, opacity, motion}
  caption,
  duration = 80,
  currentFrame,
  width = 1080,
  height = 1920,
}) {
  const progress = useCurrentFrame();
  const animProgress = clamp01((progress - (currentFrame || 0)) / duration);
  
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
      {/* Base background */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#0F0A05"
      />
      
      {/* Image layers with parallax */}
      {layers?.map((layer, i) => {
        const layerProgress = clamp01(animProgress - (i * 0.1));
        const opacity = interpolate(layerProgress, [0, 0.5], [0, layer.opacity || 0.8]);
        
        return (
          <g key={i} opacity={opacity}>
            <image
              href={layer.src}
              x={layer.x}
              y={layer.y}
              width={layer.width}
              height={layer.height}
              opacity={layer.opacity || 0.8}
              style={{
                filter: layer.filter || 'sepia(0.18) saturate(0.32) brightness(0.82)',
                transform: `scale(${interpolate(layerProgress, [0, 1], [1, 1.1])})`,
                transformOrigin: "center",
              }}
            />
          </g>
        )
      })}
      
      {/* Caption overlay */}
      {caption && (
        <text
          x={width/2}
          y={height - 100}
          fontSize="24"
          fontWeight="400"
          fill="#F5F5FF"
          textAnchor="middle"
          fontFamily="Cormorant Garamond, serif"
          style={{ opacity: interpolate(animProgress, [0.5, 1], [0, 1]) }}
        >
          {caption}
        </text>
      )}
    </svg>
  );
}

export default ReconstructedScene;
