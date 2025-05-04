import { createClient } from "redis";
import dotenv from "dotenv";
import { NPC, NPCGroup, npcId, roomId, throwData, userId } from "../types";
import { serialize, deserialize } from "../utils/serializers";

dotenv.config();

// Track client status
let clientConnected = false;
let connectionInProgress = false;

const NPC_KEY_PREFIX = "npcs:";
const THROWS_KEY_PREFIX = "throws:";
const GROUPS_KEY_PREFIX = "groups:";

export const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error("Max reconnection attempts reached");
        return new Error("Max reconnection attempts reached");
      }
      return Math.min(retries * 100, 3000); // Exponential backoff up to 3 seconds
    },
    keepAlive: 10000, // Send keepalive packet every 10 seconds
    connectTimeout: 10000, // Timeout after 10 seconds
  },
});

// Connection state logging
redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
  clientConnected = false;
  console.log("Current Redis connection state:", {
    isOpen: redisClient.isOpen,
    isReady: redisClient.isReady,
    clientConnected,
  });
});

redisClient.on("connect", () => {
  console.log("Redis Client Connected");
  clientConnected = true;
  console.log("Connection details:", {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    isOpen: redisClient.isOpen,
    isReady: redisClient.isReady,
    clientConnected,
  });
});

redisClient.on("reconnecting", () => {
  console.log("Redis Client Reconnecting");
  console.log("Reconnection attempt details:", {
    isOpen: redisClient.isOpen,
    isReady: redisClient.isReady,
    clientConnected,
  });
});

redisClient.on("ready", () => {
  console.log("Redis Client Ready");
  clientConnected = true;
  console.log("Ready state details:", {
    isOpen: redisClient.isOpen,
    isReady: redisClient.isReady,
    clientConnected,
  });
});

redisClient.on("end", () => {
  console.log("Redis Client Connection Ended");
  clientConnected = false;
  console.log("End state details:", {
    isOpen: redisClient.isOpen,
    isReady: redisClient.isReady,
    clientConnected,
  });
});

// Helper to ensure Redis client is connected
async function ensureConnected() {
  if (clientConnected && redisClient.isReady) {
    return true;
  }

  if (connectionInProgress) {
    // Wait for current connection attempt to finish
    let attempts = 0;
    while (connectionInProgress && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (clientConnected) return true;
  }

  connectionInProgress = true;

  try {
    console.log("Ensuring Redis client is connected, current state:", {
      isOpen: redisClient.isOpen,
      isReady: redisClient.isReady,
      clientConnected,
    });

    if (!redisClient.isOpen) {
      console.log(
        "Attempting to connect to Redis at:",
        process.env.REDIS_URL || "redis://localhost:6379"
      );
      await redisClient.connect();
    }

    clientConnected = true;
    return true;
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    clientConnected = false;
    throw error;
  } finally {
    connectionInProgress = false;
  }
}

export const connect = async () => {
  return ensureConnected();
};

export const get = async (key: string): Promise<string | null> => {
  try {
    await ensureConnected();
    return await redisClient.get(key);
  } catch (error) {
    console.error("Error getting from Redis", { key, error });
    throw error;
  }
};

export const set = async (key: string, value: string): Promise<void> => {
  try {
    await ensureConnected();
    await redisClient.set(key, value);
  } catch (error) {
    console.error("Error setting in Redis", { key, value, error });
    throw error;
  }
};

const del = async (key: string): Promise<void> => {
  try {
    await ensureConnected();
    await redisClient.del(key);
  } catch (error) {
    console.error("Error deleting from Redis", { key, error });
    throw error;
  }
};

const keys = async (key: string): Promise<string[]> => {
  try {
    await ensureConnected();
    return await redisClient.keys(key);
  } catch (error) {
    console.error("Error getting keys from Redis", { key, error });
    throw error;
  }
};

// Socket to user mapping functions
export const mapSocketToUserInRedis = async (
  socketId: string,
  userId: string
): Promise<void> => {
  try {
    // Create bidirectional mapping
    await redisClient.set(`socket_to_user:${socketId}`, userId);
    await redisClient.sAdd(`user_sockets:${userId}`, socketId);
  } catch (error) {
    console.error("Error mapping socket to user:", error);
    throw error;
  }
};

export const getUserIdFromSocketInRedis = async (
  socketId: string
): Promise<string | null> => {
  try {
    return await redisClient.get(`socket_to_user:${socketId}`);
  } catch (error) {
    console.error("Error getting userId from socket:", error);
    throw error;
  }
};

export const getSocketsFromUserIdInRedis = async (
  userId: string
): Promise<string[]> => {
  try {
    return await redisClient.sMembers(`user_sockets:${userId}`);
  } catch (error) {
    console.error("Error getting sockets from userId:", error);
    throw error;
  }
};

export const removeSocketUserMappingInRedis = async (
  socketId: string
): Promise<void> => {
  try {
    // Get userId before removing the mapping
    const userId = await getUserIdFromSocketInRedis(socketId);
    if (!userId) return;

    // Remove socket from user's socket set
    await redisClient.sRem(`user_sockets:${userId}`, socketId);

    // Check if this was the user's last socket
    const remainingSockets = await redisClient.sMembers(
      `user_sockets:${userId}`
    );
    if (remainingSockets.length === 0) {
      // If no sockets left, clean up the user's socket set
      await redisClient.del(`user_sockets:${userId}`);
    }

    // Remove the socket mapping
    await redisClient.del(`socket_to_user:${socketId}`);
  } catch (error) {
    console.error("Error removing socket user mapping:", error);
    throw error;
  }
};

// Modified to work with userId instead of socketId
export const decrementRoomUsersInRedis = async (
  roomName: string,
  socketId: string
): Promise<void> => {
  try {
    // Get userId from socketId
    const userId = await getUserIdFromSocketInRedis(socketId);
    if (!userId) {
      console.error("No userId found for socket:", socketId);
      return;
    }

    const roomKey = `room:${roomName}`;

    // Get room data using get instead of hGetAll
    const roomData = await get(roomKey);
    if (!roomData) {
      console.error("Room not found:", roomName);
      return;
    }

    // Parse room data
    const room = deserialize(roomData);

    if (!room) {
      console.error("Room has no users array:", roomName);
      return;
    }

    room.numUsers -= 1;
    room.lastActive = new Date().toISOString();

    if (room.numUsers === 0) {
      // Room is empty, delete all associated data
      console.log("Deleting room and all associated data:", roomName);

      // Delete room data
      await del(roomKey);

      // Delete NPCs
      await del(`npcs:${roomName}`);

      // Delete throws
      await del(`throws:${roomName}`);

      // Delete NPC groups
      await del(`npcGroups:${roomName}`);

      // Delete any other room-specific data
      const roomPattern = `${roomName}:*`;
      const roomKeys = await keys(roomPattern);
      if (roomKeys.length > 0) {
        // Delete each key individually
        for (const key of roomKeys) {
          await del(key);
        }
      }
    } else {
      // Update room with remaining users
      await set(roomKey, serialize(room));
    }
  } catch (error) {
    console.error("Error decrementing room users:", error);
    throw error;
  }
};

// Socket to room mapping functions
export const addSocketToRoomInRedis = async (
  socketId: string,
  roomName: string
): Promise<void> => {
  try {
    await redisClient.hSet(`socket:${socketId}`, "room", roomName);
  } catch (error) {
    console.error("Error adding socket to room mapping:", error);
    throw error;
  }
};

export const removeSocketFromRoomInRedis = async (
  socketId: string
): Promise<void> => {
  try {
    await redisClient.del(`socket:${socketId}`);
  } catch (error) {
    console.error("Error removing socket from room mapping:", error);
    throw error;
  }
};

export const getSocketRoomInRedis = async (
  socketId: string
): Promise<string | null> => {
  try {
    const room = await redisClient.hGet(`socket:${socketId}`, "room");
    return room || null;
  } catch (error) {
    console.error("Error getting socket room:", error);
    throw error;
  }
};

export async function getThrowsFromRedis(room: string): Promise<throwData[]> {
  try {
    const data = await get(`${THROWS_KEY_PREFIX}${room}`);
    return data ? deserialize(data) : [];
  } catch (error) {
    console.error(`Error getting throws for room ${room}:`, error);
    return [];
  }
}

// Main service functions
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

export async function getActiveThrowsFromRedis(
  roomName: string
): Promise<throwData[]> {
  const throws = await get(`throws:${roomName}`);
  return throws ? deserialize(throws) : [];
}

export async function getNPCGroupsFromRedis(
  roomName: string
): Promise<Map<userId, NPCGroup>> {
  const groups = await get(`groups:${roomName}`);
  if (!groups) return new Map();

  return deserialize(groups);
}

export async function setNPCGroupsInRedis(
  roomName: roomId,
  groups: Map<userId, NPCGroup>
): Promise<void> {
  try {
    await set(`${GROUPS_KEY_PREFIX}${roomName}`, serialize(groups));
  } catch (error) {
    console.error(`Error setting NPC groups for room ${roomName}:`, error);
    throw error;
  }
}

export async function setThrowsInRedis(
  roomName: roomId,
  throws: throwData[]
): Promise<void> {
  try {
    await set(`${THROWS_KEY_PREFIX}${roomName}`, serialize(throws));
  } catch (error) {
    console.error(`Error setting throws for room ${roomName}:`, error);
    throw error;
  }
}

export async function setNPCsInRedis(
  room: string,
  npcs: Map<npcId, NPC>
): Promise<void> {
  try {
    await set(`${NPC_KEY_PREFIX}${room}`, serialize(npcs));
  } catch (error) {
    console.error(`Error setting NPCs for room ${room}:`, error);
    throw error;
  }
}

export async function getAllRoomsFromRedis(): Promise<string[]> {
  const room_keys = await keys(`${NPC_KEY_PREFIX}*`);

  // Extract the channel names from the keys
  return room_keys.map((key: string) => key.substring(NPC_KEY_PREFIX.length));
}

export async function removeNPCFromGroupInRoomInRedis(
  roomName: string,
  captorId: userId,
  npcId: npcId
): Promise<void> {
  const groups = await getNPCGroupsFromRedis(roomName);
  const group = groups.get(captorId);

  if (group) {
    group.npcIds.delete(npcId);
    await setNPCGroupsInRedis(roomName, groups);
  }
}

export async function removeNPCGroupInRoomInRedis(
  roomName: string,
  captorId: userId
): Promise<void> {
  const groups = await getNPCGroupsFromRedis(roomName);
  groups.delete(captorId);
  await setNPCGroupsInRedis(roomName, groups);
}
