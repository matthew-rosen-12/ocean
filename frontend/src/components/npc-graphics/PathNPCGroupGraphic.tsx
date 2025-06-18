import React, {
  useEffect,
  useState,
} from "react";
import { Text } from "@react-three/drei";
import {
  NPCPhase,
  pathData,
  UserInfo,
  PathPhase,
  NPCGroup,
  NPCGroupsBiMap,
} from "shared/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMount, useNPCGroupBase } from "../../hooks/use-npc-group-base";
import { TerrainBoundaries } from "../../utils/terrain";


interface PathNPCGroupGraphicProps {
  npcGroup: NPCGroup,
  pathData: pathData;
  user?: UserInfo; // User who threw the NPC for border color (optional for fleeing NPCs)
  checkForCollision: (npcGroup: NPCGroup, npcPosition?: THREE.Vector3, isLocalUser?: boolean) => boolean; // Collision checking for fleeing NPCs
  terrainBoundaries?: TerrainBoundaries; // Add terrain boundaries for wrapping
  allPaths?: Map<string, pathData>; // All active paths for NPC-to-NPC collision
  npcGroups: NPCGroupsBiMap; // NPC groups for collision with groups
  users?: Map<string, UserInfo>; // All users for getting group positions
  myUserId: string; // Current user ID
  setPaths?: (
    paths:
      | Map<string, pathData>
      | ((prev: Map<string, pathData>) => Map<string, pathData>)
  ) => void; // Function to update paths
}

const PathNPCGroupGraphic: React.FC<PathNPCGroupGraphicProps> = ({
  npcGroup,
  pathData,
  user,
  checkForCollision,
  npcGroups,
  users,
  myUserId,
  setPaths,
}) => {
  const { group, positionRef, textureLoaded, updatePositionWithTracking, textInfo } =
    useNPCGroupBase(npcGroup, user, pathData);


  // State for extended path data (client-side collision avoidance)
  const [extendedPathData, setExtendedPathData] = useState<pathData>(pathData);
  const [isPathExtended, setIsPathExtended] = useState(false);

  // State for returning behavior
  const [lastDirectionUpdate, setLastDirectionUpdate] = useState(0);

  // Set initial position
  useMount(() => {
    updatePositionWithTracking(
      new THREE.Vector3(npcGroup.position.x, npcGroup.position.y, 0),
      "pathPC-initial"
    );
    group.position.copy(positionRef.current);
  });

  // Calculate position for path NPCs
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

    return { position, progress };
  };

  

  // Check for collisions with IDLE NPCs and extend path if needed
  const checkAndExtendPath = (
    currentPathData: pathData,
    currentTime: number
  ) => {
    if (!npcGroups || isPathExtended) return currentPathData;

    const COLLISION_RADIUS = 2.0;
    const EXTENSION_DISTANCE = 2.5;

    // Calculate where the path would end
    const elapsedTime = (currentTime - currentPathData.timestamp) / 1000;
    const pathDurationSec = currentPathData.pathDuration / 1000;

    // Only check when we're near the end of the path
    if (elapsedTime < pathDurationSec * 0.9) {
      return currentPathData;
    }

    const finalDistance = currentPathData.velocity * pathDurationSec;
    const landingPosition = new THREE.Vector3(
      currentPathData.startPosition.x +
        currentPathData.direction.x * finalDistance,
      currentPathData.startPosition.y +
        currentPathData.direction.y * finalDistance,
      0
    );

    // Check for collisions with IDLE NPCs
    const idleNPCs = npcGroups?.values()?.filter(
      (otherNpcGroup) => otherNpcGroup.phase === NPCPhase.IDLE && otherNpcGroup.id !== npcGroup.id
    ) || [];

    let hasCollision = false;
    for (const idleNPC of idleNPCs) {
      const distance = landingPosition.distanceTo(
        new THREE.Vector3(
          idleNPC.position.x,
          idleNPC.position.y,
          0
        )
      );

      if (distance < COLLISION_RADIUS) {
        hasCollision = true;
        break;
      }
    }

    // If collision detected, extend the path
    if (hasCollision) {
      const newDistance = finalDistance + EXTENSION_DISTANCE;
      const extendedPathData: pathData = {
        ...currentPathData,
        pathDuration: (newDistance / currentPathData.velocity) * 1000,
      };

      console.log(`Client: Extending path for NPC ${npcGroup.id}`);
      setExtendedPathData(extendedPathData);
      setIsPathExtended(true);
      return extendedPathData;
    }

    return currentPathData;
  };

  // Function to handle returning to player
  const handleReturning = (currentPosition: THREE.Vector3, currentTime: number) => {
    if (!npcGroup.captorId || !users || !setPaths) return;

    const captorUser = users.get(npcGroup.captorId);
    if (!captorUser) return;

    const UPDATE_INTERVAL = 300; // Update direction every 300ms
    
    // Check if we should update direction
    if (currentTime - lastDirectionUpdate < UPDATE_INTERVAL) {
      return;
    }

    // Calculate direction to player
    const directionToPlayer = {
      x: captorUser.position.x - currentPosition.x,
      y: captorUser.position.y - currentPosition.y,
    };

    // Normalize direction
    const length = Math.sqrt(
      directionToPlayer.x * directionToPlayer.x +
      directionToPlayer.y * directionToPlayer.y
    );

    if (length > 0) {
      const normalizedDirection = {
        x: directionToPlayer.x / length,
        y: directionToPlayer.y / length,
      };

      // Create new returning path data
      const returningPathData: pathData = {
        ...pathData,
        startPosition: {
          x: currentPosition.x,
          y: currentPosition.y,
        },
        direction: normalizedDirection,
        timestamp: currentTime,
        pathPhase: PathPhase.RETURNING,
        velocity: 8, // Faster return speed
        pathDuration: 3000, // Longer duration for returning
      };

      setExtendedPathData(returningPathData);
      setLastDirectionUpdate(currentTime);

      // Update the paths state
      setPaths((prev: Map<string, pathData>) => {
        const newPaths = new Map(prev);
        newPaths.set(npcGroup.id, returningPathData);
        return newPaths;
      });
    }
  };

  // Handle position updates
  useFrame(() => {
    if (!group || !textureLoaded.current) return;

    // Safety check: don't calculate path position if NPC phase changed
    if (npcGroup.phase !== NPCPhase.PATH) return;

    const currentTime = Date.now();

    // Check for collisions and potentially extend path (only for non-returning NPCs)
    let currentPathData = extendedPathData;
    if (extendedPathData.pathPhase !== PathPhase.RETURNING) {
      currentPathData = checkAndExtendPath(extendedPathData, currentTime);
    }

    // Calculate current position based on time for path objects
    const { position: pathPosition, progress } = calculatePathPosition(currentPathData, currentTime);
    updatePositionWithTracking(pathPosition, "pathPC-update");

    group.position.copy(positionRef.current);

    // Check if we should start returning (only for thrown NPCs with captorId)
    if (
      npcGroup.captorId && 
      pathData.pathPhase === PathPhase.THROWN && 
      extendedPathData.pathPhase !== PathPhase.RETURNING &&
      progress >= 1
    ) {
      console.log(`NPC ${npcGroup.id} starting to return to player (progress: ${progress})`);
      handleReturning(pathPosition, currentTime);
    }

    // Handle returning behavior
    if (extendedPathData.pathPhase === PathPhase.RETURNING && npcGroup.captorId) {
      
      // Check if we've reached the player
      const captorUser = users?.get(npcGroup.captorId);
      if (captorUser) {
        
        // Trigger capture collision
        if (checkForCollision) {
          checkForCollision(npcGroup, pathPosition, user?.id === myUserId);
        }
      }

      handleReturning(pathPosition, currentTime);

    }

    // For fleeing NPCs (no captorId), check for collision
    if (!npcGroup.captorId && checkForCollision) {
      checkForCollision(npcGroup, pathPosition);
    }

  });


  // Reset extended path data when pathData changes (new path)
  useEffect(() => {
    setExtendedPathData(pathData);
    setIsPathExtended(false);
    setLastDirectionUpdate(0);
  }, [pathData.id, pathData.timestamp, pathData]);


  return (
    <>
      <primitive object={group}>
        {/* Text component for NPC count */}
        {textInfo && (
          <Text
            position={textInfo.position}
            fontSize={textInfo.fontSize}
            color={textInfo.color}
            anchorX="center"
            anchorY="middle"
            font="https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxM.woff"
            outlineWidth={0.1}
            outlineColor="white"
          >
            {textInfo.count}
          </Text>
        )}
      </primitive>
    </>
  );
};

export default React.memo(PathNPCGroupGraphic);
