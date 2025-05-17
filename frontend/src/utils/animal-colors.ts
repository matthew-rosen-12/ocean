import { Animal } from "./types";
import * as THREE from "three";

// Define colors for each animal type
export const ANIMAL_COLORS: Record<Animal, string> = {
  WOLF: "#8A5CF6", // Purple
  DOLPHIN: "#3498DB", // Blue
};

// Get the THREE.Color object for an animal
export function getAnimalColor(animal: Animal): THREE.Color {
  return new THREE.Color(ANIMAL_COLORS[animal]);
}

// Get a matching border/outline color for an animal
export function getAnimalBorderColor(animal: Animal): THREE.Color {
  return new THREE.Color(ANIMAL_COLORS[animal]);
}

// Get a lighter version of the animal color for indicators
export function getAnimalIndicatorColor(animal: Animal): THREE.Color {
  const color = new THREE.Color(ANIMAL_COLORS[animal]);
  // Make it slightly lighter
  color.r = Math.min(1, color.r * 1.2);
  color.g = Math.min(1, color.g * 1.2);
  color.b = Math.min(1, color.b * 1.2);
  return color;
}

// Get a color with opacity for glow effects
export function getAnimalGlowColor(
  animal: Animal,
  opacity: number = 0.7
): string {
  const colorHex = ANIMAL_COLORS[animal];
  // Convert hex to rgba
  const r = parseInt(colorHex.slice(1, 3), 16);
  const g = parseInt(colorHex.slice(3, 5), 16);
  const b = parseInt(colorHex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
