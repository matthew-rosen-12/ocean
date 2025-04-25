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

// Socket to user mapping functions
export const mapSocketToUser = async (
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

export const getUserIdFromSocket = async (
  socketId: string
): Promise<string | null> => {
  try {
    return await redisClient.get(`socket_to_user:${socketId}`);
  } catch (error) {
    console.error("Error getting userId from socket:", error);
    throw error;
  }
};

export const getSocketsFromUserId = async (
  userId: string
): Promise<string[]> => {
  try {
    return await redisClient.sMembers(`user_sockets:${userId}`);
  } catch (error) {
    console.error("Error getting sockets from userId:", error);
    throw error;
  }
};

export const removeSocketUserMapping = async (
  socketId: string
): Promise<void> => {
  try {
    // Get userId before removing the mapping
    const userId = await getUserIdFromSocket(socketId);
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
export const decrementRoomUsers = async (
  roomName: string,
  socketId: string
): Promise<void> => {
  try {
    // Get userId from socketId
    const userId = await getUserIdFromSocket(socketId);
    if (!userId) {
      console.error("No userId found for socket:", socketId);
      return;
    }

    // Check if this is the user's last socket
    const remainingSockets = await getSocketsFromUserId(userId);
    if (remainingSockets.length > 1) {
      console.log(
        `User ${userId} still has ${
          remainingSockets.length - 1
        } active connections. Not removing from room.`
      );
      return; // User still has other connections, don't remove from room
    }

    const roomKey = `room:${roomName}`;
    const room = await redisClient.hGetAll(roomKey);

    if (!room || !room.users) {
      console.error("Room not found or has no users:", roomName);
      return;
    }

    const users = JSON.parse(room.users);
    const updatedUsers = users.filter((id: string) => id !== userId);

    if (updatedUsers.length === 0) {
      // Room is empty, delete all associated data
      console.log("Deleting room and all associated data:", roomName);

      // Delete room data
      await redisClient.del(roomKey);

      // Delete NPCs
      await redisClient.del(`npcs:${roomName}`);

      // Delete throws
      await redisClient.del(`throws:${roomName}`);

      // Delete NPC groups
      await redisClient.del(`npcGroups:${roomName}`);

      // Delete any other room-specific data
      const roomPattern = `${roomName}:*`;
      const roomKeys = await redisClient.keys(roomPattern);
      if (roomKeys.length > 0) {
        await redisClient.del(roomKeys);
      }
    } else {
      // Update room with remaining users
      await redisClient.hSet(roomKey, "users", JSON.stringify(updatedUsers));
    }
  } catch (error) {
    console.error("Error decrementing room users:", error);
    throw error;
  }
};

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

// User management functions
export const addUser = async (userId: string, userInfo: any): Promise<void> => {
  try {
    // Convert userInfo object to array of field-value pairs
    const entries = Object.entries(userInfo);
    if (entries.length === 0) return;

    // Use hSet with field-value pairs
    const tuples: [string, string][] = entries.map(([field, value]) => [
      field,
      String(value),
    ]);
    await redisClient.hSet(`user:${userId}`, tuples);
  } catch (error) {
    console.error("Error adding user:", error);
    throw error;
  }
};

export const removeUser = async (userId: string): Promise<void> => {
  try {
    await redisClient.del(`user:${userId}`);
  } catch (error) {
    console.error("Error removing user:", error);
    throw error;
  }
};

export const getUser = async (userId: string): Promise<any | null> => {
  try {
    const userData = await redisClient.hGetAll(`user:${userId}`);
    return Object.keys(userData).length > 0 ? userData : null;
  } catch (error) {
    console.error("Error getting user:", error);
    throw error;
  }
};

// Room user management functions
export const addUserToRoom = async (
  roomName: string,
  userId: string
): Promise<void> => {
  try {
    const roomKey = `room:${roomName}`;
    const roomData = await get(roomKey);
    let room = roomData
      ? JSON.parse(roomData)
      : {
          name: roomName,
          numUsers: 0,
          isActive: true,
          lastActive: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          users: [],
        };

    room.users = room.users || [];
    if (!room.users.includes(userId)) {
      room.users.push(userId);
      room.numUsers = room.users.length;
      room.lastActive = new Date().toISOString();
      await set(roomKey, JSON.stringify(room));
    }
  } catch (error) {
    console.error("Error adding user to room:", error);
    throw error;
  }
};

export const getRoomUsers = async (
  roomName: string
): Promise<Record<string, any>> => {
  try {
    const roomKey = `room:${roomName}`;
    const roomData = await get(roomKey);
    if (!roomData) return {};

    const room = JSON.parse(roomData);
    const users: Record<string, any> = {};

    if (room.users) {
      for (const userId of room.users) {
        const userData = await getUser(userId);
        if (userData) {
          users[userId] = userData;
        }
      }
    }

    return users;
  } catch (error) {
    console.error("Error getting room users:", error);
    throw error;
  }
};
