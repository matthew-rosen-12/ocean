import { Vector3 } from "three";
import { DIRECTION_OFFSET } from "./user-info";

export function getPosition(): Vector3 {
  const x = Math.random() * 2 - 0.5;
  const y = Math.random() * 2 - 1.5;
  return new Vector3(x, y, 0);
}

export function getDirection(): Vector3 {
  // Pick a random number 0-3 to select a cardinal direction

  const direction = Math.floor(Math.random() * 4);

  switch (direction) {
    case 0: // Right
      return new Vector3(1 + DIRECTION_OFFSET, 0, 0);
    case 1: // Left
      return new Vector3(-1 - DIRECTION_OFFSET, 0, 0);
    case 2: // Up
      return new Vector3(0, 1 + DIRECTION_OFFSET, 0);
    case 3: // Down
      return new Vector3(0, -1 - DIRECTION_OFFSET, 0);
    default:
      return new Vector3(1 + DIRECTION_OFFSET, 0, 0); // Default to right
  }
}
