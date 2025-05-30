import { NPC, NPCGroup, npcId, roomId, pathData, userId } from "../types";
import { serialize, deserialize } from "../utils/serializers";

// Simple in-memory storage to replace Redis
const inMemoryStore: { [key: string]: string } = {};

// Helper functions that replace Redis operations
export const connect = async () => {
  console.log("Using in-memory storage (no Redis connection needed)");
  return true;
};

export const get = async (key: string): Promise<string | null> => {
  return inMemoryStore[key] || null;
};

export const set = async (key: string, value: string): Promise<void> => {
  inMemoryStore[key] = value;
};

const del = async (key: string): Promise<void> => {
  delete inMemoryStore[key];
};

export const keys = async (pattern: string): Promise<string[]> => {
  // Simple pattern matching - convert Redis pattern to regex
  const regexPattern = pattern.replace(/\*/g, ".*");
  const regex = new RegExp(regexPattern);
  return Object.keys(inMemoryStore).filter((key) => regex.test(key));
};

// Room management functions
export const decrementRoomUsersInRedis = async (
  roomName: string,
  userId: string
): Promise<void> => {
  try {
    const roomKey = `room:${roomName}`;
    const roomData = await get(roomKey);

    if (!roomData) {
      console.error("Room not found:", roomName);
      return;
    }

    const room = deserialize(roomData);
    if (!room) {
      console.error("Room has no users array:", roomName);
      return;
    }

    room.numUsers -= 1;
    room.lastActive = new Date().toISOString();

    if (room.numUsers === 0) {
      console.log("Deleting room and all associated data:", roomName);

      // Delete all room-related keys
      await del(roomKey);
      await del(`npcs:${roomName}`);
      await del(`paths:${roomName}`);
      await del(`npcGroups:${roomName}`);

      // Delete any other room-specific data
      const roomPattern = `${roomName}:*`;
      const roomKeys = await keys(roomPattern);
      for (const key of roomKeys) {
        await del(key);
      }
    } else {
      await set(roomKey, serialize(room));
    }
  } catch (error) {
    console.error("Error decrementing room users:", error);
    throw error;
  }
};

// NPC functions
export async function getNPCsFromRedis(
  roomName: string
): Promise<Map<npcId, NPC>> {
  try {
    const npcsData = await get(`npcs:${roomName}`);
    if (!npcsData) return new Map();
    return deserialize(npcsData);
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
    await set(`npcs:${room}`, serialize(npcs));
  } catch (error) {
    console.error(`Error setting NPCs for room ${room}:`, error);
    throw error;
  }
}

// Path functions
export async function getpathsFromRedis(room: string): Promise<pathData[]> {
  try {
    const data = await get(`paths:${room}`);
    return data ? deserialize(data) : [];
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
    await set(`paths:${roomName}`, serialize(paths));
  } catch (error) {
    console.error(`Error setting paths for room ${roomName}:`, error);
    throw error;
  }
}

// NPC Group functions
export async function getNPCGroupsFromRedis(
  roomName: string
): Promise<Map<userId, NPCGroup>> {
  try {
    const groups = await get(`groups:${roomName}`);
    if (!groups) return new Map();
    return deserialize(groups);
  } catch (error) {
    console.error(`Error getting NPC groups for room ${roomName}:`, error);
    return new Map();
  }
}

export async function removeNPCFromGroupInRoomInRedis(
  roomName: string,
  captorId: userId,
  npcId: npcId
): Promise<void> {
  try {
    const groups = await getNPCGroupsFromRedis(roomName);
    const group = groups.get(captorId);

    if (group) {
      group.npcIds.delete(npcId);
      groups.set(captorId, group);
      await set(`groups:${roomName}`, serialize(groups));
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
    const groups = await getNPCGroupsFromRedis(roomName);
    groups.delete(captorId);
    await set(`groups:${roomName}`, serialize(groups));
  } catch (error) {
    console.error(`Error removing NPC group in room ${roomName}:`, error);
    throw error;
  }
}

// Room discovery
export async function getAllRoomsFromRedis(): Promise<string[]> {
  const room_keys = await keys(`npcs:*`);
  return room_keys.map((key: string) => key.substring(5)); // Remove "npcs:" prefix
}
