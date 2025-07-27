import { io } from "./server";
import { Socket } from "socket.io";
import { ServerToClientEvents, ClientToServerEvents } from "shared/socket-events";
import superjson from "superjson";
import { NPCGroupsBiMap, NPCGroup } from "shared/types";

// Register classes with superjson for proper serialization/deserialization
superjson.registerClass(NPCGroupsBiMap);
superjson.registerClass(NPCGroup);

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
  io.to(room).emit(event, data);
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
        socket.emit(event, data);
        break;
      }
    }
  }
}


export class TypedSocket {
  constructor(private socket: Socket) {}

  // Typed socket.on
  on<K extends keyof ClientToServerEvents>(
    event: K,
    handler: (data: Parameters<ClientToServerEvents[K]>[0]) => void | Promise<void>
  ) {
    (this.socket as any).on(event, handler);
  }

  // Typed emit
  emit<K extends keyof ServerToClientEvents>(
    event: K,
    data: Parameters<ServerToClientEvents[K]>[0]
  ) {
    this.socket.emit(event, data);
  }

  // Typed broadcast
  broadcast<K extends keyof ServerToClientEvents>(
    room: string,
    event: K,
    data: Parameters<ServerToClientEvents[K]>[0]
  ) {
    this.socket.broadcast.to(room).emit(event, data);
  }

  // Pass through other socket methods
  join(room: string) { return this.socket.join(room); }
  disconnect() { return this.socket.disconnect(); }
  get data() { return this.socket.data; }
  get id() { return this.socket.id; }
}