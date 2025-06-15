"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNPCGroupsfromMemory = getNPCGroupsfromMemory;
exports.setNPCGroupsInMemory = setNPCGroupsInMemory;
exports.addNPCGroupToCaptorNPCGroupInMemory = addNPCGroupToCaptorNPCGroupInMemory;
exports.removeTopNPCFromGroupInRoomInMemory = removeTopNPCFromGroupInRoomInMemory;
exports.removeNPCGroupInRoomInMemory = removeNPCGroupInRoomInMemory;
exports.deleteNPCGroupsInMemory = deleteNPCGroupsInMemory;
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
function mergedNPCGroups(group1, group2) {
    return Object.assign(Object.assign({}, group1), { fileNames: [...group1.fileNames, ...group2.fileNames] });
}
// Direct Group operations - no read-modify-set needed
function addNPCGroupToCaptorNPCGroupInMemory(roomName, captorId, npcGroup) {
    let roomGroups = npcGroups.get(roomName);
    if (!roomGroups) {
        roomGroups = new types_1.NPCGroupsBiMap();
        npcGroups.set(roomName, roomGroups);
    }
    let captorNPCGroup = roomGroups.getByUserId(captorId);
    if (!captorNPCGroup) {
        captorNPCGroup = Object.assign(Object.assign({}, npcGroup), { captorId });
    }
    roomGroups.setByUserId(captorId, mergedNPCGroups(captorNPCGroup, npcGroup));
}
function removeTopNPCFromGroupInRoomInMemory(roomName, captorId) {
    let roomGroups = npcGroups.get(roomName);
    if (!roomGroups) {
        return; // No groups in this room
    }
    const group = roomGroups.getByUserId(captorId);
    if (!group) {
        return; // No group for this captor
    }
    group.fileNames.pop();
    if (group.fileNames.length === 0) {
        roomGroups.deleteByUserId(captorId);
        return;
    }
    // If the removed NPC was the face NPC, select a new one
    group.faceFileName = group.fileNames[group.fileNames.length - 1];
}
function removeNPCGroupInRoomInMemory(roomName, captorId) {
    const roomGroups = npcGroups.get(roomName);
    if (!roomGroups)
        return;
    roomGroups.deleteByUserId(captorId);
}
function deleteNPCGroupsInMemory(roomName) {
    npcGroups.delete(roomName);
}
function updateNPCGroupInRoomInMemory(roomName, npcGroup) {
    const roomGroups = npcGroups.get(roomName) || new types_1.NPCGroupsBiMap();
    roomGroups.setByNpcGroupId(npcGroup.id, npcGroup);
    npcGroups.set(roomName, roomGroups);
}
