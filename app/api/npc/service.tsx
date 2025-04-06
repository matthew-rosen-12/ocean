import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import {
  DefaultMap,
  NPC,
  NPCGroup,
  npcId,
  NPCPhase,
  throwData,
  userId,
} from "../../utils/types";
import { getDirection, getPosition } from "../utils/npc-info";
import { getPusherInstance } from "../utils/pusher/pusher-instance";
const pusher = getPusherInstance();

const NUM_NPCS = 4;

let npcFilenamesCache: string[] | null = null;

export const channelNPCs = new Map<string, Map<npcId, NPC>>();

// Replace the regular Map with DefaultMap
export const channelActiveThrows = new DefaultMap<string, throwData[]>(
  () => []
);

export const channelNPCGroups = new DefaultMap<
  string,
  DefaultMap<userId, NPCGroup>
>(
  () => new DefaultMap<userId, NPCGroup>((id) => ({ npcIds: [], captorId: id }))
);

function getNPCFilenames(): string[] {
  if (npcFilenamesCache) return npcFilenamesCache;

  const npcsDir = path.join(process.cwd(), "public", "npcs");
  const files = fs.readdirSync(npcsDir);

  const imageFiles = files.filter((file) =>
    /\.(png|jpg|jpeg|gif|svg)$/i.test(file)
  );

  if (imageFiles.length === 0) {
    console.error("No image files found in npcs directory");
  }

  npcFilenamesCache = imageFiles;
  return imageFiles;
}

export function getNPCsForChannel(channelName: string): Map<npcId, NPC> {
  if (!channelNPCs.has(channelName)) {
    populateChannel(channelName);
  }

  return channelNPCs.get(channelName) || new Map<npcId, NPC>();
}

export function populateChannel(channelName: string) {
  if (!channelNPCs.has(channelName)) {
    const npcs = createNPCs(NUM_NPCS);
    const npcMap = new Map<npcId, NPC>();
    npcs.forEach((npc) => {
      npcMap.set(npc.id, npc);
    });
    channelNPCs.set(channelName, npcMap);

    return npcMap;
  }

  return channelNPCs.get(channelName);
}

function createNPCs(count: number): NPC[] {
  const npcs: NPC[] = [];
  const npcFilenames = getNPCFilenames();

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

export function updateNPCInChannel(
  channelName: string,
  npc: NPC,
  message: boolean = false
): void {
  if (!channelNPCs.has(channelName)) {
    const npcMap = new Map<npcId, NPC>();
    channelNPCs.set(channelName, npcMap);
  }

  const npcs = channelNPCs.get(channelName);
  if (npcs) {
    npcs.set(npc.id, npc);
  }
  if (message) {
    pusher.trigger(channelName, "npc-update", {
      npc: npc,
    });
  }
}

export function updateNPCGroupInChannel(
  channelName: string,
  captorId: userId,
  npcId: npcId
): void {
  if (!channelNPCGroups.has(channelName)) {
    const npcGroupMap = new DefaultMap<userId, NPCGroup>((id) => ({
      npcIds: [],
      captorId: id,
    }));
    channelNPCGroups.set(channelName, npcGroupMap);
  }

  const npcGroups = channelNPCGroups.get(channelName);
  if (npcGroups) {
    npcGroups.get(captorId).npcIds.push(npcId);
  }
}

export function setThrowCompleteInChannel(
  channelName: string,
  landedThrow: throwData
): void {
  pusher.trigger(channelName, "throw-complete", {
    throw: landedThrow,
  });
  updateNPCInChannel(channelName, landedThrow.npc, true);
}
