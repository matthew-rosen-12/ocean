"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultMap = exports.NPCPhase = void 0;
var NPCPhase;
(function (NPCPhase) {
    NPCPhase["IDLE"] = "IDLE";
    NPCPhase["CAPTURED"] = "CAPTURED";
    NPCPhase["path"] = "path";
})(NPCPhase || (exports.NPCPhase = NPCPhase = {}));
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
