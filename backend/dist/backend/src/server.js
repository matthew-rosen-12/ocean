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
const types_1 = require("shared/types");
const auth_1 = __importDefault(require("./routes/auth"));
const game_ticker_1 = require("./game-ticker");
const rooms_1 = require("./state/rooms");
const users_1 = require("./state/users");
const terrain_1 = require("./utils/terrain");
const paths_1 = require("./state/paths");
const npcGroups_1 = require("./state/npcGroups");
const paths_2 = require("./state/paths");
const npcService_1 = require("./services/npcService");
const typed_socket_1 = require("./utils/typed-socket");
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
exports.io.on("connection", (socket) => __awaiter(void 0, void 0, void 0, function* () {
    const typedSocket = new typed_socket_1.TypedSocket(socket);
    try {
        // Authenticate socket using token
        const token = socket.handshake.auth.token;
        if (!token) {
            console.log("No token provided, disconnecting");
            typedSocket.disconnect();
            return;
        }
        // Decode user info from token
        const user = JSON.parse(Buffer.from(token, "base64").toString());
        typedSocket.data.lastPosition = user.position;
        // Map this socket to the user
        typedSocket.data.user = user;
        // Join room and broadcast user joined
        typedSocket.on("join-room", (_a) => __awaiter(void 0, [_a], void 0, function* ({ name }) {
            console.log("joining room");
            typedSocket.join(name);
            typedSocket.data.room = name;
            // Add user to server memory for this room
            (0, users_1.addUserToRoom)(name, user);
            // Send all existing users in the room to the joining user
            const existingUsers = (0, users_1.getAllUsersInRoom)(name);
            if (existingUsers.size > 0) {
                typedSocket.emit("all-users", { users: existingUsers });
            }
            // Send other room state to the joining socket
            try {
                // Send terrain configuration for this room
                const terrainConfig = (0, terrain_1.generateRoomTerrain)(name);
                typedSocket.emit("terrain-config", { terrainConfig });
                // Get existing paths
                const pathsData = (0, paths_1.getpathsfromMemory)(name);
                if (pathsData) {
                    typedSocket.emit("all-paths", { paths: pathsData });
                }
                // Get existing NPC groups
                const groupsData = (0, npcGroups_1.getNPCGroupsfromMemory)(name);
                if (groupsData) {
                    typedSocket.emit("all-npc-groups", { npcGroups: groupsData });
                }
            }
            catch (error) {
                console.error("Error sending room state to new user:", error);
            }
            // Broadcast to room that user joined
            typedSocket.broadcast(name, "user-joined", { user });
        }));
        // Handle capture-npc request
        typedSocket.on("capture-npc", (_a) => __awaiter(void 0, [_a], void 0, function* ({ npcId, room, captorId }) {
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
                typedSocket.broadcast(room, "npc-group-captured", {
                    id: captorId,
                    npcGroup: updatedNPCGroup,
                });
            }
            catch (error) {
                console.error("Error capturing NPC:", error);
            }
        }));
        // Handle path-npc request
        typedSocket.on("path-npc", (_a) => __awaiter(void 0, [_a], void 0, function* ({ pathData }) {
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
                if (pathData.npcGroup.captorId) {
                    (0, npcGroups_1.removeTopNPCFromGroupInRoomInMemory)(pathData.room, pathData.npcGroup.captorId);
                }
                typedSocket.broadcast(pathData.room, "path-update", {
                    pathData,
                });
            }
            catch (error) {
                console.error("Error pathing NPC:", error);
            }
        }));
        // Handle user position updates
        typedSocket.on("update-user", (_a) => __awaiter(void 0, [_a], void 0, function* ({ user }) {
            try {
                typedSocket.data.lastPosition = user.position;
                const room = typedSocket.data.room;
                if (room) {
                    // Update user in server memory
                    (0, users_1.updateUserInRoom)(room, user);
                    // Broadcast update to other users
                    typedSocket.broadcast(room, "user-updated", { user });
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
                    // Remove user from room memory
                    (0, users_1.removeUserFromRoom)(room, user.id);
                    // Handle room users decrement
                    (0, rooms_1.decrementRoomUsersInMemory)(room, socket.id);
                    if (userId) {
                        typedSocket.broadcast(room, "user-left", { lastPosition, userId });
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
