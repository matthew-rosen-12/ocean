/**
 * Z-depth constants for consistent rendering order across the game.
 * This file establishes a clear and manageable system for layering 2D-style
 * elements in a 3D space, preventing z-fighting issues.
 */
/**
 * Defines the drawing order of different game elements.
 * Lower numbers are drawn first (appearing behind).
 * Higher numbers are drawn last (appearing in front).
 * These are abstract "layer" indices, not direct z-depth values.
 */
declare const RENDER_ORDERS: {
    readonly CLOUDS: 0;
    readonly TERRAIN: 1;
    readonly TERRAIN_OUTLINE: 2;
    readonly IDLE_NPC_GROUP_GOLD_OUTLINE: 11;
    readonly IDLE_NPC_GROUP_OUTLINE: 12;
    readonly IDLE_NPC_GROUP: 13;
    readonly REMOTE_ANIMAL_OUTLINE: 21;
    readonly REMOTE_ANIMAL_GRAPHIC: 22;
    readonly REMOTE_CAPTURED_NPC_GROUP_GOLD_OUTLINE: 31;
    readonly REMOTE_CAPTURED_NPC_GROUP_OUTLINE: 32;
    readonly REMOTE_CAPTURED_NPC_GROUP: 33;
    readonly PATH_NPC_FLEEING_GOLD_OUTLINE: 41;
    readonly PATH_NPC_FLEEING_OUTLINE: 42;
    readonly PATH_NPC_FLEEING: 43;
    readonly PATH_NPC_RETURNING_GOLD_OUTLINE: 51;
    readonly PATH_NPC_RETURNING_OUTLINE: 52;
    readonly PATH_NPC_RETURNING: 53;
    readonly PATH_NPC_THROWN_GOLD_OUTLINE: 64;
    readonly PATH_NPC_THROWN_OUTLINE: 65;
    readonly PATH_NPC_THROWN: 66;
    readonly LOCAL_CAPTURED_NPC_GROUP_GOLD_OUTLINE: 61;
    readonly LOCAL_CAPTURED_NPC_GROUP_OUTLINE: 62;
    readonly LOCAL_CAPTURED_NPC_GROUP: 63;
    readonly LOCAL_ANIMAL_OUTLINE: 100;
    readonly LOCAL_ANIMAL_GRAPHIC: 101;
};
/**
 * The final, calculated z-depth values to be used for object positions.
 * These are generated functionally from the RENDER_ORDERS.
 *
 * Example:
 * - LOCAL_ANIMAL_GRAPHIC (order 101) -> z = -0.1 (closest to camera)
 * - LOCAL_ANIMAL_OUTLINE (order 100) -> z = -0.2 (just behind the graphic)
 * - CLOUDS (order 0) -> z = -10.2 (farthest from camera)
 */
declare const Z_DEPTHS: {
    readonly CLOUDS: number;
    readonly TERRAIN: number;
    readonly TERRAIN_OUTLINE: number;
    readonly IDLE_NPC_GROUP: number;
    readonly IDLE_NPC_GROUP_OUTLINE: number;
    readonly IDLE_NPC_GROUP_GOLD_OUTLINE: number;
    readonly REMOTE_ANIMAL_GRAPHIC: number;
    readonly REMOTE_ANIMAL_OUTLINE: number;
    readonly REMOTE_CAPTURED_NPC_GROUP: number;
    readonly REMOTE_CAPTURED_NPC_GROUP_OUTLINE: number;
    readonly REMOTE_CAPTURED_NPC_GROUP_GOLD_OUTLINE: number;
    readonly PATH_NPC_FLEEING: number;
    readonly PATH_NPC_FLEEING_OUTLINE: number;
    readonly PATH_NPC_FLEEING_GOLD_OUTLINE: number;
    readonly PATH_NPC_RETURNING: number;
    readonly PATH_NPC_RETURNING_OUTLINE: number;
    readonly PATH_NPC_RETURNING_GOLD_OUTLINE: number;
    readonly PATH_NPC_THROWN: number;
    readonly PATH_NPC_THROWN_OUTLINE: number;
    readonly PATH_NPC_THROWN_GOLD_OUTLINE: number;
    readonly LOCAL_CAPTURED_NPC_GROUP: number;
    readonly LOCAL_CAPTURED_NPC_GROUP_OUTLINE: number;
    readonly LOCAL_CAPTURED_NPC_GROUP_GOLD_OUTLINE: number;
    readonly LOCAL_ANIMAL_GRAPHIC: number;
    readonly LOCAL_ANIMAL_OUTLINE: number;
};
/**
 * Standard CSS z-index values for HTML UI elements that overlay the canvas.
 * These do not affect the three.js rendering context.
 */
declare const UI_Z_INDICES: {
    readonly TIMES_UP_TEXT: 1001;
    readonly FLASH_EFFECT: 1000;
    readonly GAME_UI: 999;
};

export { RENDER_ORDERS, UI_Z_INDICES, Z_DEPTHS };
