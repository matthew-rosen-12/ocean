import { NPC, pathData, NPCGroup, NPCPhase, roomId } from "../types";
import { getPosition, getDirection } from "../user-info";
import { npcId, userId } from "../types";
import { v4 as uuidv4 } from "uuid";

// Redis Key prefixes for different data types
const NUM_NPCS = 4;

import { io } from "../server";
import {
  getActivepathsFromRedis,
  removeNPCFromGroupInRoomInRedis,
  setPathsInRedis,
  deletePathInRedis,
} from "../db/config";
import {
  updateNPCGroupInRoomInRedis,
  updateNPCInRoomInRedis,
} from "../db/npc-ops";
import { serialize } from "../utils/serializers";

export async function updateNPCInRoom(
  roomName: roomId,
  npc: NPC
): Promise<void> {
  updateNPCInRoomInRedis(roomName, npc);
  io.to(roomName).emit("npc-update", serialize({ npc }));
}

export async function updateNPCGroupInRoom(
  roomName: roomId,
  captorId: userId,
  npcId: npcId
): Promise<void> {
  await updateNPCGroupInRoomInRedis(roomName, captorId, npcId);
  io.to(roomName).emit("group-update", serialize({ groupId: captorId, npcId }));
}

export async function removeNPCFromGroupInRoom(
  roomName: string,
  captorId: userId,
  npcId: npcId
): Promise<void> {
  await removeNPCFromGroupInRoomInRedis(roomName, captorId, npcId);

  io.to(roomName).emit(
    "group-update",
    serialize({
      groupId: captorId,
      npcId,
      removed: true,
    })
  );
}

function calculateLandingPosition(pathData: pathData) {
  const { startPosition, direction, velocity, pathDuration } = pathData;
  const distance = velocity * (pathDuration / 1000);
  const landingPosition = {
    x: startPosition.x + direction.x * distance,
    y: startPosition.y + direction.y * distance,
    z: 0,
  };
  return landingPosition;
}

export async function setPathCompleteInRoom(
  roomName: string,
  npc: NPC
): Promise<void> {
  const paths = await getActivepathsFromRedis(roomName);
  const pathData = paths.filter((t) => t.npc.id === npc.id)[0];

  // Direct delete operation - no read-modify-set needed
  await deletePathInRedis(roomName, npc.id);

  // update npc from path to have phase IDLE
  npc.phase = NPCPhase.IDLE;
  npc.position = calculateLandingPosition(pathData);
  await updateNPCInRoomInRedis(roomName, npc);

  // Only emit final position for thrown NPCs (with captorId), not fleeing NPCs
  if (pathData.captorId) {
    io.to(roomName).emit("path-complete", serialize({ npc }));
  }
}

export async function createNPCs(): Promise<NPC[]> {
  const npcs: NPC[] = [];
  const npcFilenames = await getNPCFilenames();
  const shuffledFilenames = [...npcFilenames].sort(() => Math.random() - 0.5);

  for (let i = 0; i < NUM_NPCS; i++) {
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
