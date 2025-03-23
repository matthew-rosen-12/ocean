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
  direction?: Direction;
  createdAt: Date;
}

export interface Member {
  id: string;
  info: UserInfo;
}
