
import superjson from "superjson";

import { io, Socket } from "socket.io-client";

import { ServerToClientEvents, ClientToServerEvents } from "shared/socket-events";

// For Redis storage
export function serialize(data: any): string {
  return superjson.stringify(data);
}

export function deserialize(serialized: string): any {
  if (!serialized) return null;
  return superjson.parse(serialized);
}

export class TypedSocket {
  constructor(private socket: Socket) {}

  // Typed socket.on with automatic deserialization
  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K]
  ): void {
    (this.socket as any).on(event, (serializedData: string) => {
      try {
        const data = deserialize(serializedData);
        handler(data);
      } catch (error) {
        console.error(`Error deserializing ${event}:`, error);
      }
    });
  }

  // Typed emit with automatic serialization
  emit<K extends keyof ClientToServerEvents>(
    event: K,
    data: Parameters<ClientToServerEvents[K]>[0]
  ) {
    this.socket.emit(event, serialize(data));
  }


  // Pass through other socket methods
  disconnect() { return this.socket.disconnect(); }
  get id() { return this.socket.id; }
}