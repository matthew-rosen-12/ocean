"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoomNumUsersInMemory = exports.incrementRoomUsersInMemory = exports.findRoomInMemory = exports.decrementRoomUsersInMemory = exports.getAllRoomKeysInMemory = exports.deleteRoomDataInMemory = exports.setRoomDataInMemory = exports.getRoomDataInMemory = void 0;
exports.populateRoomInMemory = populateRoomInMemory;
exports.getAllRoomsfromMemory = getAllRoomsfromMemory;
const npcService_1 = require("../services/npcService");
const uuid_1 = require("uuid");
const types_1 = require("../types");
const npcGroups_1 = require("./npcGroups");
const paths_1 = require("./paths");
const rooms = new Map();
// Room management functions
const getRoomDataInMemory = (roomName) => {
    return rooms.get(roomName) || null;
};
exports.getRoomDataInMemory = getRoomDataInMemory;
const setRoomDataInMemory = (roomName, room) => {
    rooms.set(roomName, room);
};
exports.setRoomDataInMemory = setRoomDataInMemory;
const deleteRoomDataInMemory = (roomName) => {
    rooms.delete(roomName);
};
exports.deleteRoomDataInMemory = deleteRoomDataInMemory;
const getAllRoomKeysInMemory = () => {
    return Array.from(rooms.keys());
};
exports.getAllRoomKeysInMemory = getAllRoomKeysInMemory;
const decrementRoomUsersInMemory = (roomName, userId) => {
    try {
        const room = (0, exports.getRoomDataInMemory)(roomName);
        if (!room) {
            console.error("Room not found:", roomName);
            return;
        }
        room.numUsers -= 1;
        room.lastActive = new Date().toISOString();
        if (room.numUsers === 0) {
            console.log("Deleting room and all associated data:", roomName);
            // Delete room and all associated data from dedicated stores
            (0, exports.deleteRoomDataInMemory)(roomName);
            (0, npcGroups_1.deleteNPCGroupsInMemory)(roomName);
            (0, paths_1.deletePathsInMemory)(roomName);
        }
        else {
            (0, exports.setRoomDataInMemory)(roomName, room);
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
        const roomKeys = (0, exports.getAllRoomKeysInMemory)();
        const rooms = roomKeys.map((roomName) => {
            const roomData = (0, exports.getRoomDataInMemory)(roomName);
            return roomData ? Object.assign(Object.assign({}, roomData), { key: roomName }) : null;
        });
        const activeRooms = rooms
            .filter((room) => room !== null && room.isActive !== false && room.numUsers < 10)
            .sort((a, b) => a.numUsers - b.numUsers);
        if (activeRooms.length > 0) {
            const room = activeRooms[0];
            (0, exports.incrementRoomUsersInMemory)(room.name);
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
        const room = (0, exports.getRoomDataInMemory)(roomName);
        if (!room)
            throw new Error(`Room ${roomName} not found`);
        room.numUsers += 1;
        room.lastActive = new Date().toISOString();
        (0, exports.setRoomDataInMemory)(roomName, room);
    }
    catch (error) {
        console.error("Error incrementing room users", error);
        throw error;
    }
};
exports.incrementRoomUsersInMemory = incrementRoomUsersInMemory;
const createRoomInMemory = (roomName) => {
    try {
        const newRoom = {
            name: roomName,
            numUsers: 1,
            isActive: true,
            lastActive: new Date().toISOString(),
            createdAt: new Date().toISOString(),
        };
        (0, exports.setRoomDataInMemory)(roomName, newRoom);
        return newRoom;
    }
    catch (error) {
        console.error("Error creating room", error);
        throw error;
    }
};
const getRoomNumUsersInMemory = (roomName) => {
    try {
        const room = (0, exports.getRoomDataInMemory)(roomName);
        if (!room)
            return 0;
        return room.numUsers;
    }
    catch (error) {
        console.error("Error getting room users:", error);
        throw error;
    }
};
exports.getRoomNumUsersInMemory = getRoomNumUsersInMemory;
function populateRoomInMemory(roomName) {
    try {
        const npcGroups = (0, npcService_1.createNPCGroups)();
        const npcGroupsMap = new types_1.NPCGroupsBiMap();
        npcGroups.forEach((npcGroup) => {
            npcGroupsMap.setByNpcGroupId(npcGroup.id, npcGroup);
        });
        (0, npcGroups_1.setNPCGroupsInMemory)(roomName, npcGroupsMap);
    }
    catch (error) {
        console.error(`Error populating room ${roomName}:`, error);
    }
}
function getAllRoomsfromMemory() {
    // Get room names from all stores, merge and deduplicate
    const roomDataKeys = Array.from(rooms.keys());
    const npcRooms = (0, exports.getAllRoomKeysInMemory)();
    const groupRooms = (0, exports.getAllRoomKeysInMemory)();
    const pathRooms = (0, exports.getAllRoomKeysInMemory)();
    const allRooms = new Set([
        ...roomDataKeys,
        ...npcRooms,
        ...groupRooms,
        ...pathRooms,
    ]);
    return Array.from(allRooms);
}
