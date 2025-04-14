import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { connect, get, set } from "./db/config";
import { NPC, NPCPhase, throwData } from "./types";
import authRouter from "./routes/auth";

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
  setThrowCompleteInRoom,
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
    console.log("User connected:", user);

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
      io.to(data.name).emit("user-joined", user);
    });

    // Handle room leaving
    socket.on("leave-room", (roomName: string) => {
      socket.leave(roomName);
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

          setTimeout(async () => {
            await setThrowCompleteInRoom(room, throwData.id);
            const updatedActiveThrows = activeThrows.filter(
              (t: throwData) => t.id !== throwData.id
            );
            await setRoomActiveThrows(room, updatedActiveThrows);
          }, throwData.throwDuration);

          callback({ success: true });
        } catch (error) {
          console.error("Error throwing NPC:", error);
          callback({ error: "Failed to throw NPC" });
        }
      }
    );

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log("A client disconnected");
      try {
        // Get all rooms the socket was in
        const rooms = Array.from(socket.rooms);

        for (const room of rooms) {
          if (room !== socket.id) {
            // Skip the socket's own room
            const roomRecord = await get(`room:${room}`);

            if (roomRecord) {
              await set(
                `room:${room}`,
                JSON.stringify({
                  ...JSON.parse(roomRecord),
                  numUsers: { decrement: 1 },
                  lastActive: new Date().toISOString(),
                })
              );
            }
          }
        }
      } catch (error) {
        console.error("Error handling disconnection:", error);
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
