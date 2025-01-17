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

import type { Channel } from "pusher-js";

const channels: Map<string, Channel> = new Map();

export function getChannel(channelName: string): Channel {
  const pusher = getPusherInstance();

  // Check if channel already exists
  const existingChannel = channels.get(channelName);
  if (existingChannel) {
    return existingChannel;
  }
  // Create new channel
  const newChannel = pusher.subscribe(channelName);
  channels.set(channelName, newChannel);
  return newChannel;
}
