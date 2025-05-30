import {
  getRoomData,
  setRoomData,
  setNPCsInRedis,
  getAllRoomKeys,
  Room,
} from "./config";
import { createNPCs } from "../services/npcService";
import { v4 as uuidv4 } from "uuid";
import { NPC } from "../types";

export const findRoomInRedis = async (): Promise<string> => {
  try {
    const roomKeys = await getAllRoomKeys();

    const rooms = await Promise.all(
      roomKeys.map(async (roomName) => {
        const roomData = await getRoomData(roomName);
        return roomData ? { ...roomData, key: roomName } : null;
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
    const room = await getRoomData(roomName);
    if (!room) throw new Error(`Room ${roomName} not found`);

    room.numUsers += 1;
    room.lastActive = new Date().toISOString();

    await setRoomData(roomName, room);
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

    await setRoomData(roomName, newRoom);
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
    const room = await getRoomData(roomName);
    if (!room) return 0;

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
