
import { Socket } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from "shared/socket-events";
import superjson from "superjson";
import { NPCGroupsBiMap, NPCGroup } from "shared/types";

// Register classes with superjson using explicit identifiers for cross-module compatibility
superjson.registerClass(NPCGroupsBiMap, 'NPCGroupsBiMap');
superjson.registerClass(NPCGroup, 'NPCGroup');

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

  // Typed socket.on with manual deserialization
  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K]
  ): void {
    (this.socket as any).on(event, (serializedData: string) => {
      try {
        const data = deserialize(serializedData);
        handler(data as never);
      } catch (error) {
        console.error(`Error deserializing ${event}:`, error);
      }
    });
  }

  // Typed emit with manual serialization
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