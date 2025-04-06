import { Vector3 } from "three";
import { Position } from "three/examples/jsm/Addons.js";

export type Animal = "dolphin" | "wolf";

export type npcId = string;
export type userId = string;

export interface Direction {
  x: number;
  y: number;
}

export interface UserInfo {
  id: userId;
  animal: Animal;
  channel_name: string;
  position: Vector3;
  direction: Direction;
}

// First, define the NPCPhase enum
export enum NPCPhase {
  IDLE = "idle",
  CAPTURED = "captured",
  THROWN = "thrown",
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

export type throwData = {
  channelName: string;
  npc: NPC;
  startPosition: Position;
  direction: Direction;
  throwDuration: number;
  velocity: number;
  timestamp: number;
};

export type NPCGroup = {
  npcs: NPC[];
  captorId: userId;
};

export interface Member {
  id: string;
  info: UserInfo;
}
