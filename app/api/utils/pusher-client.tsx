import Pusher from "pusher";
import { config } from "../lib/config";

let pusherInstance: Pusher | null = null;

export function getPusherInstance(): Pusher {
  if (!pusherInstance) {
    pusherInstance = new Pusher(config.pusher);
  }
  return pusherInstance;
}
