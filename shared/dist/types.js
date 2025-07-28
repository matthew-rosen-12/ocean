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

// types.ts
var types_exports = {};
__export(types_exports, {
  ANIMAL_ORIENTATION: () => ANIMAL_ORIENTATION,
  ANIMAL_SCALES: () => ANIMAL_SCALES,
  Animal: () => Animal,
  BACKEND_DIRECTION_OFFSET: () => BACKEND_DIRECTION_OFFSET,
  DIRECTION_OFFSET: () => DIRECTION_OFFSET,
  DefaultMap: () => DefaultMap,
  NPCGroup: () => NPCGroup,
  NPCGroupsBiMap: () => NPCGroupsBiMap,
  NPCPhase: () => NPCPhase,
  NPC_HEIGHT: () => NPC_HEIGHT,
  NPC_WIDTH: () => NPC_WIDTH,
  PathPhase: () => PathPhase
});
module.exports = __toCommonJS(types_exports);
var Animal = /* @__PURE__ */ ((Animal2) => {
  Animal2["DOLPHIN"] = "DOLPHIN";
  Animal2["WOLF"] = "WOLF";
  Animal2["PENGUIN"] = "PENGUIN";
  Animal2["SNAKE"] = "SNAKE";
  Animal2["TURTLE"] = "TURTLE";
  Animal2["TIGER"] = "TIGER";
  Animal2["TUNA"] = "TUNA";
  Animal2["EAGLE"] = "EAGLE";
  Animal2["BEE"] = "BEE";
  Animal2["BEAR"] = "BEAR";
  Animal2["CUTTLEFISH"] = "CUTTLEFISH";
  Animal2["SALAMANDER"] = "SALAMANDER";
  return Animal2;
})(Animal || {});
var ANIMAL_SCALES = {
  DOLPHIN: 3,
  WOLF: 2,
  PENGUIN: 2.5,
  SNAKE: 2,
  TURTLE: 2,
  TIGER: 4,
  TUNA: 3,
  EAGLE: 2.5,
  BEE: 2,
  BEAR: 2.5,
  CUTTLEFISH: 2,
  SALAMANDER: 2.5
};
var ANIMAL_ORIENTATION = {
  WOLF: { rotation: 0, flipY: true },
  DOLPHIN: { rotation: 0, flipY: false },
  PENGUIN: { rotation: 0, flipY: false },
  SNAKE: { rotation: 0, flipY: true },
  TURTLE: { rotation: 0, flipY: true },
  TIGER: { rotation: 0, flipY: false },
  TUNA: { rotation: 0, flipY: false },
  EAGLE: { rotation: 0, flipY: false },
  BEE: { rotation: 0, flipY: true },
  BEAR: { rotation: 0, flipY: false },
  CUTTLEFISH: { rotation: 0, flipY: true },
  SALAMANDER: { rotation: 0, flipY: false }
};
var DIRECTION_OFFSET = 0.1;
var BACKEND_DIRECTION_OFFSET = 1e-3;
var NPC_WIDTH = 4;
var NPC_HEIGHT = 4;
var PathPhase = /* @__PURE__ */ ((PathPhase2) => {
  PathPhase2["THROWN"] = "THROWN";
  PathPhase2["RETURNING"] = "RETURNING";
  PathPhase2["FLEEING"] = "FLEEING";
  return PathPhase2;
})(PathPhase || {});
var NPCPhase = /* @__PURE__ */ ((NPCPhase2) => {
  NPCPhase2["IDLE"] = "IDLE";
  NPCPhase2["CAPTURED"] = "CAPTURED";
  NPCPhase2["PATH"] = "PATH";
  return NPCPhase2;
})(NPCPhase || {});
var NPCGroup = class {
  constructor(data) {
    this.id = data.id;
    this.fileNames = data.fileNames;
    this.captorId = data.captorId;
    this.position = data.position;
    this.direction = data.direction;
    this.phase = data.phase;
  }
  get faceFileName() {
    return this.fileNames.length > 0 ? this.fileNames[this.fileNames.length - 1] : void 0;
  }
};
var DefaultMap = class extends Map {
  constructor(defaultFactory) {
    super();
    this.defaultFactory = defaultFactory;
  }
  get(key) {
    if (!this.has(key)) {
      this.set(key, this.defaultFactory(key));
    }
    return super.get(key);
  }
};
var NPCGroupsBiMap = class _NPCGroupsBiMap {
  constructor(existing) {
    this.map1 = /* @__PURE__ */ new Map();
    this.map2 = /* @__PURE__ */ new Map();
    if (existing) {
      if (existing instanceof _NPCGroupsBiMap && typeof existing.values === "function") {
        this.map1 = new Map(existing.map1);
        this.map2 = new Map(existing.map2);
      } else if (existing && typeof existing === "object") {
        const existingAny = existing;
        if (existingAny.map2) {
          const map2Data = existingAny.map2;
          if (Array.isArray(map2Data)) {
            map2Data.forEach(([key, value]) => {
              this.setByNpcGroupId(key, value);
            });
          } else if (map2Data instanceof Map) {
            map2Data.forEach((value, key) => {
              this.setByNpcGroupId(key, value);
            });
          } else if (typeof map2Data === "object") {
            Object.entries(map2Data).forEach(([key, value]) => {
              this.setByNpcGroupId(key, value);
            });
          }
        }
      }
    }
  }
  setByUserId(userId, npcGroup) {
    if (npcGroup.fileNames.length == 0) {
      this.deleteByUserId(userId);
      return;
    }
    if (npcGroup.phase === "CAPTURED" /* CAPTURED */) {
      this.map1.set(userId, npcGroup);
    }
    this.map2.set(npcGroup.id, npcGroup);
  }
  setByNpcGroupId(npcGroupId, npcGroup) {
    if (npcGroup.fileNames.length == 0) {
      this.deleteByNpcGroupId(npcGroupId);
      return;
    }
    this.map2.set(npcGroupId, npcGroup);
    if (npcGroup.captorId && npcGroup.phase === "CAPTURED" /* CAPTURED */) {
      this.map1.set(npcGroup.captorId, npcGroup);
    }
  }
  deleteByUserId(userId) {
    const npcGroup = this.map1.get(userId);
    if (npcGroup) {
      this.map2.delete(npcGroup.id);
    }
    this.map1.delete(userId);
  }
  deleteByNpcGroupId(npcGroupId) {
    const npcGroup = this.map2.get(npcGroupId);
    if (npcGroup && npcGroup.captorId && npcGroup.phase === "CAPTURED" /* CAPTURED */) {
      const userGroup = this.map1.get(npcGroup.captorId);
      if (userGroup && userGroup.id === npcGroupId) {
        this.map1.delete(npcGroup.captorId);
      }
    }
    this.map2.delete(npcGroupId);
  }
  values() {
    return Array.from(this.map2.values());
  }
  keys() {
    return Array.from(this.map2.keys());
  }
  get size() {
    return this.map2.size;
  }
  // Get cumulative size of all NPCs across all groups
  get cumulativeSize() {
    return this.values().reduce((total, npcGroup) => total + npcGroup.fileNames.length, 0);
  }
  getByUserId(userId) {
    return this.map1.get(userId);
  }
  getByNpcGroupId(npcGroupId) {
    return this.map2.get(npcGroupId);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ANIMAL_ORIENTATION,
  ANIMAL_SCALES,
  Animal,
  BACKEND_DIRECTION_OFFSET,
  DIRECTION_OFFSET,
  DefaultMap,
  NPCGroup,
  NPCGroupsBiMap,
  NPCPhase,
  NPC_HEIGHT,
  NPC_WIDTH,
  PathPhase
});
