import React from "react";
import { NPCPhase, pathData, UserInfo, NPCGroup, NPCGroupsBiMap, ANIMAL_SCALES } from "shared/types";
import { getAnimalDimensions } from "shared/animal-dimensions";
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

    // Get animal width from dimensions, or calculate fallback if not loaded yet
    let animalWidth = animalDimensions[captorUser.animal]?.width;
    if (!animalWidth) {
      // Calculate fallback dimensions using shared module
      const animalScale = ANIMAL_SCALES[captorUser.animal as keyof typeof ANIMAL_SCALES] || 1.0;
      const fallbackDimensions = getAnimalDimensions(captorUser.animal, animalScale);
      animalWidth = fallbackDimensions.width;
    }
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
        myUserId={myUserId}
      />
    );
  }

  return null;
};
export default React.memo(NPCGraphicWrapper, (prevProps, nextProps) => {
  // Quick primitive checks first (fastest)
  if (prevProps.npcGroup.id !== nextProps.npcGroup.id) return false;
  if (prevProps.npcGroup.phase !== nextProps.npcGroup.phase) return false;
  if (prevProps.npcGroup.captorId !== nextProps.npcGroup.captorId) return false;
  if (prevProps.myUserId !== nextProps.myUserId) return false;
  if (prevProps.throwChargeCount !== nextProps.throwChargeCount) return false;
  
  // Check if NPC is being deleted (common change)
  if (prevProps.deletingNPCs.has(prevProps.npcGroup.id) !== nextProps.deletingNPCs.has(nextProps.npcGroup.id)) return false;
  
  // PathData comparison (important for rendering different graphics)
  const prevHasPath = !!prevProps.pathData;
  const nextHasPath = !!nextProps.pathData;
  if (prevHasPath !== nextHasPath) return false;
  
  if (prevHasPath && nextHasPath) {
    if (prevProps.pathData!.id !== nextProps.pathData!.id ||
        prevProps.pathData!.timestamp !== nextProps.pathData!.timestamp ||
        prevProps.pathData!.pathPhase !== nextProps.pathData!.pathPhase) return false;
  }
  
  // NPC group fileNames comparison (affects graphics)
  if (prevProps.npcGroup.fileNames.length !== nextProps.npcGroup.fileNames.length) return false;
  for (let i = 0; i < prevProps.npcGroup.fileNames.length; i++) {
    if (prevProps.npcGroup.fileNames[i] !== nextProps.npcGroup.fileNames[i]) return false;
  }
  
  // Users Map comparison only for captured NPCs (need user info)
  if (prevProps.npcGroup.phase === NPCPhase.CAPTURED) {
    const prevUser = prevProps.users.get(prevProps.npcGroup.captorId!);
    const nextUser = nextProps.users.get(nextProps.npcGroup.captorId!);
    
    if (!prevUser !== !nextUser) return false;
    if (prevUser && nextUser) {
      if (prevUser.position.x !== nextUser.position.x ||
          prevUser.position.y !== nextUser.position.y ||
          prevUser.direction.x !== nextUser.direction.x ||
          prevUser.direction.y !== nextUser.direction.y) return false;
    }
  }
  
  return true;
});
