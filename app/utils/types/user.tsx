import { Vector3 } from "three";

export interface UserInfo {
  id: string;
  animal: string;
  position: Vector3;
  createdAt: Date;
}
