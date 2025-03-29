// ocean/app/api/npc/service.ts
import { getPusherInstance } from "../utils/pusher/pusher-instance";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { NPC } from "../../utils/types";
import { getDirection, getPosition } from "../utils/npc-info";

const NUM_NPCS = 4;

// Cache for NPC filenames
let npcFilenamesCache: string[] | null = null;

// Store NPCs by channel name
const channelNPCs = new Map<string, NPC[]>();

// Function to get NPC filenames from directory
function getNPCFilenames(): string[] {
  if (npcFilenamesCache) return npcFilenamesCache;

  try {
    const npcsDir = path.join(process.cwd(), "public", "npcs");
    const files = fs.readdirSync(npcsDir);

    // Filter for image files
    const imageFiles = files.filter((file) =>
      /\.(png|jpg|jpeg|gif|svg)$/i.test(file)
    );

    if (imageFiles.length === 0) {
      console.error("No image files found in npcs directory");
    }

    npcFilenamesCache = imageFiles;
    return imageFiles;
  } catch (error) {
    console.error("Error reading NPC files:", error);
    return ["am.png", "default.png"]; // Fallback defaults
  }
}

// Function to get NPCs for a specific channel
export async function getNPCsForChannel(channelName: string): Promise<NPC[]> {
  // If this channel doesn't have NPCs yet, populate it
  if (!channelNPCs.has(channelName)) {
    await populateChannel(channelName);
  }
  return channelNPCs.get(channelName) || [];
}

// Primary function to populate a specific channel with NPCs
export async function populateChannel(channelName: string) {
  // Only create NPCs if they don't already exist for this channel
  if (!channelNPCs.has(channelName)) {
    // Create NPCs for this channel
    const npcs = createNPCs(NUM_NPCS);

    // Store NPCs for this channel
    channelNPCs.set(channelName, npcs);

    // Start updating NPCs for this channel
    startNPCUpdatesForRoom(npcs, channelName);

    return npcs;
  }

  // Return existing NPCs if already populated
  return channelNPCs.get(channelName);
}

function createNPCs(count: number): NPC[] {
  const npcs: NPC[] = [];
  const npcFilenames = getNPCFilenames();

  // Create a copy of filenames and shuffle it
  const shuffledFilenames = [...npcFilenames].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    // Use modulo to cycle through the array if we need more NPCs than filenames
    const filenameIndex = i % shuffledFilenames.length;
    const filename = shuffledFilenames[filenameIndex];

    // Create the NPC
    const npc: NPC = {
      id: `npc-${uuidv4()}`,
      type: "npc",
      filename: filename,
      position: getPosition(),
      direction: getDirection(),
    };

    npcs.push(npc);
  }

  return npcs;
}

function startNPCUpdatesForRoom(npcs: NPC[], channelName: string) {
  const pusher = getPusherInstance();

  // Broadcast all NPCs to the channel at once
  pusher.trigger(channelName, "npcs-added", {
    npcs,
  });
}
