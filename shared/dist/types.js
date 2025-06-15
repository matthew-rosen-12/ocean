// Path phases for different types of movement
export var PathPhase;
(function (PathPhase) {
    PathPhase["THROWN"] = "THROWN";
    PathPhase["FLEEING"] = "FLEEING";
    PathPhase["BOUNCING"] = "BOUNCING";
    PathPhase["RETURNING"] = "RETURNING";
})(PathPhase || (PathPhase = {}));
export var NPCPhase;
(function (NPCPhase) {
    NPCPhase["IDLE"] = "IDLE";
    NPCPhase["CAPTURED"] = "CAPTURED";
    NPCPhase["PATH"] = "PATH";
})(NPCPhase || (NPCPhase = {}));
export class DefaultMap extends Map {
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
export class NPCGroupsBiMap {
    constructor(existing) {
        this.map1 = new Map();
        this.map2 = new Map();
        if (existing) {
            // Copy all entries from existing maps using the public methods
            existing.values().forEach(npcGroup => {
                this.setByNpcGroupId(npcGroup.id, npcGroup);
            });
        }
    }
    setByUserId(userId, npcGroup) {
        this.map1.set(userId, npcGroup);
        this.map2.set(npcGroup.id, npcGroup);
    }
    setByNpcGroupId(npcGroupId, npcGroup) {
        this.map2.set(npcGroupId, npcGroup);
        if (npcGroup.captorId) {
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
    values() { return Array.from(this.map2.values()); }
    getByUserId(userId) { return this.map1.get(userId); }
    getByNpcGroupId(npcGroupId) { return this.map2.get(npcGroupId); }
}
