import React, { useEffect } from "react";
import { NPC, throwData } from "../../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMount, useNPCBase } from "../../hooks/useNPCBase";

interface ThrownNPCGraphicProps {
  npc: NPC;
  throwData: throwData;
}

const ThrownNPCGraphic: React.FC<ThrownNPCGraphicProps> = ({
  npc,
  throwData,
}) => {
  const { group, positionRef, textureLoaded, updatePositionWithTracking } =
    useNPCBase(npc);

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
  });

  // Add effect to track useFrame lifecycle
  useEffect(() => {}, [npc.id]);

  return <primitive object={group} />;
};

export default React.memo(ThrownNPCGraphic);
