import { NPCGroup, npcGroupId, pathData, UserInfo, NPCGroupsBiMap, NPCPhase, PathPhase } from "shared/types";
import { v4 as uuidv4 } from "uuid";
import { typedSocket } from "../socket";
import { calculateNPCGroupVelocityFactor, calculateNPCGroupDistanceFactor } from "./npc-group-utils";

export async function pathNPCGroup(
  myUser: UserInfo,
  npcGroup: NPCGroup,
  paths: Map<npcGroupId, pathData>,
  setPaths: (paths: Map<npcGroupId, pathData>) => void,
  setNpcGroups: (
    value: NPCGroupsBiMap | ((prev: NPCGroupsBiMap) => NPCGroupsBiMap)
  ) => void,
  throwCount: number = 1,
) {
  try {
    // Calculate how many NPCs to throw (limited by available NPCs)
    const actualThrowCount = Math.min(throwCount, npcGroup.fileNames.length);
    
    // Create new objects instead of mutating
    const captorNPCGroup = new NPCGroup({
      ...npcGroup,
      fileNames: npcGroup.fileNames.slice(0, -actualThrowCount),
    });
    const pathNPCGroup = new NPCGroup({
      ...npcGroup,
      id: uuidv4(),
      fileNames: npcGroup.fileNames.slice(-actualThrowCount),
      phase: NPCPhase.PATH,
    });

    // Calculate velocity and distance based on group size
    const baseVelocity = 20;
    const baseDuration = 2000;
    
    const velocityFactor = calculateNPCGroupVelocityFactor(actualThrowCount);
    const distanceFactor = calculateNPCGroupDistanceFactor(actualThrowCount);
    
    // Higher velocity and longer duration for larger groups
    const scaledVelocity = baseVelocity * velocityFactor;
    const scaledDuration = baseDuration * distanceFactor;

    // Create new path data
    const newpathData: pathData = {
      id: uuidv4(),
      room: myUser.room,
      npcGroupId: pathNPCGroup.id,
      startPosition: {
        x: myUser.position.x,
        y: myUser.position.y,
      },
      pathDuration: scaledDuration,
      timestamp: Date.now(),
      direction: {
        x: Math.round(myUser.direction.x),
        y: Math.round(myUser.direction.y),
      },
      velocity: scaledVelocity,
      pathPhase: PathPhase.THROWN, // This is a thrown NPC
    };

    // Create new paths map
    const updatedpaths = new Map(paths);
    updatedpaths.set(pathNPCGroup.id, newpathData);

    // Socket call to path the NPC
    const currentTypedSocket = typedSocket();
    currentTypedSocket.emit("update-npc-group", { npcGroup: captorNPCGroup });
    currentTypedSocket.emit("update-npc-group", { npcGroup: pathNPCGroup });
    currentTypedSocket.emit("update-path", { pathData: newpathData });
    // Always send the update - server will handle deletion if empty

    setPaths(updatedpaths);
    setNpcGroups((prev) => {
      const newNpcGroups = new NPCGroupsBiMap(prev);
      newNpcGroups.setByNpcGroupId(captorNPCGroup.id, captorNPCGroup);
      newNpcGroups.setByNpcGroupId(pathNPCGroup.id, pathNPCGroup);
      return newNpcGroups;
    });
  } catch {
    // Error pathing NPC
  }
}