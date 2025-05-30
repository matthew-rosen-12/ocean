import { NPC, roomId, userId, npcId } from "../types";
import { serialize, deserialize } from "../utils/serializers";
import { get, set } from "./config";

export async function updateNPCInRoomInRedis(
  roomName: roomId,
  npc: NPC
): Promise<void> {
  try {
    const npcsKey = `npcs:${roomName}`;

    // Get current NPCs
    const npcsData = await get(npcsKey);
    const npcs = npcsData ? deserialize(npcsData) : new Map();

    // Update NPC in the map
    npcs.set(npc.id, npc);

    // Save back to storage
    await set(npcsKey, serialize(npcs));
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
    const groupsKey = `groups:${roomName}`;

    // Get current groups
    const groupsData = await get(groupsKey);
    const groups = groupsData ? deserialize(groupsData) : new Map();

    // Update the group
    const group = groups.get(captorId) || { npcIds: new Set(), captorId };

    if (!group.npcIds.has(npcId)) {
      group.npcIds.add(npcId);
    }

    groups.set(captorId, group);

    // Save back to storage
    await set(groupsKey, serialize(groups));
  } catch (error) {
    console.error(`Error updating NPC group in room ${roomName}:`, error);
    throw error;
  }
}
