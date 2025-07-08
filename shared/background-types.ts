/**
 * Background types and utilities for terrain generation
 */

// Primary background types
export enum BackgroundType {
  FLORAL = "floral",
  COSMIC = "cosmic",
  MOSAIC = "mosaic",
  SNOWFLAKE = "snowflake"
}

// Union type for all valid background strings (primary + aliases)
export type BackgroundString = BackgroundType;

// Array of all valid background strings for validation
export const ALL_BACKGROUND_STRINGS: BackgroundString[] = [
  ...Object.values(BackgroundType),
] as BackgroundString[];

/**
 * Normalizes a background string to its primary BackgroundType
 * @param background - The background string to normalize
 * @returns The primary BackgroundType
 */
export function normalizeBackgroundType(background: BackgroundString): BackgroundType {
  if (Object.values(BackgroundType).includes(background as BackgroundType)) {
    return background as BackgroundType;
  }
  
  // Fallback to floral if invalid
  return BackgroundType.FLORAL;
}

/**
 * Validates if a string is a valid background type
 * @param background - The string to validate
 * @returns True if valid background type
 */
export function isValidBackgroundType(background: string): background is BackgroundString {
  return ALL_BACKGROUND_STRINGS.includes(background as BackgroundString);
}

/**
 * Gets all primary background types as an array
 * @returns Array of primary BackgroundType values
 */
export function getPrimaryBackgroundTypes(): BackgroundType[] {
  return Object.values(BackgroundType);
}