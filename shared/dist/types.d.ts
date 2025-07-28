import { BackgroundString } from './background-types.js';

declare enum Animal {
    DOLPHIN = "DOLPHIN",
    WOLF = "WOLF",
    PENGUIN = "PENGUIN",
    SNAKE = "SNAKE",
    TURTLE = "TURTLE",
    TIGER = "TIGER",
    TUNA = "TUNA",
    EAGLE = "EAGLE",
    BEE = "BEE",
    BEAR = "BEAR",
    CUTTLEFISH = "CUTTLEFISH",
    SALAMANDER = "SALAMANDER"
}
declare const ANIMAL_SCALES: {
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
declare const ANIMAL_ORIENTATION: {
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
declare const DIRECTION_OFFSET = 0.1;
declare const BACKEND_DIRECTION_OFFSET = 0.001;
declare const NPC_WIDTH = 4;
declare const NPC_HEIGHT = 4;
declare enum PathPhase {
    THROWN = "THROWN",// NPCs thrown by players
    RETURNING = "RETURNING",// NPCs returning to their thrower
    FLEEING = "FLEEING"
}
interface pathData {
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
interface UserInfo {
    id: userId;
    animal: Animal;
    room: string;
    position: Position;
    direction: Direction;
    nickname: string;
    isBot?: boolean;
}
declare enum NPCPhase {
    IDLE = "IDLE",
    CAPTURED = "CAPTURED",
    PATH = "PATH"
}
type fileName = string;
type npcGroupId = string;
declare class NPCGroup {
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
type userId = string;
type socketId = string;
declare class DefaultMap<K, V> extends Map<K, V> {
    private defaultFactory;
    constructor(defaultFactory: (key: K) => V);
    get(key: K): V;
}
type roomId = string;
declare class NPCGroupsBiMap {
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
    get cumulativeSize(): number;
    getByUserId(userId: userId): NPCGroup | undefined;
    getByNpcGroupId(npcGroupId: npcGroupId): NPCGroup | undefined;
}
interface Direction {
    x: number;
    y: number;
}
interface Member {
    id: string;
    info: UserInfo;
}
interface TerrainConfig {
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
    backgroundType: BackgroundString;
    seed: number;
    width: number;
    height: number;
    cellSize: number;
    startTime?: number;
    duration?: number;
}
interface FinalScores {
    [userId: string]: number;
}
interface Position {
    x: number;
    y: number;
    z?: number;
}

export { ANIMAL_ORIENTATION, ANIMAL_SCALES, Animal, BACKEND_DIRECTION_OFFSET, DIRECTION_OFFSET, DefaultMap, type Direction, type FinalScores, type Member, NPCGroup, NPCGroupsBiMap, NPCPhase, NPC_HEIGHT, NPC_WIDTH, PathPhase, type Position, type TerrainConfig, type UserInfo, type fileName, type npcGroupId, type pathData, type roomId, type socketId, type userId };
