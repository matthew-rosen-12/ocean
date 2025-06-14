import { Animal, Direction, Position } from "shared/types";

export const DIRECTION_OFFSET = 0.001;
const ANIMALS = ["DOLPHIN", "WOLF"];
export const ANIMAL_SCALES: Record<Animal, number> = {
  DOLPHIN: 3.0,
  WOLF: 1.0,
};

export function getRandomAnimal(): Animal {
  return ANIMALS[Math.floor(Math.random() * ANIMALS.length)] as Animal;
}

export function generateGuestId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function getPosition(): Position {
  const x = Math.random() * 2 - 0.5;
  const y = Math.random() * 2 - 1.5;
  return { x, y };
}

export function getDirection(): Direction {
  return { x: 1 + DIRECTION_OFFSET, y: 0 };
}
