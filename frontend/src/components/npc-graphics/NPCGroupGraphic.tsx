import React, { useMemo } from "react";
import { NPC, NPCGroup, UserInfo, NPCPhase } from "../../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { smoothMove } from "../../utils/movement";
import { useMount, useNPCBase } from "../../hooks/useNPCBase";

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
    const baseScale = 1;
    const logScale = Math.log(numNpcs) / Math.log(2);

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

  // Set initial position
  useMount(() => {
    updatePositionWithTracking(
      new THREE.Vector3(user.position.x, user.position.y, user.position.z),
      "NPCGroup-initial"
    );
    threeGroup.position.copy(positionRef.current);

    // Apply the scale based on number of NPCs
    if (mesh.current) {
      // Get the base scale from mesh (which is normally 3 * aspect ratio)
      const currentXScale = mesh.current.scale.x;
      const currentYScale = mesh.current.scale.y;

      // Apply our logarithmic scaling
      mesh.current.scale.set(
        currentXScale * scaleFactor,
        currentYScale * scaleFactor,
        1
      );
    }
  });

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
      indicatorPosition.y += 2; // Position above the NPC
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
    }
  });

  return (
    <>
      <primitive object={threeGroup} />

      {/* Optional: Add a text label showing the number of NPCs */}
      {npcsCount > 1 && (
        <mesh position={indicatorPosition.toArray()}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color="#2277ff" />
        </mesh>
      )}
    </>
  );
};

export default React.memo(NPCGroupGraphic);
