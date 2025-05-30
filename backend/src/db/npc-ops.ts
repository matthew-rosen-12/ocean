import { NPC, roomId, userId, npcId } from "../types";
import { setNPCInMemory, addNPCToGroupInMemory } from "./config";

export async function updateNPCInRoomInMemory(
  roomName: roomId,
  npc: NPC
): Promise<void> {
  try {
    // Direct set operation - no read-modify-set needed
    await setNPCInMemory(roomName, npc.id, npc);
  } catch (error) {
    console.error(`Error updating NPC in room ${roomName}:`, error);
    throw error;
  }
}

export async function updateNPCGroupInRoomInMemory(
  roomName: roomId,
  captorId: userId,
  npcId: npcId
): Promise<void> {
  try {
    // Direct add operation - no read-modify-set needed
    await addNPCToGroupInMemory(roomName, captorId, npcId);
  } catch (error) {
    console.error(`Error updating NPC group in room ${roomName}:`, error);
    throw error;
  }
}
