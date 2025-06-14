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
}

export enum NPCPhase {
  IDLE = "IDLE",
  CAPTURED = "CAPTURED",
  PATH = "PATH",
}

export type fileName = string;

export type npcGroupId = string;
export interface NPCGroup {
  id: npcGroupId;
  fileNames: fileName[];
  captorId?: userId;
  faceFileName: fileName; // The fileName of the face of the group for collision detection
  position: Position;
  direction: Direction;
  phase: NPCPhase;
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
      // Copy all entries from existing maps using the public methods
      existing.values().forEach(npcGroup => {
        this.setByNpcGroupId(npcGroup.id, npcGroup);
      });
    }
  }

  setByUserId(userId: userId, npcGroup: NPCGroup) {
    this.map1.set(userId, npcGroup);
    this.map2.set(npcGroup.id, npcGroup);
  }

  setByNpcGroupId(npcGroupId: npcGroupId, npcGroup: NPCGroup) {
    this.map2.set(npcGroupId, npcGroup);
    if (npcGroup.captorId) {
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
}