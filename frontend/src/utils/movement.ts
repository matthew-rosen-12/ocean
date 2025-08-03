import * as THREE from "three";

interface MovementOptions {
  lerpFactor?: number;
  moveSpeed?: number;
  minDistance?: number;
  useConstantSpeed?: boolean;
  delta?: number; // Frame delta time for frame-rate independent movement
}

/**
 * Smoothly move an object from current to target position
 * @param currentPosition The current position to update
 * @param targetPosition The target position to move toward
 * @param options Configuration options
 * @returns The updated position
 */
export function smoothMove(
  currentPosition: THREE.Vector3,
  targetPosition: THREE.Vector3,
  options: MovementOptions = {}
): THREE.Vector3 {
  const {
    lerpFactor = 0.1,
    moveSpeed = 0.1,
    minDistance = 0.01,
    useConstantSpeed = true,
    delta = 1/60, // Default to 60fps if no delta provided
  } = options;

  // Standard linear interpolation (no wrapping)
  const positionDelta = new THREE.Vector3().subVectors(
    targetPosition,
    currentPosition
  );
  const distance = currentPosition.distanceTo(targetPosition);

  // If we're close enough, don't bother moving
  if (distance <= minDistance) {
    return currentPosition;
  }

  // Calculate delta-adjusted LERP factor for frame-rate independence
  // Assume 60fps as baseline, adjust lerp factor based on actual frame time
  const deltaAdjustedLerpFactor = Math.min(lerpFactor * (delta * 60), 1.0);
  
  // Calculate LERP movement with delta adjustment
  const lerpPosition = currentPosition.clone().lerp(targetPosition, deltaAdjustedLerpFactor);
  const lerpDistance = currentPosition.distanceTo(lerpPosition);

  // If not using constant speed comparison, just return LERP result
  if (!useConstantSpeed) {
    return lerpPosition;
  }

  // Calculate delta-adjusted constant speed movement
  const deltaAdjustedMoveSpeed = moveSpeed * (delta * 60);
  const constantSpeedDistance = Math.min(deltaAdjustedMoveSpeed, distance);

  // Use whichever method moves us farther
  if (lerpDistance > constantSpeedDistance) {
    // LERP is faster - use it
    return lerpPosition;
  } else {
    // Constant speed is faster - use it
    return currentPosition
      .clone()
      .addScaledVector(positionDelta.normalize(), constantSpeedDistance);
  }
}
