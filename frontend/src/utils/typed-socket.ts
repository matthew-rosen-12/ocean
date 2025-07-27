
import { Socket } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from "shared/socket-events";
import superjson from "superjson";
import { NPCGroupsBiMap, NPCGroup } from "shared/types";

// Register classes with superjson for proper serialization/deserialization
superjson.registerClass(NPCGroupsBiMap);
superjson.registerClass(NPCGroup);

// For Redis storage only
export function serialize(data: unknown): string {
  return superjson.stringify(data);
}

export function deserialize(serialized: string): unknown {
  if (!serialized) return null;
  return superjson.parse(serialized);
}

export class TypedSocket {
  constructor(private socket: Socket) {}

  // Typed socket.on
  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K]
  ): void {
    (this.socket as any).on(event, handler);
  }

  // Typed emit
  emit<K extends keyof ClientToServerEvents>(
    event: K,
    data: Parameters<ClientToServerEvents[K]>[0]
  ) {
    this.socket.emit(event, data);
  }


  // Pass through other socket methods
  disconnect() { return this.socket.disconnect(); }
  get id() { return this.socket.id; }
}