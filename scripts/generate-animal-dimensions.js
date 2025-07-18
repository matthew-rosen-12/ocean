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
      
      // Normalize to a base size (we'll use a base width of 4 units)
      const baseWidth = 4.0;
      const normalizedHeight = baseWidth / aspectRatio;
      
      animalRatios[name] = {
        aspectRatio: aspectRatio,
        baseWidth: baseWidth,
        baseHeight: normalizedHeight,
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
  return dimensions.width * 0.5;
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