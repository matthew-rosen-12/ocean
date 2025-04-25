import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import {
  connect,
  get,
  set,
  hgetall,
  del,
  keys,
  addSocketToRoom,
  removeSocketFromRoom,
  getSocketRoom,
  addUserToRoom,
  getRoomUsers,
  addUser,
  removeUser,
  decrementRoomUsers,
  mapSocketToUser,
  getUserIdFromSocket,
  removeSocketUserMapping,
} from "./db/config";
import { NPC, NPCPhase, throwData, userId, UserInfo, socketId } from "./types";
import authRouter from "./routes/auth";
import { getGameTicker } from "./game-ticker";

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

// Connect to Redis
connect().catch(console.error);

// Import services dynamically to avoid circular dependencies
const {
  getNPCsForRoom,
  getRoomActiveThrows,
  getNPCGroupsFromRedis,
  updateNPCInRoom,
  updateNPCGroupInRoom,
  removeNPCFromGroupInRoom,
  setRoomActiveThrows,
} = require("./services/npcService");

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

    // Map this socket to the user
    await mapSocketToUser(socket.id, user.id);

    socket.on(
      "current-user-response",
      async (data: { user: UserInfo; requestingSocketId: string }) => {
        // Add the user to the map for the requesting socket
        let users = usersForSocket.get(data.requestingSocketId);
        if (!users) {
          return;
        }
        users.set(data.user.id, data.user);

        // Get the room this socket is in
        const room = await getSocketRoom(socket.id);
        if (room) {
          // Get all users in the room
          const roomUsers = await getRoomUsers(room);
          const expectedUserCount = Object.keys(roomUsers).length;

          // If we've received responses from all users in the room
          if (users.size === expectedUserCount) {
            io.to(data.requestingSocketId).emit("users-update", {
              users: Array.from(users.entries()),
            });
            usersForSocket.delete(data.requestingSocketId);
          }
        }
      }
    );

    // Join room and broadcast user joined
    socket.on("join-room", async (data: { name: string }) => {
      // Check if room exists in Redis
      const roomExists = await get(`room:${data.name}`);
      if (!roomExists) {
        // Create new room if it doesn't exist
        await set(
          `room:${data.name}`,
          JSON.stringify({
            name: data.name,
            createdAt: new Date().toISOString(),
            users: [],
          })
        );
      }

      socket.join(data.name);
      await addSocketToRoom(socket.id, data.name);

      // Add user data if they're joining for the first time
      await addUser(user.id, user);

      // Add user to the room
      await addUserToRoom(data.name, user.id);

      // add user to map for socket
      usersForSocket.set(socket.id, new Map([[user.id, user]]));

      // Broadcast request to the entire room
      console.log("Broadcasting request for current users to room:", data.name);
      socket.broadcast.to(data.name).emit("request-current-user", socket.id);
      // if after 5 seconds, no response, send to all users
      setTimeout(() => {
        const users = usersForSocket.get(socket.id);
        if (users && users.size > 1) {
          io.to(socket.id).emit("users-update", {
            users: Array.from(users.entries()),
          });
          usersForSocket.delete(socket.id);
        }
      }, 10000);

      // Now add the new user to the room

      // Send other room state to the joining socket
      try {
        // Get existing NPCs
        const npcsData = await get(`npcs:${data.name}`);
        if (npcsData) {
          const npcs = JSON.parse(npcsData);
          socket.emit("npcs-update", Array.from(Object.entries(npcs)));
        }

        // Get existing throws
        const throwsData = await get(`throws:${data.name}`);
        if (throwsData) {
          const throws = JSON.parse(throwsData);
          socket.emit("throws-update", Array.from(Object.entries(throws)));
        }

        // Get existing NPC groups
        const groupsData = await get(`npcGroups:${data.name}`);
        if (groupsData) {
          const groups = JSON.parse(groupsData);
          socket.emit("npc-groups-update", Array.from(Object.entries(groups)));
        }
      } catch (error) {
        console.error("Error sending room state to new user:", error);
      }

      // Broadcast to room that user joined
      socket.broadcast.to(data.name).emit("user-joined", user);
    });

    // Handle get-npcs request
    socket.on("get-npcs", async (data: { room: string }) => {
      console.log("get-npcs before try", data);
      try {
        const npcs = await getNPCsForRoom(data.room);
        console.log("npcs from get-npcs", npcs);
        socket.emit("npcs-data", { npcs: Array.from(npcs.entries()) });
      } catch (error) {
        console.error("Error getting NPCs:", error);
        socket.emit("npcs-data", { npcs: [] });
      }
    });

    // Handle get-throws request
    socket.on("get-throws", async ({ room }) => {
      try {
        const throws = await getRoomActiveThrows(room);
        socket.emit("throws-data", {
          throws: throws.map((throwData: throwData) => [
            throwData.npc.id,
            throwData,
          ]),
        });
      } catch (error) {
        console.error("Error getting throws:", error);
        socket.emit("throws-data", { throws: [] });
      }
    });

    // Handle get-npc-groups request
    socket.on("get-npc-groups", async ({ room }) => {
      try {
        const groups = await getNPCGroupsFromRedis(room);
        socket.emit("npc-groups-data", {
          groups: Array.from(groups.entries()),
        });
      } catch (error) {
        console.error("Error getting NPC groups:", error);
        socket.emit("npc-groups-data", { groups: [] });
      }
    });

    // Handle capture-npc request
    socket.on(
      "capture-npc",
      async (data: { npcId: string; roomName: string; captorId: string }) => {
        try {
          const npcs = await getNPCsForRoom(data.roomName);
          const npc = npcs.get(data.npcId)!;

          const updatedNPC: NPC = {
            ...npc,
            phase: NPCPhase.CAPTURED,
          };

          await updateNPCInRoom(data.roomName, updatedNPC, true);
          await updateNPCGroupInRoom(data.roomName, data.captorId, data.npcId);

          io.to(data.roomName).emit("npc-captured", {
            id: data.captorId,
            npc: updatedNPC,
          });
        } catch (error) {
          console.error("Error capturing NPC:", error);
        }
      }
    );

    // Handle throw-npc request
    socket.on(
      "throw-npc",
      async (data: {
        npcId: string;
        roomName: string;
        throwerId: string;
        direction: { x: number; y: number };
        npc: NPC;
        velocity: number;
      }) => {
        try {
          const updatedNPC: NPC = {
            ...data.npc,
            phase: NPCPhase.THROWN,
          };

          const throwData: throwData = {
            id: uuidv4(),
            room: data.roomName,
            npc: updatedNPC,
            startPosition: data.npc.position,
            direction: data.direction,
            velocity: data.velocity,
            throwDuration: 1000, // 1 second
            timestamp: Date.now(),
            throwerId: data.throwerId,
          };

          await updateNPCInRoom(data.roomName, updatedNPC);
          const activeThrows = await getRoomActiveThrows(data.roomName);
          activeThrows.push(throwData);
          await setRoomActiveThrows(data.roomName, activeThrows);
          await removeNPCFromGroupInRoom(
            data.roomName,
            data.throwerId,
            data.npcId
          );

          io.to(data.roomName).emit("npc-thrown", {
            throw: throwData,
          });
        } catch (error) {
          console.error("Error throwing NPC:", error);
        }
      }
    );

    // Handle user position updates
    socket.on("user-updated", async (data: { updatedUser: UserInfo }) => {
      try {
        // Just broadcast to room, don't update Redis
        const room = await getSocketRoom(socket.id);
        if (room) {
          socket.broadcast.to(room).emit("user-updated", {
            updatedUser: data.updatedUser,
          });
        }
      } catch (error) {
        console.error("Error handling user update:", error);
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      try {
        // Get the socket's room from Redis
        const room = await getSocketRoom(socket.id);
        if (room) {
          // Get userId from socket
          const userId = await getUserIdFromSocket(socket.id);

          // Handle room users decrement (this now checks multiple connections)
          await decrementRoomUsers(room, socket.id);

          // Remove the socket-user mapping
          await removeSocketUserMapping(socket.id);

          // Remove this socket from room
          await removeSocketFromRoom(socket.id);

          // Only broadcast user-left if this was their last connection
          if (userId) {
            socket.broadcast.to(room).emit("user-left", { userId });
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

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
