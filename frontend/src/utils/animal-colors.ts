import { useMemo } from "react";
import { Animal, UserInfo } from "shared/types";
import * as THREE from "three";

// Define HSL type
interface HSL {
  h: number;
  s: number;
  l: number;
}

// Base colors for each animal type
export const BASE_ANIMAL_COLORS: Record<Animal, string> = {
  WOLF: "#8A5CF6", // Purple
  DOLPHIN: "#3498DB", // Blue
};

// Generate a hash from user object
export function generateUserHash(user: UserInfo): number {
  // Combining multiple properties to minimize collisions
  const hashInput = `${user.id}-${user.animal}-${user.room}`;

  // Simple but effective hash function
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Generate a color based on the user object
export function getUserColor(user: UserInfo): THREE.Color {
  // Get base color for the animal type
  const baseColor = new THREE.Color(BASE_ANIMAL_COLORS[user.animal]);

  // Use the hash to create slight variations while keeping the color family
  const hash = generateUserHash(user);

  // Adjust hue slightly (±0.1) based on hash
  const hueShift = (hash % 20) / 100 - 0.1; // Range: -0.1 to 0.1

  // Convert to HSL to modify hue
  const hsl: HSL = { h: 0, s: 0, l: 0 };
  baseColor.getHSL(hsl);

  // Modify hue while keeping it in the same general color family
  hsl.h = (hsl.h + hueShift + 1) % 1; // Keep in 0-1 range

  // Adjust saturation slightly
  hsl.s = Math.min(1, Math.max(0.5, hsl.s + (hash % 10) / 100 - 0.05));

  // Return the modified color
  return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
}

// Get the THREE.Color object for an animal with user-specific variation
export function getAnimalColor(user: UserInfo): THREE.Color {
  return getUserColor(user);
}

// Get a matching border/outline color for a user
export function getAnimalBorderColor(user: UserInfo): THREE.Color {
  return getUserColor(user);
}

// Get a lighter version of the animal color for indicators
export function getAnimalIndicatorColor(user: UserInfo): THREE.Color {
  const color = getUserColor(user);
  // Make it slightly lighter
  color.r = Math.min(1, color.r * 1.2);
  color.g = Math.min(1, color.g * 1.2);
  color.b = Math.min(1, color.b * 1.2);
  return color;
}

// Get a color with opacity for glow effects
export function getAnimalGlowColor(
  user: UserInfo,
  opacity: number = 0.7
): string {
  const color = getUserColor(user);
  // Convert to rgba
  return `rgba(${Math.floor(color.r * 255)}, ${Math.floor(
    color.g * 255
  )}, ${Math.floor(color.b * 255)}, ${opacity})`;
}
