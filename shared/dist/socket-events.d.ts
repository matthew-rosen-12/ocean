import { UserInfo, TerrainConfig, NPCGroup, pathData, Position, npcGroupId, NPCGroupsBiMap, userId, FinalScores } from "./types";
export interface ServerToClientEvents {
    "user-joined": (data: {
        user: UserInfo;
    }) => void;
    "user-updated": (data: {
        user: UserInfo;
    }) => void;
    "user-left": (data: {
        lastPosition: Position;
        userId: string;
    }) => void;
    "all-users": (data: {
        users: Map<userId, UserInfo>;
    }) => void;
    "all-npc-groups": (data: {
        npcGroups: NPCGroupsBiMap;
    }) => void;
    "all-paths": (data: {
        paths: Map<npcGroupId, pathData>;
    }) => void;
    "terrain-config": (data: {
        terrainConfig: TerrainConfig;
    }) => void;
    "game-timer-info": (data: {
        gameStartTime: number;
        gameDuration: number;
    }) => void;
    "npc-group-update": (data: {
        npcGroup: NPCGroup;
    }) => void;
    "path-update": (data: {
        pathData: pathData;
    }) => void;
    "path-complete": (data: {
        npcGroup: NPCGroup;
    }) => void;
    "path-deleted": (data: {
        pathData: pathData;
    }) => void;
    "npc-group-deleted": (data: {
        npcGroupId: npcGroupId;
        currentPosition: {
            x: number;
            y: number;
            z: number;
        };
    }) => void;
    "npc-group-spawned": (data: {
        npcGroup: NPCGroup;
        spawnPosition: {
            x: number;
            y: number;
            z: number;
        };
    }) => void;
    "times-up": (data: {
        finalScores: FinalScores;
    }) => void;
}
export interface ClientToServerEvents {
    "join-room": (data: {
        name: string;
    }) => void;
    "update-path": (data: {
        pathData: pathData;
    }) => void;
    "delete-path": (data: {
        pathData: pathData;
    }) => void;
    "update-user": (data: {
        user: UserInfo;
    }) => void;
    "update-npc-group": (data: {
        npcGroup: NPCGroup;
    }) => void;
}
