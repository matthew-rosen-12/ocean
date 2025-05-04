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
  THROWN = "THROWN",
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

export type throwId = string;
export type roomId = string;
export type throwData = {
  room: roomId;
  npc: NPC;
  startPosition: { x: number; y: number };
  direction: { x: number; y: number };
  throwDuration: number;
  velocity: number;
  timestamp: number;
  throwerId: userId;
};

export type NPCGroup = {
  npcIds: Set<npcId>;
  captorId: userId;
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
