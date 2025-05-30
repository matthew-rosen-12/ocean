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
exports.decrementRoomUsersInRedis = exports.getAllRoomKeys = exports.deleteRoomData = exports.setRoomData = exports.getRoomData = exports.connect = void 0;
exports.getNPCsFromRedis = getNPCsFromRedis;
exports.setNPCsInRedis = setNPCsInRedis;
exports.getpathsFromRedis = getpathsFromRedis;
exports.getActivepathsFromRedis = getActivepathsFromRedis;
exports.setPathsInRedis = setPathsInRedis;
exports.getPathsMapFromRedis = getPathsMapFromRedis;
exports.setPathsMapInRedis = setPathsMapInRedis;
exports.getNPCGroupsFromRedis = getNPCGroupsFromRedis;
exports.setNPCGroupsInRedis = setNPCGroupsInRedis;
exports.removeNPCFromGroupInRoomInRedis = removeNPCFromGroupInRoomInRedis;
exports.removeNPCGroupInRoomInRedis = removeNPCGroupInRoomInRedis;
exports.getAllRoomsFromRedis = getAllRoomsFromRedis;
exports.debugRoomStore = debugRoomStore;
exports.debugNPCStore = debugNPCStore;
exports.debugNPCGroupStore = debugNPCGroupStore;
exports.debugPathStore = debugPathStore;
// Dedicated Room storage - direct Map access, no serialization
const roomStore = new Map();
// Dedicated NPC storage - direct Map access, no serialization
const npcStore = new Map();
// Dedicated NPC Group storage - direct Map access, no serialization
const npcGroupStore = new Map();
// Dedicated Path storage - direct Map access, no serialization
const pathStore = new Map();
// Helper functions that replace Redis operations
const connect = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Using in-memory storage (no Redis connection needed)");
    return true;
});
exports.connect = connect;
// Room management functions
const getRoomData = (roomName) => __awaiter(void 0, void 0, void 0, function* () {
    return roomStore.get(roomName) || null;
});
exports.getRoomData = getRoomData;
const setRoomData = (roomName, room) => __awaiter(void 0, void 0, void 0, function* () {
    roomStore.set(roomName, room);
});
exports.setRoomData = setRoomData;
const deleteRoomData = (roomName) => __awaiter(void 0, void 0, void 0, function* () {
    roomStore.delete(roomName);
});
exports.deleteRoomData = deleteRoomData;
const getAllRoomKeys = () => __awaiter(void 0, void 0, void 0, function* () {
    return Array.from(roomStore.keys());
});
exports.getAllRoomKeys = getAllRoomKeys;
const decrementRoomUsersInRedis = (roomName, userId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const room = yield (0, exports.getRoomData)(roomName);
        if (!room) {
            console.error("Room not found:", roomName);
            return;
        }
        room.numUsers -= 1;
        room.lastActive = new Date().toISOString();
        if (room.numUsers === 0) {
            console.log("Deleting room and all associated data:", roomName);
            // Delete room and all associated data from dedicated stores
            yield (0, exports.deleteRoomData)(roomName);
            npcStore.delete(roomName);
            npcGroupStore.delete(roomName);
            pathStore.delete(roomName);
        }
        else {
            yield (0, exports.setRoomData)(roomName, room);
        }
    }
    catch (error) {
        console.error("Error decrementing room users:", error);
        throw error;
    }
});
exports.decrementRoomUsersInRedis = decrementRoomUsersInRedis;
// NPC functions - direct Map access, no serialization
function getNPCsFromRedis(roomName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get the room's NPC map directly, or create a new one if it doesn't exist
            const roomNPCs = npcStore.get(roomName);
            if (!roomNPCs) {
                return new Map();
            }
            // Return a copy to prevent external mutations
            return new Map(roomNPCs);
        }
        catch (error) {
            console.error(`Error getting NPCs for room ${roomName}:`, error);
            return new Map();
        }
    });
}
function setNPCsInRedis(room, npcs) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Store NPCs directly in the Map - create a copy to prevent external mutations
            npcStore.set(room, new Map(npcs));
        }
        catch (error) {
            console.error(`Error setting NPCs for room ${room}:`, error);
            throw error;
        }
    });
}
// Path functions - direct Map access, no serialization
function getpathsFromRedis(room) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get the room's path map directly, or create a new one if it doesn't exist
            const roomPaths = pathStore.get(room);
            if (!roomPaths) {
                return [];
            }
            // Return array of path values
            return Array.from(roomPaths.values());
        }
        catch (error) {
            console.error(`Error getting paths for room ${room}:`, error);
            return [];
        }
    });
}
function getActivepathsFromRedis(roomName) {
    return __awaiter(this, void 0, void 0, function* () {
        return getpathsFromRedis(roomName);
    });
}
function setPathsInRedis(roomName, paths) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Convert array to Map keyed by npcId
            const pathMap = new Map();
            for (const path of paths) {
                pathMap.set(path.npc.id, path);
            }
            // Store paths directly in the Map
            pathStore.set(roomName, pathMap);
        }
        catch (error) {
            console.error(`Error setting paths for room ${roomName}:`, error);
            throw error;
        }
    });
}
function getPathsMapFromRedis(room) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get the room's path map directly, or create a new one if it doesn't exist
            const roomPaths = pathStore.get(room);
            if (!roomPaths) {
                return new Map();
            }
            // Return a copy to prevent external mutations
            return new Map(roomPaths);
        }
        catch (error) {
            console.error(`Error getting paths map for room ${room}:`, error);
            return new Map();
        }
    });
}
function setPathsMapInRedis(room, paths) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Store paths directly in the Map - create a copy to prevent external mutations
            pathStore.set(room, new Map(paths));
        }
        catch (error) {
            console.error(`Error setting paths map for room ${room}:`, error);
            throw error;
        }
    });
}
// NPC Group functions - direct Map access, no serialization
function getNPCGroupsFromRedis(roomName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get the room's NPC group map directly, or create a new one if it doesn't exist
            const roomGroups = npcGroupStore.get(roomName);
            if (!roomGroups) {
                return new Map();
            }
            // Return a copy to prevent external mutations
            return new Map(roomGroups);
        }
        catch (error) {
            console.error(`Error getting NPC groups for room ${roomName}:`, error);
            return new Map();
        }
    });
}
function setNPCGroupsInRedis(room, groups) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Store groups directly in the Map - create a copy to prevent external mutations
            npcGroupStore.set(room, new Map(groups));
        }
        catch (error) {
            console.error(`Error setting NPC groups for room ${room}:`, error);
            throw error;
        }
    });
}
function removeNPCFromGroupInRoomInRedis(roomName, captorId, npcId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get the room's groups map
            let roomGroups = npcGroupStore.get(roomName);
            if (!roomGroups) {
                return; // No groups for this room
            }
            const group = roomGroups.get(captorId);
            if (group) {
                group.npcIds.delete(npcId);
                roomGroups.set(captorId, group);
                // Update the store (though the reference is already updated)
                npcGroupStore.set(roomName, roomGroups);
            }
        }
        catch (error) {
            console.error(`Error removing NPC from group in room ${roomName}:`, error);
            throw error;
        }
    });
}
function removeNPCGroupInRoomInRedis(roomName, captorId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get the room's groups map
            let roomGroups = npcGroupStore.get(roomName);
            if (!roomGroups) {
                return; // No groups for this room
            }
            roomGroups.delete(captorId);
            // Update the store
            npcGroupStore.set(roomName, roomGroups);
        }
        catch (error) {
            console.error(`Error removing NPC group in room ${roomName}:`, error);
            throw error;
        }
    });
}
// Room discovery
function getAllRoomsFromRedis() {
    return __awaiter(this, void 0, void 0, function* () {
        // Get room names from all stores, merge and deduplicate
        const roomDataKeys = Array.from(roomStore.keys());
        const npcRooms = Array.from(npcStore.keys());
        const groupRooms = Array.from(npcGroupStore.keys());
        const pathRooms = Array.from(pathStore.keys());
        const allRooms = new Set([
            ...roomDataKeys,
            ...npcRooms,
            ...groupRooms,
            ...pathRooms,
        ]);
        return Array.from(allRooms);
    });
}
// Debug function to view current Room store state
function debugRoomStore() {
    console.log("=== Room Store Debug ===");
    console.log(`Total rooms: ${roomStore.size}`);
    for (const [roomName, room] of roomStore.entries()) {
        console.log(`Room ${roomName}: ${room.numUsers} users, active: ${room.isActive}`);
    }
    console.log("========================");
}
// Debug function to view current NPC store state
function debugNPCStore() {
    console.log("=== NPC Store Debug ===");
    console.log(`Total rooms: ${npcStore.size}`);
    for (const [roomName, npcs] of npcStore.entries()) {
        console.log(`Room ${roomName}: ${npcs.size} NPCs`);
        for (const [npcId, npc] of npcs.entries()) {
            console.log(`  - ${npcId}: ${npc.filename} (${npc.phase})`);
        }
    }
    console.log("=====================");
}
// Debug function to view current NPC Group store state
function debugNPCGroupStore() {
    console.log("=== NPC Group Store Debug ===");
    console.log(`Total rooms: ${npcGroupStore.size}`);
    for (const [roomName, groups] of npcGroupStore.entries()) {
        console.log(`Room ${roomName}: ${groups.size} groups`);
        for (const [captorId, group] of groups.entries()) {
            console.log(`  - ${captorId}: ${group.npcIds.size} NPCs`);
        }
    }
    console.log("===========================");
}
// Debug function to view current Path store state
function debugPathStore() {
    console.log("=== Path Store Debug ===");
    console.log(`Total rooms: ${pathStore.size}`);
    for (const [roomName, paths] of pathStore.entries()) {
        console.log(`Room ${roomName}: ${paths.size} paths`);
        for (const [npcId, path] of paths.entries()) {
            console.log(`  - ${npcId}: ${path.id} (${path.npc.filename})`);
        }
    }
    console.log("========================");
}
