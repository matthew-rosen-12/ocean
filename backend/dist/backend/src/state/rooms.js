"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findRoomInMemory = exports.decrementRoomUsersInMemory = void 0;
exports.getAllRoomsfromMemory = getAllRoomsfromMemory;
const npc_group_service_1 = require("../npc-group-service");
const uuid_1 = require("uuid");
const types_1 = require("shared/types");
const npc_groups_1 = require("./npc-groups");
const rooms = new Map();
// Room management functions
const getRoomDataInMemory = (roomName) => {
    return rooms.get(roomName) || null;
};
const setRoomDataInMemory = (roomName, room) => {
    rooms.set(roomName, room);
};
const deleteRoomDataInMemory = (roomName) => {
    rooms.delete(roomName);
};
const getAllRoomKeysInMemory = () => {
    return Array.from(rooms.keys());
};
const decrementRoomUsersInMemory = (roomName, _userId) => {
    try {
        const room = getRoomDataInMemory(roomName);
        if (!room) {
            console.error("Room not found:", roomName);
            return;
        }
        room.numUsers -= 1;
        room.lastActive = new Date().toISOString();
        if (room.numUsers === 0) {
            console.log("Deleting room and all associated data:", roomName);
            // Delete room and all associated data from dedicated stores
            deleteRoomDataInMemory(roomName);
            // Note: NPC groups and paths cleanup handled elsewhere
        }
        else {
            setRoomDataInMemory(roomName, room);
        }
    }
    catch (error) {
        console.error("Error decrementing room users:", error);
        throw error;
    }
};
exports.decrementRoomUsersInMemory = decrementRoomUsersInMemory;
const findRoomInMemory = () => {
    try {
        const roomKeys = getAllRoomKeysInMemory();
        const rooms = roomKeys.map((roomName) => {
            const roomData = getRoomDataInMemory(roomName);
            return roomData ? Object.assign(Object.assign({}, roomData), { key: roomName }) : null;
        });
        const activeRooms = rooms
            .filter((room) => room !== null && room.isActive !== false && room.numUsers < 10)
            .sort((a, b) => a.numUsers - b.numUsers);
        if (activeRooms.length > 0) {
            const room = activeRooms[0];
            incrementRoomUsersInMemory(room.name);
            return room.name;
        }
        // If no suitable room exists, create a new one
        const roomName = `room-${(0, uuid_1.v4)()}`;
        createRoomInMemory(roomName);
        populateRoomInMemory(roomName);
        return roomName;
    }
    catch (error) {
        console.error("Error in findRoom:", error);
        throw error;
    }
};
exports.findRoomInMemory = findRoomInMemory;
const incrementRoomUsersInMemory = (roomName) => {
    try {
        const room = getRoomDataInMemory(roomName);
        if (!room)
            throw new Error(`Room ${roomName} not found`);
        room.numUsers += 1;
        room.lastActive = new Date().toISOString();
        setRoomDataInMemory(roomName, room);
    }
    catch (error) {
        console.error("Error incrementing room users", error);
        throw error;
    }
};
const createRoomInMemory = (roomName) => {
    try {
        const newRoom = {
            name: roomName,
            numUsers: 1,
            isActive: true,
            lastActive: new Date().toISOString(),
            createdAt: new Date().toISOString(),
        };
        setRoomDataInMemory(roomName, newRoom);
        return newRoom;
    }
    catch (error) {
        console.error("Error creating room", error);
        throw error;
    }
};
const populateRoomInMemory = (roomName) => {
    try {
        const npcGroups = (0, npc_group_service_1.createNPCGroups)();
        const npcGroupsMap = new types_1.NPCGroupsBiMap();
        npcGroups.forEach((npcGroup) => {
            npcGroupsMap.setByNpcGroupId(npcGroup.id, npcGroup);
        });
        (0, npc_groups_1.setNPCGroupsInMemory)(roomName, npcGroupsMap);
    }
    catch (error) {
        console.error(`Error populating room ${roomName}:`, error);
    }
};
function getAllRoomsfromMemory() {
    // Get room names from all stores, merge and deduplicate
    const roomDataKeys = Array.from(rooms.keys());
    const npcRooms = getAllRoomKeysInMemory();
    const groupRooms = getAllRoomKeysInMemory();
    const pathRooms = getAllRoomKeysInMemory();
    const allRooms = new Set([
        ...roomDataKeys,
        ...npcRooms,
        ...groupRooms,
        ...pathRooms,
    ]);
    return Array.from(allRooms);
}
