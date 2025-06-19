export type Animal = "DOLPHIN" | "WOLF";

// Path phases for different types of movement
export enum PathPhase {
  THROWN = "THROWN", // NPCs thrown by players
  FLEEING = "FLEEING", // NPCs fleeing from players
  BOUNCING = "BOUNCING", // NPCs bouncing off each other
  RETURNING = "RETURNING", // NPCs returning to their thrower
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
  pathPhase: PathPhase; // New field to distinguish path types
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
        // Copy all entries from existing maps using the public methods
        existing.values().forEach(npcGroup => {
          this.setByNpcGroupId(npcGroup.id, npcGroup);
        });
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
    if (npcGroup.phase === NPCPhase.CAPTURED) {
      this.map1.set(userId, npcGroup);
    }
    this.map2.set(npcGroup.id, npcGroup);
  }

  setByNpcGroupId(npcGroupId: npcGroupId, npcGroup: NPCGroup) {
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
}

export interface Position {
  x: number;
  y: number;
  z?: number;
}