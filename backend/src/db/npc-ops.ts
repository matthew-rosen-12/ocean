import { NPC, roomId, userId, npcId } from "../types";
import { serialize, deserialize } from "../utils/serializers";
import { withRedisTransaction } from "./config";

const MAX_RETRIES = 100;
const RETRY_DELAY = async () =>
  await new Promise((resolve) =>
    setTimeout(resolve, Math.random() * 100 + 300)
  );

export async function updateNPCInRoomInRedis(
  roomName: roomId,
  npc: NPC
): Promise<void> {
  const npcsKey = `npcs:${roomName}`;
  let retries = MAX_RETRIES;

  await withRedisTransaction(async (client) => {
    while (retries > 0) {
      try {
        // Watch the key for changes
        await client.watch(npcsKey);

        // Get current NPCs
        const npcsData = await client.get(npcsKey);
        const npcs = npcsData ? deserialize(npcsData) : new Map();

        // Update NPC in the map
        npcs.set(npc.id, npc);

        // Start transaction
        const multi = client.multi();
        multi.set(npcsKey, serialize(npcs));

        // Execute transaction (returns null if watched key changed)
        const result = await multi.exec();

        if (result === null) {
          // Key was modified, retry
          retries--;
          await RETRY_DELAY();
          continue;
        }

        // Success
        return;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
      } finally {
        // Unwatch in case of error or early return
        await client.unwatch();
      }
    }
  });
}

export async function updateNPCGroupInRoomInRedis(
  roomName: roomId,
  captorId: userId,
  npcId: npcId
): Promise<void> {
  const groupsKey = `groups:${roomName}`;
  let retries = MAX_RETRIES;

  await withRedisTransaction(async (client) => {
    while (retries > 0) {
      try {
        // Add a small delay to stagger concurrent operations
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));

        // Watch the key for changes
        await client.watch(groupsKey);

        // Get current groups
        const groupsData = await client.get(groupsKey);
        const groups = groupsData ? deserialize(groupsData) : new Map();

        // Update the group
        const group = groups.get(captorId) || { npcIds: new Set(), captorId };

        if (!group.npcIds.has(npcId)) {
          group.npcIds.add(npcId);
        }

        groups.set(captorId, group);

        // Start transaction
        const multi = client.multi();
        multi.set(groupsKey, serialize(groups));

        // Execute transaction
        const result = await multi.exec();

        if (result === null) {
          // Key was modified, retry
          retries--;
          // Add a slightly longer delay before retry
          await RETRY_DELAY();
          continue;
        }

        // Success
        return;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
      } finally {
        // Make sure to unwatch
        await client.unwatch();
      }
    }
  });
}
