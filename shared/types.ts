export enum Animal {
  // DOLPHIN = "DOLPHIN",
  // WOLF = "WOLF", 
  // PENGUIN = "PENGUIN",
  // SNAKE = "SNAKE",
  // TURTLE = "TURTLE",
  // TIGER = "TIGER",
  // TUNA = "TUNA",
  // EAGLE = "EAGLE",
  // BEE = "BEE",
  // BEAR = "BEAR",
  // CUTTLEFISH = "CUTTLEFISH",
  SALAMANDER = "SALAMANDER",
}


export const ANIMAL_SCALES = {
  DOLPHIN: 3.0,
  WOLF: 1.0,
  PENGUIN: 2.5,
  SNAKE: 2.0,
  TURTLE: 2.0,
  TIGER: 4.0,
  TUNA: 3.0,
  EAGLE: 2.5,
  BEE: 2.0,
  BEAR: 2.5,
  CUTTLEFISH: 2.0,
  SALAMANDER: 2.5,
};

export const ANIMAL_ORIENTATION = {
  WOLF: { rotation: 0, flipY: true },
  DOLPHIN: { rotation: 0, flipY: false },
  PENGUIN: { rotation: 0, flipY: false },
  SNAKE: { rotation: 0, flipY: true },
  TURTLE: { rotation: 0, flipY: true },
  TIGER: { rotation: 0, flipY: false },
  TUNA: { rotation: 0, flipY: false},
  EAGLE: { rotation: 0, flipY: false},
  BEE: { rotation: 0, flipY: true},
  BEAR: { rotation: 0, flipY: false},
  CUTTLEFISH: { rotation: 0, flipY: true},
  SALAMANDER: { rotation: 0, flipY: false},
};

export const DIRECTION_OFFSET = 0.1;
export const BACKEND_DIRECTION_OFFSET = 0.001;

// NPC group dimensions
export const NPC_WIDTH = 4;
export const NPC_HEIGHT = 4;

// Path phases for different types of movement
export enum PathPhase {
  THROWN = "THROWN", // NPCs thrown by players (includes returning to thrower)
  FLEEING = "FLEEING", // NPCs fleeing from players
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
  pathPhase: PathPhase; // New field to distinguish path types
}

export interface UserInfo {
  id: userId;
  animal: Animal;
  room: string;
  position: Position;
  direction: Direction;
  nickname: string;
}

export enum NPCPhase {
  IDLE = "IDLE",
  CAPTURED = "CAPTURED",
  PATH = "PATH",
}

export type fileName = string;

export type npcGroupId = string;
export class NPCGroup {
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
  }) {
    this.id = data.id;
    this.fileNames = data.fileNames;
    this.captorId = data.captorId;
    this.position = data.position;
    this.direction = data.direction;
    this.phase = data.phase;
  }

  get faceFileName(): fileName | undefined {
    return this.fileNames.length > 0 ? this.fileNames[this.fileNames.length - 1] : undefined;
  }
}

export type userId = string;
export type socketId = string;

export class DefaultMap<K, V> extends Map<K, V> {
  constructor(private defaultFactory: (key: K) => V) {
    super();
  }

  get(key: K): V {
    if (!this.has(key)) {
      this.set(key, this.defaultFactory(key));
    }
    return super.get(key)!;
  }
}

export type roomId = string;

export class NPCGroupsBiMap {
  private map1 = new Map<userId, NPCGroup>();
  private map2 = new Map<npcGroupId, NPCGroup>();

  constructor(existing?: NPCGroupsBiMap) {
    if (existing) {
      // Check if existing is a proper NPCGroupsBiMap instance
      if (existing instanceof NPCGroupsBiMap && typeof existing.values === 'function') {
        // OPTIMIZED: Direct map copying for performance
        this.map1 = new Map(existing.map1);
        this.map2 = new Map(existing.map2);
      } else if (existing && typeof existing === 'object') {
        // Handle case where existing is a plain object (from deserialization)
        const existingAny = existing as any;
        
        // Try to access the internal map2 data
        if (existingAny.map2) {
          const map2Data = existingAny.map2;
          
          // Handle different serialization formats
          if (Array.isArray(map2Data)) {
            // Map serialized as array of [key, value] pairs
            map2Data.forEach(([key, value]: [string, any]) => {
              this.setByNpcGroupId(key, value);
            });
          } else if (map2Data instanceof Map) {
            // Map is still a Map
            map2Data.forEach((value, key) => {
              this.setByNpcGroupId(key, value);
            });
          } else if (typeof map2Data === 'object') {
            // Map serialized as plain object
            Object.entries(map2Data).forEach(([key, value]) => {
              this.setByNpcGroupId(key, value as any);
            });
          }
        }
      }
    }
  }

  setByUserId(userId: userId, npcGroup: NPCGroup) {
    // Only set in map1 if it's a CAPTURED group
    if (npcGroup.fileNames.length == 0) {
      this.deleteByUserId(userId);
      return;
    }
    if (npcGroup.phase === NPCPhase.CAPTURED) {
      this.map1.set(userId, npcGroup);
    }
    this.map2.set(npcGroup.id, npcGroup);
  }

  setByNpcGroupId(npcGroupId: npcGroupId, npcGroup: NPCGroup) {
    if (npcGroup.fileNames.length == 0) {
      this.deleteByNpcGroupId(npcGroupId);
      return;
    }
    this.map2.set(npcGroupId, npcGroup);
    if (npcGroup.captorId && npcGroup.phase === NPCPhase.CAPTURED) {

      this.map1.set(npcGroup.captorId, npcGroup);
    }
  }

  deleteByUserId(userId: userId) {
    const npcGroup = this.map1.get(userId);
    if (npcGroup) {
      this.map2.delete(npcGroup.id);
    }
    this.map1.delete(userId);
  }

  deleteByNpcGroupId(npcGroupId: npcGroupId) {
    const npcGroup = this.map2.get(npcGroupId);
    if (npcGroup && npcGroup.captorId && npcGroup.phase === NPCPhase.CAPTURED) {
      // Only remove from map1 if this was the user's CAPTURED group
      const userGroup = this.map1.get(npcGroup.captorId);
      if (userGroup && userGroup.id === npcGroupId) {
        this.map1.delete(npcGroup.captorId);
      }
    }
    this.map2.delete(npcGroupId);
  }

  values(): NPCGroup[] { return Array.from(this.map2.values()); }
  keys(): npcGroupId[] { return Array.from(this.map2.keys()); }
  get size(): number { return this.map2.size; }
  
  // Get cumulative size of all NPCs across all groups
  get cumulativeSize(): number { 
    return this.values().reduce((total, npcGroup) => total + npcGroup.fileNames.length, 0); 
  }
  
  getByUserId(userId: userId): NPCGroup | undefined { return this.map1.get(userId); }
  getByNpcGroupId(npcGroupId: npcGroupId): NPCGroup | undefined { return this.map2.get(npcGroupId); }
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
    walls: null; // Future: room-specific walls
    backgroundType: string; // 'floral' | 'forest' | 'animals' | 'cosmic' etc.
    seed: number; // Seed for consistent pattern generation
    width: number;
    height: number;
    cellSize: number;
    startTime?: number; // When the game started (timestamp)
    duration?: number; // Game duration in milliseconds
}

export interface FinalScores {
    [userId: string]: number;
}

export interface Position {
  x: number;
  y: number;
  z?: number;
}