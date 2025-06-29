import React, { useMemo } from "react";
import { Text } from "@react-three/drei";
import {
  NPCGroup,
  pathData,
  UserInfo,
  PathPhase,
  NPCPhase,
  NPCGroupsBiMap,
} from "shared/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { smoothMove } from "../../utils/movement";
import { useNPCGroupBase, useMount } from "../../hooks/use-npc-group-base";
import { TerrainBoundaries } from "../../utils/terrain";
import {
  calculateNPCGroupScale,
  calculateNPCGroupPosition,
} from "../../utils/npc-group-utils";
import { getAnimalColor } from "../../utils/animal-colors";
import { typedSocket } from "../../socket";
import { v4 as uuidv4 } from "uuid";
// Constants for positioning

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

interface CapturedNPCGroupGraphicProps {
  group: NPCGroup;
  user: UserInfo;
  npcGroups: NPCGroupsBiMap;
  allPaths: Map<string, pathData>;
  setPaths: (
    paths:
      | Map<string, pathData>
      | ((prev: Map<string, pathData>) => Map<string, pathData>)
  ) => void;
  setNpcGroups: (
    npcGroups:
      | NPCGroupsBiMap
      | ((prev: NPCGroupsBiMap) => NPCGroupsBiMap)
  ) => void;
  animalWidth: number | undefined;
  isLocalUser: boolean; // Add flag to distinguish local vs non-local users
  terrainBoundaries?: TerrainBoundaries; // Add terrain boundaries for wrapping
  users: Map<string, UserInfo>; // All users for getting group positions
  throwChargeCount: number | undefined;
}

const CapturedNPCGroupGraphic: React.FC<CapturedNPCGroupGraphicProps> = ({
  group,
  user,
  npcGroups,
  allPaths,
  setPaths,
  setNpcGroups,
  animalWidth,
  isLocalUser = false, // Default to false for non-local users
  throwChargeCount,
}) => {
  
  // Calculate logarithmic scale factor based on number of NPCs
  const scaleFactor = useMemo(() => {
    return calculateNPCGroupScale(group.fileNames.length);
  }, [group.fileNames.length]);

  // Get the real face NPC from the npcs map
  // Use the NPCBase hook with the face NPC (now handles outline, returns text info)
  const {
    group: threeGroup,
    positionRef,
    textureLoaded,
    updatePositionWithTracking,
    mesh,
    textInfo,
    throwChargeCountTextInfo,
  } = useNPCGroupBase(group, user, undefined, throwChargeCount);


  // Reference for smooth movement interpolation (non-local users)
  const previousPosition = useMemo(() => new THREE.Vector3(), []);
  // Memoize target position calculation to avoid unnecessary recalculations
  // Only memoize for non-local users since local users need real-time updates
  const memoizedTargetPosition = useMemo(() => {
    if (isLocalUser || !animalWidth) return null; // Don't memoize for local users or if no animalWidth
    return calculateNPCGroupPosition(user, animalWidth, scaleFactor);
  }, [
    isLocalUser,
    user.position.x,
    user.position.y,
    user.direction.x,
    user.direction.y,
    animalWidth,
    scaleFactor,
    user,
  ]);

  // Export position and scale calculation functions for collision detection
  const calculateTargetPosition = (): THREE.Vector3 => {
    // For local users, always calculate fresh to ensure real-time updates
    // For non-local users, use memoized value for performance
    if (isLocalUser && animalWidth) {
      return calculateNPCGroupPosition(user, animalWidth, scaleFactor);
    }
    return memoizedTargetPosition || new THREE.Vector3(0, 0, 100);
  };


  const handleNPCGroupReflection = (
    npcGroup: NPCGroup,
    pathData: pathData,
    currentPathPosition: THREE.Vector3
  ) => {
    if (!setPaths || !setNpcGroups || (pathData.pathPhase !== PathPhase.THROWN && pathData.pathPhase !== PathPhase.RETURNING) || !animalWidth) return;


    // Calculate reflection direction (away from the group)
    const npcGroupPosition = calculateNPCGroupPosition(user, animalWidth, scaleFactor);
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
      captorId: group.captorId,
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
      velocity:pathData.velocity, // Fast reflection speed
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
       const emissionCount = Math.min(npcGroup.fileNames.length, group.fileNames.length);
       
       // Calculate impact direction (where the thrown NPC hit from)
       const capturedGroupPosition = calculateNPCGroupPosition(user, animalWidth, scaleFactor);
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
         if (i >= group.fileNames.length) break;
         
         // Distribute NPCs within the spread angle
         const angle = startAngle + (i / Math.max(1, emissionCount - 1)) * spreadAngle;
         const emissionDirection = {
           x: Math.cos(angle),
           y: Math.sin(angle),
         };
         
         const emittedNPCGroup = new NPCGroup({
           id: uuidv4(),
           fileNames: [group.fileNames[i]],
           captorId: undefined, // Emitted NPCs are no longer captured
           phase: NPCPhase.PATH,
           direction: emissionDirection,
           position: group.position,
         });
         
         emittedNPCs.push(emittedNPCGroup);
       }

       // Create remaining group with NPCs that weren't emitted
       const remainingNPCs = group.fileNames.slice(emissionCount);
       const restOfNPCsGroup = remainingNPCs.length > 0 ? new NPCGroup({
         ...group,
         fileNames: remainingNPCs,
       }) : null;


      if (emittedNPCs.length > 0) {
        // Calculate current position of the captured group (not the stored position)
        const currentNPCGroupPosition = calculateNPCGroupPosition(user, animalWidth, scaleFactor);
        const emissionStartPosition = currentNPCGroupPosition ? {
          x: currentNPCGroupPosition.x,
          y: currentNPCGroupPosition.y,
        } : group.position;
        
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
        
        setNpcGroups((prev: NPCGroupsBiMap) => {
          const newNpcGroups = new NPCGroupsBiMap(prev);
          
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
            newNpcGroups.deleteByNpcGroupId(group.id);
            currentTypedSocket.emit("update-npc-group", { npcGroup: new NPCGroup({ ...group, fileNames: [] }) });
          }
          
          return newNpcGroups;
        });
    }
  };

  const checkForPathNPCCollision = (npcGroup: NPCGroup, pathData: pathData) => {
    if ((pathData.pathPhase !== PathPhase.THROWN && pathData.pathPhase !== PathPhase.RETURNING) || !animalWidth) return false;

    const calculatePathPosition = (pathData: pathData, currentTime: number) => {
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
    };

    // Check npc group collsiion with the path data, using npc group position and scale and path data calculated position
    const currentPathPostion = calculatePathPosition(pathData, Date.now());
    const npcGroupPosition = calculateNPCGroupPosition(
      user,
      animalWidth,
      scaleFactor
    );

    const npcGroupScale = scaleFactor;
    const npcGroupRadius = npcGroupScale;
    const distance = npcGroupPosition ? npcGroupPosition.distanceTo(currentPathPostion) : Infinity;
    if (distance < npcGroupRadius && group.fileNames.length > 0) {
      handleNPCGroupReflection(npcGroup, pathData, currentPathPostion);
      return true;
    }

    return false;
  };




  // Set initial position
  useMount(() => {
    // Start with initial position behind user
    const initialPosition = calculateTargetPosition();

    updatePositionWithTracking(initialPosition, "NPCGroup-initial");
    threeGroup.position.copy(positionRef.current);

    // Initialize previousPosition for smooth interpolation
    previousPosition.copy(positionRef.current);
  });

  // Handle position updates to follow the user
  useFrame(() => {
    if (!threeGroup || !textureLoaded.current || !user || group.fileNames.length === 0 || !animalWidth) return;

    // Calculate target position with offset from user
    const targetPosition = calculateTargetPosition();

    // Check for collisions with path NPCs if we have the required props

    // Both local and non-local users use smoothMove for nice interpolated following:
    // - Local: interpolates towards target calculated from immediate user position
    // - Non-local: interpolates towards target calculated from discrete socket user position
    // For non-local users, we need SLOWER interpolation so NPC group lags behind
    // the already-interpolated animal position
    if (!positionRef.current.equals(targetPosition)) {
      const interpolationParams = isLocalUser
        ? {
            // Local users: standard interpolation creates nice lag relative to immediate movement
            lerpFactor: 0.2,
            moveSpeed: 0.5,
            minDistance: 0.01,
            useConstantSpeed: true,
          }
        : {
            lerpFactor: 0.07,
            moveSpeed: 0.5,
            minDistance: 0.01,
            useConstantSpeed: true,
          };

      updatePositionWithTracking(
        smoothMove(
          positionRef.current.clone(),
          targetPosition,
          interpolationParams
        ),
        "NPCGroup"
      );
      threeGroup.position.copy(positionRef.current);
    }


    // Make a subtle oscillation to indicate this is a group
    const time = Date.now() / 1000;
    const oscillation = Math.sin(time * 2) * 0.05; // Reduced oscillation
    threeGroup.rotation.z = oscillation;

    // Keep scale constant - no more pulsing
    if (mesh.current) {
      // Ensure the mesh scale remains consistent with the scaleFactor
      mesh.current.scale.set(scaleFactor, scaleFactor, 1);
    }
    // only check for collision for local npc group
    if (isLocalUser) {
             Array.from(allPaths.entries()).forEach(([_npcId, pathData]) => {
         // Get the NPC group from the groups map using the ID
         const pathNPCGroup = npcGroups.getByNpcGroupId(pathData.npcGroupId);
         if (
           (pathData.pathPhase === PathPhase.THROWN || pathData.pathPhase === PathPhase.RETURNING) &&
           pathNPCGroup &&
           pathNPCGroup.captorId !== group.captorId
         ) {
           checkForPathNPCCollision(pathNPCGroup, pathData);
         }
       });
    }
  });

  // Final early return after all hooks are called
  if (!user || group.fileNames.length === 0 || !animalWidth) {
    return null;
  }

  return (
    <>
      <primitive object={threeGroup}>
        {/* Text component like the original, positioned relative to the group */}
        {textInfo && (
          <Text
            position={textInfo.position}
            fontSize={textInfo.fontSize}
            color={textInfo.color}
            anchorX="center"
            anchorY="middle"
            font="https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxM.woff"
            characters="0123456789"
            outlineWidth={0.1}
            outlineColor="white"
          >
            {textInfo.count}
          </Text>
        )} 
        {throwChargeCountTextInfo && (
          <Text
            position={throwChargeCountTextInfo.position}
            fontSize={throwChargeCountTextInfo.fontSize}
            color={throwChargeCountTextInfo.color}
            anchorX="center"
            anchorY="middle"
            font="https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxM.woff"
            characters="0123456789"
            outlineWidth={0.1}
            outlineColor={getAnimalColor(user)}
          >
            {throwChargeCountTextInfo.count}
          </Text>
        )}
      </primitive>
    </>
  );
};

export default React.memo(CapturedNPCGroupGraphic, (prevProps, nextProps) => {
  // Compare group properties
  const captorIdSame = prevProps.group.captorId === nextProps.group.captorId;
  const sizeSame = prevProps.group.fileNames.length === nextProps.group.fileNames.length;
  
  const prevNpcIds = Array.from(prevProps.group.fileNames).sort();
  const nextNpcIds = Array.from(nextProps.group.fileNames).sort();
  const npcIdsSame = prevNpcIds.every((id, index) => id === nextNpcIds[index]);

  const groupsSame = captorIdSame && sizeSame && npcIdsSame;

  // Compare other props including user position
  const userSame = prevProps.user.id === nextProps.user.id;
  const userPositionSame =
    prevProps.user.position.x === nextProps.user.position.x &&
    prevProps.user.position.y === nextProps.user.position.y 
  const userDirectionSame =
    prevProps.user.direction.x === nextProps.user.direction.x &&
    prevProps.user.direction.y === nextProps.user.direction.y;
  const animalWidthSame = prevProps.animalWidth === nextProps.animalWidth;
  const throwChargeCountSame = prevProps.throwChargeCount === nextProps.throwChargeCount;

  // Compare allPaths - this is critical for collision detection
  const allPathsSame = prevProps.allPaths.size === nextProps.allPaths.size &&
    Array.from(prevProps.allPaths.entries()).every(([npcId, pathData]) => {
      const nextPathData = nextProps.allPaths.get(npcId);
      return nextPathData && 
        pathData.id === nextPathData.id &&
        pathData.timestamp === nextPathData.timestamp &&
        pathData.pathPhase === nextPathData.pathPhase;
    });

  const shouldNotRerender =
    groupsSame &&
    userSame &&
    userPositionSame &&
    userDirectionSame &&
    animalWidthSame &&
    allPathsSame &&
    throwChargeCountSame;

  return shouldNotRerender;
});

