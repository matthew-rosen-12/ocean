import React from "react";
import { NPC, NPCPhase, pathData, UserInfo, npcId } from "../../utils/types";
import IdleNPCGraphic from "./IdleNPCGraphic";
import PathNPCGraphic from "./PathNPCGraphic";
import * as THREE from "three";
import { TerrainBoundaries } from "../../utils/terrain";

interface NPCGraphicWrapperProps {
  npc: NPC;
  checkForCollision: (npc: NPC, npcPosition?: THREE.Vector3) => void;
  pathData: pathData | undefined;
  users: Map<string, UserInfo>;
  terrainBoundaries?: TerrainBoundaries;
}

const NPCGraphicWrapper = ({
  npc,
  checkForCollision,
  pathData,
  users,
  terrainBoundaries,
}: NPCGraphicWrapperProps) => {
  if (npc.phase === NPCPhase.IDLE) {
    return (
      <IdleNPCGraphic
        key={npc.id}
        npc={npc}
        checkForCollision={checkForCollision}
      />
    );
  } else if (npc.phase === NPCPhase.path) {
    if (!pathData) {
      return null;
    }

    const captorUser = pathData.captorId
      ? users.get(pathData.captorId)
      : undefined;

    return (
      <PathNPCGraphic
        key={npc.id}
        npc={npc}
        pathData={pathData}
        user={captorUser}
        checkForCollision={checkForCollision}
        terrainBoundaries={terrainBoundaries}
      />
    );
  }

  return null;
};
export default React.memo(NPCGraphicWrapper);
