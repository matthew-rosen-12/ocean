import { createClient } from "redis";
import dotenv from "dotenv";
import { NPC, NPCGroup, npcId, roomId, pathData, userId } from "../types";
import { serialize, deserialize } from "../utils/serializers";

dotenv.config();

// Track client status
let clientConnected = false;
let connectionInProgress = false;

const NPC_KEY_PREFIX = "npcs:";
const pathS_KEY_PREFIX = "paths:";
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

export const decrementRoomUsersInRedis = async (
  roomName: string,
  userId: string
): Promise<void> => {
  try {
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

      // Delete paths
      await del(`paths:${roomName}`);

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

export async function getpathsFromRedis(room: string): Promise<pathData[]> {
  try {
    const data = await get(`${pathS_KEY_PREFIX}${room}`);
    return data ? deserialize(data) : [];
  } catch (error) {
    console.error(`Error getting paths for room ${room}:`, error);
    return [];
  }
}

// Main service functions
export async function getNPCsFromRedis(
  roomName: string
): Promise<Map<npcId, NPC>> {
  // filter for npc with filename that is nb.png
  try {
    const npcsData = await get(`npcs:${roomName}`);
    if (!npcsData) return new Map();
    const npcs: Map<npcId, NPC> = deserialize(npcsData);
    return npcs;
  } catch (error) {
    console.error(`Error getting NPCs for room ${roomName}:`, error);
    return new Map();
  }
}

export async function getActivepathsFromRedis(
  roomName: string
): Promise<pathData[]> {
  const paths = await get(`paths:${roomName}`);
  return paths ? deserialize(paths) : [];
}

export async function getNPCGroupsFromRedis(
  roomName: string
): Promise<Map<userId, NPCGroup>> {
  const groups = await get(`groups:${roomName}`);
  if (!groups) return new Map();

  return deserialize(groups);
}

export async function setPathsInRedis(
  roomName: roomId,
  paths: pathData[]
): Promise<void> {
  const pathsKey = `${pathS_KEY_PREFIX}${roomName}`;
  let retries = 3;

  while (retries > 0) {
    try {
      // Watch the key for changes
      await redisClient.watch(pathsKey);

      // Start transaction
      const multi = redisClient.multi();
      multi.set(pathsKey, serialize(paths));

      // Execute transaction
      const result = await multi.exec();

      if (result === null) {
        // Key was modified, retry
        console.log(`Transaction failed for ${pathsKey}, retrying...`);
        retries--;
        continue;
      }

      // Success
      return;
    } catch (error) {
      console.error(`Error setting paths for room ${roomName}:`, error);
      retries--;
      if (retries === 0) throw error;
    } finally {
      // Unwatch in case of error or early return
      await redisClient.unwatch();
    }
  }
}

export async function setNPCsInRedis(
  room: string,
  npcs: Map<npcId, NPC>
): Promise<void> {
  const npcsKey = `${NPC_KEY_PREFIX}${room}`;
  let retries = 3;

  while (retries > 0) {
    try {
      // Watch the key for changes
      await redisClient.watch(npcsKey);

      // Start transaction
      const multi = redisClient.multi();
      multi.set(npcsKey, serialize(npcs));

      // Execute transaction
      const result = await multi.exec();

      if (result === null) {
        // Key was modified, retry
        console.log(`Transaction failed for ${npcsKey}, retrying...`);
        retries--;
        continue;
      }

      // Success
      return;
    } catch (error) {
      console.error(`Error setting NPCs for room ${room}:`, error);
      retries--;
      if (retries === 0) throw error;
    } finally {
      // Unwatch in case of error or early return
      await redisClient.unwatch();
    }
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
  const groupsKey = `${GROUPS_KEY_PREFIX}${roomName}`;
  let retries = 3;

  while (retries > 0) {
    try {
      // Watch the key for changes
      await redisClient.watch(groupsKey);

      // Get current groups
      const groups = await getNPCGroupsFromRedis(roomName);
      const group = groups.get(captorId);

      if (group) {
        group.npcIds.delete(npcId);
        groups.set(captorId, group);

        // Start transaction
        const multi = redisClient.multi();
        multi.set(groupsKey, serialize(groups));

        // Execute transaction
        const result = await multi.exec();

        if (result === null) {
          // Key was modified, retry
          console.log(`Transaction failed for ${groupsKey}, retrying...`);
          retries--;
          continue;
        }
      }

      // Success or no group found
      return;
    } catch (error) {
      console.error(
        `Error removing NPC from group in room ${roomName}:`,
        error
      );
      retries--;
      if (retries === 0) throw error;
    } finally {
      // Unwatch in case of error or early return
      await redisClient.unwatch();
    }
  }
}

export async function removeNPCGroupInRoomInRedis(
  roomName: string,
  captorId: userId
): Promise<void> {
  const groupsKey = `${GROUPS_KEY_PREFIX}${roomName}`;
  let retries = 3;

  while (retries > 0) {
    try {
      // Watch the key for changes
      await redisClient.watch(groupsKey);

      // Get current groups
      const groups = await getNPCGroupsFromRedis(roomName);
      groups.delete(captorId);

      // Start transaction
      const multi = redisClient.multi();
      multi.set(groupsKey, serialize(groups));

      // Execute transaction
      const result = await multi.exec();

      if (result === null) {
        // Key was modified, retry
        console.log(`Transaction failed for ${groupsKey}, retrying...`);
        retries--;
        continue;
      }

      // Success
      return;
    } catch (error) {
      console.error(`Error removing NPC group in room ${roomName}:`, error);
      retries--;
      if (retries === 0) throw error;
    } finally {
      // Unwatch in case of error or early return
      await redisClient.unwatch();
    }
  }
}

// Add this after the redisClient definition
// Simple Redis connection pool implementation
class RedisConnectionPool {
  private pool: Array<any> = [];
  private maxSize: number = 5;
  private inUse: Set<any> = new Set();

  constructor(maxSize: number = 5) {
    this.maxSize = maxSize;
    console.log(`Created Redis connection pool with max size ${maxSize}`);
  }

  async getClient() {
    // Check if we have an available client
    if (this.pool.length > 0) {
      const client = this.pool.pop();
      this.inUse.add(client);
      return client;
    }

    // If pool is empty but we haven't reached max, create new client
    if (this.inUse.size < this.maxSize) {
      const client = createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
      });

      await client.connect();
      this.inUse.add(client);
      return client;
    }

    // Pool is at capacity, wait for a connection to become available
    console.log(
      "Redis connection pool at capacity, waiting for available connection"
    );
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.pool.length > 0) {
          clearInterval(checkInterval);
          const client = this.pool.pop();
          this.inUse.add(client);
          resolve(client);
        }
      }, 100);
    });
  }

  releaseClient(client: any) {
    if (this.inUse.has(client)) {
      this.inUse.delete(client);
      this.pool.push(client);
    }
  }

  async closeAll() {
    // Close all connections in the pool
    for (const client of this.pool) {
      await client.quit();
    }

    // Close all in-use connections
    for (const client of this.inUse) {
      await client.quit();
    }

    this.pool = [];
    this.inUse.clear();
  }
}

// Create a pool instance
export const redisPool = new RedisConnectionPool(10);

// Helper function to perform a transaction with a pooled connection
export async function withRedisTransaction<T>(
  operation: (client: any) => Promise<T>
): Promise<T> {
  const client = await redisPool.getClient();

  try {
    return await operation(client);
  } finally {
    redisPool.releaseClient(client);
  }
}
