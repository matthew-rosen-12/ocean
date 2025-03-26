import { Animal } from "@/app/utils/types/user";
import { Vector3 } from "three";

export const DIRECTION_OFFSET = 0.01;
const ANIMALS = ["dolphin", "wolf"];
export const ANIMAL_SCALES: Record<Animal, number> = {
  dolphin: 3.0,
  wolf: 1.0,
};

export function getRandomAnimal(): Animal {
  return ANIMALS[Math.floor(Math.random() * ANIMALS.length)] as Animal;
}

export function generateGuestId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function getPosition(): Vector3 {
  const x = Math.random() * 2 - 0.5;
  const y = Math.random() * 2 - 1.5;
  return new Vector3(x, y, 0);
}

export function getDirection(): Vector3 {
  // Pick a random number 0-3 to select a cardinal direction
  return new Vector3(1 + DIRECTION_OFFSET, 0, 0);
}
