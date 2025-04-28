import { NPC, roomId, userId, npcId } from "../types";
import {
  getNPCGroupsFromRedis,
  getNPCsFromRedis,
  setNPCGroupsInRedis,
  setNPCsInRedis,
} from "./config";

export async function updateNPCInRoomInRedis(
  roomName: roomId,
  npc: NPC
): Promise<void> {
  try {
    const npcs = await getNPCsFromRedis(roomName);
    npcs.set(npc.id, npc);
    await setNPCsInRedis(roomName, npcs);
  } catch (error) {
    console.error(`Error updating NPC in room ${roomName}:`, error);
  }
}

export async function updateNPCGroupInRoomInRedis(
  roomName: roomId,
  captorId: userId,
  npcId: npcId
): Promise<void> {
  const groups = await getNPCGroupsFromRedis(roomName);
  const group = groups.get(captorId) || { npcIds: new Set(), captorId };
  if (!group.npcIds.has(npcId)) {
    group.npcIds.add(npcId);
  }
  groups.set(captorId, group);
  setNPCGroupsInRedis(roomName, groups);
}
