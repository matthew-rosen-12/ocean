import { pathData, NPCGroup, NPCPhase, PathPhase, roomId, userId, npcGroupId } from "shared/types";

import { getInitialPosition, getInitialDirection } from "./initialization/npc-info";
import { v4 as uuidv4 } from "uuid";

const NUM_NPCS = 4;
const NPC_WIDTH = 4;
const NPC_HEIGHT = 4;

import {
  deletePathInMemory,
  getpathsfromMemory,
  setPathsInMemory,
} from "./state/paths";

import { getNPCGroupsfromMemory, removeTopNPCFromGroupInRoomInMemory, updateNPCGroupInRoomInMemory } from "./state/npc-groups";

import { emitToRoom } from "./typed-socket";

export function updateNPCGroupInRoom(
  roomName: roomId,
  npcGroup: NPCGroup
): void{
   updateNPCGroupInRoomInMemory(roomName, npcGroup);
   emitToRoom(roomName, "npc-group-update", { npcGroup });
}

export function removeTopNPCFromGroupInRoom(
  roomName: string,
  captorId: userId,
  npcGroupId: npcGroupId
): void{
   removeTopNPCFromGroupInRoomInMemory(roomName, captorId);
   emitToRoom(roomName, "npc-group-pop", {
    npcGroupId,
   });
}

export function setPathCompleteInRoom(room: string, npcGroup: NPCGroup) {
  try {
    // Get room-specific terrain configuration

    // Get the path data for this NPC
    const paths =  getpathsfromMemory(room);
    const pathDataForNPC = paths.get(npcGroup.id);

    if (!pathDataForNPC) {
      console.log(`No path data found for NPC ${npcGroup.id} in room ${room}`);
      return;
    }

    // Calculate landing position with wrap-around and collision avoidance
    const landingPosition =
       calculateLandingPositionWithCollisionAvoidance(
        pathDataForNPC,
        room,
        npcGroup.id
      );

    const updatedNPCGroup = new NPCGroup({
      ...npcGroup,
      position: landingPosition,
      phase: NPCPhase.IDLE,
    });

     updateNPCGroupInRoom(room, updatedNPCGroup);

    // Remove this path from active paths
    deletePathInMemory(room, npcGroup.id);

    // Only broadcast for thrown NPCs (ones with captorId)
    if (npcGroup.captorId) {
      emitToRoom(room, "path-complete", { npcGroup: updatedNPCGroup });
    }

  } catch (error) {
    console.error(
      `Error setting path complete for NPC ${npcGroup.id} in room ${room}:`,
      error
    );
  }
}

function calculateLandingPositionWithCollisionAvoidance(
  pathData: pathData,
  room: string,
  movingNpcGroupId: npcGroupId
) {
  const EXTENSION_DISTANCE = 2.5; // How much to extend the path if collision detected
  const MAX_EXTENSIONS = 5; // Maximum number of extensions to prevent infinite loops

  let currentPathData = { ...pathData };
  let extensionCount = 0;

  while (extensionCount < MAX_EXTENSIONS) {
    // Calculate landing position without wrapping
    const landingPosition = calculateLandingPosition(currentPathData);

    // Get all NPCs in the room to check for collisions
    const allNPCGroups =  getNPCGroupsfromMemory(room);
    const idleNPCGroups = Array.from(allNPCGroups.values()).filter(
      (npcGroup) => npcGroup.phase === NPCPhase.IDLE && npcGroup.id !== movingNpcGroupId
    );

    // Check for collisions with IDLE NPCs
    let hasCollision = false;
    for (const idleNPCGroup of idleNPCGroups) {
      const collided = detectCollision(
        landingPosition,
        { ...idleNPCGroup.position, z: 0 },
        NPC_WIDTH, // width1 - moving NPC
        NPC_HEIGHT, // height1 - moving NPC
        NPC_WIDTH, // width2 - idle NPC
        NPC_HEIGHT  // height2 - idle NPC
      );

      if (collided) {
        hasCollision = true;
        console.log(
          `Bounding box collision detected between NPC ${movingNpcGroupId} and IDLE NPC ${idleNPCGroup.id}`
        );
        break;
      }
    }

    // If no collision, return this position
    if (!hasCollision) {
      return landingPosition;
    }

    // Extend the path in the same direction
    const currentDistance =
      currentPathData.velocity * (currentPathData.pathDuration / 1000);
    const newDistance = currentDistance + EXTENSION_DISTANCE;

    // Update path data with extended distance
    currentPathData = {
      ...currentPathData,
      pathDuration: (newDistance / currentPathData.velocity) * 1000,
    };

    extensionCount++;
    console.log(
      `Extending path for NPC ${movingNpcGroupId}, extension ${extensionCount}/${MAX_EXTENSIONS}`
    );
  }

  // If we've reached max extensions, just return the last calculated position
  console.log(
    `Max extensions reached for NPC ${movingNpcGroupId}, settling at final position`
  );
  return calculateLandingPosition(currentPathData);
}

// Mirror client-side path position calculation function
function calculatePathPosition(pathData: pathData, currentTime: number) {
  // Calculate elapsed time in seconds
  const elapsedTime = (currentTime - pathData.timestamp) / 1000;
  const pathDurationSec = pathData.pathDuration / 1000;
  const progress = Math.min(elapsedTime / pathDurationSec, 1);

  let position;

  // If we've reached the end of the path, use exact same calculation as server
  if (progress >= 1) {
    const finalDistance = pathData.velocity * pathDurationSec;
    position = {
      x: pathData.startPosition.x + pathData.direction.x * finalDistance,
      y: pathData.startPosition.y + pathData.direction.y * finalDistance,
      z: 0,
    };
  } else {
    // For animation, calculate intermediate position
    const distance = pathData.velocity * elapsedTime;
    position = {
      x: pathData.startPosition.x + pathData.direction.x * distance,
      y: pathData.startPosition.y + pathData.direction.y * distance,
      z: 0,
    };
  }

  return position;
}

function calculateLandingPosition(pathData: pathData) {
  // This is the same as calculatePathPosition at progress = 1
  return calculatePathPosition(
    pathData,
    pathData.timestamp + pathData.pathDuration
  );
}

export function createNPCGroups(): NPCGroup[] {
  const npcGroups: NPCGroup[] = [];
  const npcFilenames = getNPCFilenames();
  const shuffledFilenames = [...npcFilenames].sort(() => Math.random() - 0.5);

  for (let i = 0; i < NUM_NPCS; i++) {
    const filenameIndex = i % shuffledFilenames.length;
    const filename = shuffledFilenames[filenameIndex];

    const npcGroup = new NPCGroup({
      id: uuidv4(),
      fileNames: [filename],
      position: getInitialPosition(),
      direction: getInitialDirection(),
      phase: NPCPhase.IDLE,
    });

    npcGroups.push(npcGroup);
  }

  return npcGroups;
}

function getNPCFilenames(): string[] {
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


const detectCollision = (
  position1: { x: number; y: number; z: number },
  position2: { x: number; y: number; z: number },
  width1: number = NPC_WIDTH,
  height1: number = NPC_HEIGHT,
  width2: number = NPC_WIDTH,
  height2: number = NPC_HEIGHT
) => {
  // Bounding box collision detection
  const halfWidth1 = width1 / 2;
  const halfHeight1 = height1 / 2;
  const halfWidth2 = width2 / 2;
  const halfHeight2 = height2 / 2;

  const left1 = position1.x - halfWidth1;
  const right1 = position1.x + halfWidth1;
  const top1 = position1.y - halfHeight1;
  const bottom1 = position1.y + halfHeight1;

  const left2 = position2.x - halfWidth2;
  const right2 = position2.x + halfWidth2;
  const top2 = position2.y - halfHeight2;
  const bottom2 = position2.y + halfHeight2;

  // Check if bounding boxes overlap
  return !(right1 < left2 || left1 > right2 || bottom1 < top2 || top1 > bottom2);
};

// Check for NPC collisions and handle merging/bouncing based on group sizes
export function checkAndHandleNPCCollisions(room: string): void{
  try {
    // Get all necessary data for collision detection
    const allPaths = Array.from(getpathsfromMemory(room).values());

    const allNPCGroups = getNPCGroupsfromMemory(room);

    // Check collision between path NPCs and idle NPCs
    for (let i = 0; i < allPaths.length; i++) {
      const pathData = allPaths[i];

      if (pathData.pathPhase !== PathPhase.THROWN) {
        continue;
      }
      const pathPosition = calculatePathPosition(pathData, Date.now());

      // Check collision with idle NPCs
      const idleNPCGroups = Array.from(allNPCGroups.values()).filter(
        (npcGroup) => npcGroup.phase === NPCPhase.IDLE && npcGroup.id !== pathData.npcGroup.id
      );

      for (const idleNPCGroup of idleNPCGroups) {
        const collided = detectCollision(
          pathPosition,
          { ...idleNPCGroup.position, z: 0 },
          NPC_WIDTH, NPC_HEIGHT, NPC_WIDTH, NPC_HEIGHT
        );

        if (collided) {
          console.log(`Path NPC ${pathData.npcGroup.id} collided with idle NPC ${idleNPCGroup.id}`);
          handlePathNPCMerge(room, pathData, idleNPCGroup, pathPosition);
          return;
        }
      }
    }

    // Check collision between path NPCs
    for (let i = 0; i < allPaths.length; i++) {
      const currentPathData = allPaths[i];
      if (currentPathData.pathPhase !== PathPhase.THROWN) {
        continue;
      }
      const currentPosition = calculatePathPosition(currentPathData, Date.now());

      for (let j = i + 1; j < allPaths.length; j++) {
        const otherPathData = allPaths[j];
        if (
          otherPathData.npcGroup.captorId !== currentPathData.npcGroup.captorId // Ignore same captor
        ) {
          const otherPosition = calculatePathPosition(otherPathData, Date.now());
          const collided = detectCollision(
            currentPosition,
            otherPosition,
            NPC_WIDTH, NPC_HEIGHT, NPC_WIDTH, NPC_HEIGHT
          );

          if (collided) {
            console.log("Path NPC collision detected");
            const currentSize = currentPathData.npcGroup.fileNames.length;
            const otherSize = otherPathData.npcGroup.fileNames.length;

            if (currentSize === otherSize &&  otherPathData.pathPhase === PathPhase.THROWN) {
              // Same size: bounce as before
              handleNPCBounce(room, currentPathData, currentPosition, otherPosition);
              handleNPCBounce(room, otherPathData, otherPosition, currentPosition);
            } else {
              // Different sizes: merge into bigger group
              if (currentSize >= otherSize) {
                handlePathNPCMerge(room, currentPathData, otherPathData, currentPosition);
              } else {
                handlePathNPCMerge(room, otherPathData, currentPathData, otherPosition);
              }
            }
            return;
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking NPC collisions:", error);
  }
}

// Handle merging between two path NPCs
function handlePathNPCMerge(
  room: string,
  winnerPathData: pathData,
  loser: pathData | NPCGroup,
  collisionPosition: { x: number; y: number; z: number }
): void {
  // Create merged group with winner's captor ID
  const mergedGroup = new NPCGroup({
    ...winnerPathData.npcGroup,
    fileNames: [...loser instanceof NPCGroup ? loser.fileNames : loser.npcGroup.fileNames, ...winnerPathData.npcGroup.fileNames],
    position: collisionPosition,
    phase: NPCPhase.PATH,
  });

  // update the groups in memory
  updateNPCGroupInRoom(room, mergedGroup);
  if (loser instanceof NPCGroup) {
    loser.fileNames = [];
    updateNPCGroupInRoom(room, loser);
  }
  else {
    loser.npcGroup.fileNames = [];
    updateNPCGroupInRoomInMemory(room, loser.npcGroup);
  }

  // Update the winner's path data with the merged group
  const updatedPathData: pathData = {
    ...winnerPathData,
    npcGroup: mergedGroup,
  };

  // Update memory
  const paths = getpathsfromMemory(room);
  paths.set(mergedGroup.id, updatedPathData);
  if (loser instanceof NPCGroup) {
    paths.delete(loser.id); // Remove the loser's path
  }
  else {
    console.log("loser is a path data", loser.npcGroup.id);
    paths.delete(loser.npcGroup.id); // Remove the loser's path
  }
  setPathsInMemory(room, paths);

  // Broadcast updates
  emitToRoom(room, "path-update", { pathData: updatedPathData });
  if (!(loser instanceof NPCGroup)) {
    emitToRoom(room, "path-absorbed", { pathData: loser });
  }

  console.log(`Merged path NPCs: ${winnerPathData.npcGroup.id} absorbed ${loser instanceof NPCGroup ? loser.id : loser.npcGroup.id}`);
}

// Handle bouncing between two path NPCs
function handleNPCBounce(
  room: string,
  pathData: pathData,
  myPosition: { x: number; y: number; z: number },
  otherPosition: { x: number; y: number; z: number }
): void{
  // Calculate bounce direction (away from other NPC with some randomness)
  const bounceDirection = {
    x: myPosition.x - otherPosition.x + (Math.random() - 0.5) * 2,
    y: myPosition.y - otherPosition.y + (Math.random() - 0.5) * 2,
  };

  // Normalize bounce direction
  const length = Math.sqrt(
    bounceDirection.x * bounceDirection.x +
      bounceDirection.y * bounceDirection.y
  );
  const normalizedDirection = {
    x: bounceDirection.x / length,
    y: bounceDirection.y / length,
  };

  // Create bounce path
  const bouncePathData: pathData = {
    id: uuidv4(),
    room: pathData.room,
    npcGroup: pathData.npcGroup,
    startPosition: {
      x: myPosition.x,
      y: myPosition.y,
    },
    direction: normalizedDirection,
    pathDuration: 1000, // Short bounce duration
    velocity: 15, // Medium bounce speed
    timestamp: Date.now(),
    pathPhase: PathPhase.BOUNCING,
  };

  // Update the path in memory
  const paths =  getpathsfromMemory(room);
  paths.set(bouncePathData.npcGroup.id, bouncePathData);
   setPathsInMemory(room, paths);

  console.log("handle npc bounce");

  // Broadcast to all clients
  emitToRoom(room, "path-update", { pathData: bouncePathData });
}
