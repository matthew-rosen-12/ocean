import { NPC, throwData, NPCGroup, NPCPhase } from "../types";
import { DefaultMap } from "../types";
import { get, set } from "../db/config";
import { v4 as uuidv4 } from "uuid";
import { getRandomAnimal, getPosition, getDirection } from "../user-info";

const NUM_NPCS = 4;

export async function getNPCsForRoom(room: string): Promise<Map<string, NPC>> {
  const npcsData = await get(`npcs:${room}`);
  const npcs = new Map<string, NPC>();
  if (npcsData) {
    const parsed = JSON.parse(npcsData);
    Object.entries(parsed).forEach(([id, npc]) => {
      npcs.set(id, npc as NPC);
    });
  }
  return npcs;
}

export async function getRoomActiveThrows(room: string): Promise<throwData[]> {
  const throwsData = await get(`throws:${room}`);
  return throwsData ? JSON.parse(throwsData) : [];
}

export async function getNPCGroupsFromRedis(
  room: string
): Promise<DefaultMap<string, NPCGroup>> {
  const groupsData = await get(`groups:${room}`);
  const groups = new DefaultMap<string, NPCGroup>((id: string) => ({
    npcIds: new Set<string>(),
    captorId: id,
  }));

  if (groupsData) {
    const parsed = JSON.parse(groupsData);
    Object.entries(parsed).forEach(([id, group]) => {
      const g = group as NPCGroup;
      g.npcIds = new Set(g.npcIds);
      groups.set(id, g);
    });
  }
  return groups;
}

export async function updateNPCInRoom(
  room: string,
  npc: NPC,
  isNew: boolean = false
): Promise<void> {
  const npcs = await getNPCsForRoom(room);
  npcs.set(npc.id, npc);
  await set(`npcs:${room}`, JSON.stringify(Object.fromEntries(npcs)));
}

export async function updateNPCGroupInRoom(
  room: string,
  captorId: string,
  npcId: string
): Promise<void> {
  const groups = await getNPCGroupsFromRedis(room);
  const group = groups.get(captorId);
  group.npcIds.add(npcId);
  await set(`groups:${room}`, JSON.stringify(Object.fromEntries(groups)));
}

export async function removeNPCFromGroupInRoom(
  room: string,
  captorId: string,
  npcId: string
): Promise<void> {
  const groups = await getNPCGroupsFromRedis(room);
  const group = groups.get(captorId);
  group.npcIds.delete(npcId);
  await set(`groups:${room}`, JSON.stringify(Object.fromEntries(groups)));
}

export async function setRoomActiveThrows(
  room: string,
  throws: throwData[]
): Promise<void> {
  await set(`throws:${room}`, JSON.stringify(throws));
}

export async function setThrowCompleteInRoom(
  room: string,
  throwId: string
): Promise<void> {
  const throws = await getRoomActiveThrows(room);
  const updatedThrows = throws.filter((t) => t.id !== throwId);
  await setRoomActiveThrows(room, updatedThrows);
}

export async function populateRoom(room: string): Promise<void> {
  const npcs = await createNPCs(NUM_NPCS);
  const npcMap = new Map<string, NPC>();
  npcs.forEach((npc) => {
    npcMap.set(npc.id, npc);
  });
  await set(`npcs:${room}`, JSON.stringify(Object.fromEntries(npcMap)));
}

async function createNPCs(count: number): Promise<NPC[]> {
  const npcs: NPC[] = [];

  for (let i = 0; i < count; i++) {
    const npc: NPC = {
      id: uuidv4(),
      type: "npc",
      filename: "npc.svg",
      position: getPosition(),
      direction: getDirection(),
      phase: NPCPhase.IDLE,
    };

    npcs.push(npc);
  }

  return npcs;
}
