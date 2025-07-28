"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// z-depths.ts
var z_depths_exports = {};
__export(z_depths_exports, {
  RENDER_ORDERS: () => RENDER_ORDERS,
  UI_Z_INDICES: () => UI_Z_INDICES,
  Z_DEPTHS: () => Z_DEPTHS
});
module.exports = __toCommonJS(z_depths_exports);
var RENDER_ORDERS = {
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
  LOCAL_ANIMAL_GRAPHIC: 101
};
var calculateZDepth = (renderOrder) => {
  return -(102 - renderOrder) * 0.01;
};
var Z_DEPTHS = {
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
  LOCAL_ANIMAL_OUTLINE: calculateZDepth(RENDER_ORDERS.LOCAL_ANIMAL_OUTLINE)
};
var UI_Z_INDICES = {
  TIMES_UP_TEXT: 1001,
  FLASH_EFFECT: 1e3,
  GAME_UI: 999
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RENDER_ORDERS,
  UI_Z_INDICES,
  Z_DEPTHS
});
