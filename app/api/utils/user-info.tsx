import { Vector3 } from "three";

const ANIMALS = ["dolphin", "wolf"];

export function getRandomAnimal(): string {
  return ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
}

export function generateGuestId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function getPosition(): Vector3 {
  const x = Math.random() * 2 - 0.5;
  const y = Math.random() * 2 - 1.5;
  return new Vector3(x, y, 0);
}
