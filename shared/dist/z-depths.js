/**
 * Z-depth constants for consistent rendering order across the game
 * Order from closest to screen (highest values) to farthest away (lowest values)
 */
export const Z_DEPTHS = {
    // Closest to screen - Local user's animal
    LOCAL_ANIMAL_GRAPHIC: 0.10,
    LOCAL_ANIMAL_OUTLINE: 0.09,
    // Non-local user's animal  
    REMOTE_ANIMAL_GRAPHIC: 0.08,
    REMOTE_ANIMAL_OUTLINE: 0.07,
    // Path NPC in thrown state
    PATH_NPC_THROWN: 0.06,
    PATH_NPC_THROWN_OUTLINE: 0.05,
    PATH_NPC_THROWN_GOLD_OUTLINE: 0.045,
    // Path NPC in returning state
    PATH_NPC_RETURNING: 0.04,
    PATH_NPC_RETURNING_OUTLINE: 0.03,
    PATH_NPC_RETURNING_GOLD_OUTLINE: 0.025,
    // Path NPC in fleeing phase
    PATH_NPC_FLEEING: 0.02,
    PATH_NPC_FLEEING_OUTLINE: 0.01,
    PATH_NPC_FLEEING_GOLD_OUTLINE: 0.005,
    // Captured NPC group
    CAPTURED_NPC_GROUP: 0.00,
    CAPTURED_NPC_GROUP_OUTLINE: -0.01,
    CAPTURED_NPC_GROUP_GOLD_OUTLINE: -0.015,
    // Idle NPC group - Farthest from screen (background elements)
    IDLE_NPC_GROUP: -0.02,
    IDLE_NPC_GROUP_OUTLINE: -0.03,
    IDLE_NPC_GROUP_GOLD_OUTLINE: -0.035,
    // Background elements
    TERRAIN: -0.1,
    CLOUDS: -0.2,
};
export const RENDER_ORDERS = {
    // Local player animals get highest render order
    LOCAL_ANIMAL: 20,
    LOCAL_ANIMAL_OUTLINE: 19,
    // Remote player animals
    REMOTE_ANIMAL: 18,
    REMOTE_ANIMAL_OUTLINE: 17,
    // Path NPCs in different states
    PATH_NPC_THROWN: 16,
    PATH_NPC_THROWN_OUTLINE: 15,
    PATH_NPC_THROWN_GOLD_OUTLINE: 14,
    PATH_NPC_RETURNING: 13,
    PATH_NPC_RETURNING_OUTLINE: 12,
    PATH_NPC_RETURNING_GOLD_OUTLINE: 11,
    PATH_NPC_FLEEING: 10,
    PATH_NPC_FLEEING_OUTLINE: 9,
    PATH_NPC_FLEEING_GOLD_OUTLINE: 8,
    // NPC groups
    CAPTURED_NPC_GROUP: 7,
    CAPTURED_NPC_GROUP_OUTLINE: 6,
    CAPTURED_NPC_GROUP_GOLD_OUTLINE: 5,
    IDLE_NPC_GROUP: 4,
    IDLE_NPC_GROUP_OUTLINE: 3,
    IDLE_NPC_GROUP_GOLD_OUTLINE: 2,
    // Background elements
    TERRAIN: 0,
    CLOUDS: 0,
};
export const UI_Z_INDICES = {
    TIMES_UP_TEXT: 1001,
    FLASH_EFFECT: 1000,
    GAME_UI: 999,
};
