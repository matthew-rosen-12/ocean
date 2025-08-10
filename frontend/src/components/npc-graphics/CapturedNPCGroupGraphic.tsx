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
import { useNPCGroupBase, useMount } from "../../hooks/use-npc-group-base";
import { TerrainBoundaries } from "../../utils/terrain";
import { calculateNPCGroupScale } from "../../utils/npc-group-utils";
import { getAnimalColor } from "../../utils/animal-colors";
import { RENDER_ORDERS, Z_DEPTHS } from "shared/z-depths";
import { 
  RemoteUserPositioning, 
  LocalUserPositioning,
  POSITIONING_CONFIG
} from "./captured-npc-positioning";



interface CapturedNPCGroupGraphicProps {
  group: NPCGroup;
  user: UserInfo;
  npcGroups: NPCGroupsBiMap;
  allPaths: Map<string, pathData>;
  animalWidth: number | undefined;
  isLocalUser: boolean;
  terrainBoundaries?: TerrainBoundaries;
  users: Map<string, UserInfo>;
  throwChargeCount: number | undefined;
  myUserId: string;
  userPositionRef: React.MutableRefObject<THREE.Vector3>;
  userRenderedRotationRef?: React.MutableRefObject<number>;
}

const CapturedNPCGroupGraphic: React.FC<CapturedNPCGroupGraphicProps> = ({
  group,
  user,
  npcGroups: _npcGroups,
  allPaths: _allPaths,
  animalWidth,
  isLocalUser = false,
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


  // Initialize positioning systems
  const positioningSystem = useMemo(() => {
    if (isLocalUser) {
      return new LocalUserPositioning(user);
    } else {
      return new RemoteUserPositioning(user);
    }
  }, [isLocalUser, user.id]); // Only recreate if user type changes or user changes
  
  // Reference for smooth movement interpolation (non-local users)
  const previousPosition = useMemo(() => new THREE.Vector3(), []);
  
  // Position calculation using positioning systems
  const calculateTargetPosition = useCallback((): THREE.Vector3 => {
    if (!animalWidth) return new THREE.Vector3(0, 0, -10);
    
    if (!isLocalUser) {
      return (positioningSystem as RemoteUserPositioning).calculateTargetPosition(user, animalWidth, scaleFactor);
    } else {
      return (positioningSystem as LocalUserPositioning).calculateTargetPosition(user, userPositionRef, animalWidth, scaleFactor);
    }
  }, [animalWidth, user, scaleFactor, userPositionRef, isLocalUser, positioningSystem]);




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

      // Update positioning system interpolations
      if (!isLocalUser) {
        (positioningSystem as RemoteUserPositioning).updateInterpolatedPosition(user, delta);
      } else {
        const currentUserPosition = new THREE.Vector2(user.position.x, user.position.y);
        const targetDirection = new THREE.Vector2(user.direction.x, user.direction.y);
        
        (positioningSystem as LocalUserPositioning).updateHistory(currentUserPosition, targetDirection);
        (positioningSystem as LocalUserPositioning).updateLerpedDirection(targetDirection);
      }
            
      // Calculate target position
      const targetPosition = calculateTargetPosition();
      
      // Calculate new position using positioning system
      let newPosition: THREE.Vector3;
      
      if (isLocalUser) {
        const currentUserPosition = new THREE.Vector2(user.position.x, user.position.y);
        const targetDirection = new THREE.Vector2(user.direction.x, user.direction.y);
        
        newPosition = (positioningSystem as LocalUserPositioning).calculateNewPosition(
          positionRef.current,
          targetPosition,
          userPositionRef,
          currentUserPosition,
          targetDirection,
          delta
        );
      } else {
        newPosition = (positioningSystem as RemoteUserPositioning).calculateNewPosition(
          positionRef.current,
          targetPosition,
          delta
        );
      }
      
      // DEBUG: Log calculated positions for comparison
      if (Math.random() < 0.02) { // Log occasionally to avoid spam
        const userType = isLocalUser ? 'LOCAL' : 'REMOTE';
        const actualUserPos = isLocalUser ? userPositionRef.current : (positioningSystem as RemoteUserPositioning).getInterpolatedPosition();
        const actualUserDir = isLocalUser ? 
          (positioningSystem as LocalUserPositioning).getLerpedDirection() : 
          (positioningSystem as RemoteUserPositioning).getInterpolatedDirection();
        
        const debugInfo = {
          userType,
          userId: user.id,
          userPosition: { x: Number(actualUserPos.x.toFixed(3)), y: Number(actualUserPos.y.toFixed(3)) },
          userDirection: { x: Number(actualUserDir.x.toFixed(3)), y: Number(actualUserDir.y.toFixed(3)) },
          targetPosition: { x: Number(targetPosition.x.toFixed(3)), y: Number(targetPosition.y.toFixed(3)) },
          finalPosition: { x: Number(newPosition.x.toFixed(3)), y: Number(newPosition.y.toFixed(3)) },
          animalWidth: Number(animalWidth.toFixed(3)),
          scaleFactor: Number(scaleFactor.toFixed(3)),
          rawUserPos: { x: Number(user.position.x.toFixed(3)), y: Number(user.position.y.toFixed(3)) },
          rawUserDir: { x: Number(user.direction.x.toFixed(3)), y: Number(user.direction.y.toFixed(3)) }
        };
        
        console.log(`DEBUG NPC Position:`, debugInfo);
        
        // Store for comparison - check if we have both local and remote for same scenario
        if (!window.npcDebugData) window.npcDebugData = [];
        window.npcDebugData.push({...debugInfo, timestamp: Date.now()});
        
        // Keep only recent entries
        if (window.npcDebugData.length > 20) {
          window.npcDebugData = window.npcDebugData.slice(-20);
        }
      }
      
      updatePositionWithTracking(newPosition, "NPCGroup");
      
      // Set position directly without forcing matrix update (avoid double rendering)
      threeGroup.position.copy(newPosition);

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
  }, [animationManager, calculateTargetPosition, updatePositionWithTracking, isLocalUser, threeGroup, textureLoaded, user, group.fileNames.length, group.captorId, animalWidth, positionRef, mesh, scaleFactor, positioningSystem, userPositionRef]);

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

