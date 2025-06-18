"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNPCGroupsfromMemory = getNPCGroupsfromMemory;
exports.setNPCGroupsInMemory = setNPCGroupsInMemory;
exports.removeNPCGroupInRoomInMemory = removeNPCGroupInRoomInMemory;
exports.updateNPCGroupInRoomInMemory = updateNPCGroupInRoomInMemory;
const types_1 = require("shared/types");
const npcGroups = new Map();
function getNPCGroupsfromMemory(roomName) {
    const roomGroups = npcGroups.get(roomName);
    if (!roomGroups) {
        return new types_1.NPCGroupsBiMap();
    }
    // Return a copy to prevent external mutations
    return roomGroups;
}
function setNPCGroupsInMemory(room, groups) {
    npcGroups.set(room, groups);
}
// Direct Group operations - no read-modify-set needed
function removeNPCGroupInRoomInMemory(roomName, captorId) {
    const roomGroups = npcGroups.get(roomName);
    if (!roomGroups)
        return;
    roomGroups.deleteByUserId(captorId);
}
function updateNPCGroupInRoomInMemory(roomName, npcGroup) {
    const roomGroups = npcGroups.get(roomName) || new types_1.NPCGroupsBiMap();
    if (npcGroup.fileNames.length == 0) {
        roomGroups.deleteByNpcGroupId(npcGroup.id);
    }
    else {
        roomGroups.setByNpcGroupId(npcGroup.id, npcGroup);
    }
    npcGroups.set(roomName, roomGroups);
}
