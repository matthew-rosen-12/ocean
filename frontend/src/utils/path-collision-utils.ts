import * as THREE from "three";
import { NPCGroup, pathData, PathPhase, NPCPhase, UserInfo } from "shared/types";
import { NPCInteraction, createInteraction } from "shared/interaction-prompts";
import { calculateNPCGroupPosition, calculateNPCGroupScale } from "./npc-group-utils";
import { typedSocket } from "../socket";
import { v4 as uuidv4 } from "uuid";

// Deterministic random function that produces consistent results across all clients
function getRandom(input: Record<string, any>): number {
  // Create deterministic hash from server-synchronized data only
  const hashInput = Object.entries(input)
    .sort(([a], [b]) => a.localeCompare(b)) // Sort keys for consistency
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
    
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert hash to a value between -0.5 and 0.5
  return ((hash % 1000) / 1000) - 0.5;
}

// Function to distribute bots among real users for collision detection
export function getAssignedBots(localUserId: string, allUsers: Map<string, UserInfo>): UserInfo[] {
  const realUsers = Array.from(allUsers.values()).filter(user => !user.isBot);
  const bots = Array.from(allUsers.values()).filter(user => user.isBot);
  
  console.log(`[getAssignedBots] localUserId: ${localUserId.slice(0,8)}, realUsers: ${realUsers.length}, bots: ${bots.length}`);
  
  if (realUsers.length === 0 || bots.length === 0) {
    return [];
  }
  
  const assignedBots: UserInfo[] = [];
  
  // Hash each bot to a real user
  bots.forEach(bot => {
    // Create deterministic hash based on bot ID and real user IDs
    const hashInput = {
      botId: bot.id,
      realUserIds: realUsers.map(u => u.id).sort().join(',')
    };
    
    const hash = getRandom(hashInput);
    // Map hash to a real user index
    const userIndex = Math.abs(Math.floor(hash * 1000)) % realUsers.length;
    const assignedUserId = realUsers[userIndex].id;
    
    console.log(`[getAssignedBots] bot ${bot.id.slice(0,8)} assigned to user ${assignedUserId.slice(0,8)}, localUser is ${localUserId.slice(0,8)}`);
    
    // If this real user is assigned to handle this bot's collision detection
    if (assignedUserId === localUserId) {
      assignedBots.push(bot);
      console.log(`[getAssignedBots] ✓ bot ${bot.id.slice(0,8)} assigned to THIS user`);
    }
  });
  
  console.log(`[getAssignedBots] Total assigned bots for this user: ${assignedBots.length}`);
  return assignedBots;
}

export function calculatePathPosition(pathData: pathData, currentTime: number): THREE.Vector3 {
  // Calculate elapsed time in seconds
  const elapsedTime = (currentTime - pathData.timestamp) / 1000;
  const pathDurationSec = pathData.pathDuration / 1000;
  const progress = Math.min(elapsedTime / pathDurationSec, 1);

  let position: THREE.Vector3;

  // If we've reached the end of the path, use exact same calculation as server
  if (progress >= 1) {
    const finalDistance = pathData.velocity * pathDurationSec;
    position = new THREE.Vector3(
      pathData.startPosition.x + pathData.direction.x * finalDistance,
      pathData.startPosition.y + pathData.direction.y * finalDistance,
      0
    );
  } else {
    // For animation, calculate intermediate position
    const distance = pathData.velocity * elapsedTime;
    position = new THREE.Vector3(
      pathData.startPosition.x + pathData.direction.x * distance,
      pathData.startPosition.y + pathData.direction.y * distance,
      0
    );
  }

  return position;
}

export function handleNPCGroupReflectionForUser(
  npcGroup: NPCGroup,
  pathData: pathData,
  currentPathPosition: THREE.Vector3,
  capturedGroup: NPCGroup,
  targetUser: UserInfo,
  animalWidth: number,
  setPaths: (paths: any) => void,
  setNpcGroups: (npcGroups: any) => void
) {
  if ((pathData.pathPhase !== PathPhase.THROWN && pathData.pathPhase !== PathPhase.RETURNING)) return;

  // Calculate reflection direction (away from the group)
  const capturedGroupScale = calculateNPCGroupScale(capturedGroup.fileNames.length);
  const npcGroupPosition = calculateNPCGroupPosition(targetUser, animalWidth, capturedGroupScale);
  if (!npcGroupPosition) return;
  
  const reflectionDirection = {
    x: currentPathPosition.x - npcGroupPosition.x,
    y: currentPathPosition.y - npcGroupPosition.y,
  };

  // Normalize reflection direction
  const length = Math.sqrt(
    reflectionDirection.x * reflectionDirection.x +
      reflectionDirection.y * reflectionDirection.y
  );
  
  // Get deterministic random value based on server-synchronized data only
  const normalizedHash = getRandom({
    pathId: pathData.id,
    npcGroupId: npcGroup.id,
    captorId: capturedGroup.captorId,
    timestamp: pathData.timestamp
  });
  
  // Handle edge case where collision is exactly at center
  let normalizedDirection = length > 0 ? {
    x: reflectionDirection.x / length,
    y: reflectionDirection.y / length,
  } : {
    x: normalizedHash, // Deterministic direction if collision at exact center
    y: normalizedHash * 0.7, // Use different multiplier for y to avoid purely diagonal movement
  };

  // Add deterministic offset to reflection for more interesting bounces (consistent across clients)
  const randomOffset = 0.3; // Adjust this value to control randomness (0 = no randomness, 1 = very random)
  const randomAngle = normalizedHash * Math.PI * randomOffset; // Deterministic angle between -π*offset/2 and π*offset/2
  
  // Apply rotation to the normalized direction
  const cos = Math.cos(randomAngle);
  const sin = Math.sin(randomAngle);
  normalizedDirection = {
    x: normalizedDirection.x * cos - normalizedDirection.y * sin,
    y: normalizedDirection.x * sin + normalizedDirection.y * cos,
  };

  // Create reflection path for the thrown NPC
  const reflectionPathData: pathData = {
    id: uuidv4(),
    room: pathData.room,
    npcGroupId: npcGroup.id,
    startPosition: {
      x: currentPathPosition.x,
      y: currentPathPosition.y,
    },
    direction: normalizedDirection,
    pathDuration: 1200, // Reflection duration
    velocity: pathData.velocity, // Fast reflection speed
    timestamp: Date.now(),
    pathPhase: PathPhase.THROWN,
  };

  setPaths((prev: Map<string, pathData>) => {
    const newPaths = new Map(prev);
    newPaths.set(npcGroup.id, reflectionPathData);
    return newPaths;
  });

  // Send reflection to server
  const currentTypedSocket = typedSocket();
  if (currentTypedSocket) {
    currentTypedSocket.emit("update-path", { pathData: reflectionPathData });
  }

  // Get the number of NPCs to emit based on thrown NPC group size
  const emittedNPCs: NPCGroup[] = [];
  const emissionCount = Math.min(npcGroup.fileNames.length, capturedGroup.fileNames.length);
  
  // Calculate impact direction (where the thrown NPC hit from)
  const capturedGroupPosition = calculateNPCGroupPosition(targetUser, animalWidth, capturedGroupScale);
  if (!capturedGroupPosition) return;
  
  const impactDirection = {
    x: currentPathPosition.x - capturedGroupPosition.x,
    y: currentPathPosition.y - capturedGroupPosition.y,
  };
  
  // Normalize impact direction
  const impactLength = Math.sqrt(impactDirection.x ** 2 + impactDirection.y ** 2);
  const normalizedImpact = impactLength > 0 ? {
    x: impactDirection.x / impactLength,
    y: impactDirection.y / impactLength,
  } : { x: 1, y: 0 }; // fallback direction
  
  // Create emission spread around the impact direction (like a spray pattern)
  const spreadAngle = Math.PI * 0.6; // 108° spread
  const startAngle = Math.atan2(normalizedImpact.y, normalizedImpact.x) - spreadAngle / 2;
  
  for (let i = 0; i < emissionCount; i++) {
    if (i >= capturedGroup.fileNames.length) break;
    
    // Distribute NPCs within the spread angle
    const angle = startAngle + (i / Math.max(1, emissionCount - 1)) * spreadAngle;
    const emissionDirection = {
      x: Math.cos(angle),
      y: Math.sin(angle),
    };
    
    const emittedNPCGroup = new NPCGroup({
      id: uuidv4(),
      fileNames: [capturedGroup.fileNames[i]],
      captorId: undefined, // Emitted NPCs are no longer captured
      phase: NPCPhase.PATH,
      direction: emissionDirection,
      position: capturedGroup.position,
    });
    
    emittedNPCs.push(emittedNPCGroup);
  }

  // Create remaining group with NPCs that weren't emitted
  const remainingNPCs = capturedGroup.fileNames.slice(emissionCount);
  const restOfNPCsGroup = remainingNPCs.length > 0 ? new NPCGroup({
    ...capturedGroup,
    fileNames: remainingNPCs,
  }) : null;

  if (emittedNPCs.length > 0) {
    // Send emission interaction to backend
    const interaction = createInteraction.emitted(
      capturedGroup.faceFileName!, 
      npcGroup.faceFileName!,
      targetUser.animal
    );
    
    const currentTypedSocket = typedSocket();
    if (currentTypedSocket) {
      currentTypedSocket.emit("interaction-detected", { interaction });
    }

    // Calculate current position of the captured group (not the stored position)
    const currentNPCGroupPosition = calculateNPCGroupPosition(targetUser, animalWidth, capturedGroupScale);
    const emissionStartPosition = currentNPCGroupPosition ? {
      x: currentNPCGroupPosition.x,
      y: currentNPCGroupPosition.y,
    } : capturedGroup.position;
    
    // Update local state with all emitted NPCs and their paths
    setPaths((prev: Map<string, pathData>) => {
      const newPaths = new Map(prev);
      
      emittedNPCs.forEach((emittedNPC) => {
        // Use the same direction as assigned to the NPC group
        const emissionPathData: pathData = {
          id: uuidv4(),
          room: pathData.room,
          npcGroupId: emittedNPC.id,
          startPosition: emissionStartPosition,
          direction: emittedNPC.direction, // Use the reflection-based direction
          pathDuration: 2000, // Longer duration to prevent immediate recapture
          velocity: 3.0, // Moderate emission speed
          timestamp: Date.now(),
          pathPhase: PathPhase.FLEEING,
        };
        newPaths.set(emittedNPC.id, emissionPathData);
        
        // Emit individual updates to server
        currentTypedSocket.emit("update-npc-group", { npcGroup: emittedNPC });
        currentTypedSocket.emit("update-path", { pathData: emissionPathData });
      });
      
      return newPaths;
    });
    
    setNpcGroups((prev: any) => {
      const newNpcGroups = new (prev.constructor)(prev);
      
      // Add all emitted NPCs
      emittedNPCs.forEach(emittedNPC => {
        newNpcGroups.setByNpcGroupId(emittedNPC.id, emittedNPC);
      });
      
      // Update or remove the original captured group
      if (restOfNPCsGroup) {
        newNpcGroups.setByNpcGroupId(restOfNPCsGroup.id, restOfNPCsGroup);
        currentTypedSocket.emit("update-npc-group", { npcGroup: restOfNPCsGroup });
      } else {
        // If no NPCs remain, delete the original group
        newNpcGroups.deleteByNpcGroupId(capturedGroup.id);
        currentTypedSocket.emit("update-npc-group", { npcGroup: new NPCGroup({ ...capturedGroup, fileNames: [] }) });
      }
      
      return newNpcGroups;
    });
  }
}

export function checkForPathNPCCollisionForUser(
  npcGroup: NPCGroup, 
  pathData: pathData, 
  capturedGroup: NPCGroup, 
  targetUser: UserInfo,
  animalWidth: number,
  setPaths: (paths: any) => void,
  setNpcGroups: (npcGroups: any) => void
): boolean {
  if ((pathData.pathPhase !== PathPhase.THROWN && pathData.pathPhase !== PathPhase.RETURNING)) return false;

  // Check npc group collision with the path data, using npc group position and scale and path data calculated position
  const currentPathPosition = calculatePathPosition(pathData, Date.now());
  const capturedGroupScale = calculateNPCGroupScale(capturedGroup.fileNames.length);
  const npcGroupPosition = calculateNPCGroupPosition(
    targetUser,
    animalWidth,
    capturedGroupScale
  );

  const npcGroupRadius = capturedGroupScale;
  const distance = npcGroupPosition ? npcGroupPosition.distanceTo(currentPathPosition) : Infinity;
  if (distance < npcGroupRadius && capturedGroup.fileNames.length > 0) {
    handleNPCGroupReflectionForUser(npcGroup, pathData, currentPathPosition, capturedGroup, targetUser, animalWidth, setPaths, setNpcGroups);
    return true;
  }

  return false;
}