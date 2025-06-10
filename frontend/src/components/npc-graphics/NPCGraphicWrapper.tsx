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
  allNPCs: Map<string, NPC>; // All NPCs for collision checking
  allPaths?: Map<string, pathData>; // All active paths for NPC-to-NPC collision
  npcGroups?: Map<string, any>; // NPC groups for collision with groups
  myUserId: string; // Current user ID
  setPaths?: (
    paths:
      | Map<string, pathData>
      | ((prev: Map<string, pathData>) => Map<string, pathData>)
  ) => void;
  setNpcs?: (
    npcs: Map<string, NPC> | ((prev: Map<string, NPC>) => Map<string, NPC>)
  ) => void;
}

const NPCGraphicWrapper = ({
  npc,
  checkForCollision,
  pathData,
  users,
  terrainBoundaries,
  allNPCs,
  allPaths,
  npcGroups,
  myUserId,
  setPaths,
  setNpcs,
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
        allNPCs={allNPCs}
        allPaths={allPaths}
        npcGroups={npcGroups}
        users={users}
        myUserId={myUserId}
        setPaths={setPaths}
        setNpcs={setNpcs}
      />
    );
  }

  return null;
};
export default React.memo(NPCGraphicWrapper);
