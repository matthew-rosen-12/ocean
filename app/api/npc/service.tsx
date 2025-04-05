// ocean/app/api/npc/service.ts
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { NPC, NPCPhase } from "../../utils/types";
import { getDirection, getPosition } from "../utils/npc-info";

const NUM_NPCS = 4;

let npcFilenamesCache: string[] | null = null;

export const channelNPCs = new Map<string, NPC[]>();

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

export async function getNPCsForChannel(channelName: string): Promise<NPC[]> {
  if (!channelNPCs.has(channelName)) {
    await populateChannel(channelName);
  }

  return channelNPCs.get(channelName) || [];
}

export async function populateChannel(channelName: string) {
  if (!channelNPCs.has(channelName)) {
    const npcs = createNPCs(NUM_NPCS);
    channelNPCs.set(channelName, npcs);

    return npcs;
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
      phase: NPCPhase.FREE,
    };

    npcs.push(npc);
  }

  return npcs;
}

export function addNPCToChannel(channelName: string, npc: NPC): void {
  if (!channelNPCs.has(channelName)) {
    channelNPCs.set(channelName, []);
  }

  const npcs = channelNPCs.get(channelName);
  if (npcs) {
    const existingIndex = npcs.findIndex(
      (existingNpc) => existingNpc.id === npc.id
    );

    if (existingIndex >= 0) {
      npcs.splice(existingIndex, 1);
    }

    npcs.push(npc);
  }
}

export function updateNPCInChannel(
  channelName: string,
  npcId: string,
  updates: Partial<NPC>
): void {
  if (!channelNPCs.has(channelName)) return;

  const npcs = channelNPCs.get(channelName);
  if (!npcs) return;

  const index = npcs.findIndex((npc) => npc.id === npcId);

  if (index >= 0) {
    // Only update the properties provided in updates
    npcs[index] = {
      ...npcs[index],
      ...updates,
    };
  }
}
