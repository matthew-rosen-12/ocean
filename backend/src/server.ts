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
} from "./db/config";
import { NPC, NPCPhase, throwData } from "./types";
import authRouter from "./routes/auth";
import { getGameTicker } from "./game-ticker";
import { decrementRoomUsers } from "./db/config";

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
      console.log("Room the socket joined", data.name);
      io.to(data.name).emit("user-joined", user);
    });

    // Handle room leaving
    socket.on("leave-room", async (roomName: string) => {
      socket.leave(roomName);
      await removeSocketFromRoom(socket.id);
    });

    // Handle get-npcs request
    socket.on("get-npcs", async ({ room }, callback) => {
      try {
        const npcs = await getNPCsForRoom(room);
        callback(Array.from(npcs.entries()));
      } catch (error) {
        console.error("Error getting NPCs:", error);
        callback([]);
      }
    });

    // Handle get-throws request
    socket.on("get-throws", async ({ room }, callback) => {
      try {
        const throws = await getRoomActiveThrows(room);
        callback(
          throws.map((throwData: throwData) => [throwData.npc.id, throwData])
        );
      } catch (error) {
        console.error("Error getting throws:", error);
        callback([]);
      }
    });

    // Handle get-npc-groups request
    socket.on("get-npc-groups", async ({ room }, callback) => {
      try {
        const groups = await getNPCGroupsFromRedis(room);
        callback(Array.from(groups.entries()));
      } catch (error) {
        console.error("Error getting NPC groups:", error);
        callback([]);
      }
    });

    // Handle capture-npc request
    socket.on("capture-npc", async ({ npcId, room, captorId }, callback) => {
      try {
        const npcs = await getNPCsForRoom(room);
        const npc = npcs.get(npcId)!;

        const updatedNPC: NPC = {
          ...npc,
          phase: NPCPhase.CAPTURED,
        };

        await updateNPCInRoom(room, updatedNPC, true);
        await updateNPCGroupInRoom(room, captorId, npcId);

        io.to(room).emit("npc-captured", {
          id: captorId,
          npc: updatedNPC,
        });

        callback({ success: true });
      } catch (error) {
        console.error("Error capturing NPC:", error);
        callback({ error: "Failed to capture NPC" });
      }
    });

    // Handle throw-npc request
    socket.on(
      "throw-npc",
      async (
        { npcId, room, throwerId, direction, npc, velocity },
        callback
      ) => {
        console.log("server recieved throwing npc", npc);
        try {
          const updatedNPC: NPC = {
            ...npc,
            phase: NPCPhase.THROWN,
          };

          const throwData: throwData = {
            id: uuidv4(),
            room: room,
            npc: updatedNPC,
            startPosition: npc.position,
            direction: direction,
            velocity,
            throwDuration: 1000, // 1 second
            timestamp: Date.now(),
            throwerId,
          };

          await updateNPCInRoom(room, updatedNPC);
          const activeThrows = await getRoomActiveThrows(room);
          activeThrows.push(throwData);
          await setRoomActiveThrows(room, activeThrows);
          await removeNPCFromGroupInRoom(room, throwerId, npcId);

          io.to(room).emit("npc-thrown", {
            throw: throwData,
          });

          callback({ success: true });
        } catch (error) {
          console.error("Error throwing NPC:", error);
          callback({ error: "Failed to throw NPC" });
        }
      }
    );

    // Handle disconnection
    socket.on("disconnect", async () => {
      try {
        // Get the socket's room from Redis
        const room = await getSocketRoom(socket.id);
        if (room) {
          await decrementRoomUsers(room);

          // Clean up NPCs in the room
          const npcsData = await get(`npcs:${room}`);
          if (npcsData) {
            const npcs = JSON.parse(npcsData);
            for (const [id, npcData] of Object.entries(npcs)) {
              await del(`npc:${id}`);
            }
            await del(`npcs:${room}`);
          }

          // Remove socket from room mapping
          await removeSocketFromRoom(socket.id);
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
