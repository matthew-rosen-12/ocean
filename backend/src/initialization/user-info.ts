import { Animal, Direction, Position, BACKEND_DIRECTION_OFFSET } from "shared/types";

export function getRandomAnimal(): Animal {
  return Object.values(Animal)[Math.floor(Math.random() * Object.values(Animal).length)];
}

export function generateGuestId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function getInitialPosition(): Position {
  const x = Math.random() * 2 - 0.5;
  const y = Math.random() * 2 - 1.5;
  return {x, y};
}

export function getInitialDirection(): Direction {
  return { x: 1 + BACKEND_DIRECTION_OFFSET, y: 0 };
}
