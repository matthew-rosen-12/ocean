/**
 * Z-depth constants for consistent rendering order across the game.
 * This file establishes a clear and manageable system for layering 2D-style
 * elements in a 3D space, preventing z-fighting issues.
 */

// =================================================================
// 1. RENDER ORDERS
// =================================================================
/**
 * Defines the drawing order of different game elements.
 * Lower numbers are drawn first (appearing behind).
 * Higher numbers are drawn last (appearing in front).
 * These are abstract "layer" indices, not direct z-depth values.
 */
export const RENDER_ORDERS = {
  // Background elements (draw first)
  CLOUDS: 0,
  TERRAIN: 1,
  TERRAIN_OUTLINE: 2,
  
  // Idle NPC groups
  IDLE_NPC_GROUP_GOLD_OUTLINE: 11,
  IDLE_NPC_GROUP_OUTLINE: 12,
  IDLE_NPC_GROUP: 13,
  
  // Remote animals (including bots)
  REMOTE_ANIMAL_OUTLINE: 21,
  REMOTE_ANIMAL_GRAPHIC: 22,
  
  // Captured NPC groups - remote players
  REMOTE_CAPTURED_NPC_GROUP_GOLD_OUTLINE: 31,
  REMOTE_CAPTURED_NPC_GROUP_OUTLINE: 32,
  REMOTE_CAPTURED_NPC_GROUP: 33,
  
  // Path NPCs in fleeing state
  PATH_NPC_FLEEING_GOLD_OUTLINE: 41,
  PATH_NPC_FLEEING_OUTLINE: 42,
  PATH_NPC_FLEEING: 43,
  
  // Path NPCs in returning state
  PATH_NPC_RETURNING_GOLD_OUTLINE: 51,
  PATH_NPC_RETURNING_OUTLINE: 52,
  PATH_NPC_RETURNING: 53,
  
  // Path NPCs in thrown state
  PATH_NPC_THROWN_GOLD_OUTLINE: 64,
  PATH_NPC_THROWN_OUTLINE: 65,
  PATH_NPC_THROWN: 66,
  
  // Captured NPC groups - local player (higher priority)
  LOCAL_CAPTURED_NPC_GROUP_GOLD_OUTLINE: 61,
  LOCAL_CAPTURED_NPC_GROUP_OUTLINE: 62,
  LOCAL_CAPTURED_NPC_GROUP: 63,
  
  // Local player animal (draw last - on top)
  LOCAL_ANIMAL_OUTLINE: 100,
  LOCAL_ANIMAL_GRAPHIC: 101,
} as const;


// =================================================================
// 2. Z-DEPTH CALCULATION
// =================================================================
/**
 * Calculates the z-depth for a given render order.
 * In three.js, the camera looks down the negative Z-axis.
 * - More negative values are further away from the camera.
 * - Less negative values (closer to 0) are closer to the camera.
 *
 * This formula converts a high render order (e.g., 101) to a z-depth
 * close to zero (e.g., -0.1), and a low render order (e.g., 0) to a
 * more negative z-depth (e.g., -10.2).
 *
 * The multiplier (0.1) provides significant separation between layers
 * to prevent z-fighting.
 *
 * @param renderOrder The render order value from the RENDER_ORDERS object.
 * @returns The calculated negative z-depth for the object's position.
 */
const calculateZDepth = (renderOrder: number): number => {
  return -(102 - renderOrder) * 0.01;
};


// =================================================================
// 3. Z-DEPTH CONSTANTS
// =================================================================
/**
 * The final, calculated z-depth values to be used for object positions.
 * These are generated functionally from the RENDER_ORDERS.
 *
 * Example:
 * - LOCAL_ANIMAL_GRAPHIC (order 101) -> z = -0.1 (closest to camera)
 * - LOCAL_ANIMAL_OUTLINE (order 100) -> z = -0.2 (just behind the graphic)
 * - CLOUDS (order 0) -> z = -10.2 (farthest from camera)
 */
export const Z_DEPTHS = {
  // Background elements (farthest from camera)
  CLOUDS: calculateZDepth(RENDER_ORDERS.CLOUDS),
  TERRAIN: calculateZDepth(RENDER_ORDERS.TERRAIN),
  TERRAIN_OUTLINE: calculateZDepth(RENDER_ORDERS.TERRAIN_OUTLINE),
  
  // Idle NPC groups
  IDLE_NPC_GROUP: calculateZDepth(RENDER_ORDERS.IDLE_NPC_GROUP),
  IDLE_NPC_GROUP_OUTLINE: calculateZDepth(RENDER_ORDERS.IDLE_NPC_GROUP_OUTLINE),
  IDLE_NPC_GROUP_GOLD_OUTLINE: calculateZDepth(RENDER_ORDERS.IDLE_NPC_GROUP_GOLD_OUTLINE),
  
  // Remote animals
  REMOTE_ANIMAL_GRAPHIC: calculateZDepth(RENDER_ORDERS.REMOTE_ANIMAL_GRAPHIC),
  REMOTE_ANIMAL_OUTLINE: calculateZDepth(RENDER_ORDERS.REMOTE_ANIMAL_OUTLINE),
  
  // Captured NPC groups - remote players
  REMOTE_CAPTURED_NPC_GROUP: calculateZDepth(RENDER_ORDERS.REMOTE_CAPTURED_NPC_GROUP),
  REMOTE_CAPTURED_NPC_GROUP_OUTLINE: calculateZDepth(RENDER_ORDERS.REMOTE_CAPTURED_NPC_GROUP_OUTLINE),
  REMOTE_CAPTURED_NPC_GROUP_GOLD_OUTLINE: calculateZDepth(RENDER_ORDERS.REMOTE_CAPTURED_NPC_GROUP_GOLD_OUTLINE),
  
  // Path NPCs in fleeing state
  PATH_NPC_FLEEING: calculateZDepth(RENDER_ORDERS.PATH_NPC_FLEEING),
  PATH_NPC_FLEEING_OUTLINE: calculateZDepth(RENDER_ORDERS.PATH_NPC_FLEEING_OUTLINE),
  PATH_NPC_FLEEING_GOLD_OUTLINE: calculateZDepth(RENDER_ORDERS.PATH_NPC_FLEEING_GOLD_OUTLINE),
  
  // Path NPCs in returning state
  PATH_NPC_RETURNING: calculateZDepth(RENDER_ORDERS.PATH_NPC_RETURNING),
  PATH_NPC_RETURNING_OUTLINE: calculateZDepth(RENDER_ORDERS.PATH_NPC_RETURNING_OUTLINE),
  PATH_NPC_RETURNING_GOLD_OUTLINE: calculateZDepth(RENDER_ORDERS.PATH_NPC_RETURNING_GOLD_OUTLINE),
  
  // Path NPCs in thrown state
  PATH_NPC_THROWN: calculateZDepth(RENDER_ORDERS.PATH_NPC_THROWN),
  PATH_NPC_THROWN_OUTLINE: calculateZDepth(RENDER_ORDERS.PATH_NPC_THROWN_OUTLINE),
  PATH_NPC_THROWN_GOLD_OUTLINE: calculateZDepth(RENDER_ORDERS.PATH_NPC_THROWN_GOLD_OUTLINE),
  
  // Captured NPC groups - local player
  LOCAL_CAPTURED_NPC_GROUP: calculateZDepth(RENDER_ORDERS.LOCAL_CAPTURED_NPC_GROUP),
  LOCAL_CAPTURED_NPC_GROUP_OUTLINE: calculateZDepth(RENDER_ORDERS.LOCAL_CAPTURED_NPC_GROUP_OUTLINE),
  LOCAL_CAPTURED_NPC_GROUP_GOLD_OUTLINE: calculateZDepth(RENDER_ORDERS.LOCAL_CAPTURED_NPC_GROUP_GOLD_OUTLINE),
  
  // Local player animal (closest to camera)
  LOCAL_ANIMAL_GRAPHIC: calculateZDepth(RENDER_ORDERS.LOCAL_ANIMAL_GRAPHIC),
  LOCAL_ANIMAL_OUTLINE: calculateZDepth(RENDER_ORDERS.LOCAL_ANIMAL_OUTLINE),
} as const;


// =================================================================
// 4. UI Z-INDICES
// =================================================================
/**
 * Standard CSS z-index values for HTML UI elements that overlay the canvas.
 * These do not affect the three.js rendering context.
 */
export const UI_Z_INDICES = {
  TIMES_UP_TEXT: 1001,
  FLASH_EFFECT: 1000,
  GAME_UI: 999,
} as const;