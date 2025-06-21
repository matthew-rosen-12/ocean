import { pathData } from "shared/types";
import * as THREE from "three";

/**
 * Calculate the current position of an NPC along its path
 */
export function calculatePathPosition(pathData: pathData, currentTime: number): THREE.Vector3 {
  // Calculate elapsed time in seconds
  const elapsedTime = (currentTime - pathData.timestamp) / 1000;
  const pathDurationSec = pathData.pathDuration / 1000;
  const progress = Math.min(elapsedTime / pathDurationSec, 1);

  let position: THREE.Vector3;

  // If we've reached the end of the path, use exact same calculation as server
  if (progress >= 1) {
    const finalDistance = pathData.velocity * pathDurationSec;
    position = new THREE.Vector3(
      pathData.startPosition.x + pathData.direction.x * finalDistance,
      pathData.startPosition.y + pathData.direction.y * finalDistance,
      0
    );
  } else {
    // For animation, calculate intermediate position
    const distance = pathData.velocity * elapsedTime;
    position = new THREE.Vector3(
      pathData.startPosition.x + pathData.direction.x * distance,
      pathData.startPosition.y + pathData.direction.y * distance,
      0
    );
  }

  return position;
}