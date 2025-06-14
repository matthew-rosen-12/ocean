import { NPC, roomId, userId, npcId } from "../types";
import { addNPCToGroupInMemory } from "./npcGroups";

const npcs: Map<roomId, Map<npcId, NPC>> = new Map();

// NPC functions - direct Map access, no serialization
export function getNPCsfromMemory(
  roomName: string
): Map<npcId, NPC>{
  try {
    // Get the room's NPC map directly, or create a new one if it doesn't exist
    const roomNPCs = npcs.get(roomName);
    if (!roomNPCs) {
      return new Map();
    }
    // Return a copy to prevent external mutations
    return new Map(roomNPCs);
  } catch (error) {
    console.error(`Error getting NPCs for room ${roomName}:`, error);
    return new Map();
  }
}

export function setNPCsInMemory(
  room: string,
  newNPCs: Map<npcId, NPC>
): void {
  try {
    // Store NPCs directly in the Map - create a copy to prevent external mutations
    npcs.set(room, new Map(newNPCs));
  } catch (error) {
    console.error(`Error setting NPCs for room ${room}:`, error);
    throw error;
  }
}

// Direct NPC operations - no read-modify-set needed
export function setNPCInMemory(
  roomName: string,
  npcId: npcId,
  npc: NPC
): void {
  try {
    let roomNPCs = npcs.get(roomName);
    if (!roomNPCs) {
      roomNPCs = new Map();
      npcs.set(roomName, roomNPCs);
    }
    roomNPCs.set(npcId, npc);
  } catch (error) {
    console.error(`Error setting NPC ${npcId} in room ${roomName}:`, error);
    throw error;
  }
}

export function deleteNPCInMemory(
  roomName: string,
  npcId: npcId
): void {
  try {
    const roomNPCs = npcs.get(roomName);
    if (roomNPCs) {
      roomNPCs.delete(npcId);
    }
  } catch (error) {
    console.error(`Error deleting NPC ${npcId} from room ${roomName}:`, error);
    throw error;
  }
}


export function updateNPCInRoomInMemory(
  roomName: roomId,
  npc: NPC
): void {
  try {
    // Direct set operation - no read-modify-set needed
    setNPCInMemory(roomName, npc.id, npc);
  } catch (error) {
    console.error(`Error updating NPC in room ${roomName}:`, error);
    throw error;
  }
}

export function updateNPCGroupInRoomInMemory(
  roomName: roomId,
  captorId: userId,
  npcId: npcId
): void {
  try {
    // Direct add operation - no read-modify-set needed
    addNPCToGroupInMemory(roomName, captorId, npcId);
  } catch (error) {
    console.error(`Error updating NPC group in room ${roomName}:`, error);
    throw error;
  }
}


export function deleteNPCsInMemory(roomName: string): void {
  npcs.delete(roomName);
}