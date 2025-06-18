// Server-side terrain configuration generation

import { TerrainConfig } from "shared/types";


export function generateRoomTerrain(roomId: string): TerrainConfig {
  // Use room ID to seed consistent terrain per room
  const roomHash = simpleHash(roomId);

  // Different terrain sizes based on room hash
  const terrainSizes = [80, 100, 120, 150];
  const gridSize = terrainSizes[roomHash % terrainSizes.length];
  const halfSize = gridSize / 2;

  // Different background types that match our frontend patterns
  const backgroundTypes = ["floral"];
  const backgroundType =
    backgroundTypes[Math.floor(roomHash / 4) % backgroundTypes.length];

  // Generate a seed for pattern randomness (different from roomHash to avoid correlation)
  const patternSeed = simpleHash(roomId + "_pattern");

  return {
    boundaries: {
      minX: -halfSize,
      maxX: halfSize,
      minY: -halfSize,
      maxY: halfSize,
      width: gridSize,
      height: gridSize,
    },
    gridSize,
    walls: null,
    backgroundType,
    seed: patternSeed,
    width: gridSize,
    height: gridSize,
    cellSize: 1,
  };
}

// Simple hash function for consistent room-based generation
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
