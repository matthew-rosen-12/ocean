import {UserInfo } from "shared/types";
import * as THREE from "three";

// Constants for positioning
const FOLLOW_DISTANCE = 2; // Distance behind the user

/**
 * Calculate logarithmic proportion factor based on number of fileNames in group
 * This is the core scaling function used for size, speed, and distance calculations
 */
export function calculateNPCGroupProportion(numFileNames: number): number {
  if (numFileNames === 0) return 0;

  // Logarithmic scaling function - log base 4 gives a nice curve
  // Starts at 1 for 1 fileName and roughly doubles for each doubling of fileNames
  const logProportion = Math.log(numFileNames) / Math.log(4);

  return 1 + logProportion;
}

/**
 * Calculate visual scale factor based on number of fileNames in group
 */
export function calculateNPCGroupScale(numFileNames: number): number {
  if (numFileNames === 0) return 0;

  // Use the proportion function with a base scale multiplier
  const baseScale = 3;
  return baseScale * calculateNPCGroupProportion(numFileNames);
}

/**
 * Calculate path velocity factor based on group size
 */
export function calculateNPCGroupVelocityFactor(numFileNames: number): number {
  if (numFileNames === 0) return 1;
  
  // Larger groups throw faster (square root scaling for reasonable progression)
  return Math.sqrt(calculateNPCGroupProportion(numFileNames));
}

/**
 * Calculate path distance factor based on group size  
 */
export function calculateNPCGroupDistanceFactor(numFileNames: number): number {
  if (numFileNames === 0) return 1;
  
  // Larger groups travel farther (linear scaling with the proportion)
  return calculateNPCGroupProportion(numFileNames);
}

/**
 * Calculate target position for NPC group behind the user based on their direction
 */
export function calculateNPCGroupPosition(
  user: UserInfo,
  animalWidth: number,
  npcScale: number
): THREE.Vector3 {
  // Default direction if not specified (backward is -x)
  let directionX = -1;
  let directionY = 0;

  // If user has a direction, use the inverse of it to position behind
  if (user.direction) {
    // Normalize direction
    const length = Math.sqrt(
      user.direction.x * user.direction.x + user.direction.y * user.direction.y
    );
    if (length > 0.001) {
      directionX = -user.direction.x / length; // Opposite X direction
      directionY = -user.direction.y / length; // Opposite Y direction
    }
  }

  // Calculate position that is animalWidth + scaled NPC width + FOLLOW_DISTANCE units behind the user
  const npcWidth = npcScale; // The scaled width of the NPC mesh

  const targetPosition = new THREE.Vector3(
    user.position.x +
      directionX * (animalWidth / 2 + npcWidth / 2 + FOLLOW_DISTANCE),
    user.position.y +
      directionY * (animalWidth / 2 + npcWidth / 2 + FOLLOW_DISTANCE),
    0.05 // Place in front of wave grid
  );

  return targetPosition;
}

