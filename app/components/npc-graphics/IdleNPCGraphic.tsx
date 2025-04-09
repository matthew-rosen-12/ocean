import React from "react";
import { NPC, UserInfo } from "../../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { smoothMove } from "../../utils/movement";
import { useNPCBase } from "../../hooks/useNPCBase";

interface IdleNPCGraphicProps {
  npc: NPC;
  myUser: UserInfo;
  onCollision: (npc: NPC) => void;
  isLocalUser: boolean;
}

const IdleNPCGraphic: React.FC<IdleNPCGraphicProps> = ({
  npc,
  myUser,
  onCollision,
  isLocalUser,
}) => {
  const { group, positionRef, textureLoaded, updatePositionWithTracking } =
    useNPCBase(npc);

  // Set initial position
  React.useEffect(() => {
    updatePositionWithTracking(
      new THREE.Vector3(npc.position.x, npc.position.y, npc.position.z),
      "IdleNPC-initial"
    );
    group.position.copy(positionRef.current);
  }, []);

  // Handle updates and collision detection
  useFrame(() => {
    if (!group || !textureLoaded.current) return;

    // Update position
    if (isLocalUser) {
      updatePositionWithTracking(
        new THREE.Vector3(npc.position.x, npc.position.y, 0),
        "IdleNPC-local"
      );
    } else {
      updatePositionWithTracking(
        smoothMove(
          positionRef.current.clone(),
          new THREE.Vector3(npc.position.x, npc.position.y, 0)
        ),
        "IdleNPC-remote"
      );
    }

    group.position.copy(positionRef.current);
    group.rotation.z = 0; // Fixed upright rotation

    // Check for collision
    if (onCollision) {
      const COLLISION_THRESHOLD = 2.5;

      if (myUser.position) {
        const userPos = new THREE.Vector3(
          myUser.position.x,
          myUser.position.y,
          myUser.position.z
        );
        const distance = positionRef.current.distanceTo(userPos);

        if (distance < COLLISION_THRESHOLD) {
          onCollision(npc);
        }
      }
    }
  });

  return <primitive object={group} />;
};

export default IdleNPCGraphic;
