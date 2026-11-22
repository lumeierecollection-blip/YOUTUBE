/**
 * Visual Storytelling Engine - TimelineScene Component
 * 
 * Renders animated timelines with events, dates, connecting lines,
 * and event markers that animate in sequentially.
 */

import React from 'react';
import { useCurrentFrame } from 'remotion';
import { clamp01 } from '../../../editor/layer-math.js';

export function TimelineScene({ 
  events,             // Array of {label, date, year, x, color, description}
  duration = 80,      // Animation duration in frames
  currentFrame,
  width = 1080,
  height = 1920,
}) {
  const progress = useCurrentFrame();
  const animProgress = clamp01((progress - (currentFrame || 0)) / duration);
  
  const centerX = width / 2;
  const timelineY = height * 0.5;
  const eventHeight = 120;
  
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
      {/* Main timeline vertical line */}
      <path 
        d={`M ${centerX} ${timelineY - 300} L ${centerX} ${timelineY + 300}`}
        stroke="#D4A574"
        strokeWidth="3"
        strokeDasharray="200"
        strokeDashoffset={interpolate(animProgress, [0, 1], [200, 0])}
      />
      
      {/* Events */}
      {events.map((event, i) => {
        const eventProgress = clamp01((animProgress - i * 0.15) / 0.5);
        const isVisible = eventProgress > 0;
        
        return (
          <g key={i} opacity={Math.min(eventProgress, 1)}>
            {/* Event marker dot */}
            <circle
              cx={centerX}
              cy={timelineY + (i % 2 === 0 ? -eventHeight : eventHeight)}
              r={interpolate(eventProgress, [0, 0.5], [0, 12])}
              fill={event.color || '#D4A574'}
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            
            {/* Connecting line to timeline */}
            <path
              d={`M ${centerX} ${timelineY} L ${centerX} ${timelineY + (i % 2 === 0 ? -eventHeight : eventHeight)}`}
              stroke="#D4A574"
              strokeWidth="2"
              strokeDasharray="40"
              strokeDashoffset={interpolate(eventProgress, [0, 0.5], [40, 0])}
            />
            
            {/* Event label */}
            <text
              x={centerX + (i % 2 === 0 ? 20 : -20)}
              y={timelineY + (i % 2 === 0 ? -eventHeight : eventHeight) + 5}
              fontSize="14"
              fontWeight="700"
              fill="#2C3E50"
              textAnchor={i % 2 === 0 ? 'start' : 'end'}
              fontFamily="Cormorant Garamond, serif"
              style={{ opacity: interpolate(eventProgress, [0.3, 0.8], [0, 1]) }}
            >
              {event.label}
            </text>
            
            {/* Date/Year */}
            <text
              x={centerX + (i % 2 === 0 ? 20 : -20)}
              y={timelineY + (i % 2 === 0 ? -eventHeight : eventHeight) + 25}
              fontSize="12"
              fontWeight="500"
              fill="#7F8C8D"
              textAnchor={i % 2 === 0 ? 'start' : 'end'}
              fontFamily="Cormorant Garamond, serif"
              style={{ opacity: interpolate(eventProgress, [0.4, 0.8], [0, 1]) }}
            >
              {event.date}
            </text>
          </g>
        )
      )}
    </svg>
  );
}

export default TimelineScene;
