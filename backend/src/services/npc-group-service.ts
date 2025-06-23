import { pathData, NPCGroup, NPCPhase, PathPhase, roomId, npcGroupId, NPC_WIDTH, NPC_HEIGHT } from "shared/types";

import { getInitialPosition, getInitialDirection } from "../initialization/npc-info";
import { v4 as uuidv4 } from "uuid";
import { getTerrainConfig } from "../state/terrain";

const NUM_NPCS = 40;
const MAX_CUMULATIVE_SIZE = 100;

import {
  deletePathInMemory,
  getpathsfromMemory,
  setPathsInMemory,
} from "../state/paths";

import { getNPCGroupsfromMemory, updateNPCGroupInRoomInMemory, setNPCGroupsInMemory } from "../state/npc-groups";

import { emitToRoom } from "../typed-socket";
import { getAllUsersInRoom } from "../state/users";
import { ANIMAL_SCALES } from "shared/types";

export function updateNPCGroupInRoom(
  roomName: roomId,
  npcGroup: NPCGroup
): void{
   updateNPCGroupInRoomInMemory(roomName, npcGroup);
   emitToRoom(roomName, "npc-group-update", { npcGroup });
}

export function setPathCompleteInRoom(room: string, npcGroup: NPCGroup) {

    const paths =  getpathsfromMemory(room);
    const pathDataForNPC = paths.get(npcGroup.id);

    if (!pathDataForNPC) {
      console.log(`No path data found for NPC ${npcGroup.id} in room ${room}`);
      return;
    }


    // Check if this is a thrown path that should transition to returning
    if (pathDataForNPC.pathPhase === PathPhase.THROWN && npcGroup.captorId) {
      const landingPosition = calculateLandingPosition(pathDataForNPC);
      
      // Get the thrower's current position to calculate return direction
      const allUsers = getAllUsersInRoom(room);
      const thrower = Array.from(allUsers.values()).find(user => user.id === npcGroup.captorId);
      
      if (thrower) {
        // Calculate direction back to thrower
        const directionToThrower = {
          x: thrower.position.x - landingPosition.x,
          y: thrower.position.y - landingPosition.y,
        };
        
        // Normalize direction
        const length = Math.sqrt(directionToThrower.x * directionToThrower.x + directionToThrower.y * directionToThrower.y);
        if (length > 0) {
          directionToThrower.x /= length;
          directionToThrower.y /= length;
        }

        // Update the existing path to return to thrower (keep same ID, velocity, and phase)
        const returningPathData: pathData = {
          ...pathDataForNPC,
          startPosition: landingPosition,
          direction: directionToThrower,
          timestamp: Date.now(),
          pathPhase: PathPhase.THROWN, // Keep as THROWN phase
          pathDuration: 500, // Shorter duration for return journey
        };

        // Update paths in memory with same ID
        const paths = getpathsfromMemory(room);
        paths.set(npcGroup.id, returningPathData);
        setPathsInMemory(room, paths);

        // Broadcast the updated path
        emitToRoom(room, "path-update", { pathData: returningPathData });
      } else {
        // Thrower not found, go to IDLE
        deletePathInMemory(room, pathDataForNPC.id);
        emitToRoom(room, "path-deleted", { pathData: pathDataForNPC });
        
        npcGroup.phase = NPCPhase.IDLE;
        npcGroup.position = calculateLandingPosition(pathDataForNPC);
        updateNPCGroupInRoom(room, npcGroup);
      }
    } else if (pathDataForNPC.pathPhase === PathPhase.FLEEING) {
      // Normal path completion - go to IDLE
      let landingPosition;
      
      // Only apply collision avoidance for emitted NPCs (bouncing NPCs that came from collisions)
      // These are NPCs without captorId that are in bouncing/path phase
      // Thrown NPCs (with captorId) should land normally and trigger capture/merge logic
      if (pathDataForNPC.pathPhase === PathPhase.FLEEING) {
        const collisionResult = calculateLandingPositionWithCollisionAvoidance(
          pathDataForNPC,
          room,
          npcGroup.id
        );

        // If path was extended due to collision, update clients with new path
        if (collisionResult.extendedPath) {
          // Update the path in memory and broadcast to clients
          const paths = getpathsfromMemory(room);
          paths.set(npcGroup.id, collisionResult.extendedPath);
          setPathsInMemory(room, paths);
          
          // Broadcast the extended path to clients so they can animate smoothly
          emitToRoom(room, "path-update", { pathData: collisionResult.extendedPath });
          
          // Don't complete the path yet - let the extended path finish naturally
          return;
        }
        
        landingPosition = collisionResult.position;
      } else {
        // For thrown NPCs, just calculate normal landing position without collision avoidance
        landingPosition = calculateLandingPosition(pathDataForNPC);
      }

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
    }
}

function calculateLandingPositionWithCollisionAvoidance(
  pathData: pathData,
  room: string,
  movingNpcGroupId: npcGroupId
): { position: { x: number; y: number; z: number }, extendedPath?: pathData } {
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
      // If we extended the path, return the extended path data
      if (extensionCount > 0) {
        return { position: landingPosition, extendedPath: currentPathData };
      }
      return { position: landingPosition };
    }

    // Extend the path in the same direction
    const currentDistance =
      currentPathData.velocity * (currentPathData.pathDuration / 1000);
    const newDistance = currentDistance + EXTENSION_DISTANCE;

    // Update path data with extended distance
    currentPathData = {
      ...currentPathData,
      pathDuration: (newDistance / currentPathData.velocity) * 1000,
      timestamp: Date.now(), // Update timestamp so clients start fresh
    };

    extensionCount++;
    console.log(
      `Extending path for NPC ${movingNpcGroupId}, extension ${extensionCount}/${MAX_EXTENSIONS}`
    );
  }

  // If we've reached max extensions, return the last calculated position and extended path
  console.log(
    `Max extensions reached for NPC ${movingNpcGroupId}, settling at final position`
  );
  return { 
    position: calculateLandingPosition(currentPathData),
    extendedPath: currentPathData 
  };
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

export function createNPCGroups(terrainBoundaries?: { minX: number; maxX: number; minY: number; maxY: number }): NPCGroup[] {
  const npcGroups: NPCGroup[] = [];
  const npcFilenames = getNPCFilenames();
  const shuffledFilenames = [...npcFilenames].sort(() => Math.random() - 0.5);

  for (let i = 0; i < NUM_NPCS; i++) {
    const filenameIndex = i % shuffledFilenames.length;
    const filename = shuffledFilenames[filenameIndex];

    const npcGroup = new NPCGroup({
      id: uuidv4(),
      fileNames: [filename],
      position: getInitialPosition(terrainBoundaries),
      direction: getInitialDirection(),
      phase: NPCPhase.IDLE,
    });

    npcGroups.push(npcGroup);
  }

  return npcGroups;
}

export function createSingleNPCGroup(terrainBoundaries?: { minX: number; maxX: number; minY: number; maxY: number }): NPCGroup {
  const npcFilenames = getNPCFilenames();
  const randomFilename = npcFilenames[Math.floor(Math.random() * npcFilenames.length)];

  return new NPCGroup({
    id: uuidv4(),
    fileNames: [randomFilename],
    position: getInitialPosition(terrainBoundaries),
    direction: getInitialDirection(),
    phase: NPCPhase.IDLE,
  });
}

function getNPCFilenames(): string[] {
  // Hardcode the available NPC filenames from frontend
  return [
    "ada_lovelace.png",
    "akbar.png",
    "angela_merkel.png",
    "beethoven.png",
    "benjamin_franklin.png",
    "boudica.png",
    "bruce_lee.png",
    "chang_e.png",
    "cleopatra.png",
    "da_vinci.png",
    "emperor_meiji.png",
    "fdr.png",
    "florence_nightingale.png",
    "fred_astaire.png",
    "frederick_douglass.png",
    "girl_with_a_pearl_earring.png",
    "hermes.png",
    "isaac_netwon.png",
    "jane_austen.png",
    "jim_thorpe.png",
    "julia_codesido.png",
    "julius_caesar.png",
    "leif_erikson.png",
    "mansa_musa.png",
    "margaret_thatcher.png",
    "marie_curie.png",
    "mary_queen_of_scots.png",
    "mary_wollenstonecraft.png",
    "morgan_la_fey.png",
    "napoleon_bonaparte.png",
    "nelson_mandela.png",
    "nzinga_of_ndongo_and_matamba.png",
    "queen_elizabeth_I.png",
    "queen_lili_uokalani.png",
    "robinhood.png",
    "rumi.png",
    "sacagawea.png",
    "shakespeare.png",
    "sukarno.png",
    "winston_churchill.png",
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


    // Check collision between thrown PATH NPCs and idle NPCs
    const thrownPaths = allPaths.filter(path => path.pathPhase === PathPhase.THROWN);
    const idleNPCGroups = Array.from(allNPCGroups.values()).filter(npcGroup => npcGroup.phase === NPCPhase.IDLE);
    const uncapturedIdleNPCs = idleNPCGroups.filter(npcGroup => !npcGroup.captorId);
    const capturedIdleNPCs = idleNPCGroups.filter(npcGroup => npcGroup.captorId);

    for (const thrownPath of thrownPaths) {
      const pathPosition = calculatePathPosition(thrownPath, Date.now());
      const pathNPCGroup = allNPCGroups.getByNpcGroupId(thrownPath.npcGroupId);
      if (!pathNPCGroup) continue;

      // Check collision with uncaptured idle NPCs (normal merge behavior)
      for (const idleNPCGroup of uncapturedIdleNPCs) {
        const collided = detectCollision(
          pathPosition,
          { ...idleNPCGroup.position, z: 0 },
          NPC_WIDTH, NPC_HEIGHT, NPC_WIDTH, NPC_HEIGHT
        );

        if (collided) {
          console.log(`Path NPC ${thrownPath.npcGroupId} collided with uncaptured idle NPC ${idleNPCGroup.id}`);
          handlePathNPCMerge(room, thrownPath, pathNPCGroup, idleNPCGroup, pathPosition);
          return;
        }
      }

      // Check collision with captured idle NPCs (emit individual NPCs)
      for (const capturedIdleNPCGroup of capturedIdleNPCs) {
        // Skip if it's the same captor (don't collide with your own captured NPCs)
        if (capturedIdleNPCGroup.captorId === pathNPCGroup.captorId) {
          continue;
        }

        const collided = detectCollision(
          pathPosition,
          { ...capturedIdleNPCGroup.position, z: 0 },
          NPC_WIDTH, NPC_HEIGHT, NPC_WIDTH, NPC_HEIGHT
        );

        if (collided) {
          console.log(`Path NPC ${thrownPath.npcGroupId} collided with captured idle NPC ${capturedIdleNPCGroup.id}`);
          handleCapturedNPCEmission(room, thrownPath, pathNPCGroup, capturedIdleNPCGroup, pathPosition);
          return;
        }
      }
    }

    // Check collision between thrown path NPCs
    for (const thrownPath of thrownPaths) {
      const thrownPathPosition = calculatePathPosition(thrownPath, Date.now());

      for (const otherPath of allPaths) {
        if (otherPath.id === thrownPath.id) {
          continue
        }
        
        // Get the NPC groups for both paths
        const thrownPathNPCGroup = allNPCGroups.getByNpcGroupId(thrownPath.npcGroupId);
        const otherPathNPCGroup = allNPCGroups.getByNpcGroupId(otherPath.npcGroupId);
        if (!thrownPathNPCGroup || !otherPathNPCGroup) continue;
        
        const otherPathPosition = calculatePathPosition(otherPath, Date.now());
        const collided = detectCollision(
          thrownPathPosition,
          otherPathPosition,
          NPC_WIDTH, NPC_HEIGHT, NPC_WIDTH, NPC_HEIGHT
        );

        if (collided) {
          console.log("Path NPC collision detected");
          const thrownPathSize = thrownPathNPCGroup.fileNames.length;
          const otherPathSize = otherPathNPCGroup.fileNames.length;
          const sameOwner = otherPathNPCGroup.captorId === thrownPathNPCGroup.captorId;

          if (sameOwner) {
            // Same owner: always merge (no bouncing between same player's NPCs)
            console.log(`Merging same-owner path NPCs: ${thrownPath.npcGroupId} + ${otherPath.npcGroupId}`);
            if (thrownPathSize >= otherPathSize) {
              handlePathNPCMerge(room, thrownPath, thrownPathNPCGroup, otherPathNPCGroup, thrownPathPosition);
            } else {
              handlePathNPCMerge(room, otherPath, otherPathNPCGroup, thrownPathNPCGroup, otherPathPosition);
            }
          } else {
            // Different owners: existing behavior (bounce or merge based on size)
            if (thrownPathSize === otherPathSize && otherPath.pathPhase === PathPhase.THROWN) {
              // Same size: bounce as before
              handleNPCBounce(room, thrownPath, thrownPathPosition, otherPathPosition);
              handleNPCBounce(room, otherPath, otherPathPosition, thrownPathPosition);
            } else {
              // Different sizes: merge into bigger group
              if (thrownPathSize >= otherPathSize) {
                handlePathNPCMerge(room, thrownPath, thrownPathNPCGroup, otherPathNPCGroup, thrownPathPosition);
              } else {
                handlePathNPCMerge(room, otherPath, otherPathNPCGroup, thrownPathNPCGroup, otherPathPosition);
              }
            }
          }
          return;
        }
      }
    }

    // Check collision between fleeing/idle NPCs for merging
    const fleeingPaths = allPaths.filter(path => path.pathPhase === PathPhase.FLEEING);
    
    // Check fleeing NPCs against idle NPCs
    for (const fleeingPath of fleeingPaths) {
      const fleeingPosition = calculatePathPosition(fleeingPath, Date.now());
      const fleeingNPCGroup = allNPCGroups.getByNpcGroupId(fleeingPath.npcGroupId);
      if (!fleeingNPCGroup) continue;

      // Check collision with uncaptured idle NPCs
      for (const idleNPCGroup of uncapturedIdleNPCs) {
        const collided = detectCollision(
          fleeingPosition,
          { ...idleNPCGroup.position, z: 0 },
          NPC_WIDTH, NPC_HEIGHT, NPC_WIDTH, NPC_HEIGHT
        );

        if (collided) {
          console.log(`Fleeing NPC ${fleeingPath.npcGroupId} collided with idle NPC ${idleNPCGroup.id}`);
          handleFleeingIdleMerge(room, fleeingPath, fleeingNPCGroup, idleNPCGroup, fleeingPosition);
          return;
        }
      }
    }

    // Check fleeing NPCs against other fleeing NPCs
    for (let i = 0; i < fleeingPaths.length; i++) {
      const fleeingPath1 = fleeingPaths[i];
      const fleeingPosition1 = calculatePathPosition(fleeingPath1, Date.now());
      const fleeingNPCGroup1 = allNPCGroups.getByNpcGroupId(fleeingPath1.npcGroupId);
      if (!fleeingNPCGroup1) continue;

      for (let j = i + 1; j < fleeingPaths.length; j++) {
        const fleeingPath2 = fleeingPaths[j];
        const fleeingPosition2 = calculatePathPosition(fleeingPath2, Date.now());
        const fleeingNPCGroup2 = allNPCGroups.getByNpcGroupId(fleeingPath2.npcGroupId);
        if (!fleeingNPCGroup2) continue;

        const collided = detectCollision(
          fleeingPosition1,
          fleeingPosition2,
          NPC_WIDTH, NPC_HEIGHT, NPC_WIDTH, NPC_HEIGHT
        );

        if (collided) {
          // Merge the smaller into the larger
          const size1 = fleeingNPCGroup1.fileNames.length;
          const size2 = fleeingNPCGroup2.fileNames.length;
          
          if (size1 >= size2) {
            handleFleeingFleeingMerge(room, fleeingPath1, fleeingNPCGroup1, fleeingPath2, fleeingNPCGroup2, fleeingPosition1);
          } else {
            handleFleeingFleeingMerge(room, fleeingPath2, fleeingNPCGroup2, fleeingPath1, fleeingNPCGroup1, fleeingPosition2);
          }
          return;
        }
      }
    }

    // Check idle NPCs against other idle NPCs
    for (let i = 0; i < uncapturedIdleNPCs.length; i++) {
      const idleNPC1 = uncapturedIdleNPCs[i];
      
      for (let j = i + 1; j < uncapturedIdleNPCs.length; j++) {
        const idleNPC2 = uncapturedIdleNPCs[j];
        
        const collided = detectCollision(
          { ...idleNPC1.position, z: 0 },
          { ...idleNPC2.position, z: 0 },
          NPC_WIDTH, NPC_HEIGHT, NPC_WIDTH, NPC_HEIGHT
        );

        if (collided) {
          console.log(`Idle NPCs collided: ${idleNPC1.id} + ${idleNPC2.id}`);
          handleIdleIdleMerge(room, idleNPC1, idleNPC2);
          return;
        }
      }
    }

  } catch (error) {
    console.error("Error checking NPC collisions:", error);
  }
}

// Handle merging between two path NPCs or path NPC with idle NPC
function handlePathNPCMerge(
  room: string,
  winnerPathData: pathData,
  winnerNPCGroup: NPCGroup,
  loser: NPCGroup,
  collisionPosition: { x: number; y: number; z: number }
): void {
  // Create merged group with winner's captor ID
  const mergedGroup = new NPCGroup({
    ...winnerNPCGroup,
    fileNames: [...loser.fileNames, ...winnerNPCGroup.fileNames],
    position: collisionPosition,
    phase: NPCPhase.PATH,
  });

  // update the groups in memory
  updateNPCGroupInRoom(room, mergedGroup);
  loser.fileNames = [];
  updateNPCGroupInRoom(room, loser);

  // Update the winner's path data with the merged group
  const updatedPathData: pathData = {
    ...winnerPathData,
    npcGroupId: mergedGroup.id,
  };

  // Update memory
  const paths = getpathsfromMemory(room);
  paths.set(mergedGroup.id, updatedPathData);
  paths.delete(loser.id); // Remove the loser's path if it exists
  setPathsInMemory(room, paths);

  // Broadcast updates
  emitToRoom(room, "path-update", { pathData: updatedPathData });

  console.log(`Merged path NPCs: ${winnerPathData.npcGroupId} absorbed ${loser.id}`);
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
    npcGroupId: pathData.npcGroupId,
    startPosition: {
      x: myPosition.x,
      y: myPosition.y,
    },
    direction: normalizedDirection,
    pathDuration: 1000, // Short bounce duration
    velocity: 15, // Medium bounce speed
    timestamp: Date.now(),
    pathPhase: PathPhase.THROWN,
  };

  // Update the path in memory
  const paths =  getpathsfromMemory(room);
  paths.set(pathData.npcGroupId, bouncePathData);
   setPathsInMemory(room, paths);

  console.log("handle npc bounce");

  // Broadcast to all clients
  emitToRoom(room, "path-update", { pathData: bouncePathData });
}

// Handle collision between thrown NPC and captured idle NPC - emit individual NPCs
function handleCapturedNPCEmission(
  room: string,
  _thrownPathData: pathData,
  thrownNPCGroup: NPCGroup,
  capturedNPCGroup: NPCGroup,
  collisionPosition: { x: number; y: number; z: number }
): void {
  const emissionCount = thrownNPCGroup.fileNames.length;
  console.log(`Emitting ${emissionCount} individual NPCs from captured group ${capturedNPCGroup.id}`);
  
  // Create individual NPC groups from the captured group
  const emittedNPCs: NPCGroup[] = [];
  const angleStep = (Math.PI * 2) / emissionCount;
  const emissionRadius = NPC_WIDTH * 2; // Distance from collision point
  
  for (let i = 0; i < emissionCount; i++) {
    if (i >= capturedNPCGroup.fileNames.length) break; // Safety check
    
    const angle = i * angleStep;
    const emissionPosition = {
      x: collisionPosition.x + Math.cos(angle) * emissionRadius,
      y: collisionPosition.y + Math.sin(angle) * emissionRadius,
      z: 0,
    };
    
    const singleNPC = new NPCGroup({
      id: uuidv4(),
      fileNames: [capturedNPCGroup.fileNames[i]],
      position: emissionPosition,
      direction: getInitialDirection(),
      phase: NPCPhase.IDLE,
      captorId: undefined, // Emitted NPCs are no longer captured
    });
    
    emittedNPCs.push(singleNPC);
  }
  
  // Update memory with all the new NPCs
  const allNPCGroups = getNPCGroupsfromMemory(room);
  
  // Remove the original captured NPC group
  allNPCGroups.deleteByNpcGroupId(capturedNPCGroup.id);
  
  // Add all emitted NPCs
  emittedNPCs.forEach(npc => {
    allNPCGroups.setByNpcGroupId(npc.id, npc);
  });
  
  // Also remove the thrown NPC that caused the collision
  allNPCGroups.deleteByNpcGroupId(thrownNPCGroup.id);
  
  // Update paths - remove the thrown NPC's path
  const paths = getpathsfromMemory(room);
  paths.delete(thrownNPCGroup.id);
  setPathsInMemory(room, paths);
  
  // Save updated NPC groups
  setNPCGroupsInMemory(room, allNPCGroups);
  
  // Broadcast all updates at once using bulk update
  const updatedNPCs = [...emittedNPCs];
  // Also include the removed NPCs with empty fileNames to trigger deletion on frontend
  updatedNPCs.push(new NPCGroup({ ...capturedNPCGroup, fileNames: [] }));
  updatedNPCs.push(new NPCGroup({ ...thrownNPCGroup, fileNames: [] }));
  
  emitToRoom(room, "npc-groups-bulk-update", { npcGroups: updatedNPCs });
}

// Handle merging between fleeing NPC and idle NPC
function handleFleeingIdleMerge(
  room: string,
  fleeingPath: pathData,
  fleeingNPCGroup: NPCGroup,
  idleNPCGroup: NPCGroup,
  collisionPosition: { x: number; y: number; z: number }
): void {
  // Create merged group combining both groups
  const mergedGroup = new NPCGroup({
    ...fleeingNPCGroup,
    fileNames: [...fleeingNPCGroup.fileNames, ...idleNPCGroup.fileNames],
    position: collisionPosition,
    phase: NPCPhase.PATH, // Continue fleeing
  });

  // Update the groups in memory
  updateNPCGroupInRoom(room, mergedGroup);
  
  // Remove the idle NPC
  const allNPCGroups = getNPCGroupsfromMemory(room);
  allNPCGroups.deleteByNpcGroupId(idleNPCGroup.id);
  setNPCGroupsInMemory(room, allNPCGroups);

  // Update the fleeing path with the merged group
  const updatedPathData: pathData = {
    ...fleeingPath,
    npcGroupId: mergedGroup.id,
  };

  // Update memory
  const paths = getpathsfromMemory(room);
  paths.set(mergedGroup.id, updatedPathData);
  setPathsInMemory(room, paths);

  // Broadcast updates
  emitToRoom(room, "path-update", { pathData: updatedPathData });
  emitToRoom(room, "npc-group-update", { npcGroup: new NPCGroup({ ...idleNPCGroup, fileNames: [] }) }); // Mark idle as deleted

  console.log(`Merged fleeing NPC ${fleeingPath.npcGroupId} with idle NPC ${idleNPCGroup.id}`);
}

// Handle merging between two fleeing NPCs
function handleFleeingFleeingMerge(
  room: string,
  winnerPath: pathData,
  winnerNPCGroup: NPCGroup,
  _loserPath: pathData,
  loserNPCGroup: NPCGroup,
  collisionPosition: { x: number; y: number; z: number }
): void {
  // Create merged group with winner's properties
  const mergedGroup = new NPCGroup({
    ...winnerNPCGroup,
    fileNames: [...winnerNPCGroup.fileNames, ...loserNPCGroup.fileNames],
    position: collisionPosition,
    phase: NPCPhase.PATH,
  });

  // Update groups in memory
  updateNPCGroupInRoom(room, mergedGroup);
  
  // Remove the loser NPC
  const allNPCGroups = getNPCGroupsfromMemory(room);
  allNPCGroups.deleteByNpcGroupId(loserNPCGroup.id);
  setNPCGroupsInMemory(room, allNPCGroups);

  // Update the winner's path data with the merged group
  const updatedPathData: pathData = {
    ...winnerPath,
    npcGroupId: mergedGroup.id,
  };

  // Update memory
  const paths = getpathsfromMemory(room);
  paths.set(mergedGroup.id, updatedPathData);
  paths.delete(loserNPCGroup.id); // Remove the loser's path
  setPathsInMemory(room, paths);

  // Broadcast updates
  emitToRoom(room, "path-update", { pathData: updatedPathData });
  emitToRoom(room, "npc-group-update", { npcGroup: new NPCGroup({ ...loserNPCGroup, fileNames: [] }) }); // Mark loser as deleted
}

// Handle merging between two idle NPCs
function handleIdleIdleMerge(
  room: string,
  npc1: NPCGroup,
  npc2: NPCGroup
): void {
  // Create merged group (use the larger one as base, or first one if same size)
  const size1 = npc1.fileNames.length;
  const size2 = npc2.fileNames.length;
  const winner = size1 >= size2 ? npc1 : npc2;
  const loser = size1 >= size2 ? npc2 : npc1;

  const mergedGroup = new NPCGroup({
    ...winner,
    fileNames: [...winner.fileNames, ...loser.fileNames],
    position: { 
      x: (winner.position.x + loser.position.x) / 2,
      y: (winner.position.y + loser.position.y) / 2,
      z: 0 
    },
    phase: NPCPhase.IDLE,
  });

  // Update groups in memory
  updateNPCGroupInRoom(room, mergedGroup);
  
  // Remove the loser NPC
  const allNPCGroups = getNPCGroupsfromMemory(room);
  allNPCGroups.deleteByNpcGroupId(loser.id);
  setNPCGroupsInMemory(room, allNPCGroups);

  // Broadcast updates
  emitToRoom(room, "npc-group-update", { npcGroup: new NPCGroup({ ...loser, fileNames: [] }) }); // Mark loser as deleted

  console.log(`Merged idle NPCs: ${winner.id} absorbed ${loser.id}`);
}

// Utility function to normalize direction vectors
function normalizeDirection(direction: { x: number; y: number }): { x: number; y: number } {
  const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return { x: direction.x / length, y: direction.y / length };
}

// Server-side fleeing logic - called when user positions are updated
export function checkAndHandleNPCFleeing(room: string, _updatedUserId?: string): void {
  try {
    // Get all users and NPCs in the room
    const allUsers = getAllUsersInRoom(room);
    const allNPCGroups = getNPCGroupsfromMemory(room);
    const allPaths = getpathsfromMemory(room);

    if (allUsers.size === 0) return;

    // Convert users to array for easier processing
    const users = Array.from(allUsers.values());

    // Check each NPC for fleeing behavior
    Array.from(allNPCGroups.values()).forEach((npcGroup) => {
      // Only process IDLE or PATH NPCs (not captured ones)
      if (npcGroup.phase !== NPCPhase.IDLE && npcGroup.phase !== NPCPhase.PATH) {
        return;
      }

      // Skip NPCs that are captured
      if (npcGroup.captorId) {
        return;
      }

      const npcPosition = allPaths.get(npcGroup.id) ? calculatePathPosition(allPaths.get(npcGroup.id)!, Date.now()) : npcGroup.position;

      // Check if any user is within flee range (per-user animal scale)
      let shouldFlee = false;
      let withinCaptureRange = false;

      for (const user of users) {
        const distance = Math.sqrt(
          (npcPosition.x - user.position.x) ** 2 +
          (npcPosition.y - user.position.y) ** 2
        );

        // Calculate thresholds based on user's animal scale
        const animalScale = ANIMAL_SCALES[user.animal as keyof typeof ANIMAL_SCALES] || 1.0;
        const CAPTURE_THRESHOLD = animalScale * 0.5;
        const FLEE_THRESHOLD = animalScale * 50.0;

        if (distance < CAPTURE_THRESHOLD) {
          withinCaptureRange = true;
          break; // Capture takes priority over fleeing
        } else if (distance < FLEE_THRESHOLD) {
          shouldFlee = true;
        }
      }

      // Don't flee if within capture range
      if (withinCaptureRange) {
        return;
      }

      // If should flee, calculate flee direction and create flee path
      if (shouldFlee) {
        makeNPCGroupFlee(room, npcGroup, npcPosition, users, allPaths);
      }
    });
  } catch (error) {
    console.error("Error in checkAndHandleNPCFleeing:", error);
  }
}

// Create fleeing path for an NPC (server-side version of frontend logic)
function makeNPCGroupFlee(
  room: string,
  npcGroup: NPCGroup,
  npcPosition: { x: number; y: number },
  users: { id: string; position: { x: number; y: number; z?: number }; room: string; animal: string; direction: { x: number; y: number }; nickname: string }[],
  allPaths: Map<npcGroupId, pathData>
): void {
  try {
    // Get current path data
    const currentPathData = allPaths.get(npcGroup.id);

    // Calculate flee direction from all nearby users using weighted averaging
    let totalFleeForce = { x: 0, y: 0 };
    let totalWeight = 0;

    // Check all users for flee influence
    users.forEach((user) => {
      const distance = Math.sqrt(
        (npcPosition.x - user.position.x) ** 2 +
        (npcPosition.y - user.position.y) ** 2
      );

      // Calculate flee direction away from this user
      const fleeDirection = {
        x: npcPosition.x - user.position.x,
        y: npcPosition.y - user.position.y,
      };

      // Normalize the flee direction
      const length = Math.sqrt(fleeDirection.x ** 2 + fleeDirection.y ** 2);
      if (length > 0) {
        fleeDirection.x /= length;
        fleeDirection.y /= length;

        // Weight inversely by distance (closer users have more influence)
        const weight = 1.0 / (distance * distance);

        totalFleeForce.x += fleeDirection.x * weight;
        totalFleeForce.y += fleeDirection.y * weight;
        totalWeight += weight;
      }
    });

    // If no flee forces, don't create a flee path
    if (totalWeight === 0) {
      return;
    }

    // Average the flee forces
    const averageFleeDirection = {
      x: totalFleeForce.x / totalWeight,
      y: totalFleeForce.y / totalWeight,
    };

    // Normalize the final direction
    let finalFleeDirection = normalizeDirection(averageFleeDirection);

    // If normalization failed (zero vector), use fallback
    if (finalFleeDirection.x === 0 && finalFleeDirection.y === 0 && users.length > 0) {
      // Fallback to flee from first user
      finalFleeDirection = normalizeDirection({
        x: npcPosition.x - users[0].position.x,
        y: npcPosition.y - users[0].position.y,
      });
    }

    // Add stability: if already fleeing, blend with current direction
    if (currentPathData && currentPathData.pathPhase === PathPhase.FLEEING) {
      const timeSinceLastUpdate = Date.now() - currentPathData.timestamp;
      const MIN_UPDATE_INTERVAL = 300; // Update more frequently but still stable

      // Only update if enough time has passed
      if (timeSinceLastUpdate < MIN_UPDATE_INTERVAL) {
        return;
      }

      // Blend current direction with new flee direction for stability
      const currentDir = currentPathData.direction;
      finalFleeDirection = normalizeDirection({
        x: currentDir.x * 0.4 + finalFleeDirection.x * 0.6,
        y: currentDir.y * 0.4 + finalFleeDirection.y * 0.6,
      });
    }

    // Calculate fleeing speed based on group size (larger groups move faster)
    const groupSize = npcGroup.fileNames.length;
    const baseFleeSpeed = 2.0;
    const fleeVelocity = baseFleeSpeed + Math.sqrt(groupSize) * 0.5; // Larger groups get speed bonus

    // Create new path data
    const newPathData: pathData = currentPathData
      ? {
          ...currentPathData,
          startPosition: {
            x: npcPosition.x,
            y: npcPosition.y,
          },
          direction: finalFleeDirection,
          timestamp: Date.now(),
          pathPhase: PathPhase.FLEEING,
          velocity: fleeVelocity, // Speed proportional to group size
        }
      : {
          // create new path data
          id: uuidv4(),
          room: room,
          npcGroupId: npcGroup.id,
          startPosition: {
            x: npcPosition.x,
            y: npcPosition.y,
          },
          pathDuration: 1500,
          timestamp: Date.now(),
          direction: finalFleeDirection,
          velocity: fleeVelocity, // Speed proportional to group size
          pathPhase: PathPhase.FLEEING,
        };

    // Update paths in memory
    const paths = getpathsfromMemory(room);
    paths.set(npcGroup.id, newPathData);
    setPathsInMemory(room, paths);

    // Update NPC to PATH phase
    if (npcGroup.phase !== NPCPhase.PATH) {
    const updatedNpcGroup = new NPCGroup({
      ...npcGroup,
      phase: NPCPhase.PATH,
      });
      updateNPCGroupInRoom(room, updatedNpcGroup);
    }

    // Broadcast the flee path to all clients
    emitToRoom(room, "path-update", { pathData: newPathData });

  } catch (error) {
    console.error("Error in makeNPCGroupFlee:", error);
  }
}

// Check for fleeing NPCs that have traveled far outside terrain boundaries and delete them
export function checkAndDeleteFleeingNPCs(room: string): void {
  try {
    const allNPCGroups = getNPCGroupsfromMemory(room);
    const allPaths = getpathsfromMemory(room);
    const terrainConfig = getTerrainConfig(room);
    
    // Define distance outside terrain boundaries where NPCs should be deleted
    const DELETION_DISTANCE = 10; // Hardcoded distance outside terrain bounds
    
    Array.from(allNPCGroups.values()).forEach((npcGroup) => {
      // Only check NPCs in PATH phase
      if (npcGroup.phase !== NPCPhase.PATH) {
        return;
      }
      
      // Only check NPCs on FLEEING paths
      const pathData = allPaths.get(npcGroup.id);
      if (!pathData || pathData.pathPhase !== PathPhase.FLEEING) {
        return;
      }
      
      // Calculate current position of the fleeing NPC
      const currentPosition = calculatePathPosition(pathData, Date.now());
      
      // Check if NPC is far outside terrain boundaries
      const outsideDistance = calculateDistanceOutsideTerrain(currentPosition, terrainConfig);
      
      if (outsideDistance >= DELETION_DISTANCE) {
        console.log(`Deleting fleeing NPC ${npcGroup.id} - distance outside terrain: ${outsideDistance}`);
        
        // Delete the NPC group from memory
        allNPCGroups.deleteByNpcGroupId(npcGroup.id);
        
        // Delete the path from memory
        allPaths.delete(npcGroup.id);
        
        
        // Save updated states to memory
        setNPCGroupsInMemory(room, allNPCGroups);
        setPathsInMemory(room, allPaths);
        
        // Emit deletion event to room with current position
        emitToRoom(room, "npc-group-deleted", { 
          npcGroupId: npcGroup.id,
          currentPosition: currentPosition
        });
      }
    });
  } catch (error) {
    console.error("Error in checkAndDeleteFleeingNPCs:", error);
  }
}

// Calculate how far outside terrain boundaries a position is (returns 0 if inside)
function calculateDistanceOutsideTerrain(position: { x: number; y: number }, terrainConfig: any): number {
  const { boundaries } = terrainConfig;
  
  // Calculate distance outside each boundary
  const leftDistance = boundaries.minX - position.x; // positive if outside left
  const rightDistance = position.x - boundaries.maxX; // positive if outside right
  const bottomDistance = boundaries.minY - position.y; // positive if outside bottom
  const topDistance = position.y - boundaries.maxY; // positive if outside top
  
  // Find the maximum distance outside any boundary
  const maxDistance = Math.max(0, leftDistance, rightDistance, bottomDistance, topDistance);
  
  return maxDistance;
}

// Check and spawn NPCs to maintain population of NUM_NPCS
export function checkAndSpawnNPCs(room: string): void {
  try {
    const allNPCGroups = getNPCGroupsfromMemory(room);
    const currentCount = allNPCGroups.size;
    const currentCumulativeSize = allNPCGroups.cumulativeSize;
    
    // Check both group count and cumulative size limits
    if (currentCount < NUM_NPCS && currentCumulativeSize < MAX_CUMULATIVE_SIZE) {
      const maxByGroupCount = NUM_NPCS - currentCount;
      const maxByCumulativeSize = MAX_CUMULATIVE_SIZE - currentCumulativeSize;
      const spawnCount = Math.min(maxByGroupCount, maxByCumulativeSize); // Each new group adds 1 to cumulative size
      
      if (spawnCount > 0) {
        // Get terrain boundaries for proper spawning
        const terrainConfig = getTerrainConfig(room);
        const terrainBoundaries = terrainConfig.boundaries;
        
        for (let i = 0; i < spawnCount; i++) {
          const newNPCGroup = createSingleNPCGroup(terrainBoundaries);
          
          console.log(`[DEBUG] Spawned new NPC ${newNPCGroup.id} at position (${newNPCGroup.position.x}, ${newNPCGroup.position.y}) - Groups: ${currentCount + i + 1}/${NUM_NPCS}, Cumulative: ${currentCumulativeSize + i + 1}/${MAX_CUMULATIVE_SIZE}`);
          
          // Add NPC to memory and broadcast update immediately
          const currentNPCGroups = getNPCGroupsfromMemory(room);
          currentNPCGroups.setByNpcGroupId(newNPCGroup.id, newNPCGroup);
          setNPCGroupsInMemory(room, currentNPCGroups);
          emitToRoom(room, "npc-group-update", { npcGroup: newNPCGroup });
        }
      }
    }
  } catch (error) {
    console.error("Error in checkAndSpawnNPCs:", error);
  }
}
