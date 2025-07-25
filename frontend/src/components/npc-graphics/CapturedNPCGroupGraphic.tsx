import React, { useMemo, useEffect, useRef, useCallback } from "react";
import { Text } from "@react-three/drei";
import {
  NPCGroup,
  pathData,
  UserInfo,
  PathPhase,
  NPCGroupsBiMap,
} from "shared/types";
import * as THREE from "three";
import { useAnimationManagerContext } from "../../contexts/AnimationManagerContext";
import { smoothMove } from "../../utils/movement";
import { useNPCGroupBase, useMount } from "../../hooks/use-npc-group-base";
import { TerrainBoundaries } from "../../utils/terrain";
import {
  calculateNPCGroupScale,
  calculateNPCGroupPosition,
} from "../../utils/npc-group-utils";
import { getAnimalColor } from "../../utils/animal-colors";
import { calculatePathPosition, handleNPCGroupReflectionForUser } from "../../utils/path-collision-utils";
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
  users: _users, // Not used in this component anymore (handled by CapturedNPCGroupCollisionManager)
  throwChargeCount,
}) => {
  
  // Calculate logarithmic scale factor based on number of NPCs
  const scaleFactor = useMemo(() => {
    return calculateNPCGroupScale(group.fileNames.length);
  }, [group.fileNames.length]);

  const animationManager = useAnimationManagerContext();
  const animationId = useRef<string>(`captured-${group.id}`);

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
  
  // Track last known user position and direction to detect changes
  const lastUserPosition = useRef(new THREE.Vector2(user.position.x, user.position.y));
  const lastUserDirection = useRef(new THREE.Vector2(user.direction.x, user.direction.y));
  const cachedTargetPosition = useRef<THREE.Vector3 | null>(null);
  
  const MAX_DISTANCE_FROM_USER = 15.0; // Maximum allowed distance from user
  
  // For local users, maintain smoothed user position
  const smoothedUserPosition = useRef(new THREE.Vector2(user.position.x, user.position.y));
  const smoothedUserDirection = useRef(new THREE.Vector2(user.direction.x, user.direction.y));
  
  // For remote users, maintain smoothed position to match AnimalGraphic interpolation
  const remoteSmoothedPosition = useRef(new THREE.Vector2(user.position.x, user.position.y));
  
  // Position calculation is now handled uniformly by calculateTargetPosition with caching

  // Export position and scale calculation functions for collision detection
  const calculateTargetPosition = useCallback((): THREE.Vector3 => {
    if (!animalWidth) return new THREE.Vector3(0, 0, -10);
    
    // Check if position or direction has changed
    const currentUserPosition = new THREE.Vector2(user.position.x, user.position.y);
    const currentUserDirection = new THREE.Vector2(user.direction.x, user.direction.y);
    
    const positionChanged = !lastUserPosition.current.equals(currentUserPosition);
    const directionChanged = !lastUserDirection.current.equals(currentUserDirection);
    
    if (isLocalUser) {
      // For local users, smooth the user position input first
      const smoothingFactor = 0.2; // Higher = more smoothing
      
      smoothedUserPosition.current.x = smoothedUserPosition.current.x * smoothingFactor + user.position.x * (1 - smoothingFactor);
      smoothedUserPosition.current.y = smoothedUserPosition.current.y * smoothingFactor + user.position.y * (1 - smoothingFactor);
      
      smoothedUserDirection.current.x = smoothedUserDirection.current.x * smoothingFactor + user.direction.x * (1 - smoothingFactor);
      smoothedUserDirection.current.y = smoothedUserDirection.current.y * smoothingFactor + user.direction.y * (1 - smoothingFactor);
      
      // Update when user position/direction changes or no target exists
      if (positionChanged || directionChanged || !cachedTargetPosition.current) {
        // Use smoothed position for target calculation
        const smoothedUser = {
          ...user,
          position: { x: smoothedUserPosition.current.x, y: smoothedUserPosition.current.y },
          direction: { x: smoothedUserDirection.current.x, y: smoothedUserDirection.current.y }
        };
        
        cachedTargetPosition.current = calculateNPCGroupPosition(smoothedUser, animalWidth, scaleFactor);
        lastUserPosition.current.copy(currentUserPosition);
        lastUserDirection.current.copy(currentUserDirection);
      }
    } else {
      // For remote users, apply same smoothing as AnimalGraphic (lerpFactor: 0.1)
      const remoteSmoothingFactor = 0.9; // Equivalent to lerpFactor 0.1
      
      remoteSmoothedPosition.current.x = remoteSmoothedPosition.current.x * remoteSmoothingFactor + user.position.x * (1 - remoteSmoothingFactor);
      remoteSmoothedPosition.current.y = remoteSmoothedPosition.current.y * remoteSmoothingFactor + user.position.y * (1 - remoteSmoothingFactor);
      
      // Update when user position/direction changes
      if (positionChanged || directionChanged || !cachedTargetPosition.current) {
        cachedTargetPosition.current = calculateNPCGroupPosition(user, animalWidth, scaleFactor);
        lastUserPosition.current.copy(currentUserPosition);
        lastUserDirection.current.copy(currentUserDirection);
      }
    }
    
    return cachedTargetPosition.current || new THREE.Vector3(0, 0, -10);
  }, [animalWidth, user, scaleFactor, isLocalUser]);




  const checkForPathNPCCollision = useCallback((npcGroup: NPCGroup, pathData: pathData) => {
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
  }, [animalWidth, user, scaleFactor, group, setPaths, setNpcGroups]);




  // Set initial position
  useMount(() => {
    // Start with initial position behind user
    const initialPosition = calculateTargetPosition();

    updatePositionWithTracking(initialPosition, "NPCGroup-initial");
    threeGroup.position.copy(positionRef.current);

    // Initialize previousPosition for smooth interpolation
    previousPosition.copy(positionRef.current);
  });

  // Register animation callback with the AnimationManager
  useEffect(() => {
    const callbackId = animationId.current;
    const animationCallback = (_state: unknown, _delta: number) => {
      if (!threeGroup || !textureLoaded.current || !user || group.fileNames.length === 0 || !animalWidth) return;

      // Calculate target position with offset from user (now cached and only recalculated when needed)
      const targetPosition = calculateTargetPosition();

      // Check for collisions with path NPCs if we have the required props

      // Both local and non-local users use smoothMove for nice interpolated following:
      // - Local: interpolates towards target calculated from immediate user position
      // - Non-local: interpolates towards target calculated from discrete socket user position
      // For non-local users, we need SLOWER interpolation so NPC group lags behind
      // the already-interpolated animal position
      // Always interpolate toward target - don't stop when we get close
      // The smoothMove function has its own minDistance check to prevent unnecessary updates
      const interpolationParams = isLocalUser
        ? {
            // Local users: use pure lerp without constant speed switching to avoid jitter
            lerpFactor: .15,
            moveSpeed: 0.8,
            minDistance: 0.1,
            useConstantSpeed: false,
          }
        : {
            lerpFactor: 0.07,
            moveSpeed: 0.5,
            minDistance: 0.01,
            useConstantSpeed: true,
          };

      // Calculate new position with smooth movement
      const newPosition = smoothMove(
        positionRef.current.clone(),
        targetPosition,
        interpolationParams
      );
      
      // Apply distance cap - if too far from user, clamp to max distance
      // For local users: use actual current position (not smoothed, since smoothed lags behind)
      // For remote users: use smoothed position to match visual rendered position
      const userPosition2D = isLocalUser 
        ? new THREE.Vector2(user.position.x, user.position.y)
        : new THREE.Vector2(remoteSmoothedPosition.current.x, remoteSmoothedPosition.current.y);
      
      const npcPosition2D = new THREE.Vector2(newPosition.x, newPosition.y);
      const distanceFromUser = userPosition2D.distanceTo(npcPosition2D);
      
      if (distanceFromUser > MAX_DISTANCE_FROM_USER) {
        // Clamp position to max distance from user
        const directionToNPC = npcPosition2D.clone().sub(userPosition2D).normalize();
        const clampedPosition = userPosition2D.clone().add(directionToNPC.multiplyScalar(MAX_DISTANCE_FROM_USER));
        newPosition.x = clampedPosition.x;
        newPosition.y = clampedPosition.y;
      }
      
      updatePositionWithTracking(newPosition, "NPCGroup");
      threeGroup.position.copy(positionRef.current);


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
    };

    animationManager.registerAnimationCallback(callbackId, animationCallback);

    return () => {
      animationManager.unregisterAnimationCallback(callbackId);
    };
  }, [animationManager, calculateTargetPosition, checkForPathNPCCollision, updatePositionWithTracking, isLocalUser, threeGroup, textureLoaded, user, group.fileNames.length, group.captorId, animalWidth, positionRef, mesh, scaleFactor, allPaths, npcGroups]);

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
  // Quick primitive checks first (fastest)
  if (prevProps.group.captorId !== nextProps.group.captorId) return false;
  if (prevProps.group.fileNames.length !== nextProps.group.fileNames.length) return false;
  if (prevProps.user.id !== nextProps.user.id) return false;
  if (prevProps.animalWidth !== nextProps.animalWidth) return false;
  if (prevProps.throwChargeCount !== nextProps.throwChargeCount) return false;
  
  // User position/direction checks (common changes)
  if (prevProps.user.position.x !== nextProps.user.position.x) return false;
  if (prevProps.user.position.y !== nextProps.user.position.y) return false;
  if (prevProps.user.direction.x !== nextProps.user.direction.x) return false;
  if (prevProps.user.direction.y !== nextProps.user.direction.y) return false;

  // Path comparison (expensive but necessary) - check size first
  if (prevProps.allPaths.size !== nextProps.allPaths.size) return false;
  
  // Only do deep path comparison if sizes match and we haven't failed other checks
  const prevPaths = Array.from(prevProps.allPaths.entries());
  for (let i = 0; i < prevPaths.length; i++) {
    const [npcId, pathData] = prevPaths[i];
    const nextPathData = nextProps.allPaths.get(npcId);
    if (!nextPathData ||
        pathData.id !== nextPathData.id ||
        pathData.timestamp !== nextPathData.timestamp ||
        pathData.pathPhase !== nextPathData.pathPhase) {
      return false;
    }
  }

  // NPC fileNames comparison (most expensive) - do last
  if (prevProps.group.fileNames.length !== nextProps.group.fileNames.length) return false;
  for (let i = 0; i < prevProps.group.fileNames.length; i++) {
    if (prevProps.group.fileNames[i] !== nextProps.group.fileNames[i]) return false;
  }

  return true;
});

