import React from "react";
import { NPCPhase, pathData, UserInfo, NPCGroup, NPCGroupsBiMap } from "shared/types";
import IdleNPCGraphic from "./IdleNPCGroupGraphic";
import PathNPCGraphic from "./PathNPCGroupGraphic";
import * as THREE from "three";
import { TerrainBoundaries } from "../../utils/terrain";
import IdleNPCGroupGraphic from "./IdleNPCGroupGraphic";
import PathNPCGroupGraphic from "./PathNPCGroupGraphic";

interface NPCGraphicWrapperProps {
  npcGroup: NPCGroup;
  checkForCollision: (npcGroup: NPCGroup, npcPosition?: THREE.Vector3, isLocalUser?: boolean) => boolean;
  pathData: pathData | undefined;
  users: Map<string, UserInfo>;
  terrainBoundaries?: TerrainBoundaries;
  allPaths?: Map<string, pathData>; // All active paths for NPC-to-NPC collision
  npcGroups: NPCGroupsBiMap; // NPC groups for collision with groups
  myUserId: string; // Current user ID
  setPaths?: (
    paths:
      | Map<string, pathData>
      | ((prev: Map<string, pathData>) => Map<string, pathData>)
  ) => void;
  setNpcGroups: (
    npcGroups: NPCGroupsBiMap | ((prev: NPCGroupsBiMap) => NPCGroupsBiMap)
  ) => void;
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
  setPaths,
  setNpcGroups,
}: NPCGraphicWrapperProps) => {
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
        setNpcGroups={setNpcGroups}
      />
    );
  }

  return null;
};
export default React.memo(NPCGraphicWrapper);
