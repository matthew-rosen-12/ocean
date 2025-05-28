import React, { useEffect, useRef } from "react";
import { NPC, throwData } from "../../utils/types";
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

interface ThrownNPCGraphicProps {
  npc: NPC;
  throwData: throwData;
  user: any; // User who threw the NPC for border color
}

const ThrownNPCGraphic: React.FC<ThrownNPCGraphicProps> = ({
  npc,
  throwData,
  user,
}) => {
  const { group, positionRef, textureLoaded, updatePositionWithTracking } =
    useNPCBase(npc);

  // Reference for the edge geometry outline
  const edgeGeometryRef = useRef<THREE.Object3D | null>(null);

  // Set initial position
  useMount(() => {
    updatePositionWithTracking(
      new THREE.Vector3(npc.position.x, npc.position.y, npc.position.z),
      "ThrownNPC-initial"
    );
    group.position.copy(positionRef.current);
  });

  // Calculate position for thrown NPCs
  const calculateThrowPosition = (
    throwData: throwData,
    currentTime: number
  ) => {
    // Calculate elapsed time in seconds
    const elapsedTime = (currentTime - throwData.timestamp) / 1000;
    const throwDurationSec = throwData.throwDuration / 1000;
    const progress = Math.min(elapsedTime / throwDurationSec, 1);

    // If we've reached the end of the throw, use exact same calculation as server
    if (progress >= 1) {
      const finalDistance = throwData.velocity * throwDurationSec;
      return new THREE.Vector3(
        throwData.startPosition.x + throwData.direction.x * finalDistance,
        throwData.startPosition.y + throwData.direction.y * finalDistance,
        0
      );
    }

    // For animation, calculate intermediate position
    const distance = throwData.velocity * elapsedTime;
    return new THREE.Vector3(
      throwData.startPosition.x + throwData.direction.x * distance,
      throwData.startPosition.y + throwData.direction.y * distance,
      0
    );
  };

  // Handle position updates
  useFrame(() => {
    if (!group || !textureLoaded.current) return;

    // Calculate current position based on time for thrown objects
    const throwPosition = calculateThrowPosition(throwData, Date.now());
    updatePositionWithTracking(throwPosition, "ThrownNPC-update");

    group.position.copy(positionRef.current);

    // Create edge geometry if needed and mesh is available
    if (!edgeGeometryRef.current && textureLoaded.current) {
      // Find the mesh in the group
      const mesh = group.children.find(
        (child) => child instanceof THREE.Mesh
      ) as THREE.Mesh;
      if (mesh) {
        const borderColor = getAnimalBorderColor(user);

        // Set the mesh z-position to be in front of animal graphics
        mesh.position.z = 0.11;

        // Create a square outline instead of using EdgesGeometry to avoid diagonal lines
        const squareOutlineGeometry = createSquareOutlineGeometry(1, 1); // 1x1 square, will be scaled
        const edgeGeometry = createEdgeGeometry(
          borderColor,
          false, // Thrown NPCs are never local player
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

export default React.memo(ThrownNPCGraphic);
