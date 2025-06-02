"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoomNumUsersInMemory = exports.incrementRoomUsersInMemory = exports.findRoomInMemory = void 0;
exports.populateRoom = populateRoom;
const config_1 = require("./config");
const npcService_1 = require("../services/npcService");
const uuid_1 = require("uuid");
const findRoomInMemory = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const roomKeys = yield (0, config_1.getAllRoomKeys)();
        const rooms = yield Promise.all(roomKeys.map((roomName) => __awaiter(void 0, void 0, void 0, function* () {
            const roomData = yield (0, config_1.getRoomData)(roomName);
            return roomData ? Object.assign(Object.assign({}, roomData), { key: roomName }) : null;
        })));
        const activeRooms = rooms
            .filter((room) => room !== null && room.isActive !== false && room.numUsers < 10)
            .sort((a, b) => a.numUsers - b.numUsers);
        if (activeRooms.length > 0) {
            const room = activeRooms[0];
            yield (0, exports.incrementRoomUsersInMemory)(room.name);
            return room.name;
        }
        // If no suitable room exists, create a new one
        const roomName = `room-${(0, uuid_1.v4)()}`;
        yield createRoomInMemory(roomName);
        yield populateRoom(roomName);
        return roomName;
    }
    catch (error) {
        console.error("Error in findRoom:", error);
        throw error;
    }
});
exports.findRoomInMemory = findRoomInMemory;
const incrementRoomUsersInMemory = (roomName) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const room = yield (0, config_1.getRoomData)(roomName);
        if (!room)
            throw new Error(`Room ${roomName} not found`);
        room.numUsers += 1;
        room.lastActive = new Date().toISOString();
        yield (0, config_1.setRoomData)(roomName, room);
    }
    catch (error) {
        console.error("Error incrementing room users", error);
        throw error;
    }
});
exports.incrementRoomUsersInMemory = incrementRoomUsersInMemory;
const createRoomInMemory = (roomName) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const newRoom = {
            name: roomName,
            numUsers: 1,
            isActive: true,
            lastActive: new Date().toISOString(),
            createdAt: new Date().toISOString(),
        };
        yield (0, config_1.setRoomData)(roomName, newRoom);
        return newRoom;
    }
    catch (error) {
        console.error("Error creating room", error);
        throw error;
    }
});
const getRoomNumUsersInMemory = (roomName) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const room = yield (0, config_1.getRoomData)(roomName);
        if (!room)
            return 0;
        return room.numUsers;
    }
    catch (error) {
        console.error("Error getting room users:", error);
        throw error;
    }
});
exports.getRoomNumUsersInMemory = getRoomNumUsersInMemory;
function populateRoom(roomName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const npcs = yield (0, npcService_1.createNPCs)();
            const npcMap = new Map();
            npcs.forEach((npc) => {
                npcMap.set(npc.id, npc);
            });
            (0, config_1.setNPCsInMemory)(roomName, npcMap);
        }
        catch (error) {
            console.error(`Error populating room ${roomName}:`, error);
        }
    });
}
