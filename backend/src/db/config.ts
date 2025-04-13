import { createClient } from "redis";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { populateRoom } from "../services/npcService";

dotenv.config();

export const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

export const connect = async () => {
  try {
    console.log(
      "Attempting to connect to Redis at:",
      process.env.REDIS_URL || "redis://localhost:6379"
    );
    await redisClient.connect();
    console.log("Successfully connected to Redis");
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
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

interface Room {
  name: string;
  numUsers: number;
  isActive: boolean;
  lastActive: string;
  createdAt: string;
}

export const findRoom = async (): Promise<string> => {
  try {
    console.log("Starting findRoom...");
    const roomKeys = await redisClient.keys("room:*");
    console.log("Found room keys:", roomKeys);

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

    console.log("Active rooms:", activeRooms);

    if (activeRooms.length > 0) {
      const room = activeRooms[0];
      console.log("Using existing room:", room.name);
      await incrementRoomUsers(room.name);
      return room.name;
    }

    // If no suitable room exists, create a new one
    const roomName = `room-${uuidv4()}`;
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
