import React from "react";
import { NPCPhase, pathData, UserInfo, NPCGroup, NPCGroupsBiMap } from "shared/types";
import { NPCInteraction } from "shared/interaction-types";
import * as THREE from "three";
import { TerrainBoundaries } from "../../utils/terrain";
import IdleNPCGroupGraphic from "./IdleNPCGroupGraphic";
import PathNPCGroupGraphic from "./PathNPCGroupGraphic";
import CapturedNPCGroupGraphic from "./CapturedNPCGroupGraphic";
import CloudAnimation from "./CloudAnimation";

interface NPCGraphicWrapperProps {
  npcGroup: NPCGroup;
  checkForCollision: (npcGroup: NPCGroup, npcPosition?: THREE.Vector3, isLocalUser?: boolean) => boolean;
  pathData: pathData | undefined;
  users: Map<string, UserInfo>;
  terrainBoundaries?: TerrainBoundaries;
  allPaths?: Map<string, pathData>; // All active paths for NPC-to-NPC collision
  npcGroups: NPCGroupsBiMap; // NPC groups for collision with groups
  myUserId: string; // Current user ID
  animalDimensions: { [animal: string]: { width: number; height: number } }; // Animal dimensions for scaling
  setPaths?: (
    paths:
      | Map<string, pathData>
      | ((prev: Map<string, pathData>) => Map<string, pathData>)
  ) => void;
  setNpcGroups: (
    npcGroups: NPCGroupsBiMap | ((prev: NPCGroupsBiMap) => NPCGroupsBiMap)
  ) => void;
  throwChargeCount?: number;
  deletingNPCs: Set<string>;
}

const NPCGraphicWrapper = ({
  npcGroup,
  checkForCollision,
  pathData,
  users,
  terrainBoundaries,
  allPaths,
  npcGroups,
  myUserId,
  animalDimensions,
  setPaths,
  setNpcGroups: _setNpcGroups,
  throwChargeCount,
  deletingNPCs,
}: NPCGraphicWrapperProps) => {
  // Check if this NPC is being deleted (show cloud animation)
  const isBeingDeleted = deletingNPCs.has(npcGroup.id);
  
  if (isBeingDeleted) {
    // Show cloud animation at NPC's current position
    const position = new THREE.Vector3(npcGroup.position.x, npcGroup.position.y, npcGroup.position.z || 0);
    return (
      <CloudAnimation
        position={position}
        onComplete={() => {
          // Animation complete - the actual NPC deletion is handled by the socket event listener
        }}
      />
    );
  }

  if (npcGroup.phase === NPCPhase.IDLE) {
    return (
      <IdleNPCGroupGraphic
        key={npcGroup.id}
        npcGroup={npcGroup}
        checkForCollision={checkForCollision}
      />
    );
  } else if (npcGroup.phase === NPCPhase.PATH) {
    if (!pathData) {
      return null;
    }

    const captorUser = npcGroup.captorId
      ? users.get(npcGroup.captorId)
      : undefined;

    return (
      <PathNPCGroupGraphic
        key={npcGroup.id}
        npcGroup={npcGroup}
        pathData={pathData}
        user={captorUser}
        checkForCollision={checkForCollision}
        terrainBoundaries={terrainBoundaries}
        allPaths={allPaths}
        npcGroups={npcGroups}
        users={users}
        myUserId={myUserId}
        setPaths={setPaths}
      />
    );
  }

  else if (npcGroup.phase === NPCPhase.CAPTURED) {
    const captorUser = users.get(npcGroup.captorId!);
    if (!captorUser || !allPaths || !setPaths) {
      return null;
    }

    const animalWidth = animalDimensions[captorUser.animal]?.width;
    return (
      <CapturedNPCGroupGraphic
        key={npcGroup.id}
        group={npcGroup}
        user={captorUser}
        npcGroups={npcGroups}
        allPaths={allPaths}
        setPaths={setPaths}
        setNpcGroups={_setNpcGroups}
        animalWidth={animalWidth}
        isLocalUser={captorUser.id === myUserId}
        terrainBoundaries={terrainBoundaries}
        users={users}
        throwChargeCount={throwChargeCount}
      />
    );
  }

  return null;
};
export default React.memo(NPCGraphicWrapper);
