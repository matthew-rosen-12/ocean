import { NPCGroup, roomId, userId, NPCGroupsBiMap, NPCPhase } from "shared/types";

const npcGroups: Map<roomId, NPCGroupsBiMap> = new Map();

export function getNPCGroupsfromMemory(
    roomName: string
  ): NPCGroupsBiMap {

      const roomGroups = npcGroups.get(roomName);
      if (!roomGroups) {
        return new NPCGroupsBiMap();
      }
      // Return a copy to prevent external mutations
      return roomGroups
  }
  
  export function setNPCGroupsInMemory(
    room: string,
    groups: NPCGroupsBiMap
  ): void {
    npcGroups.set(room, groups);
  }

  
  // Direct Group operations - no read-modify-set needed
  
  export function removeNPCGroupInRoomInMemory(
    roomName: string,
    captorId: userId
  ): void {
    const roomGroups = npcGroups.get(roomName);
    if (!roomGroups) return;

    roomGroups.deleteByUserId(captorId);
  }



  export function updateNPCGroupInRoomInMemory(roomName: roomId, npcGroup: NPCGroup): void {
    const roomGroups = npcGroups.get(roomName) || new NPCGroupsBiMap();
    if (npcGroup.fileNames.length == 0) {
      roomGroups.deleteByNpcGroupId(npcGroup.id);
    }
    else {
      roomGroups.setByNpcGroupId(npcGroup.id, npcGroup);
    }
    npcGroups.set(roomName, roomGroups);
  }