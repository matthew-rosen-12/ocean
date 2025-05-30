import { NPC, roomId, userId, npcId } from "../types";
import { serialize, deserialize } from "../utils/serializers";
import {
  getNPCsFromRedis,
  setNPCsInRedis,
  getNPCGroupsFromRedis,
  setNPCGroupsInRedis,
} from "./config";

export async function updateNPCInRoomInRedis(
  roomName: roomId,
  npc: NPC
): Promise<void> {
  try {
    // Get current NPCs using the direct Map access
    const npcs = await getNPCsFromRedis(roomName);

    // Update NPC in the map
    npcs.set(npc.id, npc);

    // Save back using direct Map access
    await setNPCsInRedis(roomName, npcs);
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
    // Get current groups using direct Map access
    const groups = await getNPCGroupsFromRedis(roomName);

    // Update the group
    const group = groups.get(captorId) || { npcIds: new Set(), captorId };

    if (!group.npcIds.has(npcId)) {
      group.npcIds.add(npcId);
    }

    groups.set(captorId, group);

    // Save back using direct Map access
    await setNPCGroupsInRedis(roomName, groups);
  } catch (error) {
    console.error(`Error updating NPC group in room ${roomName}:`, error);
    throw error;
  }
}
