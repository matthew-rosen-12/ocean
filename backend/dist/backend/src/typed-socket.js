"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypedSocket = void 0;
exports.serialize = serialize;
exports.deserialize = deserialize;
exports.emitToRoom = emitToRoom;
exports.emitToUser = emitToUser;
const server_1 = require("./server");
const superjson_1 = __importDefault(require("superjson"));
const types_1 = require("shared/types");
// Register classes with superjson for proper serialization/deserialization
superjson_1.default.registerClass(types_1.NPCGroupsBiMap);
superjson_1.default.registerClass(types_1.NPCGroup);
// For Redis storage only
function serialize(data) {
    return superjson_1.default.stringify(data);
}
function deserialize(serialized) {
    if (!serialized)
        return null;
    return superjson_1.default.parse(serialized);
}
function emitToRoom(room, event, data) {
    server_1.io.to(room).emit(event, data);
}
function emitToUser(room, userId, event, data) {
    var _a, _b;
    // Get all sockets in the room and find the one belonging to the user
    const sockets = server_1.io.sockets.adapter.rooms.get(room);
    if (sockets) {
        for (const socketId of sockets) {
            const socket = server_1.io.sockets.sockets.get(socketId);
            if (((_b = (_a = socket === null || socket === void 0 ? void 0 : socket.data) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) === userId) {
                socket.emit(event, data);
                break;
            }
        }
    }
}
class TypedSocket {
    constructor(socket) {
        this.socket = socket;
    }
    // Typed socket.on
    on(event, handler) {
        this.socket.on(event, handler);
    }
    // Typed emit
    emit(event, data) {
        this.socket.emit(event, data);
    }
    // Typed broadcast
    broadcast(room, event, data) {
        this.socket.broadcast.to(room).emit(event, data);
    }
    // Pass through other socket methods
    join(room) { return this.socket.join(room); }
    disconnect() { return this.socket.disconnect(); }
    get data() { return this.socket.data; }
    get id() { return this.socket.id; }
}
exports.TypedSocket = TypedSocket;
