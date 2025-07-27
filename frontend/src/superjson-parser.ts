import superjson from "superjson";
import { NPCGroupsBiMap, NPCGroup } from "shared/types";

// Register classes with superjson
superjson.registerClass(NPCGroupsBiMap);
superjson.registerClass(NPCGroup);

// Simple EventEmitter implementation for Decoder
class SimpleEmitter {
  private events: { [event: string]: Function[] } = {};

  emit(event: string, ...args: any[]) {
    const handlers = this.events[event] || [];
    handlers.forEach(handler => handler(...args));
  }

  on(event: string, handler: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(handler);
  }
}

class Encoder {
  encode(packet: any) {
    return [superjson.stringify(packet)];
  }
}

class Decoder extends SimpleEmitter {
  add(chunk: string) {
    try {
      const packet = superjson.parse(chunk);
      if (this.isPacketValid(packet)) {
        this.emit("decoded", packet);
      } else {
        throw new Error("invalid packet format");
      }
    } catch (error) {
      throw new Error(`superjson parse error: ${error}`);
    }
  }

  private isPacketValid(packet: any): boolean {
    return (
      typeof packet === "object" &&
      packet !== null &&
      typeof packet.type === "number" &&
      (packet.data === undefined || true) && // data can be anything
      (packet.id === undefined || typeof packet.id === "string" || typeof packet.id === "number") &&
      (packet.nsp === undefined || typeof packet.nsp === "string")
    );
  }

  destroy() {
    // No cleanup needed
  }
}

export const superjsonParser = { Encoder, Decoder };