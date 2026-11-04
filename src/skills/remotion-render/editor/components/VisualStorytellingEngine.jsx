/**
 * Visual Storytelling Engine - Main Component
 * 
 * Orchestrates all visual components based on the narration script and
 * visual-director decisions. Renders the appropriate visual treatment for
 * each narration sentence, handling transitions between scenes.
 */

import React from 'react';
import { useCurrentFrame } from 'remotion';
import { clamp01 } from '../../../editor/layer-math.js';
import { VisualDirector, classifyVisualIntent, getVisualConfig, VISUAL_INTENTS } from './VisualDirector';
import { MapScene } from './MapScene';
import { TimelineScene } from './TimelineScene';
import { DataVizScene } from './DataVizScene';
import { DiagramScene } from './DiagramScene';
import { EditorialScene } from './EditorialScene';
import { ReconstructedScene } from './ReconstructedScene';
import { ProductScene } from './ProductScene';

/**
 * VisualStorytellingEngine - Main component for the visual storytelling pipeline.
 * 
 * Takes a script with visual annotations and renders the appropriate visual
 * treatment for each narration sentence.
 * 
 * Props:
 *   scenes: Array of scene objects with:
 *     - id: Unique scene identifier
 *     * startFrame: Start frame
 *     * endFrame: End frame
 *     - narration: The spoken text
 *     - visualIntent: Optional pre-determined visual intent
 *     - context: Additional context for visual selection
 *   currentFrame: Current frame number
 *   width: Canvas width (default 1080)
 *   height: Canvas height (default 1920)
 */
export function VisualStorytellingEngine({ 
  scenes,
  currentFrame,
  width = 1080,
  height = 1920,
}) {
  // Find the active scene for the current frame
  const activeScene = scenes.find(
    (scene) => currentFrame >= scene.startFrame && currentFrame < scene.endFrame
  );
  
  if (!activeScene) return null;
  
  // Determine the visual to show
  const visualConfig = applyVisualPack(activeScene);
  
  if (!visualConfig) return null;
  
  const { component: VisualComponent, props } = visualConfig;
  
  // Render the appropriate visual component
  switch (VisualComponent) {
    case 'MapScene':
      return <MapScene {...props} currentFrame={currentFrame} width={width} height={height} />;
    case 'TimelineScene':
      return <TimelineScene {...props} currentFrame={currentFrame} width={width} height={height} />;
    case 'DataVizScene':
      return <DataVizScene {...props} currentFrame={currentFrame} width={width} height={height} />;
    case 'DiagramScene':
      return <DiagramScene {...props} currentFrame={currentFrame} width={width} height={height} />;
    case 'EditorialScene':
      return <EditorialScene {...props} currentFrame={currentFrame} width={width} height={height} />;
    case 'ReconstructedScene':
      return <ReconstructedScene {...props} currentFrame={currentFrame} width={width} height={height} />;
    case 'ProductScene':
      return <ProductScene {...props} currentFrame={currentFrame} width={width} height={height} />;
    default:
      return <ReconstructedScene {...props} currentFrame={currentFrame} width={width} height={height} />;
  }
}

/**
 * Apply the visual pack to a scene - determines which visual to show
 * based on narration content analysis.
 */
function applyVisualPack(scene) {
  const { sentenceIndex = 0, sentenceText = '', sceneAssets = [], subjects = [] } = scene;
  
  // Determine the visual intent
  const intent = classifyVisualIntent(sentenceText, { subject: subjects[0] });
  
  // Get the visual configuration
  const visualConfig = getVisualConfig(intent, {
    subject: subjects[0] || '',
    subjects: subjects,
    ...scene,
  });
  
  return visualConfig;
}

export default VisualStorytellingEngine;
