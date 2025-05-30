import { NPC, roomId, userId, npcId } from "../types";
import { setNPCInRedis, addNPCToGroupInRedis } from "./config";

export async function updateNPCInRoomInRedis(
  roomName: roomId,
  npc: NPC
): Promise<void> {
  try {
    // Direct set operation - no read-modify-set needed
    await setNPCInRedis(roomName, npc.id, npc);
  } catch (error) {
    console.error(`Error updating NPC in room ${roomName}:`, error);
    throw error;
  }
}

export async function updateNPCGroupInRoomInRedis(
  roomName: roomId,
  captorId: userId,
  npcId: npcId
): Promise<void> {
  try {
    // Direct add operation - no read-modify-set needed
    await addNPCToGroupInRedis(roomName, captorId, npcId);
  } catch (error) {
    console.error(`Error updating NPC group in room ${roomName}:`, error);
    throw error;
  }
}
