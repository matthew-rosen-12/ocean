export type Animal = "DOLPHIN" | "WOLF";

export enum NPCPhase {
  IDLE = "IDLE",
  CAPTURED = "CAPTURED",
  THROWN = "THROWN",
}

export interface NPC {
  id: string;
  type: string;
  filename: string;
  position: { x: number; y: number };
  direction: { x: number; y: number };
  phase: NPCPhase;
}

export interface throwData {
  id: string;
  room: string;
  npc: NPC;
  startPosition: { x: number; y: number };
  direction: { x: number; y: number };
  velocity: number;
  throwDuration: number;
  timestamp: number;
  throwerId: string;
}

export interface UserInfo {
  id: string;
  animal: Animal;
  room: string;
  position: { x: number; y: number };
  direction: { x: number; y: number };
  npcGroup: NPCGroup;
}

export interface NPCGroup {
  npcIds: Set<npcId>;
  captorId: string;
}

export type npcId = string;
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
