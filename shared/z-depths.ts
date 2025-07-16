/**
 * Z-depth constants for consistent rendering order across the game
 * Order from closest to screen (highest values) to farthest away (lowest values)
 */

export const Z_DEPTHS = {
  // All game objects at same z-depth - use render order for layering
  LOCAL_ANIMAL_GRAPHIC: 0,
  LOCAL_ANIMAL_OUTLINE: 0,
  
  REMOTE_ANIMAL_GRAPHIC: 0,
  REMOTE_ANIMAL_OUTLINE: 0,
  
  PATH_NPC_THROWN: 0,
  PATH_NPC_THROWN_OUTLINE: 0,
  PATH_NPC_THROWN_GOLD_OUTLINE: 0,
  
  PATH_NPC_RETURNING: 0,
  PATH_NPC_RETURNING_OUTLINE: 0,
  PATH_NPC_RETURNING_GOLD_OUTLINE: 0,
  
  PATH_NPC_FLEEING: 0,
  PATH_NPC_FLEEING_OUTLINE: 0,
  PATH_NPC_FLEEING_GOLD_OUTLINE: 0,
  
  CAPTURED_NPC_GROUP: 0,
  CAPTURED_NPC_GROUP_OUTLINE: 0,
  CAPTURED_NPC_GROUP_GOLD_OUTLINE: 0,
  
  IDLE_NPC_GROUP: 0,
  IDLE_NPC_GROUP_OUTLINE: 0,
  IDLE_NPC_GROUP_GOLD_OUTLINE: 0,
  
  // Background elements behind everything
  TERRAIN: -0.1,
  CLOUDS: -0.2,
} as const;

export const RENDER_ORDERS = {
  // Lower numbers = draw first (behind), Higher numbers = draw last (in front)
  
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
  
  // Captured NPC groups  
  CAPTURED_NPC_GROUP_GOLD_OUTLINE: 31,
  CAPTURED_NPC_GROUP_OUTLINE: 32,
  CAPTURED_NPC_GROUP: 33,
  
  // Path NPCs in fleeing state
  PATH_NPC_FLEEING_GOLD_OUTLINE: 41,
  PATH_NPC_FLEEING_OUTLINE: 42,
  PATH_NPC_FLEEING: 43,
  
  // Path NPCs in returning state
  PATH_NPC_RETURNING_GOLD_OUTLINE: 51,
  PATH_NPC_RETURNING_OUTLINE: 52,
  PATH_NPC_RETURNING: 53,
  
  // Path NPCs in thrown state
  PATH_NPC_THROWN_GOLD_OUTLINE: 61,
  PATH_NPC_THROWN_OUTLINE: 62,
  PATH_NPC_THROWN: 63,
  
  // Local player animal (draw last - on top)
  LOCAL_ANIMAL_OUTLINE: 100,
  LOCAL_ANIMAL_GRAPHIC: 101,
} as const;

export const UI_Z_INDICES = {
  TIMES_UP_TEXT: 1001,
  FLASH_EFFECT: 1000,
  GAME_UI: 999,
} as const;