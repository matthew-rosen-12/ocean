export declare enum Animal {
    SALAMANDER = "SALAMANDER"
}
export declare const ANIMAL_SCALES: {
    DOLPHIN: number;
    WOLF: number;
    PENGUIN: number;
    SNAKE: number;
    TURTLE: number;
    TIGER: number;
    TUNA: number;
    EAGLE: number;
    BEE: number;
    BEAR: number;
    CUTTLEFISH: number;
    SALAMANDER: number;
};
export declare const ANIMAL_ORIENTATION: {
    WOLF: {
        rotation: number;
        flipY: boolean;
    };
    DOLPHIN: {
        rotation: number;
        flipY: boolean;
    };
    PENGUIN: {
        rotation: number;
        flipY: boolean;
    };
    SNAKE: {
        rotation: number;
        flipY: boolean;
    };
    TURTLE: {
        rotation: number;
        flipY: boolean;
    };
    TIGER: {
        rotation: number;
        flipY: boolean;
    };
    TUNA: {
        rotation: number;
        flipY: boolean;
    };
    EAGLE: {
        rotation: number;
        flipY: boolean;
    };
    BEE: {
        rotation: number;
        flipY: boolean;
    };
    BEAR: {
        rotation: number;
        flipY: boolean;
    };
    CUTTLEFISH: {
        rotation: number;
        flipY: boolean;
    };
    SALAMANDER: {
        rotation: number;
        flipY: boolean;
    };
};
export declare const DIRECTION_OFFSET = 0.1;
export declare const BACKEND_DIRECTION_OFFSET = 0.001;
export declare const NPC_WIDTH = 4;
export declare const NPC_HEIGHT = 4;
export declare enum PathPhase {
    THROWN = "THROWN",// NPCs thrown by players
    FLEEING = "FLEEING",// NPCs fleeing from players
    RETURNING = "RETURNING"
}
export interface pathData {
    id: string;
    room: string;
    npcGroupId: npcGroupId;
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
    keys(): npcGroupId[];
    get size(): number;
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
