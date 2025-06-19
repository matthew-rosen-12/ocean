export type Animal = "DOLPHIN" | "WOLF";
export declare enum PathPhase {
    THROWN = "THROWN",// NPCs thrown by players
    FLEEING = "FLEEING",// NPCs fleeing from players
    BOUNCING = "BOUNCING",// NPCs bouncing off each other
    RETURNING = "RETURNING"
}
export interface pathData {
    id: string;
    room: string;
    npcGroup: NPCGroup;
    startPosition: Position;
    direction: Direction;
    velocity: number;
    pathDuration: number;
    timestamp: number;
    pathPhase: PathPhase;
}
export interface UserInfo {
    id: userId;
    animal: Animal;
    room: string;
    position: Position;
    direction: Direction;
    npcGroup: NPCGroup;
    nickname: string;
}
export declare enum NPCPhase {
    IDLE = "IDLE",
    CAPTURED = "CAPTURED",
    PATH = "PATH"
}
export type fileName = string;
export type npcGroupId = string;
export declare class NPCGroup {
    id: npcGroupId;
    fileNames: fileName[];
    captorId?: userId;
    position: Position;
    direction: Direction;
    phase: NPCPhase;
    constructor(data: {
        id: npcGroupId;
        fileNames: fileName[];
        captorId?: userId;
        position: Position;
        direction: Direction;
        phase: NPCPhase;
    });
    get faceFileName(): fileName | undefined;
}
export type userId = string;
export type socketId = string;
export declare class DefaultMap<K, V> extends Map<K, V> {
    private defaultFactory;
    constructor(defaultFactory: (key: K) => V);
    get(key: K): V;
}
export type roomId = string;
export declare class NPCGroupsBiMap {
    private map1;
    private map2;
    constructor(existing?: NPCGroupsBiMap);
    setByUserId(userId: userId, npcGroup: NPCGroup): void;
    setByNpcGroupId(npcGroupId: npcGroupId, npcGroup: NPCGroup): void;
    deleteByUserId(userId: userId): void;
    deleteByNpcGroupId(npcGroupId: npcGroupId): void;
    values(): NPCGroup[];
    getByUserId(userId: userId): NPCGroup | undefined;
    getByNpcGroupId(npcGroupId: npcGroupId): NPCGroup | undefined;
}
export interface Direction {
    x: number;
    y: number;
}
export interface Member {
    id: string;
    info: UserInfo;
}
export interface TerrainConfig {
    boundaries: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        width: number;
        height: number;
    };
    gridSize: number;
    walls: null;
    backgroundType: string;
    seed: number;
    width: number;
    height: number;
    cellSize: number;
    startTime?: number;
    duration?: number;
}
export interface FinalScores {
    [userId: string]: number;
}
export interface Position {
    x: number;
    y: number;
    z?: number;
}
