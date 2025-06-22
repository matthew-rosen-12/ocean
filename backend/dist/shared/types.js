"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NPCGroupsBiMap = exports.DefaultMap = exports.NPCGroup = exports.NPCPhase = exports.PathPhase = exports.NPC_HEIGHT = exports.NPC_WIDTH = exports.BACKEND_DIRECTION_OFFSET = exports.DIRECTION_OFFSET = exports.ANIMAL_ORIENTATION = exports.ANIMAL_SCALES = exports.Animal = void 0;
var Animal;
(function (Animal) {
    // DOLPHIN = "DOLPHIN",
    // WOLF = "WOLF", 
    // PENGUIN = "PENGUIN",
    // SNAKE = "SNAKE",
    // TURTLE = "TURTLE",
    // TIGER = "TIGER",
    // TUNA = "TUNA",
    // EAGLE = "EAGLE",
    // BEE = "BEE",
    // BEAR = "BEAR",
    // CUTTLEFISH = "CUTTLEFISH",
    Animal["SALAMANDER"] = "SALAMANDER";
})(Animal || (exports.Animal = Animal = {}));
exports.ANIMAL_SCALES = {
    DOLPHIN: 3.0,
    WOLF: 1.0,
    PENGUIN: 2.5,
    SNAKE: 2.0,
    TURTLE: 2.0,
    TIGER: 4.0,
    TUNA: 3.0,
    EAGLE: 2.5,
    BEE: 2.0,
    BEAR: 2.5,
    CUTTLEFISH: 2.0,
    SALAMANDER: 2.5,
};
exports.ANIMAL_ORIENTATION = {
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
    SALAMANDER: { rotation: 0, flipY: false },
};
exports.DIRECTION_OFFSET = 0.1;
exports.BACKEND_DIRECTION_OFFSET = 0.001;
// NPC group dimensions
exports.NPC_WIDTH = 4;
exports.NPC_HEIGHT = 4;
// Path phases for different types of movement
var PathPhase;
(function (PathPhase) {
    PathPhase["THROWN"] = "THROWN";
    PathPhase["FLEEING"] = "FLEEING";
    PathPhase["RETURNING"] = "RETURNING";
})(PathPhase || (exports.PathPhase = PathPhase = {}));
var NPCPhase;
(function (NPCPhase) {
    NPCPhase["IDLE"] = "IDLE";
    NPCPhase["CAPTURED"] = "CAPTURED";
    NPCPhase["PATH"] = "PATH";
})(NPCPhase || (exports.NPCPhase = NPCPhase = {}));
class NPCGroup {
    constructor(data) {
        this.id = data.id;
        this.fileNames = data.fileNames;
        this.captorId = data.captorId;
        this.position = data.position;
        this.direction = data.direction;
        this.phase = data.phase;
    }
    get faceFileName() {
        return this.fileNames.length > 0 ? this.fileNames[this.fileNames.length - 1] : undefined;
    }
}
exports.NPCGroup = NPCGroup;
class DefaultMap extends Map {
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
}
exports.DefaultMap = DefaultMap;
class NPCGroupsBiMap {
    constructor(existing) {
        this.map1 = new Map();
        this.map2 = new Map();
        if (existing) {
            // Check if existing is a proper NPCGroupsBiMap instance
            if (existing instanceof NPCGroupsBiMap && typeof existing.values === 'function') {
                // OPTIMIZED: Direct map copying for performance
                this.map1 = new Map(existing.map1);
                this.map2 = new Map(existing.map2);
            }
            else if (existing && typeof existing === 'object') {
                // Handle case where existing is a plain object (from deserialization)
                const existingAny = existing;
                // Try to access the internal map2 data
                if (existingAny.map2) {
                    const map2Data = existingAny.map2;
                    // Handle different serialization formats
                    if (Array.isArray(map2Data)) {
                        // Map serialized as array of [key, value] pairs
                        map2Data.forEach(([key, value]) => {
                            this.setByNpcGroupId(key, value);
                        });
                    }
                    else if (map2Data instanceof Map) {
                        // Map is still a Map
                        map2Data.forEach((value, key) => {
                            this.setByNpcGroupId(key, value);
                        });
                    }
                    else if (typeof map2Data === 'object') {
                        // Map serialized as plain object
                        Object.entries(map2Data).forEach(([key, value]) => {
                            this.setByNpcGroupId(key, value);
                        });
                    }
                }
            }
        }
    }
    setByUserId(userId, npcGroup) {
        // Only set in map1 if it's a CAPTURED group
        if (npcGroup.fileNames.length == 0) {
            this.deleteByUserId(userId);
            return;
        }
        if (npcGroup.phase === NPCPhase.CAPTURED) {
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
        if (npcGroup.captorId && npcGroup.phase === NPCPhase.CAPTURED) {
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
        if (npcGroup && npcGroup.captorId && npcGroup.phase === NPCPhase.CAPTURED) {
            // Only remove from map1 if this was the user's CAPTURED group
            const userGroup = this.map1.get(npcGroup.captorId);
            if (userGroup && userGroup.id === npcGroupId) {
                this.map1.delete(npcGroup.captorId);
            }
        }
        this.map2.delete(npcGroupId);
    }
    values() { return Array.from(this.map2.values()); }
    keys() { return Array.from(this.map2.keys()); }
    get size() { return this.map2.size; }
    getByUserId(userId) { return this.map1.get(userId); }
    getByNpcGroupId(npcGroupId) { return this.map2.get(npcGroupId); }
}
exports.NPCGroupsBiMap = NPCGroupsBiMap;
