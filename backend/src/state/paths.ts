import { npcId, pathData, roomId } from "../types";

const paths: Map<roomId, Map<npcId, pathData>> = new Map();

// Path functions - direct Map access, no serialization
export function getpathsfromMemory(room: string): pathData[] {
  try {
    // Get the room's path map directly, or create a new one if it doesn't exist
    const roomPaths = paths.get(room);
    if (!roomPaths) {
      return [];
    }
    // Return array of path values
    return Array.from(roomPaths.values());
  } catch (error) {
    console.error(`Error getting paths for room ${room}:`, error);
    return [];
  }
}

export function getActivepathsfromMemory(
  roomName: string
): pathData[] {
  return getpathsfromMemory(roomName);
}

export function setPathsInMemory(
  roomName: roomId,
  newPaths: pathData[]
): void {
  try {
    // Convert array to Map keyed by npcId
    const pathMap = new Map<npcId, pathData>();
    for (const path of newPaths) {
      pathMap.set(path.npc.id, path);
    }
    // Store paths directly in the Map
    paths.set(roomName, pathMap);
  } catch (error) {
    console.error(`Error setting paths for room ${roomName}:`, error);
    throw error;
  }
}

export function getPathsMapfromMemory(
  room: string
): Map<npcId, pathData>{
  try {
    // Get the room's path map directly, or create a new one if it doesn't exist
    const roomPaths = paths.get(room);
    if (!roomPaths) {
      return new Map();
    }
    // Return a copy to prevent external mutations
    return new Map(roomPaths);
  } catch (error) {
    console.error(`Error getting paths map for room ${room}:`, error);
    return new Map();
  }
}

export function setPathsMapInMemory(
  room: string,
  newPaths: Map<npcId, pathData>
): void{
  try {
    // Store paths directly in the Map - create a copy to prevent external mutations
    paths.set(room, new Map(newPaths));
  } catch (error) {
    console.error(`Error setting paths map for room ${room}:`, error);
    throw error;
  }
}

// Direct Path operations - no read-modify-set needed
export function setPathInMemory(
  roomName: string,
  npcId: npcId,
  pathData: pathData
): void{
  try {
    let roomPaths = paths.get(roomName);
    if (!roomPaths) {
      roomPaths = new Map();
      paths.set(roomName, roomPaths);
    }
    roomPaths.set(npcId, pathData);
  } catch (error) {
    console.error(
      `Error setting path for NPC ${npcId} in room ${roomName}:`,
      error
    );
    throw error;
  }
}

export function deletePathInMemory(
  roomName: string,
  npcId: npcId
): void{
  try {
    const roomPaths = paths.get(roomName);
    if (roomPaths) {
      roomPaths.delete(npcId);
    }
  } catch (error) {
    console.error(
      `Error deleting path for NPC ${npcId} from room ${roomName}:`,
      error
    );
    throw error;
  }
}

export function deletePathsInMemory(roomName: string): void{
  paths.delete(roomName);
}
