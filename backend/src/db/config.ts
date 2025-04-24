import { createClient } from "redis";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { populateRoom } from "../services/npcService";
import { NPC } from "../types";

dotenv.config();

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
  console.log("Current Redis connection state:", {
    isOpen: redisClient.isOpen,
    isReady: redisClient.isReady,
  });
});

redisClient.on("connect", () => {
  console.log("Redis Client Connected");
  console.log("Connection details:", {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    isOpen: redisClient.isOpen,
    isReady: redisClient.isReady,
  });
});

redisClient.on("reconnecting", () => {
  console.log("Redis Client Reconnecting");
  console.log("Reconnection attempt details:", {
    isOpen: redisClient.isOpen,
    isReady: redisClient.isReady,
  });
});

redisClient.on("ready", () => {
  console.log("Redis Client Ready");
  console.log("Ready state details:", {
    isOpen: redisClient.isOpen,
    isReady: redisClient.isReady,
  });
});

redisClient.on("end", () => {
  console.log("Redis Client Connection Ended");
  console.log("End state details:", {
    isOpen: redisClient.isOpen,
    isReady: redisClient.isReady,
  });
});

export const connect = async () => {
  try {
    if (!redisClient.isOpen) {
      console.log(
        "Attempting to connect to Redis at:",
        process.env.REDIS_URL || "redis://localhost:6379"
      );
      await redisClient.connect();
    } else {
      console.log("Redis client already connected, current state:", {
        isOpen: redisClient.isOpen,
        isReady: redisClient.isReady,
      });
    }
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    console.log("Connection failure state:", {
      isOpen: redisClient.isOpen,
      isReady: redisClient.isReady,
    });
    throw error;
  }
};

export const get = async (key: string): Promise<string | null> => {
  try {
    return await redisClient.get(key);
  } catch (error) {
    console.error("Error getting from Redis", { key, error });
    throw error;
  }
};

export const hgetall = async (key: string): Promise<Record<string, string>> => {
  try {
    return await redisClient.hGetAll(key);
  } catch (error) {
    console.error("Error getting from Redis", { key, error });
    throw error;
  }
};

export const set = async (key: string, value: string): Promise<void> => {
  try {
    await redisClient.set(key, value);
  } catch (error) {
    console.error("Error setting in Redis", { key, value, error });
    throw error;
  }
};

export const del = async (key: string): Promise<void> => {
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error("Error deleting from Redis", { key, error });
    throw error;
  }
};

export const keys = async (key: string): Promise<string[]> => {
  try {
    return await redisClient.keys(key);
  } catch (error) {
    console.error("Error getting keys from Redis", { key, error });
    throw error;
  }
};
interface Room {
  name: string;
  numUsers: number;
  isActive: boolean;
  lastActive: string;
  createdAt: string;
}

export const findRoom = async (): Promise<string> => {
  try {
    const roomKeys = await redisClient.keys("room:*");

    const rooms = await Promise.all(
      roomKeys.map(async (key) => {
        const roomData = await redisClient.get(key);
        return roomData ? { ...JSON.parse(roomData), key } : null;
      })
    );

    const activeRooms = rooms
      .filter(
        (room): room is Room & { key: string } =>
          room !== null && room.isActive !== false && room.numUsers < 10
      )
      .sort((a, b) => a.numUsers - b.numUsers);

    if (activeRooms.length > 0) {
      const room = activeRooms[0];
      await incrementRoomUsers(room.name);
      return room.name;
    }

    // If no suitable room exists, create a new one
    const roomName = `room-${uuidv4()}`;
    console.log("Creating new room:", roomName);
    await createRoom(roomName);
    await populateRoom(roomName);
    return roomName;
  } catch (error) {
    console.error("Error in findRoom:", error);
    throw error;
  }
};

export const incrementRoomUsers = async (roomName: string): Promise<void> => {
  try {
    const roomKey = `room:${roomName}`;
    const roomData = await get(roomKey);
    if (!roomData) throw new Error(`Room ${roomName} not found`);

    const room = JSON.parse(roomData);
    room.numUsers += 1;
    room.lastActive = new Date().toISOString();

    await set(roomKey, JSON.stringify(room));
  } catch (error) {
    console.error("Error incrementing room users", error);
    throw error;
  }
};

export async function decrementRoomUsers(roomName: string) {
  console.log("Decrementing room users for:", roomName);
  try {
    const roomData = await get(`room:${roomName}`);
    if (!roomData) return;

    const room = JSON.parse(roomData);
    room.numUsers = (room.numUsers || 1) - 1;

    if (room.numUsers <= 0) {
      // Delete the room if empty
      await del(`room:${roomName}`);
    } else {
      // Update the room with new user count
      await set(`room:${roomName}`, JSON.stringify(room));
    }
  } catch (error) {
    console.error("Error decrementing room users:", error);
  }
}

const createRoom = async (roomName: string): Promise<Room> => {
  try {
    const newRoom: Room = {
      name: roomName,
      numUsers: 1,
      isActive: true,
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await set(`room:${roomName}`, JSON.stringify(newRoom));
    return newRoom;
  } catch (error) {
    console.error("Error creating room", error);
    throw error;
  }
};

// Socket to room mapping functions
export const addSocketToRoom = async (
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

export const removeSocketFromRoom = async (socketId: string): Promise<void> => {
  try {
    await redisClient.del(`socket:${socketId}`);
  } catch (error) {
    console.error("Error removing socket from room mapping:", error);
    throw error;
  }
};

export const getSocketRoom = async (
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
