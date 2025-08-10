#!/usr/bin/env node

/**
 * Script to generate animal dimension ratios from SVG cache files
 * This calculates the width/height ratios and creates constants for collision detection
 */

const fs = require('fs');
const path = require('path');

// Path to animal cache files
const cacheDir = path.join(__dirname, '../frontend/public/animal-cache');
const manifestPath = path.join(cacheDir, 'manifest.json');
const outputPath = path.join(__dirname, '../shared/animal-dimensions.ts');

function generateAnimalDimensions() {
  try {
    // Read the manifest file
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    
    
    const animalRatios = {};
    
    // Process each animal
    for (const animal of manifest.animals) {
      const { name, bounds } = animal;
      
      // Calculate dimensions from bounds
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      
      // Calculate aspect ratio (width/height)
      const aspectRatio = width / height;
      
      // Normalize to max dimension of 5 (matching visual rendering)
      const maxDim = Math.max(width, height);
      const normalizeScale = 5.0 / maxDim;
      const baseWidth = width * normalizeScale;
      const baseHeight = height * normalizeScale;
      
      animalRatios[name] = {
        aspectRatio: aspectRatio,
        baseWidth: baseWidth,
        baseHeight: baseHeight,
        originalBounds: { width, height }
      };
      
      
    }
    
    // Generate TypeScript file
    const tsContent = `/**
 * Animal dimensions for collision detection
 * These values are calculated from SVG bounds and multiplied by animal scale
 * Generated automatically from animal cache files
 */

export interface AnimalDimensions {
  width: number;
  height: number;
}

// Base dimension ratios derived from SVG bounds
const ANIMAL_BASE_DIMENSIONS: { [animal: string]: AnimalDimensions } = {
${Object.entries(animalRatios).map(([name, data]) => 
  `  ${name}: { width: ${data.baseWidth.toFixed(2)}, height: ${data.baseHeight.toFixed(2)} },`
).join('\n')}
};

/**
 * Get animal dimensions for collision detection
 * Multiplies base dimensions by animal scale
 */
export function getAnimalDimensions(animal: string, scale: number = 1.0): AnimalDimensions {
  const baseDimensions = ANIMAL_BASE_DIMENSIONS[animal] || { width: 4.0, height: 4.0 };
  return {
    width: baseDimensions.width * scale,
    height: baseDimensions.height * scale
  };
}

/**
 * Get collision threshold for an animal (typically width * 0.5 to match frontend)
 */
export function getCollisionThreshold(animal: string, scale: number = 1.0): number {
  const dimensions = getAnimalDimensions(animal, scale);
  return dimensions.width * 0.1; // Reduced from 0.25 to 0.1 to prevent immediate recapture
}

/**
 * Check if two rotated bounding boxes collide using Separating Axis Theorem (SAT)
 * @param pos1 Position of first object
 * @param pos2 Position of second object
 * @param width1 Width of first object
 * @param height1 Height of first object
 * @param rotation1 Rotation of first object in radians
 * @param width2 Width of second object
 * @param height2 Height of second object
 * @param rotation2 Rotation of second object in radians
 * @returns true if the bounding boxes collide
 */
export function checkRotatedBoundingBoxCollision(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number },
  width1: number,
  height1: number,
  rotation1: number,
  width2: number,
  height2: number,
  rotation2: number
): boolean {
  // Get the corners of both bounding boxes
  const corners1 = getRotatedBoundingBoxCorners(pos1, width1, height1, rotation1);
  const corners2 = getRotatedBoundingBoxCorners(pos2, width2, height2, rotation2);

  // Get the axes to test (normals of each edge)
  const axes1 = getBoundingBoxAxes(corners1);
  const axes2 = getBoundingBoxAxes(corners2);
  const allAxes = [...axes1, ...axes2];

  // Test each axis for separation
  for (const axis of allAxes) {
    // Skip zero-length axes
    const axisLength = Math.sqrt(axis.x * axis.x + axis.y * axis.y);
    if (axisLength < 0.0001) continue;
    
    const projection1 = projectBoundingBox(corners1, axis);
    const projection2 = projectBoundingBox(corners2, axis);

    // If projections don't overlap, there's no collision
    if (projection1.max < projection2.min || projection2.max < projection1.min) {
      return false;
    }
  }

  // If no separation found on any axis, the boxes collide
  return true;
}

/**
 * Get the corners of a rotated bounding box
 */
function getRotatedBoundingBoxCorners(
  position: { x: number; y: number },
  width: number,
  height: number,
  rotation: number
): { x: number; y: number }[] {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  // Define corners relative to center (before rotation)
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight }
  ];

  // Rotate and translate each corner
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  return corners.map(corner => ({
    x: position.x + corner.x * cos - corner.y * sin,
    y: position.y + corner.x * sin + corner.y * cos
  }));
}

/**
 * Get the axes (normals) of a bounding box for SAT testing
 */
function getBoundingBoxAxes(corners: { x: number; y: number }[]): { x: number; y: number }[] {
  const axes: { x: number; y: number }[] = [];
  
  for (let i = 0; i < corners.length; i++) {
    const current = corners[i];
    const next = corners[(i + 1) % corners.length];
    
    // Get edge vector
    const edge = { x: next.x - current.x, y: next.y - current.y };
    
    // Get normal (perpendicular) vector - normalize to unit length
    const edgeLength = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
    if (edgeLength < 0.0001) continue; // Skip very small edges
    
    const normal = { x: -edge.y / edgeLength, y: edge.x / edgeLength };
    axes.push(normal);
  }
  
  return axes;
}

/**
 * Project a bounding box onto an axis
 */
function projectBoundingBox(
  corners: { x: number; y: number }[],
  axis: { x: number; y: number }
): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  
  for (const corner of corners) {
    const projection = corner.x * axis.x + corner.y * axis.y;
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  
  return { min, max };
}

// Original SVG bounds for reference
export const ORIGINAL_SVG_BOUNDS = {
${Object.entries(animalRatios).map(([name, data]) => 
  `  ${name}: { width: ${data.originalBounds.width.toFixed(1)}, height: ${data.originalBounds.height.toFixed(1)}, aspectRatio: ${data.aspectRatio.toFixed(3)} },`
).join('\n')}
};
`;
    
    // Write the generated file
    fs.writeFileSync(outputPath, tsContent, 'utf8');
    
    
    
    
  } catch (error) {
    console.error('❌ Error generating animal dimensions:', error);
    process.exit(1);
  }
}

// Run the script
generateAnimalDimensions();