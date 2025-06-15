import { UserInfo, TerrainConfig, NPCGroup, pathData, Position, npcGroupId, NPCGroupsBiMap, userId } from "./types";

export interface ServerToClientEvents {
    "user-joined": (data: { user: UserInfo }) => void;
    "user-updated": (data: { user: UserInfo }) => void;
    "user-left": (data: { lastPosition: Position; userId: string }) => void;


    "all-users": (data: { users: Map<userId, UserInfo> }) => void;
    "all-npc-groups": (data: { npcGroups: NPCGroupsBiMap }) => void;
    "all-paths": (data: { paths: Map<npcGroupId, pathData> }) => void;
    "terrain-config": (data: { terrainConfig: TerrainConfig }) => void;

    "npc-group-update": (data: { npcGroup: NPCGroup }) => void;
    "npc-group-captured": (data: { capturedNPCGroupId: npcGroupId; updatedNpcGroup: NPCGroup }) => void;
    "npc-group-pop": (data: { npcGroupId: npcGroupId }) => void;

    "path-update": (data: { pathData: pathData }) => void;
    "path-complete": (data: { npcGroup: NPCGroup }) => void;
  }
  
  export interface ClientToServerEvents {
    "join-room": (data: { name: string }) => void;
    "capture-npc-group": (data: { capturedNPCGroupId: string; room: string; updatedNpcGroup: NPCGroup }) => void;
    "path-npc-group": (data: { pathData: pathData }) => void;
    "update-user": (data: { user: UserInfo }) => void;
    "update-npc-group": (data: { npcGroup: NPCGroup }) => void;
  }