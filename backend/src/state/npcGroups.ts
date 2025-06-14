import { NPCGroup, roomId, userId, NPCGroupsBiMap } from "shared/types";

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

  function mergedNPCGroups(group1: NPCGroup, group2: NPCGroup): NPCGroup {
    return {
      ...group1,
      fileNames: [...group1.fileNames, ...group2.fileNames],
    };
  }
  
  // Direct Group operations - no read-modify-set needed
  export function addNPCGroupToCaptorNPCGroupInMemory(
    roomName: string,
    captorId: userId,
    npcGroup: NPCGroup
  ): void {
    let roomGroups = npcGroups.get(roomName);
    if (!roomGroups) {
        roomGroups = new NPCGroupsBiMap();
        npcGroups.set(roomName, roomGroups);
    }
  
    let captorNPCGroup = roomGroups.getByUserId(captorId)
    if (!captorNPCGroup) {
        captorNPCGroup = {
            ...npcGroup,
            captorId,
        };
    }
    
    roomGroups.setByUserId(captorId, mergedNPCGroups(captorNPCGroup, npcGroup));
  }
  
  export function removeTopNPCFromGroupInRoomInMemory(
    roomName: string,
    captorId: userId,
  ): void {
      let roomGroups = npcGroups.get(roomName);
      if (!roomGroups) {
        return; // No groups in this room
      }
  
      const group = roomGroups.getByUserId(captorId);
      if (!group) {
        return; // No group for this captor
      }
  
      group.fileNames.pop();

      if (group.fileNames.length === 0) {
        roomGroups.deleteByUserId(captorId);
        return
      }
  
      // If the removed NPC was the face NPC, select a new one
      group.faceFileName = group.fileNames[group.fileNames.length - 1];
  
  }
  
  export function removeNPCGroupInRoomInMemory(
    roomName: string,
    captorId: userId
  ): void {
    const roomGroups = npcGroups.get(roomName);
    if (!roomGroups) return;

    roomGroups.deleteByUserId(captorId);
  }


  export function deleteNPCGroupsInMemory(roomName: string): void {
    npcGroups.delete(roomName);
  }

  export function updateNPCGroupInRoomInMemory(roomName: roomId, npcGroup: NPCGroup): void {
    const roomGroups = npcGroups.get(roomName) || new NPCGroupsBiMap();
    roomGroups.setByNpcGroupId(npcGroup.id, npcGroup);
    npcGroups.set(roomName, roomGroups);
  }