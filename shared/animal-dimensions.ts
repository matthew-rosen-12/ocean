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
