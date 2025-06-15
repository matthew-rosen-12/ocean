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
    return new types_1.NPCGroup(Object.assign(Object.assign({}, group1), { fileNames: [...group1.fileNames, ...group2.fileNames], captorId: group1.captorId || group2.captorId }));
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
        captorNPCGroup = new types_1.NPCGroup(Object.assign(Object.assign({}, npcGroup), { captorId, phase: types_1.NPCPhase.CAPTURED }));
    }
    const mergedGroup = mergedNPCGroups(captorNPCGroup, npcGroup);
    mergedGroup.captorId = captorId; // Ensure captorId is set
    mergedGroup.phase = types_1.NPCPhase.CAPTURED; // Ensure phase is CAPTURED
    roomGroups.setByUserId(captorId, mergedGroup);
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
    // faceFileName is now computed from fileNames array
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
