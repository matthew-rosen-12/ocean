import express from "express";
import { createServer, get } from "http";
import { Server } from "socket.io";
import cors from "cors";
import {
  connect,
  decrementRoomUsersInRedis,
  getNPCGroupsFromRedis,
  getNPCsFromRedis,
  getpathsFromRedis,
  removeNPCFromGroupInRoomInRedis,
  removeNPCGroupInRoomInRedis,
  setNPCsInRedis,
  setPathsInRedis,
} from "./db/config";
import { NPC, NPCPhase, pathData, userId, UserInfo, socketId } from "./types";
import authRouter from "./routes/auth";
import { getGameTicker } from "./game-ticker";
import { updateNPCGroupInRoomInRedis } from "./db/npc-ops";
import { updateNPCInRoomInRedis } from "./db/npc-ops";
import { deserialize, serialize } from "./utils/serializers";
import { getRoomNumUsersInRedis } from "./db/room-ops";
import { setPathCompleteInRoom } from "./services/npcService";

// Initialize game ticker
getGameTicker();

const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json());

// Add auth route
app.use("/api/auth", authRouter);

const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Connect to Redis before starting server
const startServer = async () => {
  try {
    // Connect to Redis
    await connect();
    console.log("Redis connection established successfully");

    const PORT = process.env.PORT || 3001;
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();

const usersForSocket = new Map<socketId, Map<userId, UserInfo>>();

io.on("connection", async (socket) => {
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

    socket.on("current-user-response", async (serializedData: string) => {
      const { user, requestingSocketId } = deserialize(serializedData);

      let users = usersForSocket.get(requestingSocketId);
      if (!users) {
        return;
      }
      users.set(user.id, user);

      const roomName = socket.data.room;

      const expectedUserCount = await getRoomNumUsersInRedis(roomName);

      // If we've received responses from all users in the room
      if (users.size === expectedUserCount) {
        io.to(requestingSocketId).emit(
          "users-update",
          serialize({ users: users })
        );
        usersForSocket.delete(requestingSocketId);
      }
    });

    // Join room and broadcast user joined
    socket.on("join-room", async (serializedData: string) => {
      console.log("joining room");
      const { name } = deserialize(serializedData);
      // Check if room exists in Redis

      socket.join(name);
      socket.data.room = name;

      // add user to map for socket
      usersForSocket.set(socket.id, new Map([[user.id, user]]));

      // Broadcast request to the entire room
      socket.broadcast
        .to(name)
        .emit(
          "request-current-user",
          serialize({ requestingSocketId: socket.id })
        );
      // if after 5 seconds, no response, send to all users
      setTimeout(() => {
        const users = usersForSocket.get(socket.id);
        if (users && users.size > 1) {
          io.to(socket.id).emit("users-update", serialize({ users }));
          usersForSocket.delete(socket.id);
        }
      }, 1000);

      // Send other room state to the joining socket
      try {
        // Get existing NPCs
        const npcsData = await getNPCsFromRedis(name);
        if (npcsData) {
          socket.emit("npcs-update", serialize({ npcs: npcsData }));
        }

        // Get existing paths
        const pathsData = await getpathsFromRedis(name);
        if (pathsData) {
          socket.emit("paths-update", serialize({ paths: pathsData }));
        }

        // Get existing NPC groups
        const groupsData = await getNPCGroupsFromRedis(name);
        if (groupsData) {
          socket.emit("npc-groups-update", serialize({ groups: groupsData }));
        }
      } catch (error) {
        console.error("Error sending room state to new user:", error);
      }

      // Broadcast to room that user joined
      socket.broadcast.to(name).emit("user-joined", serialize({ user }));
    });

    // Handle capture-npc request
    socket.on("capture-npc", async (serializedData: string) => {
      const { npcId, room, captorId } = deserialize(serializedData);
      try {
        const npcs = await getNPCsFromRedis(room);
        const npc = npcs.get(npcId)!;

        const updatedNPC: NPC = {
          ...npc,
          phase: NPCPhase.CAPTURED,
        };

        await setPathCompleteInRoom(room, npc);
        await updateNPCInRoomInRedis(room, updatedNPC);
        await updateNPCGroupInRoomInRedis(room, captorId, npcId);

        socket.broadcast.to(room).emit(
          "npc-captured",
          serialize({
            id: captorId,
            npc: updatedNPC,
          })
        );
      } catch (error) {
        console.error("Error capturing NPC:", error);
      }
    });

    // Handle path-npc request
    socket.on("path-npc", async (serializedData: string) => {
      const { pathData } = deserialize(serializedData);
      try {
        const updatedNPC: NPC = {
          ...pathData.npc,
          phase: NPCPhase.path,
        };

        await updateNPCInRoomInRedis(pathData.room, updatedNPC);
        const activepaths = await getpathsFromRedis(pathData.room);
        activepaths.push(pathData);
        await setPathsInRedis(pathData.room, activepaths);

        // Only remove from group if there's a captorId (fleeing NPCs don't have groups)
        if (pathData.captorId) {
          await removeNPCFromGroupInRoomInRedis(
            pathData.room,
            pathData.captorId,
            pathData.npc.id
          );
        }

        socket.broadcast.to(pathData.room).emit(
          "npc-path",
          serialize({
            pathData,
          })
        );
      } catch (error) {
        console.error("Error pathing NPC:", error);
      }
    });

    // Handle user position updates
    socket.on("user-updated", async (serializedData: string) => {
      try {
        const { user } = deserialize(serializedData);
        socket.data.lastPosition = user.position;
        // Just broadcast to room, don't update Redis
        const room = socket.data.room;
        if (room) {
          socket.broadcast.to(room).emit(
            "user-updated",
            serialize({
              user,
            })
          );
        }
      } catch (error) {
        console.error("Error handling user update:", error);
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      try {
        const lastPosition = socket.data.lastPosition;

        // Get the socket's room from Redis
        const room = socket.data.room;
        if (room) {
          console.log("disconnecting");

          const userId = socket.data.user.id;
          // set npcs of this user's npc groups to IDLE
          const npcGroups = await getNPCGroupsFromRedis(room);
          const npcGroup = npcGroups.get(user.id);
          if (npcGroup) {
            const npcs = await getNPCsFromRedis(room);

            npcGroup.npcIds.forEach(async (npcId) => {
              const npc = npcs.get(npcId)!;
              const updatedNPC: NPC = {
                ...npc,
                position: lastPosition,
                phase: NPCPhase.IDLE,
              };
              npcs.set(npcId, updatedNPC);
            });
            await setNPCsInRedis(room, npcs);
          }
          // remove the user's npc groups from redis
          await removeNPCGroupInRoomInRedis(room, user.id);

          // Handle room users decrement
          await decrementRoomUsersInRedis(room, socket.id);

          if (userId) {
            socket.broadcast
              .to(room)
              .emit(
                "user-left",
                serialize({ lastPosition: lastPosition, userId })
              );
          }
        }
      } catch (error) {
        console.error("Error handling disconnect:", error);
      }
    });
  } catch (error) {
    console.error("Socket connection error:", error);
    socket.disconnect();
  }
});
