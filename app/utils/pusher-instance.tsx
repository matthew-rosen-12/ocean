import Pusher from "pusher-js";

let pusherInstance: Pusher | null = null;

export function getPusherInstance(): Pusher {
  if (!pusherInstance) {
    pusherInstance = new Pusher("0de6906930ddbfcf4c81", {
      cluster: "us2",
      authEndpoint: "/api/auth",
    });
  }
  return pusherInstance;
}
