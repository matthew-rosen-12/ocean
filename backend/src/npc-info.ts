import { Direction, Position } from "shared/types";

export function getPosition(): Position {
  const x = Math.random() * 20 - 0.5;
  const y = Math.random() * 20 - 1.5;
  return { x, y };
}

export function getDirection(): Direction {
  return { x: 0, y: 0 };
}
