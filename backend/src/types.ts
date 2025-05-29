export type Animal = "DOLPHIN" | "WOLF";

export enum NPCPhase {
  IDLE = "IDLE",
  CAPTURED = "CAPTURED",
  path = "path",
}

export interface NPC {
  id: string;
  type: string;
  filename: string;
  position: { x: number; y: number };
  direction: { x: number; y: number };
  phase: NPCPhase;
}

export interface pathData {
  id: string;
  room: string;
  npc: NPC;
  startPosition: { x: number; y: number };
  direction: { x: number; y: number };
  velocity: number;
  pathDuration: number;
  timestamp: number;
  captorId?: userId;
}

export interface UserInfo {
  id: userId;
  animal: Animal;
  room: string;
  position: { x: number; y: number };
  direction: { x: number; y: number };
  npcGroup: NPCGroup;
}

export interface NPCGroup {
  npcIds: Set<npcId>;
  captorId: userId;
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

export type roomId = string;
