import { createNPCGroups } from "../npc-group-service";
import { v4 as uuidv4 } from "uuid";
import { NPCGroupsBiMap, roomId } from "shared/types";
import { deleteNPCGroupsInMemory, setNPCGroupsInMemory } from "./npc-groups";
import { deletePathsInMemory } from "./paths";
export interface Room {
  name: string;
  numUsers: number;
  isActive: boolean;
  lastActive: string;
  createdAt: string;
}

const rooms: Map<roomId, Room> = new Map();

// Room management functions
export const getRoomDataInMemory = (roomName: string): Room | null => {
  return rooms.get(roomName) || null;
};

export const setRoomDataInMemory = (
  roomName: string,
  room: Room
): void => {
  rooms.set(roomName, room);
};

export const deleteRoomDataInMemory = (roomName: string): void => {
  rooms.delete(roomName);
};

export const getAllRoomKeysInMemory = (): string[] => {
  return Array.from(rooms.keys());
};

export const decrementRoomUsersInMemory = (
  roomName: string,
  _userId: string
): void => {
  try {
    const room =  getRoomDataInMemory(roomName);

    if (!room) {
      console.error("Room not found:", roomName);
      return;
    }

    room.numUsers -= 1;
    room.lastActive = new Date().toISOString();

    if (room.numUsers === 0) {
      console.log("Deleting room and all associated data:", roomName);

      // Delete room and all associated data from dedicated stores
      deleteRoomDataInMemory(roomName);
      deleteNPCGroupsInMemory(roomName);
      deletePathsInMemory(roomName);
    } else {
       setRoomDataInMemory(roomName, room);
    }
  } catch (error) {
    console.error("Error decrementing room users:", error);
    throw error;
  }
};

export const findRoomInMemory = (): string => {
  try {
    const roomKeys =  getAllRoomKeysInMemory();

    const rooms =  
      roomKeys.map((roomName) => {
        const roomData =  getRoomDataInMemory(roomName);
        return roomData ? { ...roomData, key: roomName } : null;
      })

    const activeRooms = rooms
      .filter(
        (room): room is Room & { key: string } =>
          room !== null && room.isActive !== false && room.numUsers < 10
      )
      .sort((a, b) => a.numUsers - b.numUsers);

    if (activeRooms.length > 0) {
      const room = activeRooms[0];
       incrementRoomUsersInMemory(room.name);
      return room.name;
    }

    // If no suitable room exists, create a new one
    const roomName = `room-${uuidv4()}`;
    createRoomInMemory(roomName);
     populateRoomInMemory(roomName);
    return roomName;
  } catch (error) {
    console.error("Error in findRoom:", error);
    throw error;
  }
};

export const incrementRoomUsersInMemory = (
  roomName: string
): void => {
  try {
    const room = getRoomDataInMemory(roomName);
    if (!room) throw new Error(`Room ${roomName} not found`);

    room.numUsers += 1;
    room.lastActive = new Date().toISOString();

    setRoomDataInMemory(roomName, room);
  } catch (error) {
    console.error("Error incrementing room users", error);
    throw error;
  }
};

const createRoomInMemory = (roomName: string): Room => {
  try {
    const newRoom: Room = {
      name: roomName,
      numUsers: 1,
      isActive: true,
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    setRoomDataInMemory(roomName, newRoom);
    return newRoom;
  } catch (error) {
    console.error("Error creating room", error);
    throw error;
  }
};

export const getRoomNumUsersInMemory = (
  roomName: string
): number => {
  try {
    const room = getRoomDataInMemory(roomName);
    if (!room) return 0;

    return room.numUsers;
  } catch (error) {
    console.error("Error getting room users:", error);
    throw error;
  }
};

export function populateRoomInMemory(roomName: string): void {
  try {
    const npcGroups = createNPCGroups();
    const npcGroupsMap: NPCGroupsBiMap = new NPCGroupsBiMap();

    npcGroups.forEach((npcGroup) => {
      npcGroupsMap.setByNpcGroupId(npcGroup.id, npcGroup);
    });

    setNPCGroupsInMemory(roomName, npcGroupsMap);
  } catch (error) {
    console.error(`Error populating room ${roomName}:`, error);
  }
}

export function getAllRoomsfromMemory(): string[] {
  // Get room names from all stores, merge and deduplicate
  const roomDataKeys = Array.from(rooms.keys());
  const npcRooms = getAllRoomKeysInMemory();
  const groupRooms = getAllRoomKeysInMemory();
  const pathRooms = getAllRoomKeysInMemory();
  const allRooms = new Set([
    ...roomDataKeys,
    ...npcRooms,
    ...groupRooms,
    ...pathRooms,
  ]);
  return Array.from(allRooms);
}
