import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import {
  NPC,
  NPCPhase,
  PathPhase,
  pathData,
  UserInfo,
} from "../../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMount, useNPCBase } from "../../hooks/useNPCBase";
import { createEdgeGeometry } from "../../utils/load-animal-svg";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { getAnimalBorderColor } from "../../utils/animal-colors";
import { TerrainBoundaries } from "../../utils/terrain";
import { v4 as uuidv4 } from "uuid";
import { socket } from "../../socket";
import { serialize } from "../../utils/serializers";
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
  terrainBoundaries,
  allNPCs,
  allPaths,
  npcGroups,
  users,
  myUserId,
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
  const [hasCollided, setHasCollided] = useState(false); // Prevent multiple collisions

  // Memoized function to calculate group positions for collision detection
  const calculateGroupPositions = useMemo(() => {
    if (!npcGroups || !users || !allNPCs) return new Map();

    const groupPositions = new Map<
      string,
      { position: THREE.Vector3; scale: number; radius: number }
    >();

    Array.from(npcGroups.values()).forEach((group) => {
      if (group.npcIds.size > 0) {
        // Get the face NPC for this group
        const faceNpcId = getFaceNpcId(group);
        if (!faceNpcId) return;

        const faceNpc = allNPCs.get(faceNpcId);
        if (!faceNpc || faceNpc.phase !== NPCPhase.CAPTURED) return;

        // Get the user who owns this group to calculate position
        const groupUser = users.get(group.captorId);
        if (!groupUser) return;

        // Calculate the current group position and scale using utility functions
        const groupScale = calculateNPCGroupScale(group.npcIds.size);

        // We need animal width for proper position calculation
        // For now, use a reasonable default - this should be passed in as a prop
        const animalWidth = 4.0; // TODO: Pass this as prop or get from context

        const groupPosition = calculateNPCGroupPosition(
          groupUser,
          animalWidth,
          groupScale
        );

        // Use group scale for collision radius - larger groups have larger collision areas
        const GROUP_COLLISION_RADIUS = groupScale * 0.8; // Scale factor for collision

        groupPositions.set(group.captorId, {
          position: groupPosition,
          scale: groupScale,
          radius: GROUP_COLLISION_RADIUS,
        });
      }
    });

    return groupPositions;
  }, [
    npcGroups,
    users,
    allNPCs,
    // Add relevant dependencies for position changes
    ...(users
      ? Array.from(users.values()).flatMap((user) => [
          user.position.x,
          user.position.y,
          user.direction.x,
          user.direction.y,
        ])
      : []),
  ]);

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

    return position;
  };

  // Check for collisions with other NPCs with captors and handle bouncing/reflection
  const checkNPCToNPCCollision = (
    currentPathData: pathData,
    currentPosition: THREE.Vector3
  ) => {
    if (!allNPCs || !allPaths || !npcGroups || hasCollided) return;

    // Only check for thrown NPCs (those with captors)
    if (
      currentPathData.pathPhase !== PathPhase.THROWN ||
      !currentPathData.captorId
    )
      return;

    // Check collision with NPC groups - only against face NPC with proper position/scale
    if (npcGroups && users && allNPCs) {

      // Use the memoized group positions for efficient collision detection
      Array.from(calculateGroupPositions.entries()).forEach(
        ([captorId, groupData]) => {
          if (captorId !== currentPathData.captorId) {
            // Ignore same captor
            const distance = currentPosition.distanceTo(groupData.position);

            if (distance < groupData.radius) {
              const group = npcGroups.get(captorId);
              if (group) {
                console.log(
                  `NPC-to-Group collision detected: ${npc.id} vs group ${captorId} at distance ${distance}`
                );
                setHasCollided(true);
                handleNPCGroupReflection(
                  currentPosition,
                  groupData.position,
                  group
                );
                return;
              }
            }
          }
        }
      );
    } else {
      console.log(
        `Group collision check skipped - npcGroups: ${!!npcGroups}, users: ${!!users}, allNPCs: ${!!allNPCs}`
      );
    }
  };

  // Handle reflection off NPC group and emit NPC from group
  const handleNPCGroupReflection = (
    npcPosition: THREE.Vector3,
    groupPosition: THREE.Vector3,
    group: any
  ) => {
    if (!setPaths || !setNpcs || !allNPCs) return;

    // Calculate reflection direction
    const reflectionDirection = {
      x: npcPosition.x - groupPosition.x,
      y: npcPosition.y - groupPosition.y,
    };

    // Normalize reflection direction
    const length = Math.sqrt(
      reflectionDirection.x * reflectionDirection.x +
        reflectionDirection.y * reflectionDirection.y
    );
    const normalizedDirection = {
      x: reflectionDirection.x / length,
      y: reflectionDirection.y / length,
    };

    // Create reflection path for the thrown NPC
    const reflectionPathData: pathData = {
      id: uuidv4(),
      room: pathData.room,
      npc: npc,
      startPosition: {
        x: npcPosition.x,
        y: npcPosition.y,
      },
      direction: normalizedDirection,
      pathDuration: 1200, // Reflection duration
      velocity: 18, // Fast reflection speed
      timestamp: Date.now(),
      captorId: pathData.captorId,
      pathPhase: PathPhase.BOUNCING,
    };

    // Send reflection to server
    const currentSocket = socket();
    if (currentSocket) {
      currentSocket.emit(
        "path-npc",
        serialize({ pathData: reflectionPathData }),
        (response: { success: boolean }) => {
          if (!response.success) console.error("NPC reflection failed");
        }
      );

      // Emit an NPC from the group in the same direction (faster)
      if (group.npcIds.size > 0) {
        const emittedNPCId = group.npcIds.values().next().value;
        const emittedNPC = allNPCs.get(emittedNPCId);

        if (emittedNPC) {
          const emissionPathData: pathData = {
            id: uuidv4(),
            room: pathData.room,
            npc: emittedNPC,
            startPosition: {
              x: groupPosition.x,
              y: groupPosition.y,
            },
            direction: normalizedDirection,
            pathDuration: 1500, // Longer emission duration
            velocity: 25, // Very fast emission speed
            timestamp: Date.now(),
            captorId: group.captorId,
            pathPhase: PathPhase.THROWN,
          };

          currentSocket.emit(
            "path-npc",
            serialize({ pathData: emissionPathData }),
            (response: { success: boolean }) => {
              if (!response.success) console.error("NPC emission failed");
            }
          );
        }
      }
    }

    // Update local state
    setPaths((prev: Map<string, pathData>) => {
      const newPaths = new Map(prev);
      newPaths.set(npc.id, reflectionPathData);
      return newPaths;
    });
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

  // Handle position updates
  useFrame(() => {
    if (!group || !textureLoaded.current) return;

    // Safety check: don't calculate path position if NPC phase changed
    if (npc.phase !== NPCPhase.path) return;

    // Check for collisions and potentially extend path
    const currentPathData = checkAndExtendPath(extendedPathData, Date.now());

    // Calculate current position based on time for path objects
    const pathPosition = calculatePathPosition(currentPathData, Date.now());
    updatePositionWithTracking(pathPosition, "pathPC-update");

    group.position.copy(positionRef.current);

    // Check for NPC-to-NPC collisions (bouncing/reflection)
    checkNPCToNPCCollision(currentPathData, pathPosition);

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
    setHasCollided(false); // Reset collision flag for new paths
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
