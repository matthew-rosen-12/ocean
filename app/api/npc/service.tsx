// ocean/app/api/npc/service.ts
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { NPC, NPCPhase, throwData } from "../../utils/types";
import { getDirection, getPosition } from "../utils/npc-info";
import { getPusherInstance } from "../utils/pusher/pusher-instance";
const pusher = getPusherInstance();

const NUM_NPCS = 4;

let npcFilenamesCache: string[] | null = null;

export const channelFreeNPCs = new Map<string, NPC[]>();
export const channelActiveThrows = new Map<string, throwData[]>();

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

export async function getFreeNPCsForChannel(
  channelName: string
): Promise<NPC[]> {
  if (!channelFreeNPCs.has(channelName)) {
    await populateChannel(channelName);
  }

  return channelFreeNPCs.get(channelName) || [];
}

export async function populateChannel(channelName: string) {
  if (!channelFreeNPCs.has(channelName)) {
    const npcs = createNPCs(NUM_NPCS);
    channelFreeNPCs.set(channelName, npcs);

    return npcs;
  }

  return channelFreeNPCs.get(channelName);
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

export function updateFreeNPCInChannel(channelName: string, npc: NPC): void {
  if (!channelFreeNPCs.has(channelName)) {
    channelFreeNPCs.set(channelName, []);
  }

  const npcs = channelFreeNPCs.get(channelName);
  if (npcs) {
    const existingIndex = npcs.findIndex(
      (existingNpc) => existingNpc.id === npc.id
    );

    if (existingIndex >= 0) {
      npcs.splice(existingIndex, 1);
    }

    npcs.push(npc);
  }
  pusher.trigger(channelName, "npc-update", {
    ...npc,
  });
}

export function setThrownCompleteInChannel(
  channelName: string,
  landedThrow: throwData
): void {
  if (!channelFreeNPCs.has(channelName)) {
    channelFreeNPCs.set(channelName, []);
  }

  pusher.trigger(channelName, "throw-complete", {
    ...landedThrow,
  });
}
