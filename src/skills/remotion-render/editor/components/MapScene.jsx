/**
 * Visual Storytelling Engine - MapScene Component
 * 
 * Renders geographic maps with region highlighting, route animation,
 * and location labels. Uses SVG map files from public/assets.
 */

import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { clamp01, interpolate as lerp } from '../../../editor/layer-math.js';

const MAP_COLORS = {
  land: '#E8E4D4',
  water: '#BFD7EA',
  accent: '#D4A574',
  highlight: '#E74C3C',
  text: '#2C3E50',
};

export function MapScene({ 
  region,           // Country/region name to highlight
  regionColor = MAP_COLORS.accent,
  route,            // Array of {lat, lon} points for route animation
  labels,           // Array of {label, lat, lon, offsetX, offsetY} for location labels
  duration = 60,    // Animation duration in frames
  currentFrame,
  width = 1080,
  height = 1920,
}) {
  const progress = useCurrentFrame();
  const animProgress = clamp01((progress - (currentFrame || 0)) / duration);
  
  // Map SVG path data for common regions (simplified country outlines)
  const MAP_DATA = {
    york: 'M 350 200 L 400 210 L 420 250 L 410 300 L 380 320 L 360 340 L 340 320 L 320 280 L 330 240 L 340 210 Z',
    london: 'M 450 200 L 480 210 L 490 240 L 480 270 L 470 290 L 460 310 L 450 320 L 440 300 L 430 270 L 440 240 L 450 220 Z',
    rome: 'M 550 200 L 580 210 L 590 250 L 580 290 L 570 310 L 560 320 L 550 330 L 540 320 L 530 300 L 540 260 L 550 220 Z',
  };

  const pathData = MAP_DATA[region?.toLowerCase()] || MAP_DATA.york;
  
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
      {/* Background land/water */}
      <path d="M 0 0 L {width} 0 L {width} {height} L 0 {height} Z" fill={MAP_COLORS.water} />
      {/* Map shape with reveal animation */}
      <path 
        d={pathData}
        fill={regionColor}
        stroke="#2C3E50"
        strokeWidth="2"
        style={{
          opacity: interpolate(progress, [0, duration * 0.3], [0, 1]),
          transform: `scale(${interpolate(progress, [0, duration * 0.3], [0.8, 1])})`,
          transformOrigin: "center",
        }}
      />
      {/* Route line animation */}
      {route && route.length > 1 && (
        <path
          d={generatePath(route)}
          fill="none"
          stroke={MAP_COLORS.accent}
          strokeWidth="3"
          strokeDasharray="200"
          strokeDashoffset={interpolate(animProgress, [0, 1], [200, 0])}
          style={{ opacity: interpolate(animProgress, [0, 0.5], [0, 1]) }}
        />
      )}
      {/* Location labels */}
      {labels?.map((label, i) => (
        <text
          key={i}
          x={label.offsetX || 0}
          y={label.offsetY || 0}
          fontSize="14"
          fontWeight="700"
          fill={MAP_COLORS.text}
          style={{
            opacity: interpolate(animProgress, [0.2 * i, 1], [0, 1]),
          }}
          fontFamily="Cormorant Garamond, serif"
        >
          {label.label}
        </text>
      ))}
    </svg>
  );
}

function generatePath(points) {
  return points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
}

export default MapScene;
