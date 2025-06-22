import { createNPCGroups } from "../services/npc-group-service";
import { BotManagementService } from "../services/bot-management-service";
import { v4 as uuidv4 } from "uuid";
import { NPCGroupsBiMap, roomId } from "shared/types";
import { setNPCGroupsInMemory } from "./npc-groups";
import { getTerrainConfig } from "./terrain";
export interface Room {
  name: string;
  numUsers: number;
  isActive: boolean;
  lastActive: string;
  createdAt: string;
}

const rooms: Map<roomId, Room> = new Map();

// Room management functions
const getRoomDataInMemory = (roomName: string): Room | null => {
  return rooms.get(roomName) || null;
};

const setRoomDataInMemory = (
  roomName: string,
  room: Room
): void => {
  rooms.set(roomName, room);
};

const deleteRoomDataInMemory = (roomName: string): void => {
  rooms.delete(roomName);
};

const getAllRoomKeysInMemory = (): string[] => {
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

      // Stop bot spawning for this room
      BotManagementService.stopBotSpawning(roomName);
      
      // Delete room and all associated data from dedicated stores
      deleteRoomDataInMemory(roomName);
      // Note: NPC groups and paths cleanup handled elsewhere
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

    const currentTime = Date.now();
    const ROOM_JOIN_WINDOW = 30 * 1000; // 30 seconds in milliseconds

    const activeRooms = rooms
      .filter(
        (room): room is Room & { key: string } => {
          if (!room || room.isActive === false || room.numUsers >= 8) {
            return false;
          }
          
          // Check if room is less than 30 seconds old
          const roomAge = currentTime - new Date(room.createdAt).getTime();
          return roomAge < ROOM_JOIN_WINDOW;
        }
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

const incrementRoomUsersInMemory = (
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
    
    // Start bot spawning process for new room
    BotManagementService.startBotSpawning(roomName);
    
    return newRoom;
  } catch (error) {
    console.error("Error creating room", error);
    throw error;
  }
};


const populateRoomInMemory = (roomName: string): void => {
  try {
    // Get terrain boundaries for proper NPC spawning
    const terrainConfig = getTerrainConfig(roomName);
    const terrainBoundaries = terrainConfig.boundaries;
    
    const npcGroups = createNPCGroups(terrainBoundaries);
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
