"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getpathsfromMemory = getpathsfromMemory;
exports.setPathsInMemory = setPathsInMemory;
exports.deletePathInMemory = deletePathInMemory;
const types_1 = require("shared/types");
const paths = new types_1.DefaultMap(() => new Map());
// Path functions - direct Map access, no serialization
function getpathsfromMemory(room) {
    return paths.get(room);
}
function setPathsInMemory(roomName, newPaths) {
    paths.set(roomName, newPaths);
}
// Direct Path operations - no read-modify-set needed
function deletePathInMemory(roomName, npcGroupId) {
    const roomPaths = paths.get(roomName);
    if (roomPaths) {
        roomPaths.delete(npcGroupId);
    }
}
