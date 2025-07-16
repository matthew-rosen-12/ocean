/**
 * Z-depth constants for consistent rendering order across the game
 * Order from closest to screen (highest values) to farthest away (lowest values)
 */
export declare const Z_DEPTHS: {
    readonly LOCAL_ANIMAL_GRAPHIC: 0;
    readonly LOCAL_ANIMAL_OUTLINE: 0;
    readonly REMOTE_ANIMAL_GRAPHIC: 0;
    readonly REMOTE_ANIMAL_OUTLINE: 0;
    readonly PATH_NPC_THROWN: 0;
    readonly PATH_NPC_THROWN_OUTLINE: 0;
    readonly PATH_NPC_THROWN_GOLD_OUTLINE: 0;
    readonly PATH_NPC_RETURNING: 0;
    readonly PATH_NPC_RETURNING_OUTLINE: 0;
    readonly PATH_NPC_RETURNING_GOLD_OUTLINE: 0;
    readonly PATH_NPC_FLEEING: 0;
    readonly PATH_NPC_FLEEING_OUTLINE: 0;
    readonly PATH_NPC_FLEEING_GOLD_OUTLINE: 0;
    readonly CAPTURED_NPC_GROUP: 0;
    readonly CAPTURED_NPC_GROUP_OUTLINE: 0;
    readonly CAPTURED_NPC_GROUP_GOLD_OUTLINE: 0;
    readonly IDLE_NPC_GROUP: 0;
    readonly IDLE_NPC_GROUP_OUTLINE: 0;
    readonly IDLE_NPC_GROUP_GOLD_OUTLINE: 0;
    readonly TERRAIN: -0.1;
    readonly CLOUDS: -0.2;
};
export declare const RENDER_ORDERS: {
    readonly CLOUDS: 0;
    readonly TERRAIN: 1;
    readonly TERRAIN_OUTLINE: 2;
    readonly IDLE_NPC_GROUP_GOLD_OUTLINE: 11;
    readonly IDLE_NPC_GROUP_OUTLINE: 12;
    readonly IDLE_NPC_GROUP: 13;
    readonly REMOTE_ANIMAL_OUTLINE: 21;
    readonly REMOTE_ANIMAL_GRAPHIC: 22;
    readonly CAPTURED_NPC_GROUP_GOLD_OUTLINE: 31;
    readonly CAPTURED_NPC_GROUP_OUTLINE: 32;
    readonly CAPTURED_NPC_GROUP: 33;
    readonly PATH_NPC_FLEEING_GOLD_OUTLINE: 41;
    readonly PATH_NPC_FLEEING_OUTLINE: 42;
    readonly PATH_NPC_FLEEING: 43;
    readonly PATH_NPC_RETURNING_GOLD_OUTLINE: 51;
    readonly PATH_NPC_RETURNING_OUTLINE: 52;
    readonly PATH_NPC_RETURNING: 53;
    readonly PATH_NPC_THROWN_GOLD_OUTLINE: 61;
    readonly PATH_NPC_THROWN_OUTLINE: 62;
    readonly PATH_NPC_THROWN: 63;
    readonly LOCAL_ANIMAL_OUTLINE: 101;
    readonly LOCAL_ANIMAL_GRAPHIC: 102;
};
export declare const UI_Z_INDICES: {
    readonly TIMES_UP_TEXT: 1001;
    readonly FLASH_EFFECT: 1000;
    readonly GAME_UI: 999;
};
