"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NPCGroupsBiMap = exports.DefaultMap = exports.NPCGroup = exports.NPCPhase = exports.PathPhase = void 0;
// Path phases for different types of movement
var PathPhase;
(function (PathPhase) {
    PathPhase["THROWN"] = "THROWN";
    PathPhase["FLEEING"] = "FLEEING";
    PathPhase["BOUNCING"] = "BOUNCING";
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
                // Copy all entries from existing maps using the public methods
                existing.values().forEach(npcGroup => {
                    this.setByNpcGroupId(npcGroup.id, npcGroup);
                });
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
    getByUserId(userId) { return this.map1.get(userId); }
    getByNpcGroupId(npcGroupId) { return this.map2.get(npcGroupId); }
}
exports.NPCGroupsBiMap = NPCGroupsBiMap;
