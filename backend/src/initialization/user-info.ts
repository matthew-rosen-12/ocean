import { Animal, Direction, Position } from "shared/types";

const DIRECTION_OFFSET = 0.001;
const ANIMALS = ["WOLF", "DOLPHIN", "PENGUIN"];

export function getRandomAnimal(): Animal {
  return ANIMALS[Math.floor(Math.random() * ANIMALS.length)] as Animal;
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
  return { x: 1 + DIRECTION_OFFSET, y: 0 };
}
