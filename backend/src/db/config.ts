import { NPC, NPCGroup, npcId, roomId, pathData, userId } from "../types";
import { serialize, deserialize } from "../utils/serializers";

// Room interface for room metadata
export interface Room {
  name: string;
  numUsers: number;
  isActive: boolean;
  lastActive: string;
  createdAt: string;
}

// Dedicated Room storage - direct Map access, no serialization
const roomStore: Map<roomId, Room> = new Map();

// Dedicated NPC storage - direct Map access, no serialization
const npcStore: Map<roomId, Map<npcId, NPC>> = new Map();

// Dedicated NPC Group storage - direct Map access, no serialization
const npcGroupStore: Map<roomId, Map<userId, NPCGroup>> = new Map();

// Dedicated Path storage - direct Map access, no serialization
const pathStore: Map<roomId, Map<npcId, pathData>> = new Map();

// Helper functions that replace Redis operations
export const connect = async () => {
  console.log("Using in-memory storage (no Redis connection needed)");
  return true;
};

// Room management functions
export const getRoomData = async (roomName: string): Promise<Room | null> => {
  return roomStore.get(roomName) || null;
};

export const setRoomData = async (
  roomName: string,
  room: Room
): Promise<void> => {
  roomStore.set(roomName, room);
};

export const deleteRoomData = async (roomName: string): Promise<void> => {
  roomStore.delete(roomName);
};

export const getAllRoomKeys = async (): Promise<string[]> => {
  return Array.from(roomStore.keys());
};

export const decrementRoomUsersInRedis = async (
  roomName: string,
  userId: string
): Promise<void> => {
  try {
    const room = await getRoomData(roomName);

    if (!room) {
      console.error("Room not found:", roomName);
      return;
    }

    room.numUsers -= 1;
    room.lastActive = new Date().toISOString();

    if (room.numUsers === 0) {
      console.log("Deleting room and all associated data:", roomName);

      // Delete room and all associated data from dedicated stores
      await deleteRoomData(roomName);
      npcStore.delete(roomName);
      npcGroupStore.delete(roomName);
      pathStore.delete(roomName);
    } else {
      await setRoomData(roomName, room);
    }
  } catch (error) {
    console.error("Error decrementing room users:", error);
    throw error;
  }
};

// NPC functions - direct Map access, no serialization
export async function getNPCsFromRedis(
  roomName: string
): Promise<Map<npcId, NPC>> {
  try {
    // Get the room's NPC map directly, or create a new one if it doesn't exist
    const roomNPCs = npcStore.get(roomName);
    if (!roomNPCs) {
      return new Map();
    }
    // Return a copy to prevent external mutations
    return new Map(roomNPCs);
  } catch (error) {
    console.error(`Error getting NPCs for room ${roomName}:`, error);
    return new Map();
  }
}

export async function setNPCsInRedis(
  room: string,
  npcs: Map<npcId, NPC>
): Promise<void> {
  try {
    // Store NPCs directly in the Map - create a copy to prevent external mutations
    npcStore.set(room, new Map(npcs));
  } catch (error) {
    console.error(`Error setting NPCs for room ${room}:`, error);
    throw error;
  }
}

// Path functions - direct Map access, no serialization
export async function getpathsFromRedis(room: string): Promise<pathData[]> {
  try {
    // Get the room's path map directly, or create a new one if it doesn't exist
    const roomPaths = pathStore.get(room);
    if (!roomPaths) {
      return [];
    }
    // Return array of path values
    return Array.from(roomPaths.values());
  } catch (error) {
    console.error(`Error getting paths for room ${room}:`, error);
    return [];
  }
}

export async function getActivepathsFromRedis(
  roomName: string
): Promise<pathData[]> {
  return getpathsFromRedis(roomName);
}

export async function setPathsInRedis(
  roomName: roomId,
  paths: pathData[]
): Promise<void> {
  try {
    // Convert array to Map keyed by npcId
    const pathMap = new Map<npcId, pathData>();
    for (const path of paths) {
      pathMap.set(path.npc.id, path);
    }
    // Store paths directly in the Map
    pathStore.set(roomName, pathMap);
  } catch (error) {
    console.error(`Error setting paths for room ${roomName}:`, error);
    throw error;
  }
}

export async function getPathsMapFromRedis(
  room: string
): Promise<Map<npcId, pathData>> {
  try {
    // Get the room's path map directly, or create a new one if it doesn't exist
    const roomPaths = pathStore.get(room);
    if (!roomPaths) {
      return new Map();
    }
    // Return a copy to prevent external mutations
    return new Map(roomPaths);
  } catch (error) {
    console.error(`Error getting paths map for room ${room}:`, error);
    return new Map();
  }
}

export async function setPathsMapInRedis(
  room: string,
  paths: Map<npcId, pathData>
): Promise<void> {
  try {
    // Store paths directly in the Map - create a copy to prevent external mutations
    pathStore.set(room, new Map(paths));
  } catch (error) {
    console.error(`Error setting paths map for room ${room}:`, error);
    throw error;
  }
}

// NPC Group functions - direct Map access, no serialization
export async function getNPCGroupsFromRedis(
  roomName: string
): Promise<Map<userId, NPCGroup>> {
  try {
    // Get the room's NPC group map directly, or create a new one if it doesn't exist
    const roomGroups = npcGroupStore.get(roomName);
    if (!roomGroups) {
      return new Map();
    }
    // Return a copy to prevent external mutations
    return new Map(roomGroups);
  } catch (error) {
    console.error(`Error getting NPC groups for room ${roomName}:`, error);
    return new Map();
  }
}

export async function setNPCGroupsInRedis(
  room: string,
  groups: Map<userId, NPCGroup>
): Promise<void> {
  try {
    // Store groups directly in the Map - create a copy to prevent external mutations
    npcGroupStore.set(room, new Map(groups));
  } catch (error) {
    console.error(`Error setting NPC groups for room ${room}:`, error);
    throw error;
  }
}

export async function removeNPCFromGroupInRoomInRedis(
  roomName: string,
  captorId: userId,
  npcId: npcId
): Promise<void> {
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
  } catch (error) {
    console.error(`Error removing NPC from group in room ${roomName}:`, error);
    throw error;
  }
}

export async function removeNPCGroupInRoomInRedis(
  roomName: string,
  captorId: userId
): Promise<void> {
  try {
    // Get the room's groups map
    let roomGroups = npcGroupStore.get(roomName);
    if (!roomGroups) {
      return; // No groups for this room
    }

    roomGroups.delete(captorId);
    // Update the store
    npcGroupStore.set(roomName, roomGroups);
  } catch (error) {
    console.error(`Error removing NPC group in room ${roomName}:`, error);
    throw error;
  }
}

// Room discovery
export async function getAllRoomsFromRedis(): Promise<string[]> {
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
}

// Debug function to view current Room store state
export function debugRoomStore(): void {
  console.log("=== Room Store Debug ===");
  console.log(`Total rooms: ${roomStore.size}`);
  for (const [roomName, room] of roomStore.entries()) {
    console.log(
      `Room ${roomName}: ${room.numUsers} users, active: ${room.isActive}`
    );
  }
  console.log("========================");
}

// Debug function to view current NPC store state
export function debugNPCStore(): void {
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
export function debugNPCGroupStore(): void {
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
export function debugPathStore(): void {
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
