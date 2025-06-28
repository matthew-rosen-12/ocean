/**
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
  BEAR: { width: 4.00, height: 4.00 },
  BEE: { width: 4.00, height: 4.00 },
  CUTTLEFISH: { width: 4.00, height: 2.00 },
  DOLPHIN: { width: 4.00, height: 3.06 },
  EAGLE: { width: 4.00, height: 2.24 },
  PENGUIN: { width: 4.00, height: 7.83 },
  SALAMANDER: { width: 4.00, height: 2.25 },
  SNAKE: { width: 4.00, height: 3.47 },
  TIGER: { width: 4.00, height: 2.67 },
  TUNA: { width: 4.00, height: 1.74 },
  TURTLE: { width: 4.00, height: 1.87 },
  WOLF: { width: 4.00, height: 4.41 },
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
  BEAR: { width: 1024.0, height: 1024.0, aspectRatio: 1.000 },
  BEE: { width: 1024.0, height: 1024.0, aspectRatio: 1.000 },
  CUTTLEFISH: { width: 500.0, height: 250.0, aspectRatio: 2.000 },
  DOLPHIN: { width: 307.5, height: 235.2, aspectRatio: 1.308 },
  EAGLE: { width: 1367.0, height: 766.0, aspectRatio: 1.785 },
  PENGUIN: { width: 324.7, height: 635.9, aspectRatio: 0.511 },
  SALAMANDER: { width: 1365.0, height: 768.0, aspectRatio: 1.777 },
  SNAKE: { width: 2334.1, height: 2026.5, aspectRatio: 1.152 },
  TIGER: { width: 1254.0, height: 836.0, aspectRatio: 1.500 },
  TUNA: { width: 1552.0, height: 675.0, aspectRatio: 2.299 },
  TURTLE: { width: 5059.9, height: 2367.0, aspectRatio: 2.138 },
  WOLF: { width: 287.6, height: 317.1, aspectRatio: 0.907 },
};
