import { Vector3 } from "three";

export function getPosition(): Vector3 {
  const x = Math.random() * 20 - 0.5;
  const y = Math.random() * 20 - 1.5;
  return new Vector3(x, y, 0);
}

export function getDirection(): Vector3 {
  return new Vector3(0, 0, 0);
}
