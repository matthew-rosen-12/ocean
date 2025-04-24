import React from "react";
import { NPC } from "../../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { smoothMove } from "../../utils/movement";
import { useMount, useNPCBase } from "../../hooks/useNPCBase";

interface IdleNPCGraphicProps {
  npc: NPC;
  checkForCollision: (npc: NPC) => void;
}

const IdleNPCGraphic: React.FC<IdleNPCGraphicProps> = ({
  npc,
  checkForCollision,
}) => {
  const { group, positionRef, textureLoaded, updatePositionWithTracking } =
    useNPCBase(npc);

  // Set initial position
  useMount(() => {
    updatePositionWithTracking(
      new THREE.Vector3(npc.position.x, npc.position.y, npc.position.z),
      "IdleNPC-initial"
    );
    group.position.copy(positionRef.current);
  });

  // Handle updates and collision detection
  useFrame(() => {
    if (!group || !textureLoaded.current) return;

    const targetPosition = new THREE.Vector3(npc.position.x, npc.position.y, 0);
    if (!positionRef.current.equals(targetPosition)) {
      updatePositionWithTracking(
        smoothMove(positionRef.current.clone(), targetPosition),
        "IdleNPC"
      );

      group.position.copy(positionRef.current);
    }
    group.rotation.z = 0; // Fixed upright rotation

    // Check for collision
    checkForCollision(npc);
  });

  return <primitive object={group} />;
};

export default IdleNPCGraphic;
