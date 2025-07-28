import superjson from "superjson";
import { NPCGroupsBiMap, NPCGroup } from "shared/types";

// Register classes with superjson
superjson.registerClass(NPCGroupsBiMap);
superjson.registerClass(NPCGroup);

// Browser-compatible EventEmitter
class BrowserEventEmitter {
  private events: { [event: string]: Function[] } = {};

  emit(event: string, ...args: any[]) {
    const handlers = this.events[event] || [];
    handlers.forEach(handler => handler(...args));
    return handlers.length > 0;
  }

  on(event: string, handler: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(handler);
    return this;
  }

  addListener(event: string, handler: Function) {
    return this.on(event, handler);
  }

  removeListener(event: string, handler: Function) {
    if (this.events[event]) {
      const index = this.events[event].indexOf(handler);
      if (index > -1) {
        this.events[event].splice(index, 1);
      }
    }
    return this;
  }

  removeAllListeners(event?: string) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }

  off(event: string, handler: Function) {
    return this.removeListener(event, handler);
  }
}

class Encoder {
  encode(packet: any) {
    return [superjson.stringify(packet)];
  }
}

class Decoder extends BrowserEventEmitter {
  add(chunk: string) {
    try {
      const packet = superjson.parse(chunk);
      if (this.isPacketValid(packet)) {
        this.emit("decoded", packet);
      } else {
        console.error("Invalid packet format:", packet);
        throw new Error("invalid packet format");
      }
    } catch (error) {
      console.error("Superjson parse error:", error, "Chunk:", chunk);
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
    this.removeAllListeners();
  }
}

export const superjsonParser = { Encoder, Decoder };