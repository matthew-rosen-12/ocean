import { DefaultMap, npcGroupId, pathData, roomId } from "shared/types";

const paths: DefaultMap<roomId, Map<npcGroupId, pathData>> = new DefaultMap(() => new Map());

// Path functions - direct Map access, no serialization
export function getpathsfromMemory(room: string): Map<npcGroupId, pathData> {
   return paths.get(room);
}

export  function setPathsInMemory(
  roomName: roomId,
  newPaths: Map<npcGroupId, pathData>
): void {
    paths.set(roomName, newPaths);
}


// Direct Path operations - no read-modify-set needed

export async function deletePathInMemory(
  roomName: string,
  npcGroupId: npcGroupId
): Promise<void> {
    const roomPaths = paths.get(roomName);
    if (roomPaths) {
      roomPaths.delete(npcGroupId);
    }
}

