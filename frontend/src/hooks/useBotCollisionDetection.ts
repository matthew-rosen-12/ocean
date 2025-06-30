import { UserInfo, NPCGroupsBiMap, pathData, PathPhase } from "shared/types";
import { useFrame } from "@react-three/fiber";
import { getAssignedBots, checkForPathNPCCollisionForUser } from "../utils/collision-utils";

interface UseBotCollisionDetectionProps {
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

export function useBotCollisionDetection({
  myUser,
  users,
  npcGroups,
  allPaths,
  setPaths,
  setNpcGroups,
  animalDimensions,
}: UseBotCollisionDetectionProps) {

  useFrame(() => {
    if (!myUser) return;

    // Get bots assigned to this local user for collision detection
    const assignedBots = getAssignedBots(myUser.id, users);
    const usersToCheck = assignedBots; // Only check bots, not the local user (handled elsewhere)
    
    usersToCheck.forEach(userToCheck => {
      const animalWidth = animalDimensions[userToCheck.animal]?.width;
      if (!animalWidth) return;

      // Find captured NPC groups for this user (or bot)
      const capturedGroups = Array.from(npcGroups.values()).filter(
        npcGroup => npcGroup.captorId === userToCheck.id && npcGroup.fileNames.length > 0
      );
      
      capturedGroups.forEach(capturedGroup => {
        Array.from(allPaths.entries()).forEach(([_npcId, pathData]) => {
          // Get the NPC group from the groups map using the ID
          const pathNPCGroup = npcGroups.getByNpcGroupId(pathData.npcGroupId);
          if (
            (pathData.pathPhase === PathPhase.THROWN || pathData.pathPhase === PathPhase.RETURNING) &&
            pathNPCGroup &&
            pathNPCGroup.captorId !== capturedGroup.captorId
          ) {
            // For assigned bots, we need to use their position data instead of the local user's
            checkForPathNPCCollisionForUser(pathNPCGroup, pathData, capturedGroup, userToCheck, animalWidth, setPaths, setNpcGroups);
          }
        });
      });
    });
  });
}