import React from "react";
import { Text } from "@react-three/drei";
import {
  NPCPhase,
  pathData,
  UserInfo,
  NPCGroup,
  NPCGroupsBiMap,
} from "shared/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMount, useNPCGroupBase } from "../../hooks/use-npc-group-base";
import { TerrainBoundaries } from "../../utils/terrain";


interface PathNPCGroupGraphicProps {
  npcGroup: NPCGroup,
  pathData: pathData;
  user?: UserInfo; // User who threw the NPC for border color (optional for fleeing NPCs)
  checkForCollision: (npcGroup: NPCGroup, npcPosition?: THREE.Vector3, isLocalUser?: boolean) => boolean; // Collision checking for fleeing NPCs
  terrainBoundaries?: TerrainBoundaries; // Add terrain boundaries for wrapping
  allPaths?: Map<string, pathData>; // All active paths for NPC-to-NPC collision
  npcGroups: NPCGroupsBiMap; // NPC groups for collision with groups
  users?: Map<string, UserInfo>; // All users for getting group positions
  myUserId: string; // Current user ID
  setPaths?: (
    paths:
      | Map<string, pathData>
      | ((prev: Map<string, pathData>) => Map<string, pathData>)
  ) => void; // Function to update paths
}

const PathNPCGroupGraphic: React.FC<PathNPCGroupGraphicProps> = ({
  npcGroup,
  pathData,
  user,
  checkForCollision,
  npcGroups: _npcGroups,
  users: _users,
  myUserId,
  setPaths: _setPaths,
}) => {
  const { group, positionRef, textureLoaded, updatePositionWithTracking, textInfo } =
    useNPCGroupBase(npcGroup, user, pathData);




  // Set initial position
  useMount(() => {
    updatePositionWithTracking(
      new THREE.Vector3(npcGroup.position.x, npcGroup.position.y, 0),
      "pathPC-initial"
    );
    group.position.copy(positionRef.current);
  });

  // Calculate position for path NPCs
  const calculatePathPosition = (pathData: pathData, currentTime: number) => {
    // Calculate elapsed time in seconds
    const elapsedTime = (currentTime - pathData.timestamp) / 1000;
    const pathDurationSec = pathData.pathDuration / 1000;
    const progress = Math.min(elapsedTime / pathDurationSec, 1);

    let position: THREE.Vector3;

    // If we've reached the end of the path, use exact same calculation as server
    if (progress >= 1) {
      const finalDistance = pathData.velocity * pathDurationSec;
      position = new THREE.Vector3(
        pathData.startPosition.x + pathData.direction.x * finalDistance,
        pathData.startPosition.y + pathData.direction.y * finalDistance,
        0
      );
    } else {
      // For animation, calculate intermediate position
      const distance = pathData.velocity * elapsedTime;
      position = new THREE.Vector3(
        pathData.startPosition.x + pathData.direction.x * distance,
        pathData.startPosition.y + pathData.direction.y * distance,
        0
      );
    }

    return { position, progress };
  };

  



  // Handle position updates
  useFrame(() => {
    if (!group || !textureLoaded.current) return;

    // Safety check: don't calculate path position if NPC phase changed
    if (npcGroup.phase !== NPCPhase.PATH) return;

    const currentTime = Date.now();

    // Calculate current position based on time for path objects
    const { position: pathPosition } = calculatePathPosition(pathData, currentTime);
    updatePositionWithTracking(pathPosition, "pathPC-update");

    group.position.copy(positionRef.current);

    // Check for collision with player (for both thrown and returning NPCs)
    if (npcGroup.captorId && checkForCollision) {
      checkForCollision(npcGroup, pathPosition, user?.id === myUserId);
    }

    // For fleeing NPCs (no captorId), check for collision
    if (!npcGroup.captorId && checkForCollision) {
      checkForCollision(npcGroup, pathPosition);
    }

  });




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

export default React.memo(PathNPCGroupGraphic);
