import { Vector3 } from "three";
import { Position } from "three/examples/jsm/Addons.js";

export type Animal = "DOLPHIN" | "WOLF";

export type npcId = string;
export type userId = string;

export interface Direction {
  x: number;
  y: number;
}

export interface UserInfo {
  id: userId;
  animal: Animal;
  room: string;
  position: Vector3;
  direction: Direction;
  npcGroup: NPCGroup;
}

// First, define the NPCPhase enum
export enum NPCPhase {
  IDLE = "IDLE",
  CAPTURED = "CAPTURED",
  path = "path",
}

// Path phases for different types of movement
export enum PathPhase {
  THROWN = "THROWN", // NPCs thrown by players
  FLEEING = "FLEEING", // NPCs fleeing from players
  BOUNCING = "BOUNCING", // NPCs bouncing off each other
  RETURNING = "RETURNING", // NPCs returning to their thrower
}

export type NPC = {
  id: npcId;
  type: string;
  filename: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  direction: {
    x: number;
    y: number;
  };
  phase: NPCPhase;
};

export type pathId = string;
export type roomId = string;
export type pathData = {
  id: pathId;
  room: roomId;
  npc: NPC;
  startPosition: { x: number; y: number };
  direction: { x: number; y: number };
  pathDuration: number;
  velocity: number;
  timestamp: number;
  captorId?: userId;
  pathPhase: PathPhase; // New field to distinguish path types
};

export type NPCGroup = {
  npcIds: Set<npcId>;
  captorId: userId;
  faceNpcId?: npcId; // The NPC that serves as the face of the group for collision detection
};

export interface Member {
  id: string;
  info: UserInfo;
}

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
