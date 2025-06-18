"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypedSocket = void 0;
exports.serialize = serialize;
exports.deserialize = deserialize;
exports.emitToRoom = emitToRoom;
exports.emitToSocket = emitToSocket;
const server_1 = require("./server");
const superjson_1 = __importDefault(require("superjson"));
const types_1 = require("shared/types");
// Register classes with superjson for proper serialization/deserialization
superjson_1.default.registerClass(types_1.NPCGroupsBiMap);
superjson_1.default.registerClass(types_1.NPCGroup);
// For Redis storage
function serialize(data) {
    return superjson_1.default.stringify(data);
}
function deserialize(serialized) {
    if (!serialized)
        return null;
    return superjson_1.default.parse(serialized);
}
function emitToRoom(room, event, data) {
    server_1.io.to(room).emit(event, serialize(data));
}
function emitToSocket(socketId, event, data) {
    server_1.io.to(socketId).emit(event, serialize(data));
}
class TypedSocket {
    constructor(socket) {
        this.socket = socket;
    }
    // Typed socket.on with automatic deserialization
    on(event, handler) {
        this.socket.on(event, (serializedData) => {
            try {
                const data = deserialize(serializedData);
                handler(data);
            }
            catch (error) {
                console.error(`Error deserializing ${event}:`, error);
            }
        });
    }
    // Typed emit with automatic serialization
    emit(event, data) {
        this.socket.emit(event, serialize(data));
    }
    // Typed broadcast with automatic serialization
    broadcast(room, event, data) {
        this.socket.broadcast.to(room).emit(event, serialize(data));
    }
    // Pass through other socket methods
    join(room) { return this.socket.join(room); }
    disconnect() { return this.socket.disconnect(); }
    get data() { return this.socket.data; }
    get id() { return this.socket.id; }
}
exports.TypedSocket = TypedSocket;
