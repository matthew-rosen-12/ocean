import { NPCGroup, pathData, roomId } from "shared/types";
import { getpathsfromMemory, setPathsInMemory } from "../state/paths";

export function deletePathInRoom(room: string, pathData: pathData) {
    const roomPaths = getpathsfromMemory(room);
    roomPaths.delete(pathData.npcGroupId);
    setPathsInMemory(room, roomPaths);
}

export function getPathPosition(npcGroup: NPCGroup, room: roomId) {
    const paths = getpathsfromMemory(room)
    const pathData = paths.get(npcGroup.id);
    
    if (!pathData) {
        // Return the NPC's current position if no path exists
        return npcGroup.position;
    }
    
    // Calculate current position along path with progress clamping
    const now = Date.now();
    const elapsedTime = (now - pathData.timestamp); // seconds
    const distance = pathData.velocity * elapsedTime;
    
    return {
        x: pathData.startPosition.x + pathData.direction.x * distance,
        y: pathData.startPosition.y + pathData.direction.y * distance,
        z: 0
    };

}