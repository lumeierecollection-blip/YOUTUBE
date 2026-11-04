/**
 * Visual Storytelling Engine - EditorialScene Component
 * 
 * Renders editorial graphics: document overlays, annotation callouts,
 * newspaper-style citations, and highlighted text excerpts.
 */

import React from 'react';
import { useCurrentFrame } from 'remotion';
import { clamp01 } from '../../../editor/layer-math.js';

export function EditorialScene({ 
  documentText,      // Document text to display
  highlight,         // Text to highlight within document
  citation,          // Citation text
  annotations,       // Array of {text, x, y, targetX, targetY} annotation callouts
  background = '#F5EFE6', // Parchment-like background
  duration = 80,
  currentFrame,
  width = 1080,
  height = 1920,
}) {
  const progress = useCurrentFrame();
  const animProgress = clamp01((progress - (currentFrame || 0)) / duration);
  
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
      {/* Parchment background */}
      <rect
        x={50}
        y={height * 0.2}
        width={width - 100}
        height={height * 0.6}
        fill={background}
        stroke="#8B7355"
        strokeWidth="2"
        style={{ opacity: interpolate(animProgress, [0, 0.5], [0, 1]) }}
      />
      
      {/* Document text */}
      <text
        x={width/2}
        y={height/2 - 40}
        fontSize="24"
        fontWeight="400"
        fill="#2C3E50"
        textAnchor="middle"
        fontFamily="Cormorant Garamond, serif"
        style={{ opacity: interpolate(animProgress, [0.4, 1], [0, 1]) }}
        lineHeight="1.6"
      >
        {documentText}
      </text>
      
      {/* Highlight box */}
      {highlight && (
        <rect
          x={width/2 - 150}
          y={height/2 - 60}
          width={300}
          height={40}
          fill="#E74C3C"
          fillOpacity={0.3}
          style={{ opacity: interpolate(animProgress, [0.6, 1], [0, 1]) }}
        />
        <text
          x={width/2}
          y={height/2 - 30}
          fontSize="24"
          fontWeight="700"
          fill="#E74C3C"
          textAnchor="middle"
          fontFamily="Cormorant Garamond, serif"
          style={{ opacity: interpolate(animProgress, [0.6, 1], [0, 1]) }}
        >
          {highlight}
        </text>
      )}
      
      {/* Citation */}
      <text
        x={width/2}
        y={height/2 + 120}
        fontSize="18"
        fontWeight="400"
        fill="#7F8C8D"
        textAnchor="middle"
        fontFamily="Cormorant Garamond, serif"
        style={{ opacity: interpolate(animProgress, [0.8, 1], [0, 1]) }}
      >
        {citation}
      </text>
      
      {/* Annotation callouts */}
      {annotations?.map((ann, i) => (
        <g key={i} opacity={interpolate(animProgress, [0.7, 1], [0, 1])}>
          {/* Callout line */}
          <line
            x1={ann.x}
            y1={ann.y}
            x2={ann.targetX}
            y2={ann.targetY}
            stroke="#E74C3C"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          {/* Callout circle */}
          <circle
            cx={ann.x}
            cy={ann.y}
            r={6}
            fill="#E74C3C"
          />
          {/* Callout label */}
          <text
            x={ann.targetX}
            y={ann.targetY - 10}
            fontSize="14"
            fontWeight="700"
            fill="#2C3E50"
            textAnchor="middle"
            fontFamily="Cormorant Garamond, serif"
          >
            {ann.text}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default EditorialScene;
