import React from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { smoothMove } from "../../utils/movement";
import { useMount, useNPCGroupBase } from "../../hooks/use-npc-group-base";
import { NPCGroup } from "shared/types";

interface IdleNPCGroupGraphicProps {
  npcGroup: NPCGroup;
  checkForCollision: (npcGroup: NPCGroup) => void;
}

const IdleNPCGroupGraphic: React.FC<IdleNPCGroupGraphicProps> = ({
  npcGroup,
  checkForCollision,
}) => {
  const { group, positionRef, textureLoaded, updatePositionWithTracking, textInfo } =
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
  return (
    <>
      <primitive object={group}>
        {/* Text component for NPC count */}
        {textInfo && (
          <Text
            position={textInfo.position}
            fontSize={textInfo.fontSize}
            color={textInfo.color}
            anchorX="center"
            anchorY="middle"
            font="https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxM.woff"
            outlineWidth={0.1}
            outlineColor="white"
          >
            {textInfo.count}
          </Text>
        )}
      </primitive>
    </>
  );
};

export default IdleNPCGroupGraphic;
