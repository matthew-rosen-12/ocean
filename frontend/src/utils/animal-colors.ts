import { UserInfo } from "shared/types";
import * as THREE from "three";

// Fixed palette of 8 distinct colors for up to 8 users
export const USER_COLOR_PALETTE: string[] = [
  "#FF0000", // Red
  "#00FF00", // Teal
  "#0000FF", // Blue
  "#FF00FF", // Green
  "#00FFFF", // Yellow
  "#800080", // Pink
  "#FFA500", // Light Green
  "#008000", // Plum
];

// Generate a hash from user ID to consistently assign colors
export function generateUserHash(user: UserInfo): number {
  // Use user ID for consistent color assignment
  const hashInput = user.id;

  // Simple but effective hash function
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Generate a color based on the user object using fixed palette
export function getUserColor(user: UserInfo): THREE.Color {
  // Use hash to get a consistent color index for this user
  const hash = generateUserHash(user);
  const colorIndex = hash % USER_COLOR_PALETTE.length;
  
  return new THREE.Color(USER_COLOR_PALETTE[colorIndex]);
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
  const color = getUserColor(user).clone(); // Clone to avoid modifying the original
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
