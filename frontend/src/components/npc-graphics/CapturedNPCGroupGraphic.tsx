import React, { useMemo, useEffect, useRef, useCallback } from "react";
import { Text } from "@react-three/drei";
import {
  NPCGroup,
  pathData,
  UserInfo,
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
import { RENDER_ORDERS, Z_DEPTHS } from "shared/z-depths";
// Constants for positioning

// Helper functions for position clamping
const clampPositionToMaxDistance = (
  position: THREE.Vector3,
  userPosition: THREE.Vector3,
  maxDistance: number
): THREE.Vector3 => {
  const userPos2D = new THREE.Vector2(userPosition.x, userPosition.y);
  const pos2D = new THREE.Vector2(position.x, position.y);
  const distance = userPos2D.distanceTo(pos2D);
  
  if (distance <= maxDistance) {
    return position.clone();
  }
  
  const direction = pos2D.clone().sub(userPos2D).normalize();
  const clampedPos2D = userPos2D.clone().add(direction.multiplyScalar(maxDistance));
  return new THREE.Vector3(clampedPos2D.x, clampedPos2D.y, position.z);
};

const getClampedInterpolatedPosition = (
  interpolatedPosition: THREE.Vector3,
  userPosition: THREE.Vector3,
  maxDistance: number
): THREE.Vector3 => {
  return clampPositionToMaxDistance(interpolatedPosition, userPosition, maxDistance);
};



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
  userPositionRef: React.MutableRefObject<THREE.Vector3>; // Always required
  userRenderedRotationRef?: React.MutableRefObject<number>; // Not needed for lerped approach but kept for compatibility
}

const CapturedNPCGroupGraphic: React.FC<CapturedNPCGroupGraphicProps> = ({
  group,
  user,
  npcGroups,
  allPaths,
  animalWidth,
  isLocalUser = false, // Default to false for non-local users
  users: _users, // Not used in this component anymore (handled by CapturedNPCGroupCollisionManager)
  throwChargeCount,
  userPositionRef,
  userRenderedRotationRef: _userRenderedRotationRef,
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
  
  // Lerped direction for smooth rotation - starts with current user direction
  const lerpedDirection = useRef(new THREE.Vector2(user.direction.x, user.direction.y));
  
  // Track last known user position and direction to detect changes
  const lastUserPosition = useRef(new THREE.Vector2(user.position.x, user.position.y));
  const lastUserDirection = useRef(new THREE.Vector2(user.direction.x, user.direction.y));
  const cachedTargetPosition = useRef<THREE.Vector3 | null>(null);
  
  // Track velocity changes over multiple frames for smart positioning
  const positionHistory = useRef<THREE.Vector2[]>([]);
  const directionHistory = useRef<THREE.Vector2[]>([]);
  const maxHistoryFrames = 20; // Maximum frames to track
  const isUsingDirectClampedPositioning = useRef(false);
  
  
  // Single position tracking system - no conflicting smoothing layers
  
  // Position calculation using position ref when available for consistency
  const calculateTargetPosition = useCallback((): THREE.Vector3 => {
    if (!animalWidth) return new THREE.Vector3(0, 0, -10);
    
    // Use position ref for local users, fallback to user.position for remote users
    const effectiveUserPosition = isLocalUser ? userPositionRef.current : user.position;
    const currentUserPosition = new THREE.Vector2(effectiveUserPosition.x, effectiveUserPosition.y);
    const currentUserDirection = lerpedDirection.current.clone();
    
    const positionChanged = !lastUserPosition.current.equals(currentUserPosition);
    const directionChanged = !lastUserDirection.current.equals(currentUserDirection);
    
    // Only recalculate when user position/direction changes or no target exists
    if (positionChanged || directionChanged || !cachedTargetPosition.current) {
      // Create a user-like object with the effective position and lerped direction for calculation
      const userForCalculation = {
        ...user,
        position: { x: effectiveUserPosition.x, y: effectiveUserPosition.y, z: effectiveUserPosition.z },
        direction: { x: currentUserDirection.x, y: currentUserDirection.y }
      };
      cachedTargetPosition.current = calculateNPCGroupPosition(userForCalculation, animalWidth, scaleFactor);
      lastUserPosition.current.copy(currentUserPosition);
      lastUserDirection.current.copy(currentUserDirection);
    }
    
    return cachedTargetPosition.current || new THREE.Vector3(0, 0, -10);
  }, [animalWidth, user, scaleFactor, userPositionRef, isLocalUser]);




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
    const animationCallback = (_state: unknown, delta: number) => {
      if (!threeGroup || !textureLoaded.current || !user || group.fileNames.length === 0 || !animalWidth) return;

      // Get current user position
      const effectiveUserPosition = isLocalUser ? userPositionRef.current : user.position;
      const currentUserPosition = new THREE.Vector2(effectiveUserPosition.x, effectiveUserPosition.y);
      
      // Lerp the user direction for smooth rotation
      const targetDirection = new THREE.Vector2(user.direction.x, user.direction.y);
      const directionLerpSpeed = 0.15; // Adjust this for rotation smoothness
      lerpedDirection.current.lerp(targetDirection, directionLerpSpeed);

      // Update position and direction history using lerped direction
      positionHistory.current.push(currentUserPosition.clone());
      directionHistory.current.push(targetDirection.clone());
      
      // Keep only the last N frames
      if (positionHistory.current.length > maxHistoryFrames) {
        positionHistory.current.shift();
        directionHistory.current.shift();
      }
            
      // Calculate target position with offset from user (now cached and only recalculated when needed)
      const targetPosition = calculateTargetPosition();

      // No need for separate tracking - using history arrays now

      // Use standard interpolation first
      const localParams = { lerpFactor: 0.08, moveSpeed: 0.4, minDistance: 0.1, useConstantSpeed: false };
      const remoteParams = { lerpFactor: 0.04, moveSpeed: 0.3, minDistance: 0.01, useConstantSpeed: true };
      
      const interpolationParams = isLocalUser
        ? { ...localParams, delta }
        : { ...remoteParams, delta };
      
      // Apply distance clamping to interpolated position

      const maxDistance = 15.0; // Maximum allowed distance from user
      
      let newPosition: THREE.Vector3;

      // check if isUsingDirectClampedPosition should be set to false
      if (isUsingDirectClampedPositioning.current) {
        const positionStillChanging = positionHistory.current.length >= 2 && 
        currentUserPosition.distanceTo(positionHistory.current[positionHistory.current.length - 2]) > 0.001;
        const directionNotChanging = directionHistory.current.length >= 2 &&
        targetDirection.distanceTo(directionHistory.current[directionHistory.current.length - 2]) < .01;
      
        if (!positionStillChanging || !directionNotChanging) {
          // Either position stopped changing or direction changed - go back to interpolation
          isUsingDirectClampedPositioning.current = false;
        }
      }


      if (isUsingDirectClampedPositioning.current) {
        const directionToNPC = targetPosition.clone().sub(userPositionRef.current).normalize();
        const clampedPos2D = userPositionRef.current.clone().add(directionToNPC.multiplyScalar(maxDistance));
        const clampedPosition = new THREE.Vector3(clampedPos2D.x, clampedPos2D.y, 0);
        
        // Check if lerped position is close to target position
        
        newPosition = clampedPosition;
        console.log('using clamped')
      }

      else {
        const interpolatedPosition = smoothMove(
          positionRef.current.clone(),
          targetPosition,
          interpolationParams
        );
        const userPos2D = new THREE.Vector2(effectiveUserPosition.x, effectiveUserPosition.y);
        const interpolatedPos2D = new THREE.Vector2(interpolatedPosition.x, interpolatedPosition.y);
        const distanceFromUser = userPos2D.distanceTo(interpolatedPos2D);

        if (distanceFromUser > maxDistance) {
          // Distance got clamped
          const userPos3D = new THREE.Vector3(effectiveUserPosition.x, effectiveUserPosition.y, effectiveUserPosition.z);
          const clampedPosition = getClampedInterpolatedPosition(interpolatedPosition, userPos3D, maxDistance);
          const clampedTargetPosition = clampPositionToMaxDistance(targetPosition, userPos3D, maxDistance);
          
          const distanceToTarget = clampedPosition.distanceTo(clampedTargetPosition);
          const isCloseToTarget = distanceToTarget < 5; // Close enough threshold
          
          // Start using direct positioning if lerped position is close to target and it's local user
          if (isCloseToTarget) {
            isUsingDirectClampedPositioning.current = true;
          }
          
          newPosition = clampedPosition;
        } else {
          // No clamping needed - use interpolated position
          newPosition = interpolatedPosition;
        }
      }

      
      updatePositionWithTracking(newPosition, "NPCGroup");
      
      // Force immediate mesh position update to prevent jumpiness
      threeGroup.position.copy(newPosition);
      threeGroup.updateMatrixWorld(true);


      // Make a subtle oscillation to indicate this is a group
      const time = Date.now() / 1000;
      const oscillation = Math.sin(time * 2) * 0.05; // Reduced oscillation
      threeGroup.rotation.z = oscillation;

      // Keep scale constant - no more pulsing
      if (mesh.current) {
        // Ensure the mesh scale remains consistent with the scaleFactor
        mesh.current.scale.set(scaleFactor, scaleFactor, 1);
      }
      
    };

    animationManager.registerAnimationCallback(callbackId, animationCallback);

    return () => {
      animationManager.unregisterAnimationCallback(callbackId);
    };
  }, [animationManager, calculateTargetPosition, updatePositionWithTracking, isLocalUser, threeGroup, textureLoaded, user, group.fileNames.length, group.captorId, animalWidth, positionRef, mesh, scaleFactor, allPaths, npcGroups, userPositionRef]);

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
            position={[textInfo.position[0], textInfo.position[1], isLocalUser ? -0.01 : Z_DEPTHS.REMOTE_CAPTURED_NPC_GROUP]}
            fontSize={textInfo.fontSize}
            color={textInfo.color}
            anchorX="center"
            anchorY="middle"
            font="https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxM.woff"
            characters="0123456789"
            outlineWidth={0.1}
            outlineColor="white"
            renderOrder={isLocalUser ? RENDER_ORDERS.LOCAL_CAPTURED_NPC_GROUP : RENDER_ORDERS.REMOTE_CAPTURED_NPC_GROUP}
          >
            {textInfo.count}
          </Text>
        )} 
        {throwChargeCountTextInfo && (
          <Text
            position={[throwChargeCountTextInfo.position[0], throwChargeCountTextInfo.position[1], isLocalUser ? -0.01 : Z_DEPTHS.REMOTE_CAPTURED_NPC_GROUP]}
            fontSize={throwChargeCountTextInfo.fontSize}
            color={throwChargeCountTextInfo.color}
            anchorX="center"
            anchorY="middle"
            font="https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxM.woff"
            characters="0123456789"
            outlineWidth={0.1}
            outlineColor={getAnimalColor(user)}
            renderOrder={isLocalUser ? RENDER_ORDERS.LOCAL_CAPTURED_NPC_GROUP : RENDER_ORDERS.REMOTE_CAPTURED_NPC_GROUP}
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

