/**
 * Visual Storytelling Engine - ProductScene Component
 * 
 * Renders product demonstrations with UI screenshots, feature highlights,
 * and annotated callouts for product explanation videos.
 */

import React from 'react';
import { useCurrentFrame } from 'remotion';
import { clamp01 } from '../../../editor/layer-math.js';

export function ProductScene({ 
  screenshot,      // URL/path to product screenshot
  features,        // Array of {label, x, y, targetX, targetY} feature callouts
  headline,
  subhead,
  duration = 80,
  currentFrame,
  width = 1080,
  height = 1920,
}) {
  const progress = useCurrentFrame();
  const animProgress = clamp01((progress - (currentFrame || 0)) / duration);
  
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
      {/* Background */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#0F0A05"
      />
      
      {/* Screenshot */}
      <image
        href={screenshot}
        x={width/2 - 300}
        y={height/2 - 400}
        width={600}
        height={600}
        style={{
          opacity: interpolate(animProgress, [0, 0.5], [0, 1]),
          filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))',
          transform: `scale(${interpolate(animProgress, [0, 0.5], [0.8, 1])})`,
          transformOrigin: "center",
        }}
      />
      
      {/* Headline */}
      {headline && (
        <text
          x={width/2}
          y={height/2 + 320}
          fontSize="32"
          fontWeight="700"
          fill="#F5F5FF"
          textAnchor="middle"
          fontFamily="Cormorant Garamond, serif"
          style={{ opacity: interpolate(animProgress, [0.6, 1], [0, 1]) }}
        >
          {headline}
        </text>
      )}
      
      {/* Subhead */}
      {subhead && (
        <text
          x={width/2}
          y={height/2 + 360}
          fontSize="18"
          fontWeight="400"
          fill="#C9CDD6"
          textAnchor="middle"
          fontFamily="Cormorant Garamond, serif"
          style={{ opacity: interpolate(animProgress, [0.7, 1], [0, 1]) }}
        >
          {subhead}
        </text>
      )}
      
      {/* Feature callouts */}
      {features?.map((feature, i) => (
        <g key={i} opacity={interpolate(animProgress, [0.7, 1], [0, 1])}>
          {/* Feature dot */}
          <circle
            cx={feature.x}
            cy={feature.y}
            r={8}
            fill="#D4A574"
          />
          {/* Connector line */}
          <line
            x1={feature.x}
            y1={feature.y}
            x2={feature.targetX}
            y2={feature.targetY}
            stroke="#D4A574"
            strokeWidth="2"
          />
          {/* Feature label */}
          <text
            x={feature.targetX}
            y={feature.targetY - 10}
            fontSize="14"
            fontWeight="700"
            fill="#2C3E50"
            textAnchor="middle"
            fontFamily="Cormorant Garamond, serif"
          >
            {feature.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default ProductScene;
