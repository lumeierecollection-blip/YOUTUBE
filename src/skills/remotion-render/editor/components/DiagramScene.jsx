/**
 * Visual Storytelling Engine - DiagramScene Component
 * 
 * Renders process diagrams, cause-and-effect diagrams, and concept maps
 * with animated arrows and nodes.
 */

import React from 'react';
import { useCurrentFrame } from 'remotion';
import { clamp01 } from '../../../editor/layer-math.js';

export function DiagramScene({ 
  type = 'process',           // 'process' | 'cause-effect' | 'concept'
  nodes,                      // Array of {id, label, x, y, color}
  edges,                      // Array of {from, to, label}
  duration = 80,
  currentFrame,
  width = 1080,
  height = 1920,
}) {
  const progress = useCurrentFrame();
  const animProgress = clamp01((progress - (currentFrame || 0)) / duration);
  
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
      {/* Edges (drawn first so they're behind nodes) */}
      {edges?.map((edge, i) => {
        const startNode = nodes.find(n => n.id === edge.from);
        const endNode = nodes.find(n => n.id === edge.to);
        if (!startNode || !endNode) return null;
        
        const midX = (startNode.x + endNode.x) / 2;
        const midY = (startNode.y + endNode.y) / 2;
        
        return (
          <path
            key={edge.from + '-' + edge.to}
            d={`M ${startNode.x} ${startNode.y} Q ${midX} ${midY} ${endNode.x} ${endNode.y}`}
            fill="none"
            stroke="#7F8C8D"
            strokeWidth="2"
            strokeDasharray="100"
            strokeDashoffset={interpolate(animProgress, [i * 0.1, i * 0.1 + 0.4], [100, 0])}
          />
        );
      })}
      
      {/* Nodes */}
      {nodes?.map((node, i) => {
        const nodeProgress = clamp01(animProgress - i * 0.15);
        
        return (
          <g key={node.id} opacity={interpolate(nodeProgress, [0, 0.5], [0, 1])}>
            {/* Node circle */}
            <circle
              cx={node.x}
              cy={node.y}
              r={interpolate(nodeProgress, [0, 0.4], [0, 40])}
              fill={node.color || '#D4A574'}
              stroke="#2C3E50"
              strokeWidth="2"
            />
            {/* Node label */}
            <text
              x={node.x}
              cy={node.y + 50}
              fontSize="16"
              fontWeight="700"
              fill="#2C3E50"
              textAnchor="middle"
              fontFamily="Cormorant Garamond, serif"
              style={{ opacity: interpolate(nodeProgress, [0.4, 1], [0, 1]) }}
            >
              {node.label}
            </text>
          </g>
        )
      })}
    </svg>
  );
}

export default DiagramScene;
