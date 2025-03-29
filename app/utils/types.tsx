import { Vector3 } from "three";

export type Animal = "dolphin" | "wolf";

export interface Direction {
  x: number;
  y: number;
}

export interface UserInfo {
  id: string;
  animal: Animal;
  channel_name: string;
  position: Vector3;
  direction: Direction;
  npcGroup?: NPCGroup;
}

export interface Member {
  id: string;
  info: UserInfo;
}

export type NPC = {
  id: string;
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
};

export type NPCGroup = {
  npcs: NPC[];
  captor?: UserInfo;
};
