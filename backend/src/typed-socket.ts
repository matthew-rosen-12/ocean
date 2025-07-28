import { io } from "./server";
import { Socket } from "socket.io";
import { ServerToClientEvents, ClientToServerEvents } from "shared/socket-events";
import superjson from "superjson";
import { NPCGroupsBiMap, NPCGroup } from "shared/types";

// Register classes with superjson using explicit identifiers for cross-module compatibility
superjson.registerClass(NPCGroupsBiMap, 'NPCGroupsBiMap');
superjson.registerClass(NPCGroup, 'NPCGroup');

// For Redis storage only
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

export function emitToUser<K extends keyof ServerToClientEvents>(
  room: string,
  userId: string,
  event: K,
  data: Parameters<ServerToClientEvents[K]>[0]
) {
  // Get all sockets in the room and find the one belonging to the user
  const sockets = io.sockets.adapter.rooms.get(room);
  if (sockets) {
    for (const socketId of sockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket?.data?.user?.id === userId) {
        socket.emit(event, serialize(data));
        break;
      }
    }
  }
}


export class TypedSocket {
  constructor(private socket: Socket) {}

  // Typed socket.on with manual deserialization
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

  // Typed emit with manual serialization
  emit<K extends keyof ServerToClientEvents>(
    event: K,
    data: Parameters<ServerToClientEvents[K]>[0]
  ) {
    this.socket.emit(event, serialize(data));
  }

  // Typed broadcast with manual serialization
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