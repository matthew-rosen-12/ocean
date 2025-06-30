import React from "react";
import { UserInfo, NPCGroupsBiMap, pathData } from "shared/types";
import { useBotCollisionDetection } from "../hooks/useBotCollisionDetection";

interface BotCollisionManagerProps {
  myUser: UserInfo | undefined;
  users: Map<string, UserInfo>;
  npcGroups: NPCGroupsBiMap;
  allPaths: Map<string, pathData>;
  setPaths: (
    paths: Map<string, pathData> | ((prev: Map<string, pathData>) => Map<string, pathData>)
  ) => void;
  setNpcGroups: (
    npcGroups: NPCGroupsBiMap | ((prev: NPCGroupsBiMap) => NPCGroupsBiMap)
  ) => void;
  animalDimensions: { [animal: string]: { width: number; height: number } };
}

// This component needs to be inside the Canvas to use useFrame
const BotCollisionManager: React.FC<BotCollisionManagerProps> = ({
  myUser,
  users,
  npcGroups,
  allPaths,
  setPaths,
  setNpcGroups,
  animalDimensions,
}) => {
  // Use bot collision detection hook
  useBotCollisionDetection({
    myUser,
    users,
    npcGroups,
    allPaths,
    setPaths,
    setNpcGroups,
    animalDimensions,
  });

  // This component doesn't render anything, it just handles collision detection
  return null;
};

export default BotCollisionManager;