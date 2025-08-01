import React, { useEffect, useRef, useCallback } from "react";
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
  
  // Track in-flight collision processing to prevent race conditions
  const processingCollisionsRef = useRef<Set<string>>(new Set());
  
  // Track pending state updates for cleanup
  const pendingUpdatesRef = useRef<Set<() => void>>(new Set());

  // Wrapped state setters that track completion
  const setPathsWithTracking = useCallback((updater: any, onComplete?: () => void) => {
    const cleanup = () => {
      if (onComplete) onComplete();
      pendingUpdatesRef.current.delete(cleanup);
    };
    pendingUpdatesRef.current.add(cleanup);
    
    setPaths((prev: Map<string, pathData>) => {
      const result = typeof updater === 'function' ? updater(prev) : updater;
      // Schedule cleanup after state update
      setTimeout(cleanup, 0);
      return result;
    });
  }, [setPaths]);

  const setNpcGroupsWithTracking = useCallback((updater: any, onComplete?: () => void) => {
    const cleanup = () => {
      if (onComplete) onComplete();
      pendingUpdatesRef.current.delete(cleanup);
    };
    pendingUpdatesRef.current.add(cleanup);
    
    setNpcGroups((prev: NPCGroupsBiMap) => {
      const result = typeof updater === 'function' ? updater(prev) : updater;
      // Schedule cleanup after state update
      setTimeout(cleanup, 0);
      return result;
    });
  }, [setNpcGroups]);

  // Wrapper functions to use original setPaths/setNpcGroups interface with tracking
  const wrappedSetPaths = useCallback((updater: any) => {
    setPathsWithTracking(updater);
  }, [setPathsWithTracking]);

  const wrappedSetNpcGroups = useCallback((updater: any) => {
    setNpcGroupsWithTracking(updater);
  }, [setNpcGroupsWithTracking]);

  // Stabilized collision callback to prevent race conditions
  const collisionCallback = useCallback((_state: unknown, _delta: number) => {
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
            
            // Skip if this collision was recently processed or is currently being processed
            if (recentCollisionsRef.current.has(collisionKey) || processingCollisionsRef.current.has(collisionKey)) {
              return;
            }
            
            // Mark collision as being processed to prevent race conditions
            processingCollisionsRef.current.add(collisionKey);
            
            // Check for collision and if it occurs, mark as recent
            const collisionOccurred = checkForPathNPCCollisionForUser(
              pathNPCGroup, 
              pathData, 
              capturedGroup, 
              userToCheck, 
              animalWidth, 
              wrappedSetPaths, 
              wrappedSetNpcGroups
            );
            
            if (collisionOccurred) {
              // Mark this collision as recent to prevent duplicate processing
              recentCollisionsRef.current.add(collisionKey);
              setTimeout(() => {
                recentCollisionsRef.current.delete(collisionKey);
              }, 300); // 300ms debounce period
            }
            
            // Remove from processing set after a brief delay to ensure state updates complete
            setTimeout(() => {
              processingCollisionsRef.current.delete(collisionKey);
            }, 100);
          }
        });
      });
    });
  }, [myUser, users, npcGroups, allPaths, animalDimensions, wrappedSetPaths, wrappedSetNpcGroups]);

  // Register captured NPC group collision detection with AnimationManager
  useEffect(() => {
    const callbackId = collisionAnimationId.current;

    animationManager.registerAnimationCallback(callbackId, collisionCallback);

    return () => {
      animationManager.unregisterAnimationCallback(callbackId);
      
      // Clean up any pending state updates
      pendingUpdatesRef.current.forEach(cleanup => cleanup());
      pendingUpdatesRef.current.clear();
      
      // Clear processing and recent collision sets
      processingCollisionsRef.current.clear();
      recentCollisionsRef.current.clear();
    };
  }, [animationManager, collisionCallback]);

  // This component doesn't render anything, it just handles collision detection
  return null;
};

export default CapturedNPCGroupCollisionManager;