import { Direction, Position } from "shared/types";

export function getInitialPosition(): Position {
  const x = Math.random() * 20 - 0.5;
  const y = Math.random() * 20 - 1.5;
  return { x, y };
}

export function getInitialDirection(): Direction {
  return { x: 0, y: 0 };
}
