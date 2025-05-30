"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./db/config");
const types_1 = require("./types");
const auth_1 = __importDefault(require("./routes/auth"));
const game_ticker_1 = require("./game-ticker");
const npc_ops_1 = require("./db/npc-ops");
const npc_ops_2 = require("./db/npc-ops");
const serializers_1 = require("./utils/serializers");
const room_ops_1 = require("./db/room-ops");
const npcService_1 = require("./services/npcService");
// Initialize game ticker
(0, game_ticker_1.getGameTicker)();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"],
    credentials: true,
}));
app.use(express_1.default.json());
// Add auth route
app.use("/api/auth", auth_1.default);
const httpServer = (0, http_1.createServer)(app);
exports.io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:3001"],
        methods: ["GET", "POST"],
        credentials: true,
    },
    transports: ["websocket", "polling"],
});
// Connect to Redis before starting server
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Connect to Redis
        yield (0, config_1.connect)();
        console.log("Redis connection established successfully");
        const PORT = process.env.PORT || 3001;
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
});
// Start the server
startServer();
const usersForSocket = new Map();
exports.io.on("connection", (socket) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("A client connected");
    try {
        // Authenticate socket using token
        const token = socket.handshake.auth.token;
        if (!token) {
            console.log("No token provided, disconnecting");
            socket.disconnect();
            return;
        }
        // Decode user info from token
        const user = JSON.parse(Buffer.from(token, "base64").toString());
        socket.data.lastPosition = user.position;
        // Map this socket to the user
        socket.data.user = user;
        socket.on("current-user-response", (serializedData) => __awaiter(void 0, void 0, void 0, function* () {
            const { user, requestingSocketId } = (0, serializers_1.deserialize)(serializedData);
            let users = usersForSocket.get(requestingSocketId);
            if (!users) {
                return;
            }
            users.set(user.id, user);
            const roomName = socket.data.room;
            const expectedUserCount = yield (0, room_ops_1.getRoomNumUsersInRedis)(roomName);
            // If we've received responses from all users in the room
            if (users.size === expectedUserCount) {
                exports.io.to(requestingSocketId).emit("users-update", (0, serializers_1.serialize)({ users: users }));
                usersForSocket.delete(requestingSocketId);
            }
        }));
        // Join room and broadcast user joined
        socket.on("join-room", (serializedData) => __awaiter(void 0, void 0, void 0, function* () {
            console.log("joining room");
            const { name } = (0, serializers_1.deserialize)(serializedData);
            // Check if room exists in Redis
            socket.join(name);
            socket.data.room = name;
            // add user to map for socket
            usersForSocket.set(socket.id, new Map([[user.id, user]]));
            // Broadcast request to the entire room
            socket.broadcast
                .to(name)
                .emit("request-current-user", (0, serializers_1.serialize)({ requestingSocketId: socket.id }));
            // if after 5 seconds, no response, send to all users
            setTimeout(() => {
                const users = usersForSocket.get(socket.id);
                if (users && users.size > 1) {
                    exports.io.to(socket.id).emit("users-update", (0, serializers_1.serialize)({ users }));
                    usersForSocket.delete(socket.id);
                }
            }, 1000);
            // Send other room state to the joining socket
            try {
                // Get existing NPCs
                const npcsData = yield (0, config_1.getNPCsFromRedis)(name);
                if (npcsData) {
                    socket.emit("npcs-update", (0, serializers_1.serialize)({ npcs: npcsData }));
                }
                // Get existing paths
                const pathsData = yield (0, config_1.getpathsFromRedis)(name);
                if (pathsData) {
                    socket.emit("paths-update", (0, serializers_1.serialize)({ paths: pathsData }));
                }
                // Get existing NPC groups
                const groupsData = yield (0, config_1.getNPCGroupsFromRedis)(name);
                if (groupsData) {
                    socket.emit("npc-groups-update", (0, serializers_1.serialize)({ groups: groupsData }));
                }
            }
            catch (error) {
                console.error("Error sending room state to new user:", error);
            }
            // Broadcast to room that user joined
            socket.broadcast.to(name).emit("user-joined", (0, serializers_1.serialize)({ user }));
        }));
        // Handle capture-npc request
        socket.on("capture-npc", (serializedData) => __awaiter(void 0, void 0, void 0, function* () {
            const { npcId, room, captorId } = (0, serializers_1.deserialize)(serializedData);
            try {
                const npcs = yield (0, config_1.getNPCsFromRedis)(room);
                const npc = npcs.get(npcId);
                const updatedNPC = Object.assign(Object.assign({}, npc), { phase: types_1.NPCPhase.CAPTURED });
                // Only call setPathCompleteInRoom if the NPC is actually in PATH phase
                if (npc.phase === types_1.NPCPhase.path) {
                    yield (0, npcService_1.setPathCompleteInRoom)(room, npc);
                }
                yield (0, npc_ops_2.updateNPCInRoomInRedis)(room, updatedNPC);
                yield (0, npc_ops_1.updateNPCGroupInRoomInRedis)(room, captorId, npcId);
                socket.broadcast.to(room).emit("npc-captured", (0, serializers_1.serialize)({
                    id: captorId,
                    npc: updatedNPC,
                }));
            }
            catch (error) {
                console.error("Error capturing NPC:", error);
            }
        }));
        // Handle path-npc request
        socket.on("path-npc", (serializedData) => __awaiter(void 0, void 0, void 0, function* () {
            const { pathData } = (0, serializers_1.deserialize)(serializedData);
            try {
                const updatedNPC = Object.assign(Object.assign({}, pathData.npc), { phase: types_1.NPCPhase.path });
                yield (0, npc_ops_2.updateNPCInRoomInRedis)(pathData.room, updatedNPC);
                const activepaths = yield (0, config_1.getpathsFromRedis)(pathData.room);
                // if pathData already exists, update it
                const existingPath = activepaths.find((p) => p.npc.id === pathData.npc.id);
                if (existingPath) {
                    activepaths.splice(activepaths.indexOf(existingPath), 1);
                }
                activepaths.push(pathData);
                yield (0, config_1.setPathsInRedis)(pathData.room, activepaths);
                // Only remove from group if there's a captorId (fleeing NPCs don't have groups)
                if (pathData.captorId) {
                    yield (0, config_1.removeNPCFromGroupInRoomInRedis)(pathData.room, pathData.captorId, pathData.npc.id);
                }
                socket.broadcast.to(pathData.room).emit("npc-path", (0, serializers_1.serialize)({
                    pathData,
                }));
            }
            catch (error) {
                console.error("Error pathing NPC:", error);
            }
        }));
        // Handle user position updates
        socket.on("user-updated", (serializedData) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { user } = (0, serializers_1.deserialize)(serializedData);
                socket.data.lastPosition = user.position;
                // Just broadcast to room, don't update Redis
                const room = socket.data.room;
                if (room) {
                    socket.broadcast.to(room).emit("user-updated", (0, serializers_1.serialize)({
                        user,
                    }));
                }
            }
            catch (error) {
                console.error("Error handling user update:", error);
            }
        }));
        // Handle disconnection
        socket.on("disconnect", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const lastPosition = socket.data.lastPosition;
                // Get the socket's room from Redis
                const room = socket.data.room;
                if (room) {
                    console.log("disconnecting");
                    const userId = socket.data.user.id;
                    // set npcs of this user's npc groups to IDLE
                    const npcGroups = yield (0, config_1.getNPCGroupsFromRedis)(room);
                    const npcGroup = npcGroups.get(user.id);
                    if (npcGroup) {
                        const npcs = yield (0, config_1.getNPCsFromRedis)(room);
                        npcGroup.npcIds.forEach((npcId) => __awaiter(void 0, void 0, void 0, function* () {
                            const npc = npcs.get(npcId);
                            const updatedNPC = Object.assign(Object.assign({}, npc), { position: lastPosition, phase: types_1.NPCPhase.IDLE });
                            npcs.set(npcId, updatedNPC);
                        }));
                        yield (0, config_1.setNPCsInRedis)(room, npcs);
                    }
                    // remove the user's npc groups from redis
                    yield (0, config_1.removeNPCGroupInRoomInRedis)(room, user.id);
                    // Handle room users decrement
                    yield (0, config_1.decrementRoomUsersInRedis)(room, socket.id);
                    if (userId) {
                        socket.broadcast
                            .to(room)
                            .emit("user-left", (0, serializers_1.serialize)({ lastPosition: lastPosition, userId }));
                    }
                }
            }
            catch (error) {
                console.error("Error handling disconnect:", error);
            }
        }));
    }
    catch (error) {
        console.error("Socket connection error:", error);
        socket.disconnect();
    }
}));
