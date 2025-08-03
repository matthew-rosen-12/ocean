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
  userPositionRef?: React.MutableRefObject<THREE.Vector3>; // Add position ref for consistency
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
  
  // Track velocity changes over multiple frames for smart positioning
  const positionHistory = useRef<THREE.Vector2[]>([]);
  const directionHistory = useRef<THREE.Vector2[]>([]);
  const maxHistoryFrames = 8; // Maximum frames to track
  const consistentMovementFrames = useRef(0);
  const lastInterpolationTime = useRef(Date.now());
  const isUsingDirectClampedPositioning = useRef(false);
  const clampedDistance = useRef<number | null>(null);
  
  
  // Single position tracking system - no conflicting smoothing layers
  
  // Position calculation using position ref when available for consistency
  const calculateTargetPosition = useCallback((): THREE.Vector3 => {
    if (!animalWidth) return new THREE.Vector3(0, 0, -10);
    
    // Use position ref for local users, fallback to user.position for remote users
    const effectiveUserPosition = userPositionRef ? userPositionRef.current : user.position;
    const currentUserPosition = new THREE.Vector2(effectiveUserPosition.x, effectiveUserPosition.y);
    const currentUserDirection = new THREE.Vector2(user.direction.x, user.direction.y);
    
    const positionChanged = !lastUserPosition.current.equals(currentUserPosition);
    const directionChanged = !lastUserDirection.current.equals(currentUserDirection);
    
    // Only recalculate when user position/direction changes or no target exists
    if (positionChanged || directionChanged || !cachedTargetPosition.current) {
      // Create a user-like object with the effective position for calculation
      const userForCalculation = {
        ...user,
        position: { x: effectiveUserPosition.x, y: effectiveUserPosition.y, z: effectiveUserPosition.z }
      };
      cachedTargetPosition.current = calculateNPCGroupPosition(userForCalculation, animalWidth, scaleFactor);
      lastUserPosition.current.copy(currentUserPosition);
      lastUserDirection.current.copy(currentUserDirection);
    }
    
    return cachedTargetPosition.current || new THREE.Vector3(0, 0, -10);
  }, [animalWidth, user, scaleFactor, userPositionRef]);




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

      // Get current user position and direction
      const effectiveUserPosition = userPositionRef ? userPositionRef.current : user.position;
      const currentUserPosition = new THREE.Vector2(effectiveUserPosition.x, effectiveUserPosition.y);
      const currentUserDirection = new THREE.Vector2(user.direction.x, user.direction.y);

      // Update position and direction history
      positionHistory.current.push(currentUserPosition.clone());
      directionHistory.current.push(currentUserDirection.clone());
      
      // Keep only the last N frames
      if (positionHistory.current.length > maxHistoryFrames) {
        positionHistory.current.shift();
        directionHistory.current.shift();
      }
      
      // Adaptively choose how many frames back to compare based on frame timing
      const frameTimeMs = delta * 1000;
      let framesToLookBack: number;
      if (frameTimeMs > 100) {
        framesToLookBack = 2; // Very slow frames - compare with just 2 frames ago
      } else if (frameTimeMs > 33) {
        framesToLookBack = 3; // Slow frames - compare with 3 frames ago
      } else {
        framesToLookBack = 5; // Normal frames - compare with 5 frames ago
      }
      
      // Only do velocity change detection for LOCAL users
      let isConsistentMovement = false;
      if (isLocalUser && positionHistory.current.length >= framesToLookBack + 1) {
        const oldPosition = positionHistory.current[positionHistory.current.length - 1 - framesToLookBack];
        const oldDirection = directionHistory.current[directionHistory.current.length - 1 - framesToLookBack];
        
        // Calculate velocity and direction change over the adaptive frame span
        const positionChange = currentUserPosition.distanceTo(oldPosition);
        const directionChange = currentUserDirection.distanceTo(oldDirection);
        
        // Check if user is rotating (any direction change means we should interpolate)
        const isRotating = directionChange > 0.05; // Detect any significant rotation
        const isMoving = positionChange > 0.01; // Higher threshold - need significant movement
        const directionStable = directionChange < 0.1; // Much stricter - very small direction changes only
        
        // Only consider consistent movement if NOT rotating AND moving significantly
        isConsistentMovement = !isRotating && isMoving && directionStable;
        
        // Debug logging for rotation
        if (isRotating || isMoving) {
          console.log('Movement check:', {
            positionChange: positionChange.toFixed(4),
            directionChange: directionChange.toFixed(4),
            isRotating,
            isMoving,
            directionStable,
            consistentFrames: consistentMovementFrames.current,
            isConsistentMovement,
            isUsingDirect: isUsingDirectClampedPositioning.current
          });
        }
      }
      
      // Calculate target position with offset from user (now cached and only recalculated when needed)
      const targetPosition = calculateTargetPosition();
      
      if (isLocalUser) {
        if (isConsistentMovement) {
          consistentMovementFrames.current++;
          // Switch to direct positioning after 10 frames of consistent movement (harder to trigger)
          if (consistentMovementFrames.current >= 10 && !isUsingDirectClampedPositioning.current) {
            // Use the CURRENT NPC position distance to maintain smooth transition
            const userPos2D = new THREE.Vector2(effectiveUserPosition.x, effectiveUserPosition.y);
            const currentNPCPos2D = new THREE.Vector2(positionRef.current.x, positionRef.current.y);
            clampedDistance.current = userPos2D.distanceTo(currentNPCPos2D);
            isUsingDirectClampedPositioning.current = true;
            console.log('Switching to direct positioning! Distance:', clampedDistance.current);
          }
        } else {
          consistentMovementFrames.current = 0;
          lastInterpolationTime.current = Date.now();
          // Reset direct positioning when velocity changes
          isUsingDirectClampedPositioning.current = false;
          clampedDistance.current = null;
          console.log('Switching back to interpolation');
        }
      }

      let newPosition: THREE.Vector3;
      
      // Only use direct positioning for LOCAL users, remote users always interpolate
      if (isLocalUser && isUsingDirectClampedPositioning.current && clampedDistance.current !== null) {
        // Continue using direct positioning at the clamped distance
        const userPos2D = new THREE.Vector2(effectiveUserPosition.x, effectiveUserPosition.y);
        const targetPos2D = new THREE.Vector2(targetPosition.x, targetPosition.y);
        const directionToNPC = targetPos2D.clone().sub(userPos2D).normalize();
        const clampedPos2D = userPos2D.clone().add(directionToNPC.multiplyScalar(clampedDistance.current));
        newPosition = new THREE.Vector3(clampedPos2D.x, clampedPos2D.y, targetPosition.z);
      } else {
        // Use interpolation for direction changes and initial movement
        // Check if we're currently rotating for different parameters
        const currentUserDirection = new THREE.Vector2(user.direction.x, user.direction.y);
        
        let isCurrentlyRotating = false;
        if (positionHistory.current.length >= framesToLookBack + 1) {
          const oldDirection = directionHistory.current[directionHistory.current.length - 1 - framesToLookBack];
          const currentDirectionChange = currentUserDirection.distanceTo(oldDirection);
          isCurrentlyRotating = currentDirectionChange > 0.05;
        }
        
        // Much smoother parameters during rotation
        const rotationParams = { lerpFactor: 0.02, moveSpeed: 0.1, minDistance: 0.1, useConstantSpeed: false };
        const normalLocalParams = { lerpFactor: 0.05, moveSpeed: 0.3, minDistance: 0.1, useConstantSpeed: false };
        const baseRemoteParams = { lerpFactor: 0.03, moveSpeed: 0.25, minDistance: 0.01, useConstantSpeed: true };
        
        const interpolationParams = isLocalUser
          ? (isCurrentlyRotating ? { ...rotationParams, delta } : { ...normalLocalParams, delta })
          : { ...baseRemoteParams, delta };

        const interpolatedPosition = smoothMove(
          positionRef.current.clone(),
          targetPosition,
          interpolationParams
        );
        
        // Apply distance clamping to interpolated position
        const userPos2D = new THREE.Vector2(effectiveUserPosition.x, effectiveUserPosition.y);
        const interpolatedPos2D = new THREE.Vector2(interpolatedPosition.x, interpolatedPosition.y);
        const maxDistance = 15.0; // Maximum allowed distance from user
        
        const distanceFromUser = userPos2D.distanceTo(interpolatedPos2D);
        if (distanceFromUser > maxDistance) {
          // Clamping happened - only switch to direct positioning for LOCAL users if not already in direct mode
          if (isLocalUser && !isUsingDirectClampedPositioning.current) {
            isUsingDirectClampedPositioning.current = true;
            clampedDistance.current = maxDistance;
          }
          
          const directionToNPC = interpolatedPos2D.clone().sub(userPos2D).normalize();
          const clampedPos2D = userPos2D.clone().add(directionToNPC.multiplyScalar(maxDistance));
          newPosition = new THREE.Vector3(clampedPos2D.x, clampedPos2D.y, interpolatedPosition.z);
        } else {
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

