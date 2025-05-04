import { redisClient, get, set, setNPCsInRedis } from "./config";
import { createNPCs } from "../services/npcService";
import { v4 as uuidv4 } from "uuid";
import { NPC } from "../types";
import { deserialize, serialize } from "../utils/serializers";

interface Room {
  name: string;
  numUsers: number;
  isActive: boolean;
  lastActive: string;
  createdAt: string;
}

export const findRoomInRedis = async (): Promise<string> => {
  try {
    const roomKeys = await redisClient.keys("room:*");

    const rooms = await Promise.all(
      roomKeys.map(async (key) => {
        const roomData = await redisClient.get(key);
        return roomData ? { ...deserialize(roomData), key } : null;
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
      await incrementRoomUsersInRedis(room.name);
      return room.name;
    }

    // If no suitable room exists, create a new one
    const roomName = `room-${uuidv4()}`;
    await createRoomInRedis(roomName);
    await populateRoom(roomName);
    return roomName;
  } catch (error) {
    console.error("Error in findRoom:", error);
    throw error;
  }
};

export const incrementRoomUsersInRedis = async (
  roomName: string
): Promise<void> => {
  try {
    const roomKey = `room:${roomName}`;
    const roomData = await get(roomKey);
    if (!roomData) throw new Error(`Room ${roomName} not found`);

    const room = deserialize(roomData);
    room.numUsers += 1;
    room.lastActive = new Date().toISOString();

    await set(roomKey, serialize(room));
  } catch (error) {
    console.error("Error incrementing room users", error);
    throw error;
  }
};

const createRoomInRedis = async (roomName: string): Promise<Room> => {
  try {
    const newRoom: Room = {
      name: roomName,
      numUsers: 1,
      isActive: true,
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await set(`room:${roomName}`, serialize(newRoom));
    return newRoom;
  } catch (error) {
    console.error("Error creating room", error);
    throw error;
  }
};

export const getRoomNumUsersInRedis = async (
  roomName: string
): Promise<number> => {
  try {
    const roomKey = `room:${roomName}`;
    const roomData = await get(roomKey);
    if (!roomData) return 0;
    const room = deserialize(roomData);

    return room.numUsers;
  } catch (error) {
    console.error("Error getting room users:", error);
    throw error;
  }
};

export async function populateRoom(roomName: string): Promise<void> {
  try {
    const npcs = await createNPCs();
    const npcMap: Map<string, NPC> = new Map();

    npcs.forEach((npc) => {
      npcMap.set(npc.id, npc);
    });

    setNPCsInRedis(roomName, npcMap);
  } catch (error) {
    console.error(`Error populating room ${roomName}:`, error);
  }
}
