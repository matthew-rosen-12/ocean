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
const types_1 = require("./types");
const auth_1 = __importDefault(require("./routes/auth"));
const game_ticker_1 = require("./game-ticker");
const serializers_1 = require("./utils/serializers");
const rooms_1 = require("./state/rooms");
const terrain_1 = require("./utils/terrain");
const paths_1 = require("./state/paths");
const npcGroups_1 = require("./state/npcGroups");
const paths_2 = require("./state/paths");
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
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
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
            const expectedUserCount = yield (0, rooms_1.getRoomNumUsersInMemory)(roomName);
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
                // Send terrain configuration for this room
                const terrainConfig = (0, terrain_1.generateRoomTerrain)(name);
                socket.emit("terrain-config", (0, serializers_1.serialize)({ terrainConfig }));
                // Get existing paths
                const pathsData = (0, paths_1.getpathsfromMemory)(name);
                if (pathsData) {
                    socket.emit("paths-update", (0, serializers_1.serialize)({ paths: pathsData }));
                }
                // Get existing NPC groups
                const groupsData = (0, npcGroups_1.getNPCGroupsfromMemory)(name);
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
                const npcGroups = (0, npcGroups_1.getNPCGroupsfromMemory)(room);
                const npcGroup = npcGroups.getByNpcGroupId(npcId);
                const updatedNPCGroup = Object.assign(Object.assign({}, npcGroup), { phase: types_1.NPCPhase.CAPTURED });
                // Only call setPathCompleteInRoom if the NPC is actually in PATH phase
                if (npcGroup.phase === types_1.NPCPhase.PATH) {
                    const paths = (0, paths_1.getpathsfromMemory)(room);
                    paths.delete(npcGroup.id);
                    (0, paths_2.setPathsInMemory)(room, paths);
                }
                (0, npcService_1.updateNPCGroupInRoom)(room, updatedNPCGroup);
                socket.broadcast.to(room).emit("npc-captured", (0, serializers_1.serialize)({
                    id: captorId,
                    npcGroup: updatedNPCGroup,
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
                const updatedNPCGroup = Object.assign(Object.assign({}, pathData.npcGroup), { phase: types_1.NPCPhase.PATH });
                (0, npcService_1.updateNPCGroupInRoom)(pathData.room, updatedNPCGroup);
                const activepaths = (0, paths_1.getpathsfromMemory)(pathData.room);
                // if pathData already exists, update it
                const existingPath = activepaths.get(pathData.npcGroup.id);
                if (existingPath) {
                    activepaths.delete(pathData.npcGroup.id);
                }
                activepaths.set(pathData.npcGroup.id, pathData);
                (0, paths_2.setPathsInMemory)(pathData.room, activepaths);
                // Only remove from group if there's a captorId (fleeing NPCs don't have groups)
                if (pathData.captorId) {
                    (0, npcGroups_1.removeTopNPCFromGroupInRoomInMemory)(pathData.room, pathData.captorId);
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
                const room = socket.data.room;
                if (room) {
                    console.log("disconnecting");
                    const userId = socket.data.user.id;
                    // set npcs of this user's npc groups to IDLE
                    const npcGroups = (0, npcGroups_1.getNPCGroupsfromMemory)(room);
                    const npcGroup = npcGroups.getByUserId(user.id);
                    if (npcGroup) {
                        const updatedNPCGroup = Object.assign(Object.assign({}, npcGroup), { position: lastPosition, phase: types_1.NPCPhase.IDLE });
                        npcGroups.setByNpcGroupId(npcGroup.id, updatedNPCGroup);
                        (0, npcGroups_1.setNPCGroupsInMemory)(room, npcGroups);
                    }
                    // remove the user's npc groups from redis
                    (0, npcGroups_1.removeNPCGroupInRoomInMemory)(room, user.id);
                    // Handle room users decrement
                    (0, rooms_1.decrementRoomUsersInMemory)(room, socket.id);
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
