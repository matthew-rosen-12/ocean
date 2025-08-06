import React, { useEffect, useRef, useCallback } from "react";
import { UserInfo, NPCGroupsBiMap, pathData, PathPhase } from "shared/types";
import { useAnimationManagerContext } from "../contexts/AnimationManagerContext";
import { getAssignedBots, checkForPathNPCCollisionForUser } from "../utils/path-collision-utils";

// Module-level collision tracking that persists across component re-renders
const globalRecentCollisions = new Set<string>();
const globalProcessingCollisions = new Set<string>();

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
  
  // Track recent collisions to prevent duplicate processing (shared across all users)
  const recentCollisionsRef = useRef<Set<string>>(new Set());
  
  // Track in-flight collision processing to prevent race conditions (shared across all users)
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
            // Create collision key using NPC group IDs - these should be stable during collision sequence
            const collisionKey = `${pathNPCGroup.id}-${capturedGroup.id}`;
            
            // Debug: Log collision tracking state
            const isRecent = globalRecentCollisions.has(collisionKey);
            const isProcessing = globalProcessingCollisions.has(collisionKey);
            
            // Skip if this collision was recently processed or is currently being processed
            if (isRecent || isProcessing) {
              return;
            }
            
            // Mark collision as being processed to prevent race conditions
            globalProcessingCollisions.add(collisionKey);
            
            // Check for collision and if it occurs, mark as recent
            const collisionOccurred = checkForPathNPCCollisionForUser(
              pathNPCGroup, 
              pathData, 
              capturedGroup, 
              userToCheck, 
              animalWidth, 
              wrappedSetPaths, 
              wrappedSetNpcGroups,
              collisionKey
            );
            
            if (collisionOccurred) {
              // Log ALL successful collisions to detect duplicates + WHO is processing it
              
              // Mark this collision as recent to prevent duplicate processing
              globalRecentCollisions.add(collisionKey);
              setTimeout(() => {
                globalRecentCollisions.delete(collisionKey);
              }, 500); // Standard debounce period
            }
            
            // Remove from processing set after state updates complete (longer delay for emissions)
            setTimeout(() => {
              globalProcessingCollisions.delete(collisionKey);
            }, collisionOccurred ? 400 : 100); // Longer delay if collision occurred to prevent duplicate emissions
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