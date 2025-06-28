"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePathInRoom = deletePathInRoom;
exports.getPathPosition = getPathPosition;
const paths_1 = require("../state/paths");
function deletePathInRoom(room, pathData) {
    const roomPaths = (0, paths_1.getpathsfromMemory)(room);
    roomPaths.delete(pathData.npcGroupId);
    (0, paths_1.setPathsInMemory)(room, roomPaths);
}
function getPathPosition(npcGroup, room) {
    const paths = (0, paths_1.getpathsfromMemory)(room);
    const pathData = paths.get(npcGroup.id);
    // Calculate current position along path with progress clamping
    const now = Date.now();
    const elapsedTime = (now - pathData.timestamp); // seconds
    const distance = pathData.velocity * elapsedTime;
    return {
        x: pathData.startPosition.x + pathData.direction.x * distance,
        y: pathData.startPosition.y + pathData.direction.y * distance,
        z: 0
    };
}
