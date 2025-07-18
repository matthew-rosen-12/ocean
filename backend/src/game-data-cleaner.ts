import { getAllUsersInRoom, removeUserFromRoom } from "./state/users";
import { getNPCGroupsfromMemory, setNPCGroupsInMemory } from "./state/npc-groups";
import { getpathsfromMemory, setPathsInMemory } from "./state/paths";
import { getAllRoomsfromMemory } from "./state/rooms";
import { NPCGroupsBiMap } from "shared/types";

/**
 * Clears all game data for a specific room including:
 * - All users in the room
 * - All NPC groups in the room  
 * - All paths in the room
 * - Room data itself
 * - Terrain configuration (generated per-room, will be regenerated on next join)
 */
export function clearAllGameData(roomName: string): void {
  try {

    // Clear users in the room
    const roomUsersData = getAllUsersInRoom(roomName);
    if (roomUsersData && roomUsersData.size > 0) {
      const userCount = roomUsersData.size;
      const userIds = Array.from(roomUsersData.keys());
      userIds.forEach(userId => {
        removeUserFromRoom(roomName, userId);
      });
    }

    // Clear NPC groups in the room
    const roomNpcGroups = getNPCGroupsfromMemory(roomName);
    if (roomNpcGroups && roomNpcGroups.values().length > 0) {
      const npcGroupCount = roomNpcGroups.values().length;
      // Clear by setting an empty NPCGroupsBiMap
      setNPCGroupsInMemory(roomName, new NPCGroupsBiMap());
    }

    // Clear paths in the room
    const roomPaths = getpathsfromMemory(roomName);
    if (roomPaths && roomPaths.size > 0) {
      const pathCount = roomPaths.size;
      // Clear by setting an empty Map
      setPathsInMemory(roomName, new Map());
    }

    // Note: Room data cleanup is handled by the rooms module when users disconnect
    // The room will be automatically cleaned up when numUsers reaches 0


  } catch (error) {
    console.error(`Error clearing game data for room ${roomName}:`, error);
    throw error;
  }
}

/**
 * Clears all game data across all rooms (for complete server reset)
 */
export function clearAllGameDataGlobally(): void {
  try {

    // Get all room names and clear each room individually
    const allRooms = getAllRoomsfromMemory();
    let totalCleared = 0;

    allRooms.forEach(roomName => {
      try {
        clearAllGameData(roomName);
        totalCleared++;
      } catch (error) {
        console.error(`Error clearing room ${roomName}:`, error);
      }
    });

  } catch (error) {
    console.error("Error clearing all game data globally:", error);
    throw error;
  }
}