import { UserInfo, Animal } from "shared/types";
import * as THREE from "three";

// Fixed palette of distinct colors
export const USER_COLOR_PALETTE: string[] = [
  "#FF0000", // Red
  "#00FF00", // Green
  "#0000FF", // Blue
  "#00FFFF", // Cyan
  "#FF00FF", // Magenta
  "#000000",
  "#FFFFFF",
  "#800080", // Purple
];

// Generate a hash from a string
function generateStringHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

const ALL_ANIMALS = Object.values(Animal)

// Generate a color based on animal type and room, ensuring no collisions within a room
export function getUserColor(user: UserInfo): THREE.Color {
  // Get the index of this animal in the sorted list
  const animalIndex = ALL_ANIMALS.indexOf(user.animal);
  
  // Generate a room-specific offset based on room name hash
  const roomOffset = generateStringHash(user.room);
  
  // Calculate the color index: animal index + room offset, wrapped around palette size
  const colorIndex = (animalIndex + roomOffset) % USER_COLOR_PALETTE.length;
  
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

// Get the appropriate outline color (white or black) based on animal color brightness
export function getNicknameOutlineColor(user: UserInfo): THREE.Color {
  const animalColor = getUserColor(user);
  
  // Calculate luminance using the relative luminance formula
  const luminance = 0.299 * animalColor.r + 0.587 * animalColor.g + 0.114 * animalColor.b;
  
  // Use white outline for dark colors, black outline for light colors
  return luminance < 0.5 ? new THREE.Color('#FFFFFF') : new THREE.Color('#000000');
}
