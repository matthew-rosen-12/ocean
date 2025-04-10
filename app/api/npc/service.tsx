import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import {
  NPC,
  NPCGroup,
  npcId,
  NPCPhase,
  throwData,
  userId,
} from "../../utils/types";
import { getDirection, getPosition } from "../utils/npc-info";
import { getPusherInstance } from "../utils/pusher/pusher-instance";
import { getRedisClient } from "../utils/redis-client";

const pusher = getPusherInstance();
const NUM_NPCS = 4;

// Redis Key prefixes for different data types
const NPC_KEY_PREFIX = "npcs:";
const THROWS_KEY_PREFIX = "throws:";
const GROUPS_KEY_PREFIX = "groups:";

// Helper functions for Redis storage
async function getNPCMapFromRedis(
  channelName: string
): Promise<Map<npcId, NPC>> {
  const redis = await getRedisClient();
  const data = await redis.get(`${NPC_KEY_PREFIX}${channelName}`);
  return data ? new Map(JSON.parse(data)) : new Map();
}

async function setNPCMapToRedis(
  channelName: string,
  npcs: Map<npcId, NPC>
): Promise<void> {
  const redis = await getRedisClient();
  await redis.set(
    `${NPC_KEY_PREFIX}${channelName}`,
    JSON.stringify(Array.from(npcs.entries()))
  );
}

async function getThrowsFromRedis(channelName: string): Promise<throwData[]> {
  const redis = await getRedisClient();
  const data = await redis.get(`${THROWS_KEY_PREFIX}${channelName}`);
  return data ? JSON.parse(data) : [];
}

async function setThrowsToRedis(
  channelName: string,
  throws: throwData[]
): Promise<void> {
  const redis = await getRedisClient();
  await redis.set(`${THROWS_KEY_PREFIX}${channelName}`, JSON.stringify(throws));
}

export async function getNPCGroupsFromRedis(
  channelName: string
): Promise<Map<userId, NPCGroup>> {
  const redis = await getRedisClient();
  const data = await redis.get(`${GROUPS_KEY_PREFIX}${channelName}`);

  if (!data) {
    return new Map();
  }

  const parsed = JSON.parse(data);
  return new Map(
    parsed.map(([id, group]: [string, NPCGroup]) => {
      return [id, { npcIds: new Set(group.npcIds), captorId: group.captorId }];
    })
  );
}

async function setNPCGroupsToRedis(
  channelName: string,
  groups: Map<userId, NPCGroup>
): Promise<void> {
  const redis = await getRedisClient();
  const serializable = Array.from(groups.entries()).map(([id, group]) => {
    return [id, { npcIds: Array.from(group.npcIds), captorId: group.captorId }];
  });

  await redis.set(
    `${GROUPS_KEY_PREFIX}${channelName}`,
    JSON.stringify(serializable)
  );
}

// Main service functions
export async function getNPCsForChannel(
  channelName: string
): Promise<Map<npcId, NPC>> {
  const npcs = await getNPCMapFromRedis(channelName);

  if (npcs.size === 0) {
    return populateChannel(channelName);
  }

  return npcs;
}

export async function getChannelActiveThrows(
  channelName: string
): Promise<throwData[]> {
  return getThrowsFromRedis(channelName);
}

export async function setChannelActiveThrows(
  channelName: string,
  throws: throwData[]
): Promise<void> {
  await setThrowsToRedis(channelName, throws);
}

export async function populateChannel(
  channelName: string
): Promise<Map<npcId, NPC>> {
  const existingNpcs = await getNPCMapFromRedis(channelName);

  if (existingNpcs.size === 0) {
    const npcs = await createNPCs(NUM_NPCS);
    const npcMap = new Map<npcId, NPC>();

    npcs.forEach((npc) => {
      npcMap.set(npc.id, npc);
    });

    await setNPCMapToRedis(channelName, npcMap);
    return npcMap;
  }

  return existingNpcs;
}

async function createNPCs(count: number): Promise<NPC[]> {
  const npcs: NPC[] = [];
  const npcFilenames = await getNPCFilenames();
  const shuffledFilenames = [...npcFilenames].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    const filenameIndex = i % shuffledFilenames.length;
    const filename = shuffledFilenames[filenameIndex];

    // Create the NPC
    const npc: NPC = {
      id: `npc-${uuidv4()}`,
      type: "npc",
      filename: filename,
      position: getPosition(),
      direction: getDirection(),
      phase: NPCPhase.IDLE,
    };

    npcs.push(npc);
  }

  return npcs;
}

export async function updateNPCInChannel(
  channelName: string,
  npc: NPC,
  message: boolean = false
): Promise<void> {
  const npcs = await getNPCMapFromRedis(channelName);
  npcs.set(npc.id, npc);
  await setNPCMapToRedis(channelName, npcs);

  if (message) {
    pusher.trigger(channelName, "npc-update", {
      npc: npc,
    });
  }
}

export async function updateNPCGroupInChannel(
  channelName: string,
  captorId: userId,
  npcId: npcId
): Promise<void> {
  const groups = await getNPCGroupsFromRedis(channelName);

  if (!groups.has(captorId)) {
    groups.set(captorId, { npcIds: new Set(), captorId });
  }

  const group = groups.get(captorId)!;
  group.npcIds.add(npcId);

  await setNPCGroupsToRedis(channelName, groups);
}

export async function removeNPCFromGroupInChannel(
  channelName: string,
  throwerId: userId,
  npcId: npcId
): Promise<void> {
  const groups = await getNPCGroupsFromRedis(channelName);

  if (!groups.has(throwerId)) {
    return;
  }

  const group = groups.get(throwerId)!;
  group.npcIds.delete(npcId);

  await setNPCGroupsToRedis(channelName, groups);
}

export async function setThrowCompleteInChannel(
  channelName: string,
  landedThrow: throwData
): Promise<void> {
  // Calculate landing position
  const landingPosition = calculateLandingPosition(landedThrow);

  // Update NPC with new position and change phase back to IDLE
  const updatedNPC = {
    ...landedThrow.npc,
    position: landingPosition,
    phase: NPCPhase.IDLE,
  };

  pusher.trigger(channelName, "throw-complete", {
    throw: {
      ...landedThrow,
      npc: updatedNPC,
    },
  });

  await updateNPCInChannel(channelName, updatedNPC, true);
}

function calculateLandingPosition(throwData: throwData) {
  const { startPosition, direction, velocity, throwDuration } = throwData;
  const distance = velocity * (throwDuration / 1000);
  const landingPosition = {
    x: startPosition.x + direction.x * distance,
    y: startPosition.y + direction.y * distance,
    z: 0,
  };
  return landingPosition;
}

async function getNPCFilenames(): Promise<string[]> {
  // Implementation using fs directly
  const npcsDir = path.join(process.cwd(), "public", "npcs");
  const files = fs.readdirSync(npcsDir);
  return files.filter((file) => /\.(png|jpg|jpeg|gif|svg)$/i.test(file));
}

// Add this new function to get all channel names
export async function getAllChannelNames(): Promise<string[]> {
  const redis = await getRedisClient();
  const keys = await redis.keys(`${NPC_KEY_PREFIX}*`);

  // Extract the channel names from the keys
  return keys.map((key) => key.substring(NPC_KEY_PREFIX.length));
}
