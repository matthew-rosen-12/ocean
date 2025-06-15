import { io } from "../server";

import superjson from "superjson";
import { NPCGroupsBiMap, NPCGroup } from "shared/types";

// Register classes with superjson for proper serialization/deserialization
superjson.registerClass(NPCGroupsBiMap);
superjson.registerClass(NPCGroup);

import { Socket } from "socket.io";
import { ServerToClientEvents, ClientToServerEvents } from "shared/socket-events";

// For Redis storage
export function serialize(data: any): string {
  return superjson.stringify(data);
}

export function deserialize(serialized: string): any {
  if (!serialized) return null;
  return superjson.parse(serialized);
}

export function emitToRoom<K extends keyof ServerToClientEvents>(
  room: string,
  event: K,
  data: Parameters<ServerToClientEvents[K]>[0]
) {
  io.to(room).emit(event, serialize(data));
}

export function emitToSocket<K extends keyof ServerToClientEvents>(
  socketId: string,
  event: K,
  data: Parameters<ServerToClientEvents[K]>[0]
) {
  io.to(socketId).emit(event, serialize(data));
}

export class TypedSocket {
  constructor(private socket: Socket) {}

  // Typed socket.on with automatic deserialization
  on<K extends keyof ClientToServerEvents>(
    event: K,
    handler: (data: Parameters<ClientToServerEvents[K]>[0]) => void | Promise<void>
  ) {
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
  emit<K extends keyof ServerToClientEvents>(
    event: K,
    data: Parameters<ServerToClientEvents[K]>[0]
  ) {
    this.socket.emit(event, serialize(data));
  }

  // Typed broadcast with automatic serialization
  broadcast<K extends keyof ServerToClientEvents>(
    room: string,
    event: K,
    data: Parameters<ServerToClientEvents[K]>[0]
  ) {
    this.socket.broadcast.to(room).emit(event, serialize(data));
  }

  // Pass through other socket methods
  join(room: string) { return this.socket.join(room); }
  disconnect() { return this.socket.disconnect(); }
  get data() { return this.socket.data; }
  get id() { return this.socket.id; }
}