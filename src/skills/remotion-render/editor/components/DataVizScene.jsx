/**
 * Visual Storytelling Engine - DataVizScene Component
 * 
 * Renders data visualizations: bar charts, line charts, gauges, counters.
 * Animated with keyframe-driven growth and count-up animations.
 */

import React from 'react';
import { useCurrentFrame } from 'remotion';
import { clamp01, interpolate } from '../../../editor/layer-math.js';

const CHART_COLORS = ['#D4A574', '#2C3E50', '#E74C3C', '#3498DB', '#27AE60', '#F39C12'];

export function DataVizScene({ 
  type = 'bars',           // 'bars' | 'line' | 'gauge' | 'counter'
  data,                    // Array of {label, value, color}
  maxValue,                // Max value for axis scaling
  width = 1080,
  height = 1920,
  currentFrame,
  duration = 80,
}) {
  const progress = useCurrentFrame();
  const animProgress = clamp01((progress - (currentFrame || 0)) / duration);
  
  const colors = CHART_COLORS;
  
  if (type === 'bars') {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
        {data.map((d, i) => {
          const barHeight = (d.value / maxValue) * 300;
          const barY = height * 0.7 - barHeight;
          const barX = 100 + i * 150;
          
          return (
            <g key={i} opacity={interpolate(animProgress, [i * 0.15, i * 0.15 + 0.5], [0, 1])}>
              <rect
                x={barX}
                y={barY}
                width={100}
                height={interpolate(animProgress, [i * 0.15, i * 0.15 + 0.5], [0, barHeight])}
                fill={colors[i % colors.length]}
              />
              <text
                x={barX + 50}
                y={barY - 10}
                fontSize="14"
                fontWeight="700"
                fill="#2C3E50"
                textAnchor="middle"
                fontFamily="Cormorant Garamond, serif"
                style={{ opacity: interpolate(animProgress, [i * 0.15 + 0.3, i * 0.15 + 0.8], [0, 1]) }}
              >
                {d.label}
              </text>
              <text
                x={barX + 50}
                y={barY - 5}
                fontSize="24"
                fontWeight="900"
                fill={d.color || colors[i % colors.length]}
                textAnchor="middle"
                fontFamily="Cormorant Garamond, serif"
                style={{ opacity: interpolate(animProgress, [i * 0.15 + 0.3, i * 0.15 + 0.8], [0, 1]) }}
              >
                {d.value}
              </text>
            </g>
          )
        )}
      </svg>
    );
  }
  
  if (type === 'line') {
    const points = data.map((d, i) => {
      const x = 100 + i * ((width - 200) / (data.length - 1));
      const y = height * 0.7 - (d.value / maxValue) * 300;
      return `${x},${y}`;
    }).join(' ');
    
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
        <path
          d={points}
          fill="none"
          stroke={CHART_COLORS[0]}
          strokeWidth="3"
          strokeDasharray={points.length * 50}
          strokeDashoffset={interpolate(animProgress, [0, 1], [points.length * 50, 0])}
        />
        {data.map((d, i) => {
          const x = 100 + i * ((width - 200) / (data.length - 1));
          const y = height * 0.7 - (d.value / maxValue) * 300;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={interpolate(animProgress, [i * 0.1, i * 0.1 + 0.3], [0, 8])}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
            />
          )
        })}
      </svg>
    );
  }
  
  if (type === 'gauge') {
    const gaugeValue = data[0]?.value || 0;
    const gaugeAngle = (gaugeValue / maxValue) * 180 - 90; // -90 to 90 degrees
    
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
        {/* Gauge arc background */}
        <path
          d={`M ${width/2 - 150} ${height/2 + 50} A 150 150 0 0 1 ${width/2 + 150} ${height/2 + 50}`}
          fill="none"
          stroke="#E0E0E0"
          strokeWidth="20"
        />
        {/* Gauge arc value */}
        <path
          d={`M ${width/2 - 150} ${height/2 + 50} A 150 150 0 ${gaugeAngle > 180 ? 1 : 0} 1 ${width/2 + 150 * Math.cos(gaugeAngle * Math.PI / 180)} ${height/2 + 50 + 150 * Math.sin(gaugeAngle * Math.PI / 180)}`}
          fill="none"
          stroke={CHART_COLORS[0]}
          strokeWidth="20"
          strokeLinecap="round"
          strokeDasharray={300}
          strokeDashoffset={interpolate(animProgress, [0, 1], [300, 300 - (gaugeValue / maxValue) * 300])}
        />
        {/* Center value text */}
        <text
          x={width/2}
          y={height/2 + 50}
          fontSize="48"
          fontWeight="900"
          fill={CHART_COLORS[0]}
          textAnchor="middle"
          fontFamily="Cormorant Garamond, serif"
          style={{ opacity: interpolate(animProgress, [0.5, 1], [0, 1]) }}
        >
          {Math.round(gaugeValue)}
        </text>
      </svg>
    );
  }
  
  if (type === 'counter') {
    const value = data[0]?.value || 0;
    const currentValue = interpolate(animProgress, [0, 1], [0, value]);
    
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
        <text
          x={width/2}
          y={height/2}
          fontSize="120"
          fontWeight="900"
          fill={CHART_COLORS[0]}
          textAnchor="middle"
          fontFamily="Cormorant Garamond, serif"
          style={{ opacity: interpolate(animProgress, [0.3, 1], [0, 1]) }}
        >
          {Math.round(currentValue)}
        </text>
        {data[0]?.label && (
          <text
            x={width/2}
            y={height/2 + 60}
            fontSize="24"
            fontWeight="400"
            fill="#2C3E50"
            textAnchor="middle"
            fontFamily="Cormorant Garamond, serif"
            style={{ opacity: interpolate(animProgress, [0.5, 1], [0, 1]) }}
          >
            {data[0].label}
          </text>
        )}
      </svg>
    );
  }
  
  return null;
}

export default DataVizScene;
