import { Vector3 } from "three";

export function getPosition(): Vector3 {
  const x = Math.random() * 4 - 0.5;
  const y = Math.random() * 4 - 1.5;
  return new Vector3(x, y, 0);
}

export function getDirection(): Vector3 {
  // Pick a random number 0-3 to select a cardinal direction
  return new Vector3(0, 0, 0);
}
