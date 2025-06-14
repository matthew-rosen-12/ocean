import React from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { smoothMove } from "../../utils/movement";
import { useMount, useNPCGroupBase } from "../../hooks/useNPCGroupBase";
import { NPCGroup } from "shared/types";

interface IdleNPCGroupGraphicProps {
  npcGroup: NPCGroup;
  checkForCollision: (npcGroup: NPCGroup) => void;
}

const IdleNPCGroupGraphic: React.FC<IdleNPCGroupGraphicProps> = ({
  npcGroup,
  checkForCollision,
}) => {
  const { group, positionRef, textureLoaded, updatePositionWithTracking } =
    useNPCGroupBase(npcGroup);

  // Set initial position
  useMount(() => {
    updatePositionWithTracking(
      new THREE.Vector3(npcGroup.position.x, npcGroup.position.y, 0),
      "IdleNPC-initial"
    );
    group.position.copy(positionRef.current);
  });

  // Handle updates and collision detection
  useFrame(() => {
    if (!group || !textureLoaded.current) return;

    const targetPosition = new THREE.Vector3(npcGroup.position.x, npcGroup.position.y, 0);
    if (!positionRef.current.equals(targetPosition)) {
      updatePositionWithTracking(
        smoothMove(positionRef.current.clone(), targetPosition),
        "IdleNPC"
      );

      group.position.copy(positionRef.current);
    }
    group.rotation.z = 0; // Fixed upright rotation

    // Check for collision
    checkForCollision(npcGroup);
  });

  // Add effect to track useFrame lifecycles
  return <primitive object={group} />;
};

export default IdleNPCGroupGraphic;
