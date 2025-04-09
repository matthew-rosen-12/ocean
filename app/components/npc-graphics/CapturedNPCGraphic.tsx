import React from "react";
import { NPC, UserInfo } from "../../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { smoothMove } from "../../utils/movement";
import { useNPCBase } from "../../hooks/useNPCBase";

interface CapturedNPCGraphicProps {
  npc: NPC;
  myUser: UserInfo;
  followingUser: UserInfo;
  isLocalUser: boolean;
  offsetIndex: number;
}

const CapturedNPCGraphic: React.FC<CapturedNPCGraphicProps> = ({
  npc,
  followingUser,
  isLocalUser,
  offsetIndex,
}) => {
  const { group, positionRef, textureLoaded, updatePositionWithTracking } =
    useNPCBase(npc);

  // Helper function for calculating follow position
  const calculateFollowPosition = (
    followingUser: UserInfo,
    offsetIndex: number,
    offsetDistance: number = 4.0
  ): THREE.Vector3 => {
    // Get user direction
    const dx = followingUser.direction?.x || 0;
    const dy = followingUser.direction?.y || 0;

    // Normalize direction
    const dirLength = Math.sqrt(dx * dx + dy * dy) || 1;
    const normalizedDx = dx / dirLength;
    const normalizedDy = dy / dirLength;

    // Calculate base position behind player
    let posX =
      followingUser.position.x -
      normalizedDx * offsetDistance * (offsetIndex + 1);
    let posY =
      followingUser.position.y -
      normalizedDy * offsetDistance * (offsetIndex + 1);

    // For staggered formation, use perpendicular vector
    if (offsetIndex > 0) {
      const perpDx = -normalizedDy;
      const perpDy = normalizedDx;
      const spreadFactor =
        (offsetIndex % 2 === 0 ? 1 : -1) * Math.ceil(offsetIndex / 2) * 1.2;
      posX += perpDx * spreadFactor;
      posY += perpDy * spreadFactor;
    }

    return new THREE.Vector3(posX, posY, 0);
  };

  // Set initial position
  React.useEffect(() => {
    const position = calculateFollowPosition(followingUser, offsetIndex);
    updatePositionWithTracking(position, "CapturedNPC-initial");
    group.position.copy(positionRef.current);
  }, []);

  // Handle position updates
  useFrame(() => {
    if (!group || !textureLoaded.current) return;

    const targetPosition = calculateFollowPosition(followingUser, offsetIndex);

    if (!positionRef.current.equals(targetPosition)) {
      if (isLocalUser) {
        updatePositionWithTracking(targetPosition, "CapturedNPC-local");
      } else {
        updatePositionWithTracking(
          smoothMove(positionRef.current.clone(), targetPosition),
          "CapturedNPC-remote"
        );
      }

      group.position.copy(positionRef.current);
      group.rotation.z = 0; // Fixed upright rotation
    }
  });

  return <primitive object={group} />;
};

export default CapturedNPCGraphic;
