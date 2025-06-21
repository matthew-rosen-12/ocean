/**
 * Z-depth constants for consistent rendering order across the game
 * Order from closest to screen (highest values) to farthest away (lowest values)
 */
export declare const Z_DEPTHS: {
    readonly LOCAL_ANIMAL_GRAPHIC: 0.1;
    readonly LOCAL_ANIMAL_OUTLINE: 0.09;
    readonly REMOTE_ANIMAL_GRAPHIC: 0.08;
    readonly REMOTE_ANIMAL_OUTLINE: 0.07;
    readonly PATH_NPC_THROWN: 0.06;
    readonly PATH_NPC_THROWN_OUTLINE: 0.05;
    readonly PATH_NPC_THROWN_GOLD_OUTLINE: 0.045;
    readonly PATH_NPC_RETURNING: 0.04;
    readonly PATH_NPC_RETURNING_OUTLINE: 0.03;
    readonly PATH_NPC_RETURNING_GOLD_OUTLINE: 0.025;
    readonly PATH_NPC_FLEEING: 0.02;
    readonly PATH_NPC_FLEEING_OUTLINE: 0.01;
    readonly PATH_NPC_FLEEING_GOLD_OUTLINE: 0.005;
    readonly CAPTURED_NPC_GROUP: 0;
    readonly CAPTURED_NPC_GROUP_OUTLINE: -0.01;
    readonly CAPTURED_NPC_GROUP_GOLD_OUTLINE: -0.015;
    readonly IDLE_NPC_GROUP: -0.02;
    readonly IDLE_NPC_GROUP_OUTLINE: -0.03;
    readonly IDLE_NPC_GROUP_GOLD_OUTLINE: -0.035;
    readonly TERRAIN: -0.1;
    readonly CLOUDS: -0.2;
};
export declare const RENDER_ORDERS: {
    readonly LOCAL_ANIMAL: 20;
    readonly LOCAL_ANIMAL_OUTLINE: 19;
    readonly REMOTE_ANIMAL: 18;
    readonly REMOTE_ANIMAL_OUTLINE: 17;
    readonly PATH_NPC_THROWN: 16;
    readonly PATH_NPC_THROWN_OUTLINE: 15;
    readonly PATH_NPC_THROWN_GOLD_OUTLINE: 14;
    readonly PATH_NPC_RETURNING: 13;
    readonly PATH_NPC_RETURNING_OUTLINE: 12;
    readonly PATH_NPC_RETURNING_GOLD_OUTLINE: 11;
    readonly PATH_NPC_FLEEING: 10;
    readonly PATH_NPC_FLEEING_OUTLINE: 9;
    readonly PATH_NPC_FLEEING_GOLD_OUTLINE: 8;
    readonly CAPTURED_NPC_GROUP: 7;
    readonly CAPTURED_NPC_GROUP_OUTLINE: 6;
    readonly CAPTURED_NPC_GROUP_GOLD_OUTLINE: 5;
    readonly IDLE_NPC_GROUP: 4;
    readonly IDLE_NPC_GROUP_OUTLINE: 3;
    readonly IDLE_NPC_GROUP_GOLD_OUTLINE: 2;
    readonly TERRAIN: 0;
    readonly CLOUDS: 0;
};
export declare const UI_Z_INDICES: {
    readonly TIMES_UP_TEXT: 1001;
    readonly FLASH_EFFECT: 1000;
    readonly GAME_UI: 999;
};
