import superjson from "superjson";
import { NPCGroupsBiMap, NPCGroup } from "shared/types";
import { EventEmitter } from "events";

// Register classes with superjson using explicit identifiers for cross-module compatibility
superjson.registerClass(NPCGroupsBiMap, 'NPCGroupsBiMap');
superjson.registerClass(NPCGroup, 'NPCGroup');

class Encoder {
  encode(packet: any) {
    return [superjson.stringify(packet)];
  }
}

class Decoder extends EventEmitter {
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