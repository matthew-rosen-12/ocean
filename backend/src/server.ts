import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import { NPCPhase, NPCGroup } from "shared/types";
import authRouter from "./routes/auth";
import { getGameTicker } from "./game-ticker";
import { decrementRoomUsersInMemory } from "./state/rooms";
import { addUserToRoom, removeUserFromRoom, updateUserInRoom, getAllUsersInRoom } from "./state/users";
import { getTerrainConfig } from "./state/terrain";
import { getpathsfromMemory } from "./state/paths";
import { getNPCGroupsfromMemory, removeNPCGroupInRoomInMemory, setNPCGroupsInMemory } from "./state/npc-groups";
import { setPathsInMemory } from "./state/paths";
import { updateNPCGroupInRoom } from "./services/npc-group-service";
import { TypedSocket } from "./typed-socket";
import { startGameTimer, cleanupGameTimer, getGameStartTime, GAME_DURATION } from "./game-timer";
import { deletePathInRoom } from "./services/path-service";

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

const startServer = async () => {
  try {
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


io.on("connection", async (socket) => {
  const typedSocket = new TypedSocket(socket);

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
    typedSocket.on("join-room", async ({ name }) => {
      console.log("joining room");

      typedSocket.join(name);
      typedSocket.data.room = name;

      // Check if this is the first user in the room (before adding)
      const existingUsers = getAllUsersInRoom(name);
      const isFirstUser = existingUsers.size === 0;

      // Start game timer if this is the first user (before sending room state)
      if (isFirstUser) {
        startGameTimer(name);
      }

      // Send room state to the joining socket BEFORE adding user to room
      try {
        // Send terrain configuration for this room
        const terrainConfig = getTerrainConfig(name);
        typedSocket.emit("terrain-config", { terrainConfig });

        // Send game timing information
        const gameStartTime = getGameStartTime(name);
        if (gameStartTime) {
          typedSocket.emit("game-timer-info", { 
            gameStartTime, 
            gameDuration: GAME_DURATION 
          });
        }

        // Get existing paths
        const pathsData =  getpathsfromMemory(name);
        if (pathsData) {
          typedSocket.emit("all-paths", { paths: pathsData });
        }

        // Get existing NPC groups - send BEFORE users
        const groupsData =  getNPCGroupsfromMemory(name);
        if (groupsData) {
          typedSocket.emit("all-npc-groups", { npcGroups: groupsData });
        }
      } catch (error) {
        console.error("Error sending room state to new user:", error);
      }

      // Add user to server memory for this room AFTER sending NPC groups
      addUserToRoom(name, user);

      // Send all existing users in the room to the joining user
      const allUsers = getAllUsersInRoom(name);
      if (allUsers.size > 1) { // More than just the current user
        typedSocket.emit("all-users", { users: allUsers });
      }

      // Broadcast to room that user joined
      typedSocket.broadcast(name, "user-joined", { user });
    });


    // Handle path-npc request
    typedSocket.on("update-path", async ({ pathData }) => {
      try {        
        // Get the NPC group from memory using the ID
        const npcGroups = getNPCGroupsfromMemory(pathData.room);
        const pathNPCGroup = npcGroups.getByNpcGroupId(pathData.npcGroupId);

        if (pathNPCGroup) {
          updateNPCGroupInRoom(pathData.room, pathNPCGroup);
        }
        
        const activepaths = getpathsfromMemory(pathData.room);
        // if pathData already exists, update it
        const existingPath = activepaths.get(pathData.npcGroupId);
        if (existingPath) {
          console.log(`Replacing existing path for ${pathData.npcGroupId.slice(0,8)}: ${existingPath.pathPhase} -> ${pathData.pathPhase}`);
          activepaths.delete(pathData.npcGroupId);
        }
        activepaths.set(pathData.npcGroupId, pathData);
        setPathsInMemory(pathData.room, activepaths);


        typedSocket.broadcast(pathData.room, "path-update", {
          pathData,
        });
      } catch (error) {
        console.error("Error pathing NPC:", error);
      }
    });

    typedSocket.on("delete-path", async ({ pathData }) => {
        const room = typedSocket.data.room;
        if (room) {
          deletePathInRoom(room, pathData);
        }
      });

    typedSocket.on("update-npc-group", async ({ npcGroup }) => {
      const room = typedSocket.data.room;
      if (room) {
        updateNPCGroupInRoom(room, npcGroup);
      }
    });

    // Handle user position updates
    typedSocket.on("update-user", async ({ user }) => {
      try {
        typedSocket.data.lastPosition = user.position;
        const room = typedSocket.data.room;
        if (room) {
          // Update user in server memory
          updateUserInRoom(room, user);
          // Broadcast update to other users
          typedSocket.broadcast(room, "user-updated", { user });
        }
      } catch (error) {
        console.error("Error handling user update:", error);
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      try {
        const lastPosition = socket.data.lastPosition;

        const room = socket.data.room;
        if (room) {
          console.log("disconnecting");

          const userId = socket.data.user.id;
          // set npcs of this user's npc groups to IDLE
          const npcGroups = getNPCGroupsfromMemory(room);
          const npcGroup = npcGroups.getByUserId(user.id);
          if (npcGroup) {
            const updatedNPCGroup = new NPCGroup({
              ...npcGroup,
                position: lastPosition,
                phase: NPCPhase.IDLE,
              });
            npcGroups.setByNpcGroupId(npcGroup.id, updatedNPCGroup);
            setNPCGroupsInMemory(room, npcGroups);
          }
          // remove the user's npc groups from redis
          removeNPCGroupInRoomInMemory(room, user.id);

          // Remove user from room memory
          removeUserFromRoom(room, user.id);

          // Handle room users decrement
          decrementRoomUsersInMemory(room, socket.id);

          // Check if room is now empty and cleanup game timer
          const remainingUsers = getAllUsersInRoom(room);
          if (remainingUsers.size === 0) {
            cleanupGameTimer(room);
          }

          if (userId) {
            typedSocket.broadcast(room, "user-left", { lastPosition, userId });
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
