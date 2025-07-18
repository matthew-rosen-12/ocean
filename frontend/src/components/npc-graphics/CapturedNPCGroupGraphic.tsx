import React, { useMemo } from "react";
import { Text } from "@react-three/drei";
import {
  NPCGroup,
  pathData,
  UserInfo,
  PathPhase,
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
import { calculatePathPosition, handleNPCGroupReflectionForUser } from "../../utils/collision-utils";
// Constants for positioning



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
  myUserId: string; // Current user ID for render order logic
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
  users: _users, // Not used in this component anymore (handled by BotCollisionManager)
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
  } = useNPCGroupBase(group, user, undefined, throwChargeCount, isLocalUser);


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
    return memoizedTargetPosition || new THREE.Vector3(0, 0, -10);
  };




  const checkForPathNPCCollision = (npcGroup: NPCGroup, pathData: pathData) => {
    if ((pathData.pathPhase !== PathPhase.THROWN && pathData.pathPhase !== PathPhase.RETURNING) || !animalWidth) return false;

    // Check npc group collision with the path data, using npc group position and scale and path data calculated position
    const currentPathPosition = calculatePathPosition(pathData, Date.now());
    const npcGroupPosition = calculateNPCGroupPosition(
      user,
      animalWidth,
      scaleFactor
    );

    const npcGroupRadius = scaleFactor;
    const distance = npcGroupPosition ? npcGroupPosition.distanceTo(currentPathPosition) : Infinity;
    if (distance < npcGroupRadius && group.fileNames.length > 0) {
      handleNPCGroupReflectionForUser(npcGroup, pathData, currentPathPosition, group, user, animalWidth, setPaths, setNpcGroups);
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
    // Check for collision for local user only (bot collision handled in Scene.tsx)
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

