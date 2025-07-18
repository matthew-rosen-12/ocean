import React, { useEffect, useRef } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { useAnimationManagerContext } from "../../contexts/AnimationManagerContext";
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
  const animationManager = useAnimationManagerContext();
  const animationId = useRef<string>(`idle-${npcGroup.id}`);

  // Set initial position
  useMount(() => {
    updatePositionWithTracking(
      new THREE.Vector3(npcGroup.position.x, npcGroup.position.y, 0),
      "IdleNPC-initial"
    );
    group.position.copy(positionRef.current);
  });

  // Register animation callback with the AnimationManager
  useEffect(() => {
    const callbackId = animationId.current;
    const animationCallback = (_state: unknown, _delta: number) => {
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
    };

    animationManager.registerAnimationCallback(callbackId, animationCallback);

    return () => {
      animationManager.unregisterAnimationCallback(callbackId);
    };
  }, [npcGroup, group, textureLoaded, positionRef, updatePositionWithTracking, checkForCollision, animationManager]);

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
            characters="0123456789"
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
