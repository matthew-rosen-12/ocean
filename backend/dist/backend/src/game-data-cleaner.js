"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAllGameData = clearAllGameData;
exports.clearAllGameDataGlobally = clearAllGameDataGlobally;
const users_1 = require("./state/users");
const npc_groups_1 = require("./state/npc-groups");
const paths_1 = require("./state/paths");
const rooms_1 = require("./state/rooms");
const types_1 = require("shared/types");
/**
 * Clears all game data for a specific room including:
 * - All users in the room
 * - All NPC groups in the room
 * - All paths in the room
 * - Room data itself
 * - Terrain configuration (generated per-room, will be regenerated on next join)
 */
function clearAllGameData(roomName) {
    try {
        console.log(`Clearing all game data for room: ${roomName}`);
        // Clear users in the room
        const roomUsersData = (0, users_1.getAllUsersInRoom)(roomName);
        if (roomUsersData && roomUsersData.size > 0) {
            const userCount = roomUsersData.size;
            const userIds = Array.from(roomUsersData.keys());
            userIds.forEach(userId => {
                (0, users_1.removeUserFromRoom)(roomName, userId);
            });
            console.log(`Cleared ${userCount} users from room ${roomName}`);
        }
        // Clear NPC groups in the room
        const roomNpcGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(roomName);
        if (roomNpcGroups && roomNpcGroups.values().length > 0) {
            const npcGroupCount = roomNpcGroups.values().length;
            // Clear by setting an empty NPCGroupsBiMap
            (0, npc_groups_1.setNPCGroupsInMemory)(roomName, new types_1.NPCGroupsBiMap());
            console.log(`Cleared ${npcGroupCount} NPC groups from room ${roomName}`);
        }
        // Clear paths in the room
        const roomPaths = (0, paths_1.getpathsfromMemory)(roomName);
        if (roomPaths && roomPaths.size > 0) {
            const pathCount = roomPaths.size;
            // Clear by setting an empty Map
            (0, paths_1.setPathsInMemory)(roomName, new Map());
            console.log(`Cleared ${pathCount} paths from room ${roomName}`);
        }
        // Note: Room data cleanup is handled by the rooms module when users disconnect
        // The room will be automatically cleaned up when numUsers reaches 0
        console.log(`Successfully cleared all game data for room: ${roomName}`);
    }
    catch (error) {
        console.error(`Error clearing game data for room ${roomName}:`, error);
        throw error;
    }
}
/**
 * Clears all game data across all rooms (for complete server reset)
 */
function clearAllGameDataGlobally() {
    try {
        console.log("Clearing all game data globally");
        // Get all room names and clear each room individually
        const allRooms = (0, rooms_1.getAllRoomsfromMemory)();
        let totalCleared = 0;
        allRooms.forEach(roomName => {
            try {
                clearAllGameData(roomName);
                totalCleared++;
            }
            catch (error) {
                console.error(`Error clearing room ${roomName}:`, error);
            }
        });
        console.log(`Globally cleared ${totalCleared} rooms`);
    }
    catch (error) {
        console.error("Error clearing all game data globally:", error);
        throw error;
    }
}
