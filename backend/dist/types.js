"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultMap = exports.PathPhase = exports.NPCPhase = void 0;
var NPCPhase;
(function (NPCPhase) {
    NPCPhase["IDLE"] = "IDLE";
    NPCPhase["CAPTURED"] = "CAPTURED";
    NPCPhase["path"] = "path";
})(NPCPhase || (exports.NPCPhase = NPCPhase = {}));
// Path phases for different types of movement
var PathPhase;
(function (PathPhase) {
    PathPhase["THROWN"] = "THROWN";
    PathPhase["FLEEING"] = "FLEEING";
    PathPhase["BOUNCING"] = "BOUNCING";
})(PathPhase || (exports.PathPhase = PathPhase = {}));
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
