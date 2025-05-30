import React, { useEffect, useRef } from "react";
import { NPC, NPCPhase, pathData, UserInfo } from "../../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMount, useNPCBase } from "../../hooks/useNPCBase";
import { createEdgeGeometry } from "../../utils/load-animal-svg";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { getAnimalBorderColor } from "../../utils/animal-colors";

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
  checkForCollision?: (npc: NPC, npcPosition?: THREE.Vector3) => void; // Collision checking for fleeing NPCs
}

const pathPCGraphic: React.FC<pathPCGraphicProps> = ({
  npc,
  pathData,
  user,
  checkForCollision,
}) => {
  const { group, positionRef, textureLoaded, updatePositionWithTracking } =
    useNPCBase(npc);

  // Reference for the edge geometry outline
  const edgeGeometryRef = useRef<THREE.Object3D | null>(null);

  // Set initial position
  useMount(() => {
    updatePositionWithTracking(
      new THREE.Vector3(npc.position.x, npc.position.y, npc.position.z),
      "pathPC-initial"
    );
    group.position.copy(positionRef.current);
  });

  // Calculate position for path NPCs
  const calculatepathPosition = (pathData: pathData, currentTime: number) => {
    // Calculate elapsed time in seconds
    const elapsedTime = (currentTime - pathData.timestamp) / 1000;
    const pathDurationSec = pathData.pathDuration / 1000;
    const progress = Math.min(elapsedTime / pathDurationSec, 1);

    // If we've reached the end of the path, use exact same calculation as server
    if (progress >= 1) {
      const finalDistance = pathData.velocity * pathDurationSec;
      return new THREE.Vector3(
        pathData.startPosition.x + pathData.direction.x * finalDistance,
        pathData.startPosition.y + pathData.direction.y * finalDistance,
        0
      );
    }

    // For animation, calculate intermediate position
    const distance = pathData.velocity * elapsedTime;
    return new THREE.Vector3(
      pathData.startPosition.x + pathData.direction.x * distance,
      pathData.startPosition.y + pathData.direction.y * distance,
      0
    );
  };

  // Handle position updates
  useFrame(() => {
    if (!group || !textureLoaded.current) return;

    // Safety check: don't calculate path position if NPC phase changed
    if (npc.phase !== NPCPhase.path) return;

    // Calculate current position based on time for path objects
    const pathPosition = calculatepathPosition(pathData, Date.now());
    updatePositionWithTracking(pathPosition, "pathPC-update");

    group.position.copy(positionRef.current);

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
