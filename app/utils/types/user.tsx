import { Vector3 } from "three";

export interface UserInfo {
  id: string;
  animal: string;
  channel_name: string;
  position: Vector3;
  createdAt: Date;
}

export interface Member {
  id: string;
  info: UserInfo;
}
