import React, { useEffect, useRef } from "react";
import { UserInfo, NPCGroupsBiMap, pathData, PathPhase } from "shared/types";
import { useAnimationManagerContext } from "../contexts/AnimationManagerContext";
import { getAssignedBots, checkForPathNPCCollisionForUser } from "../utils/path-collision-utils";

interface CapturedNPCGroupCollisionManagerProps {
  myUser: UserInfo | undefined;
  users: Map<string, UserInfo>;
  npcGroups: NPCGroupsBiMap;
  allPaths: Map<string, pathData>;
  setPaths: (
    paths: Map<string, pathData> | ((prev: Map<string, pathData>) => Map<string, pathData>)
  ) => void;
  setNpcGroups: (
    npcGroups: NPCGroupsBiMap | ((prev: NPCGroupsBiMap) => NPCGroupsBiMap)
  ) => void;
  animalDimensions: { [animal: string]: { width: number; height: number } };
}

// This component needs to be inside the Canvas to use AnimationManager
const CapturedNPCGroupCollisionManager: React.FC<CapturedNPCGroupCollisionManagerProps> = ({
  myUser,
  users,
  npcGroups,
  allPaths,
  setPaths,
  setNpcGroups,
  animalDimensions,
}) => {
  const animationManager = useAnimationManagerContext();
  const collisionAnimationId = useRef<string>(`captured-group-collision-${myUser?.id || 'unknown'}`);
  
  // Track recent collisions to prevent duplicate processing
  const recentCollisionsRef = useRef<Set<string>>(new Set());

  // Register captured NPC group collision detection with AnimationManager
  useEffect(() => {
    const callbackId = collisionAnimationId.current;
    const collisionCallback = (_state: unknown, _delta: number) => {
      if (!myUser) return;

      // Get bots assigned to this local user for collision detection
      const assignedBots = getAssignedBots(myUser.id, users);
      const usersToCheck = [myUser, ...assignedBots]; // Check both local user and assigned bots
      
      
      usersToCheck.forEach(userToCheck => {
        const animalWidth = animalDimensions[userToCheck.animal]?.width;
        if (!animalWidth) return;

        // Find captured NPC groups for this user (or bot)
        const capturedGroups = Array.from(npcGroups.values()).filter(
          npcGroup => npcGroup.captorId === userToCheck.id && npcGroup.fileNames.length > 0
        );
        
        capturedGroups.forEach(capturedGroup => {
          Array.from(allPaths.entries()).forEach(([_npcId, pathData]) => {
            // Get the NPC group from the groups map using the ID
            const pathNPCGroup = npcGroups.getByNpcGroupId(pathData.npcGroupId);
            if (
              (pathData.pathPhase === PathPhase.THROWN || pathData.pathPhase === PathPhase.RETURNING) &&
              pathNPCGroup &&
              pathNPCGroup.captorId !== capturedGroup.captorId
            ) {
              // Create unique collision key to prevent duplicate processing
              const collisionKey = `${pathNPCGroup.id}-${capturedGroup.id}`;
              
              // Skip if this collision was recently processed
              if (recentCollisionsRef.current.has(collisionKey)) {
                return;
              }
              
              // Check for collision and if it occurs, mark as recent
              const collisionOccurred = checkForPathNPCCollisionForUser(pathNPCGroup, pathData, capturedGroup, userToCheck, animalWidth, setPaths, setNpcGroups);
              
              if (collisionOccurred) {
                // Mark this collision as recent to prevent duplicate processing
                recentCollisionsRef.current.add(collisionKey);
                setTimeout(() => {
                  recentCollisionsRef.current.delete(collisionKey);
                }, 300); // 300ms debounce period
              }
            }
          });
        });
      });
    };

    animationManager.registerAnimationCallback(callbackId, collisionCallback);

    return () => {
      animationManager.unregisterAnimationCallback(callbackId);
    };
  }, [animationManager, myUser, users, npcGroups, allPaths, setPaths, setNpcGroups, animalDimensions]);

  // This component doesn't render anything, it just handles collision detection
  return null;
};

export default CapturedNPCGroupCollisionManager;