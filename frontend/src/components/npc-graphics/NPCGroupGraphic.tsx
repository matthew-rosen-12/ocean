import React, { useEffect, useMemo, useRef } from "react";
import { NPC, NPCGroup, UserInfo } from "../../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { smoothMove } from "../../utils/movement";
import { useMount, useNPCBase } from "../../hooks/useNPCBase";
import {
  getAnimalBorderColor,
  getAnimalIndicatorColor,
} from "../../utils/animal-colors";
import { Text } from "@react-three/drei";

interface NPCGroupGraphicProps {
  group: NPCGroup;
  groupSize: number;
  user: UserInfo | undefined;
  npcs: Map<string, NPC>;
}

const NPCGroupGraphic: React.FC<NPCGroupGraphicProps> = ({
  group,
  user,
  npcs,
}) => {
  // Skip rendering if no user or no NPCs
  if (!user || group.npcIds.size === 0) return null;

  // Get first NPC id from the group and find the actual NPC
  const firstNpcId =
    group.npcIds.size === 0 ? null : group.npcIds.values().next().value;

  // If there's no NPC in the group, don't render anything
  if (!firstNpcId) return null;

  // Get the real NPC from the npcs map
  const npc = npcs.get(firstNpcId)!;

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
  const indicatorPosition = useMemo(() => new THREE.Vector3(), []);

  // Create a border outline for the NPC group
  const outlineMaterial = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: getAnimalBorderColor(user.animal),
      linewidth: 2,
    });
    return material;
  }, [user.animal]);

  const outlineRef = useRef<THREE.Line | null>(null);

  // Set initial position
  useEffect(() => {
    updatePositionWithTracking(
      new THREE.Vector3(user.position.x, user.position.y, user.position.z),
      "NPCGroup-initial"
    );
    threeGroup.position.copy(positionRef.current);

    // Apply the scale based on number of NPCs
    if (mesh.current) {
      // Apply our logarithmic scaling
      mesh.current.scale.set(scaleFactor, scaleFactor, 1);

      // Create outline based on mesh size
      if (outlineRef.current) {
        threeGroup.remove(outlineRef.current);
      }

      const width = mesh.current.scale.x * 1.1; // Slightly larger than the NPC
      const height = mesh.current.scale.y * 1.1;

      const outlineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-width / 2, -height / 2, 0),
        new THREE.Vector3(width / 2, -height / 2, 0),
        new THREE.Vector3(width / 2, height / 2, 0),
        new THREE.Vector3(-width / 2, height / 2, 0),
        new THREE.Vector3(-width / 2, -height / 2, 0),
      ]);

      outlineRef.current = new THREE.Line(outlineGeometry, outlineMaterial);
      outlineRef.current.renderOrder = 1; // Ensure it renders on top
      threeGroup.add(outlineRef.current);
    }
  }, [
    user.position,
    scaleFactor,
    threeGroup,
    positionRef,
    updatePositionWithTracking,
    mesh,
    outlineMaterial,
  ]);

  // Handle position updates to follow the user
  useFrame(() => {
    if (!threeGroup || !textureLoaded.current) return;

    const targetPosition = new THREE.Vector3(
      user.position.x,
      user.position.y,
      0
    );

    if (!positionRef.current.equals(targetPosition)) {
      updatePositionWithTracking(
        smoothMove(positionRef.current.clone(), targetPosition),
        "NPCGroup"
      );
      threeGroup.position.copy(positionRef.current);

      // Update indicator position to follow the group
      indicatorPosition.copy(positionRef.current);
      indicatorPosition.y += mesh.current ? mesh.current.scale.y / 2 + 0.5 : 2; // Position above the NPC
    }

    // Make a subtle oscillation to indicate this is a group
    const time = Date.now() / 1000;
    const oscillation = Math.sin(time * 2) * 0.05; // Reduced oscillation
    threeGroup.rotation.z = oscillation;

    // Ensure scale is always maintained with very subtle pulse
    if (mesh.current) {
      // Get the base scale
      const baseX = mesh.current.scale.x / scaleFactor;
      const baseY = mesh.current.scale.y / scaleFactor;

      // Apply scaling with a MUCH more subtle pulse effect
      const pulseEffect = 1 + Math.sin(time * 3) * 0.01; // Very subtle 1% pulse
      mesh.current.scale.set(
        baseX * scaleFactor * pulseEffect,
        baseY * scaleFactor * pulseEffect,
        1
      );

      // Update outline to match the mesh size if it exists
      if (outlineRef.current) {
        const width = mesh.current.scale.x * 1.1;
        const height = mesh.current.scale.y * 1.1;

        const outlinePositions = new Float32Array([
          -width / 2,
          -height / 2,
          0,
          width / 2,
          -height / 2,
          0,
          width / 2,
          height / 2,
          0,
          -width / 2,
          height / 2,
          0,
          -width / 2,
          -height / 2,
          0,
        ]);

        outlineRef.current.geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(outlinePositions, 3)
        );
      }
    }
  });

  return (
    <>
      <primitive object={threeGroup} />

      {/* Counter indicator showing the number of NPCs */}
      {npcsCount > 1 && (
        <group position={indicatorPosition.toArray()}>
          {/* Background circle */}
          <mesh>
            <circleGeometry args={[0.7, 32]} />
            <meshBasicMaterial color={getAnimalIndicatorColor(user.animal)} />
          </mesh>

          {/* Outline for the counter */}
          <lineSegments>
            <circleGeometry args={[0.7, 32]} />
            <lineBasicMaterial color={getAnimalBorderColor(user.animal)} />
          </lineSegments>

          {/* Text showing count */}
          <Text
            position={[0, 0, 0.1]}
            fontSize={0.5}
            color="#FFFFFF"
            font="/fonts/Inter-Bold.woff"
            anchorX="center"
            anchorY="middle"
          >
            {npcsCount}
          </Text>
        </group>
      )}
    </>
  );
};

export default React.memo(NPCGroupGraphic);
