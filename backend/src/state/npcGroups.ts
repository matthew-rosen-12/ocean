import { NPCGroup, roomId, userId, npcId } from "../types";

const npcGroups: Map<roomId, Map<userId, NPCGroup>> = new Map();

export function getNPCGroupsfromMemory(
    roomName: string
  ): Map<userId, NPCGroup> {
    try {
      // Get the room's NPC group map directly, or create a new one if it doesn't exist
      const roomGroups = npcGroups.get(roomName);
      if (!roomGroups) {
        return new Map();
      }
      // Return a copy to prevent external mutations
      return new Map(roomGroups);
    } catch (error) {
      console.error(`Error getting NPC groups for room ${roomName}:`, error);
      return new Map();
    }
  }
  
  export function setNPCGroupsInMemory(
    room: string,
    groups: Map<userId, NPCGroup>
  ): void {
    try {
      // Store groups directly in the Map - create a copy to prevent external mutations
      npcGroups.set(room, new Map(groups));
    } catch (error) {
      console.error(`Error setting NPC groups for room ${room}:`, error);
      throw error;
    }
  }
  
  // Direct Group operations - no read-modify-set needed
  export function addNPCToGroupInMemory(
    roomName: string,
    captorId: userId,
    npcId: npcId
  ): void {
    try {
      let roomGroups = npcGroups.get(roomName);
      if (!roomGroups) {
        roomGroups = new Map();
        npcGroups.set(roomName, roomGroups);
      }
  
      let group = roomGroups.get(captorId);
      if (!group) {
        group = {
          npcIds: new Set(),
          captorId,
          faceNpcId: npcId, // Set the first NPC as the face NPC
        };
        roomGroups.set(captorId, group);
      }
  
      group.npcIds.add(npcId);
  
      // If no face NPC is set or the face NPC is no longer in the group, set this one as face
      if (!group.faceNpcId || !group.npcIds.has(group.faceNpcId)) {
        group.faceNpcId = npcId;
      }
    } catch (error) {
      console.error(
        `Error adding NPC ${npcId} to group ${captorId} in room ${roomName}:`,
        error
      );
      throw error;
    }
  }
  
  export function removeNPCFromGroupInRoomInMemory(
    roomName: string,
    captorId: userId,
    npcId: npcId
  ): void {
    try {
      let roomGroups = npcGroups.get(roomName);
      if (!roomGroups) {
        return; // No groups in this room
      }
  
      const group = roomGroups.get(captorId);
      if (!group) {
        return; // No group for this captor
      }
  
      group.npcIds.delete(npcId);
  
      // If the removed NPC was the face NPC, select a new one
      if (group.faceNpcId === npcId) {
        const remainingNpcs = Array.from(group.npcIds);
        group.faceNpcId = remainingNpcs.length > 0 ? remainingNpcs[0] : undefined;
      }
  
      // If group is now empty, remove it entirely
      if (group.npcIds.size === 0) {
        roomGroups.delete(captorId);
      }
    } catch (error) {
      console.error(
        `Error removing NPC ${npcId} from group ${captorId} in room ${roomName}:`,
        error
      );
      throw error;
    }
  }
  
  export function removeNPCGroupInRoomInMemory(
    roomName: string,
    captorId: userId
  ): void {
    try {
      const roomGroups = npcGroups.get(roomName);
      if (!roomGroups) return;
  
      roomGroups.delete(captorId);
    } catch (error) {
      console.error(`Error removing NPC group in room ${roomName}:`, error);
      throw error;
    }
  }


  export function deleteNPCGroupsInMemory(roomName: string): void {
    npcGroups.delete(roomName);
  }