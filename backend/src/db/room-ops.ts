import {
  getRoomData,
  setRoomData,
  setNPCsInMemory,
  getAllRoomKeys,
  Room,
} from "./config";
import { createNPCs } from "../services/npcService";
import { v4 as uuidv4 } from "uuid";
import { NPC } from "../types";

export const findRoomInMemory = async (): Promise<string> => {
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
      await incrementRoomUsersInMemory(room.name);
      return room.name;
    }

    // If no suitable room exists, create a new one
    const roomName = `room-${uuidv4()}`;
    await createRoomInMemory(roomName);
    await populateRoom(roomName);
    return roomName;
  } catch (error) {
    console.error("Error in findRoom:", error);
    throw error;
  }
};

export const incrementRoomUsersInMemory = async (
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

const createRoomInMemory = async (roomName: string): Promise<Room> => {
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

export const getRoomNumUsersInMemory = async (
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

    setNPCsInMemory(roomName, npcMap);
  } catch (error) {
    console.error(`Error populating room ${roomName}:`, error);
  }
}
