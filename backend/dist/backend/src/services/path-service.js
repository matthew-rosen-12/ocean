"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePathInRoom = deletePathInRoom;
const paths_1 = require("../state/paths");
function deletePathInRoom(room, pathData) {
    const roomPaths = (0, paths_1.getpathsfromMemory)(room);
    roomPaths.delete(pathData.npcGroupId);
    (0, paths_1.setPathsInMemory)(room, roomPaths);
}
