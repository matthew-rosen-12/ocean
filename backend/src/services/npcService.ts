import { NPC, throwData, NPCGroup, NPCPhase } from "../types";
import { get, keys, set } from "../db/config";
import { v4 as uuidv4 } from "uuid";
import { getPosition, getDirection } from "../user-info";
import { npcId, userId } from "../types";

// Redis Key prefixes for different data types
const NPC_KEY_PREFIX = "npcs:";
const THROWS_KEY_PREFIX = "throws:";
const GROUPS_KEY_PREFIX = "groups:";
const NUM_NPCS = 4;

import { io } from "../server";
// Helper functions for Redis storage
async function getNPCMapFromRedis(room: string): Promise<Map<npcId, NPC>> {
  const data = await get(`${NPC_KEY_PREFIX}${room}`);
  return data ? new Map(JSON.parse(data)) : new Map();
}

async function setNPCMapToRedis(
  room: string,
  npcs: Map<npcId, NPC>
): Promise<void> {
  await set(
    `${NPC_KEY_PREFIX}${room}`,
    JSON.stringify(Array.from(npcs.entries()))
  );
}

export async function getThrowsFromRedis(room: string): Promise<throwData[]> {
  const data = await get(`${THROWS_KEY_PREFIX}${room}`);
  return data ? JSON.parse(data) : [];
}

export async function setThrowsToRedis(
  room: string,
  throws: throwData[]
): Promise<void> {
  await set(`${THROWS_KEY_PREFIX}${room}`, JSON.stringify(throws));
}

async function setNPCGroupsToRedis(
  room: string,
  groups: Map<userId, NPCGroup>
): Promise<void> {
  const serializable = Array.from(groups.entries()).map(([id, group]) => {
    return [id, { npcIds: Array.from(group.npcIds), captorId: group.captorId }];
  });

  await set(`${GROUPS_KEY_PREFIX}${room}`, JSON.stringify(serializable));
}

// Main service functions
export async function getNPCsForRoom(
  roomName: string
): Promise<Map<npcId, NPC>> {
  const npcsData = await get(`npcs:${roomName}`);
  if (!npcsData) return new Map();
  const parsed = JSON.parse(npcsData);
  // Convert from array of [id, npc] pairs to Map
  return new Map(parsed.map(([id, npc]: [string, NPC]) => [id, npc]));
}

export async function getRoomActiveThrows(
  roomName: string
): Promise<throwData[]> {
  const throws = await get(`throws:${roomName}`);
  return throws ? JSON.parse(throws as string) : [];
}

export async function getNPCGroupsFromRedis(
  roomName: string
): Promise<Map<userId, NPCGroup>> {
  const groups = await get(`groups:${roomName}`);
  if (!groups) return new Map();

  const parsed = JSON.parse(groups as string);
  return new Map(
    parsed.map(([id, group]: [string, NPCGroup]) => [
      id,
      { npcIds: new Set(group.npcIds), captorId: group.captorId },
    ])
  );
}

export async function updateNPCInRoom(
  roomName: string,
  npc: NPC,
  message: boolean
): Promise<void> {
  const npcs = await getNPCMapFromRedis(roomName);
  npcs.set(npc.id, npc);
  await setNPCMapToRedis(roomName, npcs);

  if (message) {
    io.to(roomName).emit("npc-update", {
      npc: npc,
    });
  }
}

export async function updateNPCGroupInRoom(
  roomName: string,
  captorId: userId,
  npcId: npcId
): Promise<void> {
  const groups = await getNPCGroupsFromRedis(roomName);
  const group = groups.get(captorId) || { npcIds: new Set(), captorId };

  if (!group.npcIds.has(npcId)) {
    group.npcIds.add(npcId);
    await set(
      `groups:${roomName}`,
      JSON.stringify(Array.from(groups.entries()))
    );
    io.to(roomName).emit("group-update", { groupId: captorId, npcId });
  }
}

export async function removeNPCFromGroupInRoom(
  roomName: string,
  captorId: userId,
  npcId: npcId
): Promise<void> {
  const groups = await getNPCGroupsFromRedis(roomName);
  const group = groups.get(captorId);

  if (group) {
    group.npcIds.delete(npcId);
    await set(
      `groups:${roomName}`,
      JSON.stringify(Array.from(groups.entries()))
    );
    io.to(roomName).emit("group-update", {
      groupId: captorId,
      npcId,
      removed: true,
    });
  }
}

export async function setRoomActiveThrows(
  roomName: string,
  throws: throwData[]
): Promise<void> {
  await set(`throws:${roomName}`, JSON.stringify(throws));
  io.to(roomName).emit("throws-update", { throws });
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

export async function setThrowCompleteInRoom(
  roomName: string,
  throwData: throwData
): Promise<void> {
  const throws = await getRoomActiveThrows(roomName);
  const updatedThrows = throws.filter((t) => t.id !== throwData.id);
  await setRoomActiveThrows(roomName, updatedThrows);
  // update npc from throw to have phase IDLE
  const npc = throwData.npc;
  npc.phase = NPCPhase.IDLE;
  npc.position = calculateLandingPosition(throwData);
  io.to(roomName).emit("throw-complete", { npc });
}

export async function populateRoom(roomName: string): Promise<void> {
  const npcs = await createNPCs(NUM_NPCS);
  const npcMap = new Map<npcId, NPC>();
  npcs.forEach((npc) => {
    npcMap.set(npc.id, npc);
  });
  await setNPCMapToRedis(roomName, npcMap);
  io.to(roomName).emit("npcs-populated", {
    npcs: Array.from(npcMap.entries()),
  });
}

async function createNPCs(count: number): Promise<NPC[]> {
  const npcs: NPC[] = [];
  const npcFilenames = await getNPCFilenames();
  const shuffledFilenames = [...npcFilenames].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    const filenameIndex = i % shuffledFilenames.length;
    const filename = shuffledFilenames[filenameIndex];

    const npc: NPC = {
      id: uuidv4(),
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

async function getNPCFilenames(): Promise<string[]> {
  // Hardcode the available NPC filenames from frontend
  return [
    "am.png",
    "cl.png",
    "fdr.png",
    "he.png",
    "mlf.png",
    "mt.png",
    "nb.png",
    "rh.png",
    "wc.png",
  ];
}

// Add this new function to get all channel names
export async function getAllRooms(): Promise<string[]> {
  const room_keys = await keys(`${NPC_KEY_PREFIX}*`);

  // Extract the channel names from the keys
  return room_keys.map((key: string) => key.substring(NPC_KEY_PREFIX.length));
}
