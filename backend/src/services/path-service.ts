import { pathData } from "shared/types";
import { getpathsfromMemory, setPathsInMemory } from "../state/paths";

export function deletePathInRoom(room: string, pathData: pathData) {
    const roomPaths = getpathsfromMemory(room);
    roomPaths.delete(pathData.npcGroupId);
    setPathsInMemory(room, roomPaths);
}