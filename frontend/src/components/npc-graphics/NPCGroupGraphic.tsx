import React, { useMemo, useRef, useEffect } from "react";
import { NPC, NPCGroup, UserInfo } from "../../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { smoothMove } from "../../utils/movement";
import { useNPCBase, useMount } from "../../hooks/useNPCBase";
import {
  getAnimalBorderColor,
  getAnimalIndicatorColor,
} from "../../utils/animal-colors";
import { createEdgeGeometry } from "../../utils/load-animal-svg";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { TerrainBoundaries } from "../../utils/terrain";
// Constants for positioning
const FOLLOW_DISTANCE = 2; // Distance behind the user

interface NPCGroupGraphicProps {
  group: NPCGroup;
  user: UserInfo;
  npcs: Map<string, NPC>;
  animalWidth: number | undefined;
  isLocalUser?: boolean; // Add flag to distinguish local vs non-local users
  terrainBoundaries?: TerrainBoundaries; // Add terrain boundaries for wrapping
}

const NPCGroupGraphic: React.FC<NPCGroupGraphicProps> = ({
  group,
  user,
  npcs,
  animalWidth,
  isLocalUser = false, // Default to false for non-local users
  terrainBoundaries,
}) => {
  // Skip rendering if no user or no NPCs
  if (!user || group.npcIds.size === 0) {
    return null;
  }

  // If animal width is not set, don't render
  if (!animalWidth) {
    return null;
  }

  // Calculate logarithmic scale factor based on number of NPCs
  const scaleFactor = useMemo(() => {
    const numNpcs = group.npcIds.size;
    if (numNpcs === 0) return 0;

    // Logarithmic scaling function - log base 2 gives a nice curve
    // Scale starts at 1 for 1 NPC and roughly doubles for each doubling of NPCs
    const baseScale = 3;
    const logScale = Math.log(numNpcs) / Math.log(4);

    return baseScale * (1 + logScale);
  }, [group.npcIds.size]);

  // Get first NPC id from the group and find the actual NPC
  const firstNpcId =
    group.npcIds.size === 0 ? null : group.npcIds.values().next().value;

  // If there's no NPC in the group, don't render anything
  if (!firstNpcId) return null;

  // Get the real NPC from the npcs map
  const npc = npcs.get(firstNpcId)!;

  // Use the NPCBase hook with the real NPC
  const {
    group: threeGroup,
    positionRef,
    textureLoaded,
    updatePositionWithTracking,
    mesh,
  } = useNPCBase(npc);

  // Add a badge showing the number of NPCs in the group
  const npcsCount = group.npcIds.size;

  // Reference to store the indicator position
  const indicatorRef = useRef<THREE.Group>(null);
  // Reference for the edge geometry outline
  const edgeGeometryRef = useRef<THREE.Object3D | null>(null);
  // Reference for smooth movement interpolation (non-local users)
  const previousPosition = useMemo(() => new THREE.Vector3(), []);

  // Add effect to track component lifecycle
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
  }, []);

  // Add effect to recreate outline when group size changes
  useEffect(() => {
    // Remove existing edge geometry when group size changes
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
  }, [group.npcIds.size, scaleFactor]);

  // Calculate target position behind the user based on their direction
  const calculateTargetPosition = (
    userPosition: THREE.Vector3
  ): THREE.Vector3 => {
    // Default direction if not specified (backward is -x)
    let directionX = -1;
    let directionY = 0;

    // If user has a direction, use the inverse of it to position behind
    if (user.direction) {
      // Normalize direction
      const length = Math.sqrt(
        user.direction.x * user.direction.x +
          user.direction.y * user.direction.y
      );
      if (length > 0.001) {
        directionX = -user.direction.x / length; // Opposite X direction
        directionY = -user.direction.y / length; // Opposite Y direction
      }
    }

    // Calculate position that is animalWidth + scaled NPC width + FOLLOW_DISTANCE units behind the user
    let npcWidth = 0;
    if (mesh.current) {
      npcWidth = mesh.current.scale.x; // width of the NPC mesh
    }

    let targetPosition = new THREE.Vector3(
      userPosition.x +
        directionX * (animalWidth / 2 + npcWidth / 2 + FOLLOW_DISTANCE),
      userPosition.y +
        directionY * (animalWidth / 2 + npcWidth / 2 + FOLLOW_DISTANCE),
      0.05 // Place in front of wave grid
    );

    return targetPosition;
  };

  // Set initial position
  useMount(() => {
    // Start with initial position behind user
    const initialPosition = calculateTargetPosition(
      new THREE.Vector3(user.position.x, user.position.y, user.position.z)
    );

    updatePositionWithTracking(initialPosition, "NPCGroup-initial");
    threeGroup.position.copy(positionRef.current);

    // Initialize previousPosition for smooth interpolation
    previousPosition.copy(positionRef.current);

    // Apply the scale based on number of NPCs
    if (mesh.current) {
      // Apply our logarithmic scaling
      mesh.current.scale.set(scaleFactor, scaleFactor, 1);

      // Create edge geometry outline for the NPC
      const borderColor = getAnimalBorderColor(user);

      // Create a square outline instead of using EdgesGeometry to avoid diagonal lines
      const squareOutlineGeometry = createSquareOutlineGeometry(1, 1); // 1x1 square, will be scaled
      const edgeGeometry = createEdgeGeometry(
        borderColor,
        false, // NPCs are never local player
        squareOutlineGeometry, // Use our custom square outline
        undefined // No fallback needed
      );

      // Position the outline behind the NPC
      edgeGeometry.position.z = -0.01;

      // Add the edge geometry to the group
      threeGroup.add(edgeGeometry);
      edgeGeometryRef.current = edgeGeometry;

      // Scale the edge geometry to match the mesh
      edgeGeometry.scale.set(scaleFactor, scaleFactor, 1);
    }
  });

  // Handle position updates to follow the user
  useFrame(() => {
    if (!threeGroup || !textureLoaded.current) return;

    // Calculate target position with offset from user
    const targetPosition = calculateTargetPosition(
      new THREE.Vector3(user.position.x, user.position.y, user.position.z)
    );

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
            lerpFactor: 0.1,
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

    // Always update indicator position to follow the group
    if (indicatorRef.current && mesh.current) {
      indicatorRef.current.position.copy(threeGroup.position);
      indicatorRef.current.position.y += mesh.current.scale.y / 2 + 2.8;
    }

    // Make a subtle oscillation to indicate this is a group
    const time = Date.now() / 1000;
    const oscillation = Math.sin(time * 2) * 0.05; // Reduced oscillation
    threeGroup.rotation.z = oscillation;

    // Keep scale constant - no more pulsing
    if (mesh.current) {
      // Ensure the mesh scale remains consistent with the scaleFactor
      mesh.current.scale.set(scaleFactor, scaleFactor, 1);

      // Create or update edge geometry if needed
      if (!edgeGeometryRef.current && textureLoaded.current) {
        const borderColor = getAnimalBorderColor(user);

        // Create a square outline instead of using EdgesGeometry to avoid diagonal lines
        const squareOutlineGeometry = createSquareOutlineGeometry(1, 1); // 1x1 square, will be scaled
        const edgeGeometry = createEdgeGeometry(
          borderColor,
          false, // NPCs are never local player
          squareOutlineGeometry, // Use our custom square outline
          undefined // No fallback needed
        );

        // Position the outline behind the NPC
        edgeGeometry.position.z = -0.01;

        // Add the edge geometry to the group
        threeGroup.add(edgeGeometry);
        edgeGeometryRef.current = edgeGeometry;

        // Scale the edge geometry to match the mesh
        edgeGeometry.scale.set(scaleFactor, scaleFactor, 1);
      }
    }
  });

  return (
    <>
      <primitive object={threeGroup} />

      {/* Counter indicator showing the number of NPCs */}
      {npcsCount > 1 && (
        <group ref={indicatorRef}>
          {/* Text showing count with outline */}
          <Text
            position={[0, -0.5, 0]}
            fontSize={2.8}
            color={getAnimalBorderColor(user)}
            anchorX="center"
            anchorY="middle"
            font="https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxM.woff"
            outlineWidth={0.1}
            outlineColor="white"
          >
            {npcsCount}
          </Text>
        </group>
      )}
    </>
  );
};

export default React.memo(NPCGroupGraphic, (prevProps, nextProps) => {
  // Compare group properties
  const captorIdSame = prevProps.group.captorId === nextProps.group.captorId;
  const sizeSame = prevProps.group.npcIds.size === nextProps.group.npcIds.size;
  const prevNpcIds = Array.from(prevProps.group.npcIds).sort();
  const nextNpcIds = Array.from(nextProps.group.npcIds).sort();
  const npcIdsSame = prevNpcIds.every((id, index) => id === nextNpcIds[index]);

  const groupsSame = captorIdSame && sizeSame && npcIdsSame;

  // Compare other props including user position
  const userSame = prevProps.user.id === nextProps.user.id;
  const userPositionSame =
    prevProps.user.position.x === nextProps.user.position.x &&
    prevProps.user.position.y === nextProps.user.position.y &&
    prevProps.user.position.z === nextProps.user.position.z;
  const userDirectionSame =
    prevProps.user.direction.x === nextProps.user.direction.x &&
    prevProps.user.direction.y === nextProps.user.direction.y;
  const animalWidthSame = prevProps.animalWidth === nextProps.animalWidth;

  const shouldNotRerender =
    groupsSame &&
    userSame &&
    userPositionSame &&
    userDirectionSame &&
    animalWidthSame;

  return shouldNotRerender;
});

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
