import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import {
  NPC,
  NPCPhase,
  pathData,
  UserInfo,
  PathPhase,
} from "../../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMount, useNPCBase } from "../../hooks/useNPCBase";
import { createEdgeGeometry } from "../../utils/load-animal-svg";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { getAnimalBorderColor } from "../../utils/animal-colors";
import { TerrainBoundaries } from "../../utils/terrain";
import {
  getFaceNpcId,
  calculateNPCGroupPosition,
  calculateNPCGroupScale,
} from "../../utils/npc-group-utils";

// Function to create a square outline geometry
function createSquareOutlineGeometry(
  width: number,
  height: number
): LineGeometry {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  // Create square outline points (clockwise)
  const linePositions = [
    // Bottom edge
    -halfWidth,
    -halfHeight,
    0,
    halfWidth,
    -halfHeight,
    0,
    // Right edge
    halfWidth,
    -halfHeight,
    0,
    halfWidth,
    halfHeight,
    0,
    // Top edge
    halfWidth,
    halfHeight,
    0,
    -halfWidth,
    halfHeight,
    0,
    // Left edge
    -halfWidth,
    halfHeight,
    0,
    -halfWidth,
    -halfHeight,
    0,
  ];

  const lineGeometry = new LineGeometry();
  lineGeometry.setPositions(new Float32Array(linePositions));
  return lineGeometry;
}

interface pathPCGraphicProps {
  npc: NPC;
  pathData: pathData;
  user?: UserInfo; // User who threw the NPC for border color (optional for fleeing NPCs)
  checkForCollision: (npc: NPC, npcPosition?: THREE.Vector3) => void; // Collision checking for fleeing NPCs
  terrainBoundaries?: TerrainBoundaries; // Add terrain boundaries for wrapping
  allNPCs?: Map<string, NPC>; // All NPCs in the scene for collision checking
  allPaths?: Map<string, pathData>; // All active paths for NPC-to-NPC collision
  npcGroups?: Map<string, any>; // NPC groups for collision with groups
  users?: Map<string, UserInfo>; // All users for getting group positions
  myUserId?: string; // Current user ID
  setPaths?: (
    paths:
      | Map<string, pathData>
      | ((prev: Map<string, pathData>) => Map<string, pathData>)
  ) => void; // Function to update paths
  setNpcs?: (
    npcs: Map<string, NPC> | ((prev: Map<string, NPC>) => Map<string, NPC>)
  ) => void; // Function to update NPCs
}

const pathPCGraphic: React.FC<pathPCGraphicProps> = ({
  npc,
  pathData,
  user,
  checkForCollision,
  allNPCs,
  npcGroups,
  users,
  setPaths,
  setNpcs,
}) => {
  const { group, positionRef, textureLoaded, updatePositionWithTracking } =
    useNPCBase(npc);

  // Reference for the edge geometry outline
  const edgeGeometryRef = useRef<THREE.Object3D | null>(null);

  // State for extended path data (client-side collision avoidance)
  const [extendedPathData, setExtendedPathData] = useState<pathData>(pathData);
  const [isPathExtended, setIsPathExtended] = useState(false);

  // State for returning behavior
  const [lastDirectionUpdate, setLastDirectionUpdate] = useState(0);

  // Set initial position
  useMount(() => {
    updatePositionWithTracking(
      new THREE.Vector3(npc.position.x, npc.position.y, npc.position.z),
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
    if (!allNPCs || isPathExtended) return currentPathData;

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
    const idleNPCs = Array.from(allNPCs.values()).filter(
      (otherNpc) => otherNpc.phase === NPCPhase.IDLE && otherNpc.id !== npc.id
    );

    let hasCollision = false;
    for (const idleNPC of idleNPCs) {
      const distance = landingPosition.distanceTo(
        new THREE.Vector3(
          idleNPC.position.x,
          idleNPC.position.y,
          idleNPC.position.z
        )
      );

      if (distance < COLLISION_RADIUS) {
        hasCollision = true;
        console.log(
          `Client: Collision detected between NPC ${npc.id} and IDLE NPC ${idleNPC.id} at distance ${distance}`
        );
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

      console.log(`Client: Extending path for NPC ${npc.id}`);
      setExtendedPathData(extendedPathData);
      setIsPathExtended(true);
      return extendedPathData;
    }

    return currentPathData;
  };

  // Function to handle returning to player
  const handleReturning = (currentPosition: THREE.Vector3, currentTime: number) => {
    if (!pathData.captorId || !users || !setPaths) return;

    const captorUser = users.get(pathData.captorId);
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
        newPaths.set(npc.id, returningPathData);
        return newPaths;
      });

      console.log(`NPC ${npc.id} returning to player at direction:`, normalizedDirection);
    }
  };

  // Handle position updates
  useFrame(() => {
    if (!group || !textureLoaded.current) return;

    // Safety check: don't calculate path position if NPC phase changed
    if (npc.phase !== NPCPhase.path) return;

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
      pathData.captorId && 
      pathData.pathPhase === PathPhase.THROWN && 
      extendedPathData.pathPhase !== PathPhase.RETURNING &&
      progress >= 1
    ) {
      console.log(`NPC ${npc.id} starting to return to player`);
      handleReturning(pathPosition, currentTime);
    }

    // Handle returning behavior
    if (extendedPathData.pathPhase === PathPhase.RETURNING && pathData.captorId) {
      handleReturning(pathPosition, currentTime);
      
      // Check if we've reached the player
      const captorUser = users?.get(pathData.captorId);
      if (captorUser) {
        const distanceToPlayer = pathPosition.distanceTo(
          new THREE.Vector3(captorUser.position.x, captorUser.position.y, captorUser.position.z)
        );
        
        // If close enough to player, capture the NPC
        if (distanceToPlayer < 2.0) {
          console.log(`NPC ${npc.id} returned to player and captured`);
          
          // Trigger capture collision
          if (checkForCollision) {
            checkForCollision(npc, pathPosition);
          }
          
          // Reset returning state
          setLastDirectionUpdate(0);
          return; // Exit early to prevent further processing
        }
      }
    }

    // For fleeing NPCs (no captorId), check for collision
    if (!pathData.captorId && checkForCollision) {
      checkForCollision(npc, pathPosition);
    }

    // Create edge geometry if needed and mesh is available
    if (!edgeGeometryRef.current && textureLoaded.current) {
      // Find the mesh in the group
      const mesh = group.children.find(
        (child) => child instanceof THREE.Mesh
      ) as THREE.Mesh;
      if (mesh && user) {
        const borderColor = getAnimalBorderColor(user);

        // Set the mesh z-position to be in front of animal graphics
        mesh.position.z = 0.11;

        // Create a square outline instead of using EdgesGeometry to avoid diagonal lines
        const squareOutlineGeometry = createSquareOutlineGeometry(1, 1); // 1x1 square, will be scaled
        const edgeGeometry = createEdgeGeometry(
          borderColor,
          false, // path NPCs are never local player
          squareOutlineGeometry, // Use our custom square outline
          undefined // No fallback needed
        );

        // Position the outline in front of animal outlines (absolute z-position)
        edgeGeometry.position.z = 0.095;

        // Scale the edge geometry to match the mesh
        edgeGeometry.scale.copy(mesh.scale);

        // Add the edge geometry to the group
        group.add(edgeGeometry);
        edgeGeometryRef.current = edgeGeometry;
      }
    }
  });

  // Reset extended path data when pathData changes (new path)
  useEffect(() => {
    setExtendedPathData(pathData);
    setIsPathExtended(false);
    setLastDirectionUpdate(0);
  }, [pathData.id, pathData.timestamp]);

  // Add effect to track useFrame lifecycle and cleanup
  useEffect(() => {
    return () => {
      // Cleanup edge geometry
      if (edgeGeometryRef.current) {
        // Dispose of edge geometry materials and geometry
        edgeGeometryRef.current.traverse((child) => {
          if (
            child instanceof THREE.Mesh ||
            child instanceof THREE.LineSegments
          ) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat) => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });

        // Remove from parent if still attached
        if (edgeGeometryRef.current.parent) {
          edgeGeometryRef.current.parent.remove(edgeGeometryRef.current);
        }

        edgeGeometryRef.current = null;
      }
    };
  }, [npc.id]);

  return <primitive object={group} />;
};

export default React.memo(pathPCGraphic);
